/**
 * SQLite Optimizer - Утилиты для оптимизации работы с SQLite
 * Пул соединений, автоматическая оптимизация, восстановление
 *
 * @module utils/sqliteOptimizer
 * @example
 * import { sqliteOptimizer } from './utils/sqliteOptimizer.js';
 *
 * // Оптимизация БД
 * await sqliteOptimizer.optimize(db);
 *
 * // Выполнение запроса с retry
 * const result = await sqliteOptimizer.execute(db, query, params);
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { logger } from './logger.js';
import { SQLITE_CONSTANTS } from './constants.js';

/**
 * Класс для оптимизации SQLite
 */
export class SQLiteOptimizer {
  constructor() {
    this.connections = new Map();
    this.queryStats = {
      totalQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      slowQueries: 0
    };
    this._queryTimes = [];
  }

  /**
   * Открытие соединения с оптимизациями
   * @param {string} dbPath - Путь к БД
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<Object>}
   */
  async openConnection(dbPath, options = {}) {
    const cacheKey = dbPath;

    // Проверяем кэш соединений
    if (this.connections.has(cacheKey)) {
      return this.connections.get(cacheKey);
    }

    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
        ...options
      });

      // Применяем оптимизации
      await this._applyOptimizations(db);

      // Сохраняем в кэш (только 1 соединение для SQLite)
      this.connections.set(cacheKey, db);

      logger.debug(`SQLite connection opened: ${dbPath}`, 'sqlite');

      return db;
    } catch (error) {
      logger.error(`Failed to open SQLite connection: ${error.message}`, 'sqlite');
      throw error;
    }
  }

  /**
   * Применение оптимизаций к соединению
   * @private
   */
  async _applyOptimizations(db) {
    try {
      // Журнальный режим для производительности
      await db.exec('PRAGMA journal_mode = WAL');

      // Синхронизация для баланса между безопасностью и скоростью
      await db.exec('PRAGMA synchronous = NORMAL');

      // Кэш страниц
      await db.exec('PRAGMA cache_size = -64000'); // 64MB

      // Ммемори мапленный I/O
      await db.exec('PRAGMA mmap_size = 268435456'); // 256MB

      // Пул соединений
      await db.exec('PRAGMA max_page_count = 1073741823');

      // Busy timeout для предотвращения блокировок
      await db.exec(`PRAGMA busy_timeout = ${SQLITE_CONSTANTS.SQLITE_BUSY_TIMEOUT}`);

      // Foreign keys
      await db.exec('PRAGMA foreign_keys = ON');

      logger.debug('SQLite optimizations applied', 'sqlite');
    } catch (error) {
      logger.warn(`Failed to apply some optimizations: ${error.message}`, 'sqlite');
      // Не критично, продолжаем работу
    }
  }

  /**
   * Выполнение запроса с retry и логированием
   * @param {Object} db - Соединение с БД
   * @param {string} query - SQL запрос
   * @param {Array} params - Параметры
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async execute(db, query, params = [], options = {}) {
    const {
      maxRetries = SQLITE_CONSTANTS.SQLITE_MAX_RETRIES,
      baseDelay = SQLITE_CONSTANTS.SQLITE_RETRY_BASE_DELAY,
      logQuery = false
    } = options;

    const startTime = Date.now();
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (logQuery) {
          logger.debug(`Executing query (attempt ${attempt}): ${query}`, 'sqlite', { params });
        }

        const result = await db.run(query, ...params);

        // Статистика
        const queryTime = Date.now() - startTime;
        this._recordQueryTime(queryTime);

        if (queryTime > 1000) {
          logger.warn(`Slow query detected (${queryTime}ms): ${query.substring(0, 100)}`, 'sqlite');
        }

        return result;
      } catch (error) {
        lastError = error;
        this.queryStats.failedQueries++;

        // Проверяем можно ли повторить запрос
        if (this._isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          logger.debug(`Query failed (retryable), retrying in ${delay}ms: ${error.message}`, 'sqlite');
          await new Promise(resolve => {
            const timer = setTimeout(resolve, delay);
            timer.unref();
          });
        } else {
          logger.error(`Query failed (attempt ${attempt}): ${error.message}`, 'sqlite', {
            query: query.substring(0, 200),
            params: params.length,
            attempt
          });
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Выполнение запроса с получением данных
   * @param {Object} db - Соединение с БД
   * @param {string} query - SQL запрос
   * @param {Array} params - Параметры
   * @returns {Promise<Array>}
   */
  async query(db, query, params = []) {
    const startTime = Date.now();

    try {
      const result = await db.all(query, ...params);

      const queryTime = Date.now() - startTime;
      this._recordQueryTime(queryTime);

      this.queryStats.totalQueries++;

      return result;
    } catch (error) {
      this.queryStats.failedQueries++;
      logger.error(`Query error: ${error.message}`, 'sqlite', {
        query: query.substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Выполнение транзакции
   * @param {Object} db - Соединение с БД
   * @param {Function} callback - Функция транзакции
   * @returns {Promise<any>}
   */
  async transaction(db, callback) {
    try {
      await db.exec('BEGIN TRANSACTION');

      const result = await callback(db);

      await db.exec('COMMIT');

      return result;
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
        logger.info('Transaction rolled back', 'sqlite');
      } catch (rollbackError) {
        logger.error(`Failed to rollback transaction: ${rollbackError.message}`, 'sqlite');
      }

      throw error;
    }
  }

  /**
   * Проверка целостности БД
   * @param {Object} db - Соединение с БД
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async checkIntegrity(db) {
    try {
      const result = await db.all('PRAGMA integrity_check');

      if (result.length === 1 && result[0].integrity_check === 'ok') {
        return { valid: true, errors: [] };
      }

      const errors = result.map(row => row.integrity_check);
      return { valid: false, errors };
    } catch (error) {
      return {
        valid: false,
        errors: [`Integrity check failed: ${error.message}`]
      };
    }
  }

  /**
   * Оптимизация БД (VACUUM, ANALYZE)
   * @param {Object} db - Соединение с БД
   */
  async optimize(db) {
    try {
      logger.info('Starting database optimization...', 'sqlite');

      // Анализ индексов
      await db.exec('ANALYZE');
      logger.debug('ANALYZE completed', 'sqlite');

      // Очистка мусора
      await db.exec('VACUUM');
      logger.debug('VACUUM completed', 'sqlite');

      // Проверка целостности
      const integrity = await this.checkIntegrity(db);
      if (!integrity.valid) {
        logger.warn(`Database integrity issues: ${integrity.errors.join(', ')}`, 'sqlite');
      }

      logger.info('Database optimization completed', 'sqlite');
    } catch (error) {
      logger.error(`Optimization failed: ${error.message}`, 'sqlite');
    }
  }

  /**
   * Создание индексов для Cursor-specific таблиц
   * @param {Object} db - Соединение с БД
   */
  async createCursorIndexes(db) {
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_key_prefix ON ItemTable(key)',
        'CREATE INDEX IF NOT EXISTS idx_cursor_keys ON ItemTable(key) WHERE key LIKE \'%cursor%\'',
        'CREATE INDEX IF NOT EXISTS idx_telemetry_keys ON ItemTable(key) WHERE key LIKE \'%telemetry%\'',
        'CREATE INDEX IF NOT EXISTS idx_usage_keys ON ItemTable(key) WHERE key LIKE \'%usage%\''
      ];

      for (const index of indexes) {
        await db.exec(index);
      }

      logger.debug('Cursor-specific indexes created/verified', 'sqlite');
    } catch (error) {
      logger.warn(`Failed to create indexes: ${error.message}`, 'sqlite');
    }
  }

  /**
   * Закрытие соединения
   * @param {string} dbPath - Путь к БД
   */
  async closeConnection(dbPath) {
    const db = this.connections.get(dbPath);
    if (db) {
      try {
        await db.close();
        this.connections.delete(dbPath);
        logger.debug(`SQLite connection closed: ${dbPath}`, 'sqlite');
      } catch (error) {
        logger.error(`Failed to close connection: ${error.message}`, 'sqlite');
      }
    }
  }

  /**
   * Закрытие всех соединений
   */
  async closeAll() {
    const closePromises = Array.from(this.connections.keys()).map(dbPath =>
      this.closeConnection(dbPath)
    );

    await Promise.allSettled(closePromises);
    logger.info('All SQLite connections closed', 'sqlite');
  }

  /**
   * Проверка является ли ошибка retryable
   * @private
   */
  _isRetryableError(error) {
    const retryableCodes = [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'SQLITE_IOERR'
    ];

    return retryableCodes.includes(error.code) ||
      error.message.includes('database is locked') ||
      error.message.includes('database is busy');
  }

  /**
   * Запись времени запроса для статистики
   * @private
   */
  _recordQueryTime(time) {
    this._queryTimes.push(time);

    // Храним только последние 100 запросов
    if (this._queryTimes.length > 100) {
      this._queryTimes.shift();
    }

    // Пересчет среднего времени
    this.queryStats.avgQueryTime =
      this._queryTimes.reduce((sum, t) => sum + t, 0) / this._queryTimes.length;

    // Подсчет медленных запросов (>1 секунды)
    if (time > 1000) {
      this.queryStats.slowQueries++;
    }
  }

  /**
   * Получение статистики
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.queryStats,
      activeConnections: this.connections.size
    };
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    this.queryStats = {
      totalQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      slowQueries: 0
    };
    this._queryTimes = [];
  }
}

// Глобальный экземпляр
export const globalSQLiteOptimizer = new SQLiteOptimizer();

export default SQLiteOptimizer;
