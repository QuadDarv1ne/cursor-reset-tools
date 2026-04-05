/**
 * Circuit Breaker - Защита от каскадных сбоев
 * Реализует паттерн Circuit Breaker с экспоненциальной задержкой и jitter
 *
 * @module utils/circuitBreaker
 */

import { createLogger } from './logger.js';
import { appConfig } from './appConfig.js';

const logger = createLogger({ level: appConfig.logging.level });

// ============================================
// Константы и конфигурация
// ============================================

const DEFAULT_CONFIG = {
  // Порог ошибок до открытия цепи
  failureThreshold: 5,
  
  // Порог успеха для закрытия цепи (в half-open состоянии)
  successThreshold: 3,
  
  // Время ожидания перед попыткой восстановления (мс)
  recoveryTimeout: 30000,
  
  // Таймаут выполнения операции (мс)
  timeout: 10000,
  
  // Базовая задержка для retry (мс)
  retryBaseDelay: 1000,
  
  // Максимальная задержка retry (мс)
  retryMaxDelay: 60000,
  
  // Множитель экспоненциальной задержки
  retryMultiplier: 2,
  
  // Jitter для предотвращения thundering herd
  jitterFactor: 0.1,
  
  // Максимальное количество retry
  maxRetries: 3,
  
  // Включить мониторинг
  monitoring: true
};

// ============================================
// Состояния Circuit Breaker
// ============================================

const CircuitState = {
  CLOSED: 'closed',       // Нормальное состояние, запросы выполняются
  OPEN: 'open',           // Цепь разомкнута, запросы блокируются
  HALF_OPEN: 'half_open'  // Проверка восстановления
};

// ============================================
// Статистика Circuit Breaker
// ============================================

class CircuitStats {
  constructor() {
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.rejectedCalls = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.stateChanges = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }

  recordSuccess() {
    this.totalCalls++;
    this.successfulCalls++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;
  }

  recordFailure() {
    this.totalCalls++;
    this.failedCalls++;
    this.lastFailureTime = Date.now();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;
  }

  recordRejection() {
    this.totalCalls++;
    this.rejectedCalls++;
  }

  get failureRate() {
    if (this.totalCalls === 0) return 0;
    return (this.failedCalls / this.totalCalls) * 100;
  }

  get successRate() {
    if (this.totalCalls === 0) return 0;
    return (this.successfulCalls / this.totalCalls) * 100;
  }

  reset() {
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.rejectedCalls = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
}

// ============================================
// Circuit Breaker Class
// ============================================

export class CircuitBreaker {
  /**
   * @param {string} name - Имя circuit breaker
   * @param {Object} config - Конфигурация
   */
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    this.stats = new CircuitStats();
    this.nextAttempt = null;
    this.lastStateChange = Date.now();
    this._onStateChange = null;
    this._logger = logger;

    this._logger.debug(`CircuitBreaker created: ${name}`, 'circuit-breaker');
  }

  /**
   * Выполнение операции с защитой circuit breaker
   * @param {Function} operation - Асинхронная операция
   * @param {Object} options - Опции выполнения
   * @returns {Promise<any>}
   */
  async execute(operation, options = {}) {
    const {
      enableRetry = true,
      maxRetries = this.config.maxRetries,
      fallback = null,
      timeout = this.config.timeout
    } = options;

    // Проверка состояния цепи
    if (!this._canExecute()) {
      this.stats.recordRejection();
      this._logger.warn(
        `CircuitBreaker [${this.name}] request rejected (state: ${this.state})`,
        'circuit-breaker'
      );

      if (fallback) {
        return typeof fallback === 'function' ? fallback() : fallback;
      }

      throw new CircuitBreakerOpenError(
        `Circuit breaker is open for ${this.name}`,
        this.nextAttempt
      );
    }

    let lastError = null;
    let attempt = 0;

    // Выполнение с retry если включено
    while (attempt <= maxRetries && enableRetry) {
      attempt++;
      
      try {
        // Выполнение операции с таймаутом
        const result = await this._executeWithTimeout(operation, timeout);
        
        // Запись успеха
        this._recordSuccess();
        return result;
      } catch (error) {
        lastError = error;
        this._recordFailure();

        // Если это последняя попытка или retry отключён
        if (attempt > maxRetries || !enableRetry) {
          break;
        }

        // Экспоненциальная задержка с jitter
        const delay = this._calculateRetryDelay(attempt);
        this._logger.debug(
          `CircuitBreaker [${this.name}] retry ${attempt}/${maxRetries} after ${delay}ms`,
          'circuit-breaker'
        );
        await this._sleep(delay);
      }
    }

    // Если есть fallback и все попытки провалились
    if (lastError && fallback) {
      this._logger.warn(
        `CircuitBreaker [${this.name}] using fallback after ${attempt} failures`,
        'circuit-breaker'
      );
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    throw lastError || new Error(`Operation failed for ${this.name}`);
  }

  /**
   * Проверка можно ли выполнить запрос
   * @returns {boolean}
   */
  _canExecute() {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Проверка истекло ли время ожидания
      if (this.nextAttempt && Date.now() >= this.nextAttempt) {
        this._changeState(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    // HALF_OPEN - разрешаем один запрос для проверки
    return true;
  }

  /**
   * Выполнение операции с таймаутом
   * @param {Function} operation
   * @param {number} timeout
   * @returns {Promise<any>}
   */
  async _executeWithTimeout(operation, timeout) {
    return Promise.race([
      operation(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Расчёт задержки retry с экспоненциальным ростом и jitter
   * @param {number} attempt
   * @returns {number}
   */
  _calculateRetryDelay(attempt) {
    const { retryBaseDelay, retryMaxDelay, retryMultiplier, jitterFactor } = this.config;
    
    // Экспоненциальная задержка
    let delay = retryBaseDelay * Math.pow(retryMultiplier, attempt - 1);
    
    // Ограничение максимум
    delay = Math.min(delay, retryMaxDelay);
    
    // Добавление jitter для предотвращения thundering herd
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay += jitter;
    
    return Math.max(0, Math.round(delay));
  }

  /**
   * Запись успеха
   */
  _recordSuccess() {
    this.stats.recordSuccess();

    if (this.state === CircuitState.HALF_OPEN) {
      // Проверка достаточно ли успехов для закрытия цепи
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this._changeState(CircuitState.CLOSED);
        this._logger.info(
          `CircuitBreaker [${this.name}] CLOSED after ${this.stats.consecutiveSuccesses} successes`,
          'circuit-breaker'
        );
      }
    }
  }

  /**
   * Запись ошибки
   */
  _recordFailure() {
    this.stats.recordFailure();

    if (this.state === CircuitState.CLOSED) {
      // Проверка достигнут ли порог ошибок
      if (this.stats.consecutiveFailures >= this.config.failureThreshold) {
        this._tripCircuit();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Любой сбой в half-open сразу размыкает цепь
      this._tripCircuit();
    }
  }

  /**
   * Размыкание цепи
   */
  _tripCircuit() {
    this._changeState(CircuitState.OPEN);
    this.nextAttempt = Date.now() + this.config.recoveryTimeout;
    
    this._logger.warn(
      `CircuitBreaker [${this.name}] TRIPPED! Next attempt in ${this.config.recoveryTimeout}ms`,
      'circuit-breaker'
    );
  }

  /**
   * Изменение состояния
   * @param {string} newState
   */
  _changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.stats.stateChanges++;

    if (this._onStateChange) {
      this._onStateChange(oldState, newState, this.stats);
    }
  }

  /**
   * Ручной сброс circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.stats.reset();
    this.nextAttempt = null;
    this._changeState(CircuitState.CLOSED);
    
    this._logger.info(`CircuitBreaker [${this.name}] manually reset`, 'circuit-breaker');
  }

  /**
   * Ручное размыкание цепи
   * @param {number} timeout - Время до следующей попытки (мс)
   */
  trip(timeout = null) {
    if (timeout) {
      this.config.recoveryTimeout = timeout;
    }
    this._tripCircuit();
  }

  /**
   * Получение статуса circuit breaker
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      stats: {
        totalCalls: this.stats.totalCalls,
        successfulCalls: this.stats.successfulCalls,
        failedCalls: this.stats.failedCalls,
        rejectedCalls: this.stats.rejectedCalls,
        failureRate: this.stats.failureRate.toFixed(2),
        successRate: this.stats.successRate.toFixed(2),
        consecutiveFailures: this.stats.consecutiveFailures,
        consecutiveSuccesses: this.stats.consecutiveSuccesses,
        stateChanges: this.stats.stateChanges,
        lastFailureTime: this.stats.lastFailureTime,
        lastSuccessTime: this.stats.lastSuccessTime
      },
      config: {
        failureThreshold: this.config.failureThreshold,
        successThreshold: this.config.successThreshold,
        recoveryTimeout: this.config.recoveryTimeout,
        maxRetries: this.config.maxRetries
      },
      nextAttempt: this.nextAttempt,
      timeUntilNextAttempt: this.nextAttempt ? Math.max(0, this.nextAttempt - Date.now()) : null,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * Callback при изменении состояния
   * @param {Function} callback
   */
  onStateChange(callback) {
    this._onStateChange = callback;
  }

  /**
   * Утилиты для сна
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Circuit Breaker Manager
// ============================================

export class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.globalStats = {
      totalBreakers: 0,
      openBreakers: 0,
      totalCalls: 0,
      totalFailures: 0
    };
  }

  /**
   * Создание нового circuit breaker
   * @param {string} name
   * @param {Object} config
   * @returns {CircuitBreaker}
   */
  create(name, config = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const breaker = new CircuitBreaker(name, config);
    this.breakers.set(name, breaker);
    this.globalStats.totalBreakers++;

    // Отслеживание изменений состояния
    breaker.onStateChange((oldState, newState) => {
      this._updateGlobalStats();
      
      if (newState === CircuitState.OPEN) {
        logger.error(`CircuitBreaker opened: ${name}`, 'circuit-breaker-manager');
      } else if (newState === CircuitState.CLOSED) {
        logger.info(`CircuitBreaker closed: ${name}`, 'circuit-breaker-manager');
      }
    });

    return breaker;
  }

  /**
   * Получение circuit breaker по имени
   * @param {string} name
   * @returns {CircuitBreaker|null}
   */
  get(name) {
    return this.breakers.get(name) || null;
  }

  /**
   * Удаление circuit breaker
   * @param {string} name
   * @returns {boolean}
   */
  remove(name) {
    const existed = this.breakers.delete(name);
    if (existed) {
      this.globalStats.totalBreakers--;
    }
    return existed;
  }

  /**
   * Сброс всех circuit breakers
   */
  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
    this._updateGlobalStats();
  }

  /**
   * Получение статуса всех circuit breakers
   * @returns {Object}
   */
  getAllStatus() {
    const statuses = {};
    this.breakers.forEach((breaker, name) => {
      statuses[name] = breaker.getStatus();
    });

    this._updateGlobalStats();

    return {
      global: this.globalStats,
      breakers: statuses
    };
  }

  /**
   * Получение статусов только разомкнутых цепей
   * @returns {Array}
   */
  getOpenBreakers() {
    const open = [];
    this.breakers.forEach((breaker, name) => {
      if (breaker.state === CircuitState.OPEN) {
        open.push({ name, status: breaker.getStatus() });
      }
    });
    return open;
  }

  /**
   * Обновление глобальной статистики
   */
  _updateGlobalStats() {
    let openCount = 0;
    let totalCalls = 0;
    let totalFailures = 0;

    this.breakers.forEach(breaker => {
      if (breaker.state === CircuitState.OPEN) openCount++;
      totalCalls += breaker.stats.totalCalls;
      totalFailures += breaker.stats.failedCalls;
    });

    this.globalStats.openBreakers = openCount;
    this.globalStats.totalCalls = totalCalls;
    this.globalStats.totalFailures = totalFailures;
  }

  /**
   * Инициализация стандартных circuit breakers для приложения
   */
  initDefaults() {
    // API вызовы
    this.create('api:ip-check', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      timeout: 10000,
      maxRetries: 2
    });

    // Proxy проверки
    this.create('proxy:check', {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      timeout: 15000,
      maxRetries: 2
    });

    // DNS операции
    this.create('dns:operations', {
      failureThreshold: 3,
      recoveryTimeout: 45000,
      timeout: 10000,
      maxRetries: 2
    });

    // VPN операции
    this.create('vpn:operations', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      timeout: 20000,
      maxRetries: 1
    });

    // Файловые операции
    this.create('file:operations', {
      failureThreshold: 5,
      recoveryTimeout: 15000,
      timeout: 10000,
      maxRetries: 3
    });

    // База данных
    this.create('database:operations', {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      timeout: 15000,
      maxRetries: 2
    });

    // Email сервисы
    this.create('email:service', {
      failureThreshold: 3,
      recoveryTimeout: 120000,
      timeout: 30000,
      maxRetries: 2
    });

    // Обновления
    this.create('updater:service', {
      failureThreshold: 2,
      recoveryTimeout: 300000, // 5 минут
      timeout: 30000,
      maxRetries: 1
    });

    logger.info('Default circuit breakers initialized', 'circuit-breaker-manager');
  }
}

// ============================================
// Custom Errors
// ============================================

export class CircuitBreakerOpenError extends Error {
  constructor(message, nextAttempt = null) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.nextAttempt = nextAttempt;
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================
// Синглтон
// ============================================

export const globalCircuitBreakerManager = new CircuitBreakerManager();
export default globalCircuitBreakerManager;
