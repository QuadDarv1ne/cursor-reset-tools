/**
 * Config Backup - Экспорт/импорт настроек в JSON
 * Бэкап конфигурации всех менеджеров и настроек приложения
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

/**
 * Класс для управления бэкапами конфигурации
 */
export class ConfigBackupManager {
  constructor() {
    this.backupDir = BACKUP_DIR;
    this.maxBackups = 10;
  }

  /**
   * Инициализация менеджера бэкапов
   */
  async init() {
    await fs.ensureDir(this.backupDir);
    logger.info('Config Backup Manager initialized', 'backup');
  }

  /**
   * Экспорт текущей конфигурации в JSON
   * @param {string} filePath - Путь для сохранения (опционально)
   * @returns {Promise<object>} Экспортированная конфигурация
   */
  async export(filePath) {
    try {
      const config = await this._collectConfig();
      const withChecksum = this._attachChecksum(config);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultPath = path.join(this.backupDir, `config-backup-${timestamp}.json`);
      const targetPath = filePath || defaultPath;

      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeJson(targetPath, withChecksum, { spaces: 2 });

      logger.info(`Config exported to ${targetPath}`, 'backup');
      return { success: true, path: targetPath, config: withChecksum };
    } catch (error) {
      logger.error(`Export failed: ${error.message}`, 'backup');
      return { success: false, error: error.message };
    }
  }

  /**
   * Импорт конфигурации из JSON
   * @param {string} filePath - Путь к файлу конфигурации
   * @returns {Promise<object>} Результат импорта
   */
  async import(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const config = await fs.readJson(filePath);
      this._verifyChecksumIfPresent(config);
      await this._validateConfig(config);
      await this._applyConfig(config);

      logger.info(`Config imported from ${filePath}`, 'backup');
      return { success: true, config };
    } catch (error) {
      logger.error(`Import failed: ${error.message}`, 'backup');
      return { success: false, error: error.message };
    }
  }

  /**
   * Preview импорта: показывает, что изменится (без применения)
   * @param {string} filePath
   */
  async previewImport(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const incoming = await fs.readJson(filePath);
      this._verifyChecksumIfPresent(incoming);
      await this._validateConfig(incoming);

      const current = this._attachChecksum(await this._collectConfig());
      const changes = this._diffObjects(current, incoming);
      const diff = { changed: changes.length, changes };

      return { success: true, current, incoming, diff };
    } catch (error) {
      logger.error(`Preview import failed: ${error.message}`, 'backup');
      return { success: false, error: error.message };
    }
  }

  /**
   * Создание автоматического бэкапа
   * @returns {Promise<object>} Результат бэкапа
   */
  async autoBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `auto-backup-${timestamp}.json`);
    return this.export(backupPath);
  }

  /**
   * Создать бэкап (алиас для autoBackup, используется в app.js)
   * @returns {Promise<object>} Результат бэкапа
   */
  async createBackup() {
    return this.autoBackup();
  }

  /**
   * Получение списка доступных бэкапов
   * @returns {Promise<Array>} Список файлов бэкапов
   */
  async listBackups() {
    try {
      if (!await fs.pathExists(this.backupDir)) {
        return [];
      }

      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          const config = await fs.readJson(filePath);
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            version: config.version || 'unknown',
            platforms: config.platforms || []
          });
        }
      }

      return backups.sort((a, b) => b.modifiedAt - a.modifiedAt);
    } catch (error) {
      logger.error(`List backups failed: ${error.message}`, 'backup');
      return [];
    }
  }

  /**
   * Удаление старого бэкапа
   * @param {string} filename - Имя файла для удаления
   * @returns {Promise<boolean>} Результат удаления
   */
  async deleteBackup(filename) {
    try {
      const filePath = path.join(this.backupDir, filename);
      await fs.remove(filePath);
      logger.info(`Backup deleted: ${filename}`, 'backup');
      return true;
    } catch (error) {
      logger.error(`Delete backup failed: ${error.message}`, 'backup');
      return false;
    }
  }

  /**
   * Очистка старых бэкапов (оставляем maxBackups)
   * @returns {Promise<number>} Количество удалённых файлов
   */
  async cleanup() {
    const backups = await this.listBackups();
    let deleted = 0;

    if (backups.length > this.maxBackups) {
      for (let i = this.maxBackups; i < backups.length; i++) {
        await this.deleteBackup(backups[i].filename);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Сбор текущей конфигурации
   * @private
   */
  async _collectConfig() {
    const config = {
      version: '2.6.0',
      timestamp: new Date().toISOString(),
      platform: process.platform,
      settings: {},
      managers: {}
    };

    // Сбор настроек прокси
    try {
      const { globalProxyDatabase } = await import('./proxyDatabase.js');
      config.managers.proxy = {
        enabled: globalProxyDatabase?.enabled || false,
        autoRotate: globalProxyDatabase?.autoRotate || false,
        rotateInterval: globalProxyDatabase?.rotateInterval || 300000
      };
    } catch {
      config.managers.proxy = { enabled: false };
    }

    // Сбор настроек уведомлений
    try {
      const { NotificationManager } = await import('./notificationManager.js');
      const nm = new NotificationManager();
      config.managers.notifications = {
        enabled: nm.config?.enabled || false,
        telegram: nm.config?.telegram?.enabled || false,
        discord: nm.config?.discord?.enabled || false
      };
    } catch {
      config.managers.notifications = { enabled: false };
    }

    // Сбор настроек DNS
    try {
      const { globalDNSManager } = await import('./dnsManager.js');
      config.managers.dns = {
        enabled: globalDNSManager?.enabled || false,
        provider: globalDNSManager?.currentProvider || 'cloudflare',
        autoSwitch: globalDNSManager?.autoSwitch || false
      };
    } catch {
      config.managers.dns = { enabled: false };
    }

    // Сбор настроек DoH
    try {
      const { globalDoHManager } = await import('./dohManager.js');
      config.managers.doh = {
        enabled: globalDoHManager?.enabled || false,
        provider: globalDoHManager?.currentProvider || 'cloudflare'
      };
    } catch {
      config.managers.doh = { enabled: false };
    }

    // Сбор настроек VPN
    try {
      const { globalVPNManager } = await import('./vpnManager.js');
      config.managers.vpn = {
        enabled: globalVPNManager?.enabled || false,
        killSwitch: globalVPNManager?.killSwitch || false,
        preferredProtocol: globalVPNManager?.preferredProtocol || 'wireguard'
      };
    } catch {
      config.managers.vpn = { enabled: false };
    }

    // Сбор настроек SmartBypass
    try {
      const { globalSmartBypassManager } = await import('./smartBypassManager.js');
      config.managers.smartBypass = {
        enabled: globalSmartBypassManager?.enabled || false,
        methods: globalSmartBypassManager?.methods || []
      };
    } catch {
      config.managers.smartBypass = { enabled: false };
    }

    // Пользовательские настройки
    try {
      if (await fs.pathExists(CONFIG_FILE)) {
        config.settings = await fs.readJson(CONFIG_FILE);
      }
    } catch {
      config.settings = {};
    }

    config.platforms = ['win32', 'darwin', 'linux', 'freebsd'];

    return config;
  }

  _attachChecksum(config) {
    const base = this._stripChecksum(config);
    const serialized = JSON.stringify(base);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    return {
      ...base,
      checksum: {
        algo: 'sha256',
        value: checksum
      }
    };
  }

  _stripChecksum(config) {
    if (!config || typeof config !== 'object') {
      return config;
    }
    // shallow remove checksum field
    // eslint-disable-next-line no-unused-vars
    const { checksum, ...rest } = config;
    return rest;
  }

  _verifyChecksumIfPresent(config) {
    if (!config?.checksum?.value) {
      return true;
    }
    if (config.checksum.algo !== 'sha256') {
      throw new Error(`Unsupported checksum algo: ${config.checksum.algo}`);
    }
    const base = this._stripChecksum(config);
    const serialized = JSON.stringify(base);
    const expected = crypto.createHash('sha256').update(serialized).digest('hex');
    if (expected !== config.checksum.value) {
      throw new Error('Checksum mismatch');
    }
    return true;
  }

  _diffObjects(a, b, basePath = '') {
    const changes = [];
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

    const keys = new Set([
      ...Object.keys(isObj(a) ? a : {}),
      ...Object.keys(isObj(b) ? b : {})
    ]);

    for (const key of keys) {
      const pathKey = basePath ? `${basePath}.${key}` : key;
      const va = a?.[key];
      const vb = b?.[key];

      if (isObj(va) && isObj(vb)) {
        changes.push(...this._diffObjects(va, vb, pathKey));
        continue;
      }

      const same = JSON.stringify(va) === JSON.stringify(vb);
      if (!same) {
        changes.push({
          path: pathKey,
          from: va === undefined ? null : va,
          to: vb === undefined ? null : vb
        });
      }
    }

    return changes;
  }

  /**
   * Валидация конфигурации
   * @private
   */
  async _validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid config format');
    }
    if (!config.version) {
      throw new Error('Config version is required');
    }
    if (!config.managers || typeof config.managers !== 'object') {
      throw new Error('Managers config is required');
    }
    return true;
  }

  /**
   * Применение конфигурации
   * @private
   */
  async _applyConfig(config) {
    // Сохранение общей конфигурации
    if (config.settings && Object.keys(config.settings).length > 0) {
      await fs.ensureDir(path.dirname(CONFIG_FILE));
      await fs.writeJson(CONFIG_FILE, config.settings, { spaces: 2 });
    }

    // Применение настроек менеджеров будет выполнено при следующем старте
    logger.info('Config will be applied on next application start', 'backup');
  }

  /**
   * Получение статистики бэкапов
   * @returns {Promise<object>} Статистика
   */
  async getStats() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1] : null,
      newestBackup: backups.length > 0 ? backups[0] : null,
      maxBackups: this.maxBackups
    };
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    logger.info('Config Backup stats reset', 'backup');
  }

  /**
   * Остановка менеджера (для graceful shutdown)
   */
  stop() {
    logger.info('Config Backup Manager stopped', 'backup');
    return true;
  }
}

// Глобальный экземпляр
export const globalConfigBackup = new ConfigBackupManager();
