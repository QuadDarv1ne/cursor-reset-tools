/**
 * Metrics Manager - Сбор метрик использования
 * Опциональный сбор статистики с согласия пользователя
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';
import { appConfig } from './appConfig.js';

const METRICS_FILE = path.join(process.cwd(), 'data', 'metrics.json');

/**
 * Конфигурация метрик из appConfig
 */
export const METRICS_CONFIG = {
  enabled: appConfig.monitoring.metricsEnabled,
  interval: appConfig.monitoring.metricsInterval,
  maxEntries: appConfig.monitoring.historyLimit
};

/**
 * Класс для управления метриками
 */
export class MetricsManager {
  constructor() {
    this.metrics = {
      enabled: false,
      entries: [],
      lastCleanup: Date.now()
    };
    this.metricsPath = METRICS_FILE;
  }

  /**
   * Инициализация метрик
   */
  async init() {
    logger.info('Initializing Metrics Manager...', 'metrics');

    try {
      await fs.ensureDir(path.dirname(this.metricsPath));

      if (await fs.pathExists(this.metricsPath)) {
        this.metrics = await fs.readJson(this.metricsPath);
      } else {
        await this.save();
      }

      logger.info('Metrics Manager initialized', 'metrics');
    } catch (error) {
      logger.error(`Metrics init failed: ${error.message}`, 'metrics');
    }

    return this;
  }

  /**
   * Включение/выключение сбора метрик
   * @param {boolean} enabled
   */
  async setEnabled(enabled) {
    this.metrics.enabled = enabled;
    await this.save();
    logger.info(`Metrics ${enabled ? 'enabled' : 'disabled'}`, 'metrics');
  }

  /**
   * Проверка включены ли метрики
   * @returns {boolean}
   */
  isEnabled() {
    return this.metrics.enabled === true;
  }

  /**
   * Запись события
   * @param {string} event - Тип события
   * @param {Object} data - Данные события
   */
  async track(event, data = {}) {
    if (!this.isEnabled()) {
      return;
    }

    const entry = {
      timestamp: Date.now(),
      event,
      data
    };

    this.metrics.entries.push(entry);

    // Очистка старых записей
    if (this.metrics.entries.length > METRICS_CONFIG.maxEntries) {
      this.metrics.entries = this.metrics.entries.slice(-METRICS_CONFIG.maxEntries);
    }

    await this.save();
  }

  /**
   * Получение статистики
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7d = now - (7 * 24 * 60 * 60 * 1000);
    const last30d = now - (30 * 24 * 60 * 60 * 1000);

    const events = {};

    this.metrics.entries.forEach(entry => {
      events[entry.event] = (events[entry.event] || 0) + 1;
    });

    return {
      enabled: this.metrics.enabled,
      totalEntries: this.metrics.entries.length,
      last24h: this.metrics.entries.filter(e => e.timestamp > last24h).length,
      last7d: this.metrics.entries.filter(e => e.timestamp > last7d).length,
      last30d: this.metrics.entries.filter(e => e.timestamp > last30d).length,
      events
    };
  }

  /**
   * Очистка метрик
   */
  async clear() {
    this.metrics.entries = [];
    this.metrics.lastCleanup = Date.now();
    await this.save();
    logger.info('Metrics cleared', 'metrics');
  }

  /**
   * Экспорт метрик
   * @returns {Object}
   */
  async export() {
    return {
      enabled: this.metrics.enabled,
      entries: this.metrics.entries,
      stats: this.getStats()
    };
  }

  /**
   * Сохранение метрик
   */
  async save() {
    try {
      await fs.writeJson(this.metricsPath, this.metrics, { spaces: 2 });
    } catch (error) {
      logger.error(`Metrics save failed: ${error.message}`, 'metrics');
    }
  }

  /**
   * Получение статуса
   * @returns {Object}
   */
  getStatus() {
    return {
      enabled: this.metrics.enabled,
      totalEntries: this.metrics.entries.length,
      lastCleanup: this.metrics.lastCleanup,
      stats: this.getStats()
    };
  }

  /**
   * Остановка менеджера (для graceful shutdown)
   */
  stopMetrics() {
    this.metrics.enabled = false;
    logger.info('Metrics Manager stopped', 'metrics');
    return true;
  }
}

// Глобальный экземпляр
export const globalMetricsManager = new MetricsManager();

export default MetricsManager;
