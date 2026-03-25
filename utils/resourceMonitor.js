/**
 * Resource Monitor - Мониторинг ресурсов системы (CPU, RAM, Disk)
 * Кроссплатформенная поддержка: Windows, macOS, Linux, FreeBSD
 */

import os from 'os';
import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';

const STATS_FILE = path.join(process.cwd(), 'data', 'resource-stats.json');

/**
 * Конфигурация мониторинга ресурсов
 */
export const RESOURCE_CONFIG = {
  sampleInterval: 5000, // 5 секунд между замерами
  historyLimit: 100, // Максимум 100 записей в истории
  alerts: {
    cpuThreshold: 80, // %
    memoryThreshold: 85, // %
    diskThreshold: 90 // %
  }
};

/**
 * Класс для мониторинга ресурсов
 */
export class ResourceMonitor {
  constructor() {
    this.currentStats = {
      cpu: 0,
      memory: {
        total: 0,
        free: 0,
        used: 0,
        percent: 0
      },
      disk: {
        total: 0,
        free: 0,
        used: 0,
        percent: 0
      },
      uptime: 0,
      load: []
    };
    this.history = [];
    this.alerts = [];
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.lastSample = null;
    this.saveCounter = 0;
    this.lastSaveTime = 0;
  }

  /**
   * Инициализация мониторинга
   */
  async init() {
    logger.info('Initializing Resource Monitor...', 'resource');

    try {
      await fs.ensureDir(path.dirname(STATS_FILE));

      if (await fs.pathExists(STATS_FILE)) {
        const data = await fs.readJson(STATS_FILE);
        this.history = data.history || [];
        this.alerts = data.alerts || [];
      }

      // Первичный замер
      await this.sample();

      logger.info('Resource Monitor initialized', 'resource');
    } catch (error) {
      logger.error(`Resource init failed: ${error.message}`, 'resource');
    }

    return this;
  }

  /**
   * Сделать замер ресурсов (с оптимизированным сохранением)
   */
  async sample() {
    const timestamp = Date.now();

    try {
      // CPU usage
      const cpuUsage = await this._getCpuUsage();

      // Memory usage
      const memoryUsage = this._getMemoryUsage();

      // Disk usage
      const diskUsage = await this._getDiskUsage();

      // System uptime
      const uptime = os.uptime();

      // Load average
      const load = os.loadavg();

      this.currentStats = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        uptime,
        load,
        timestamp
      };

      this.lastSample = timestamp;

      // Добавление в историю
      this.history.push({ ...this.currentStats });

      // Ограничение истории
      if (this.history.length > RESOURCE_CONFIG.historyLimit) {
        this.history.shift();
      }

      // Проверка порогов и алерты
      this._checkAlerts();

      // Сохранение только каждые 10 семплов (раз в 50 секунд при интервале 5с)
      // или при наличии новых алертов
      const shouldSave = this.alerts.length > 0 &&
        (this.alerts[this.alerts.length - 1]?.timestamp || 0) > (this.lastSaveTime || 0);

      if (shouldSave || !this.saveCounter) {
        this.saveCounter = 0;
      }

      this.saveCounter = (this.saveCounter || 0) + 1;

      if (this.saveCounter % 10 === 0 || shouldSave) {
        await this._save();
        this.lastSaveTime = timestamp;
      }

      return this.currentStats;
    } catch (error) {
      logger.error(`Sample error: ${error.message}`, 'resource');
      return this.currentStats;
    }
  }

  /**
   * Получить использование CPU (кроссплатформенно)
   */
  async _getCpuUsage() {
    return new Promise(resolve => {
      const startMeasure = os.cpus().map(cpu => cpu.times);

      setTimeout(() => {
        const endMeasure = os.cpus().map(cpu => cpu.times);

        let totalIdle = 0;
        let totalTick = 0;

        for (let i = 0; i < startMeasure.length; i++) {
          const start = startMeasure[i];
          const end = endMeasure[i];

          const idle = end.idle - start.idle;
          const total = (end.user - start.user) +
                       (end.nice - start.nice) +
                       (end.sys - start.sys) +
                       (end.irq - start.irq) +
                       (end.softirq - start.softirq) +
                       idle;

          totalIdle += idle;
          totalTick += total;
        }

        const usage = ((totalTick - totalIdle) / totalTick) * 100;
        resolve(Math.round(usage * 100) / 100);
      }, RESOURCE_CONFIG.sampleInterval / 2);
    });
  }

  /**
   * Получить использование памяти
   */
  _getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percent = Math.round((used / total) * 100 * 100) / 100;

    return {
      total,
      free,
      used,
      percent
    };
  }

  /**
   * Получить использование диска (для основной партиции)
   */
  async _getDiskUsage() {
    try {
      // Кроссплатформенный способ через fs.statfs
      const platform = os.platform();
      const mountPoint = platform === 'win32' ? 'C:\\' : '/';

      try {
        const stats = await fs.statfs(mountPoint);
        const total = stats.bsize * stats.blocks;
        const free = stats.bsize * stats.bfree;
        const used = total - free;
        const percent = Math.round((used / total) * 100 * 100) / 100;

        return { total, free, used, percent };
      } catch (err) {
        // Fallback: оценка через process.cwd()
        const cwdStats = await fs.statfs(process.cwd());
        const total = cwdStats.bsize * cwdStats.blocks;
        const free = cwdStats.bsize * cwdStats.bfree;
        const used = total - free;
        const percent = Math.round((used / total) * 100 * 100) / 100;

        return { total, free, used, percent };
      }
    } catch (error) {
      logger.error(`Disk usage error: ${error.message}`, 'resource');
      return { total: 0, free: 0, used: 0, percent: 0 };
    }
  }

  /**
   * Проверка порогов и генерация алертов
   */
  _checkAlerts() {
    const { cpuThreshold, memoryThreshold, diskThreshold } = RESOURCE_CONFIG.alerts;
    const alerts = [];

    if (this.currentStats.cpu > cpuThreshold) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `Высокое использование CPU: ${this.currentStats.cpu}%`,
        threshold: cpuThreshold,
        value: this.currentStats.cpu,
        timestamp: Date.now()
      });
    }

    if (this.currentStats.memory.percent > memoryThreshold) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Высокое использование RAM: ${this.currentStats.memory.percent}%`,
        threshold: memoryThreshold,
        value: this.currentStats.memory.percent,
        timestamp: Date.now()
      });
    }

    if (this.currentStats.disk.percent > diskThreshold) {
      alerts.push({
        type: 'disk',
        severity: 'error',
        message: `Критическое заполнение диска: ${this.currentStats.disk.percent}%`,
        threshold: diskThreshold,
        value: this.currentStats.disk.percent,
        timestamp: Date.now()
      });
    }

    // Добавление новых алертов
    if (alerts.length > 0) {
      this.alerts.push(...alerts);
      // Ограничение истории алертов
      if (this.alerts.length > 50) {
        this.alerts.shift();
      }

      alerts.forEach(alert => {
        logger.warn(alert.message, 'resource');
      });
    }
  }

  /**
   * Запустить непрерывный мониторинг
   */
  startMonitoring(interval = RESOURCE_CONFIG.sampleInterval) {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.sample().catch(err => {
        logger.error(`Monitor error: ${err.message}`, 'resource');
      });
    }, interval);

    logger.info(`Resource monitoring started (interval: ${interval}ms)`, 'resource');
  }

  /**
   * Остановить мониторинг
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Resource monitoring stopped', 'resource');
  }

  /**
   * Получить текущую статистику
   */
  getCurrentStats() {
    return {
      ...this.currentStats,
      lastSample: this.lastSample,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Получить историю
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Получить алерты
   */
  getAlerts(limit = 10) {
    return this.alerts.slice(-limit);
  }

  /**
   * Очистить алерты
   */
  clearAlerts() {
    this.alerts = [];
    logger.info('Alerts cleared', 'resource');
  }

  /**
   * Получить сводную статистику
   */
  getSummary() {
    if (this.history.length === 0) {
      return {
        cpu: { avg: 0, min: 0, max: 0, current: 0 },
        memory: { avg: 0, min: 0, max: 0, current: 0 },
        disk: { avg: 0, min: 0, max: 0, current: 0 },
        samples: 0
      };
    }

    const cpuValues = this.history.map(h => h.cpu);
    const memValues = this.history.map(h => h.memory.percent);
    const diskValues = this.history.map(h => h.disk.percent);

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = arr => Math.min(...arr);
    const max = arr => Math.max(...arr);

    return {
      cpu: {
        avg: Math.round(avg(cpuValues) * 100) / 100,
        min: min(cpuValues),
        max: max(cpuValues),
        current: this.currentStats.cpu
      },
      memory: {
        avg: Math.round(avg(memValues) * 100) / 100,
        min: min(memValues),
        max: max(memValues),
        current: this.currentStats.memory.percent
      },
      disk: {
        avg: Math.round(avg(diskValues) * 100) / 100,
        min: min(diskValues),
        max: max(diskValues),
        current: this.currentStats.disk.percent
      },
      samples: this.history.length,
      uptime: this.currentStats.uptime,
      load: this.currentStats.load
    };
  }

  /**
   * Сохранение статистики
   */
  async _save() {
    try {
      await fs.writeJson(STATS_FILE, {
        history: this.history,
        alerts: this.alerts
      }, { spaces: 2 });
    } catch (error) {
      logger.error(`Resource save failed: ${error.message}`, 'resource');
    }
  }

  /**
   * Экспорт данных
   */
  async export() {
    return {
      current: this.currentStats,
      summary: this.getSummary(),
      history: this.history,
      alerts: this.alerts,
      config: RESOURCE_CONFIG
    };
  }
}

// Глобальный экземпляр
export const globalResourceMonitor = new ResourceMonitor();

export default ResourceMonitor;
