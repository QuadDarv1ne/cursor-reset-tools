import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';

/**
 * Менеджер бэкапов для отката изменений
 */
export class BackupManager {
  constructor(backupDir = null) {
    this.backups = new Map();
    this.backupDir = backupDir;
  }

  /**
   * Создать бэкап файла
   * @param {string} filePath - Путь к файлу
   * @param {string} [operationId] - ID операции для группировки
   * @returns {Promise<string|null>} Путь к бэкапу или null
   */
  async createBackup(filePath, operationId = 'default') {
    try {
      if (!await fs.pathExists(filePath)) {
        logger.debug(`File not found for backup: ${filePath}`, 'backup');
        return null;
      }

      const timestamp = Date.now();
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);

      const backupPath = this.backupDir
        ? path.join(this.backupDir, `${base}.${timestamp}${ext}.bak`)
        : `${filePath}.${timestamp}.bak`;

      await fs.copy(filePath, backupPath);

      // Сохраняем информацию о бэкапе
      if (!this.backups.has(operationId)) {
        this.backups.set(operationId, []);
      }
      this.backups.get(operationId).push({
        original: filePath,
        backup: backupPath,
        timestamp
      });

      logger.info(`Backup created: ${backupPath}`, 'backup');
      return backupPath;
    } catch (error) {
      logger.error(`Backup failed: ${error.message}`, 'backup');
      return null;
    }
  }

  /**
   * Восстановить файл из бэкапа
   * @param {string} filePath - Путь к оригинальному файлу
   * @returns {Promise<boolean>}
   */
  async restore(filePath) {
    try {
      // Ищем бэкап для этого файла
      for (const entry of this.backups.entries()) {
        const backups = entry[1];
        const backupInfo = backups.find(b => b.original === filePath);

        if (backupInfo && await fs.pathExists(backupInfo.backup)) {
          await fs.copy(backupInfo.backup, filePath);
          logger.info(`Restored from backup: ${filePath}`, 'rollback');
          return true;
        }
      }

      logger.warn(`No backup found for: ${filePath}`, 'rollback');
      return false;
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`, 'rollback');
      return false;
    }
  }

  /**
   * Восстановить все файлы из бэкапа по ID операции
   * @param {string} operationId - ID операции
   * @returns {Promise<{restored: number, failed: number}>}
   */
  async rollback(operationId = 'default') {
    const backups = this.backups.get(operationId);
    if (!backups || backups.length === 0) {
      logger.warn(`No backups found for operation: ${operationId}`, 'rollback');
      return { restored: 0, failed: 0 };
    }

    let restored = 0;
    let failed = 0;

    // Восстанавливаем в обратном порядке
    for (const backupInfo of backups.reverse()) {
      try {
        if (await fs.pathExists(backupInfo.backup)) {
          await fs.copy(backupInfo.backup, backupInfo.original);
          logger.info(`Rolled back: ${backupInfo.original}`, 'rollback');
          restored++;
        } else {
          logger.warn(`Backup file not found: ${backupInfo.backup}`, 'rollback');
          failed++;
        }
      } catch (error) {
        logger.error(`Rollback failed for ${backupInfo.original}: ${error.message}`, 'rollback');
        failed++;
      }
    }

    // Очищаем информацию о бэкапах этой операции
    this.backups.delete(operationId);

    return { restored, failed };
  }

  /**
   * Очистить все бэкапы
   * @param {boolean} deleteFiles - Удалить файлы бэкапов
   * @returns {Promise<number>} Количество удалённых файлов
   */
  async clearAll(deleteFiles = false) {
    let deletedCount = 0;

    if (deleteFiles) {
      for (const [, backups] of this.backups.entries()) {
        for (const backupInfo of backups) {
          try {
            await fs.remove(backupInfo.backup);
            deletedCount++;
          } catch (e) {
            // Игнорируем ошибки удаления
          }
        }
      }
    }

    this.backups.clear();
    return deletedCount;
  }

  /**
   * Получить информацию о бэкапах
   * @param {string} [operationId] - ID операции (опционально)
   * @returns {Object}
   */
  getInfo(operationId = null) {
    if (operationId) {
      const backups = this.backups.get(operationId);
      return {
        operationId,
        count: backups ? backups.length : 0,
        backups: backups || []
      };
    }

    const info = {};
    for (const [opId, backups] of this.backups.entries()) {
      info[opId] = {
        count: backups.length,
        files: backups.map(b => ({
          original: b.original,
          backup: b.backup,
          timestamp: new Date(b.timestamp).toISOString()
        }))
      };
    }
    return info;
  }

  /**
   * Создать бэкап с содержимым (для файлов которые ещё не существуют)
   * @param {string} filePath - Путь к файлу
   * @param {string|Buffer} content - Содержимое для бэкапа
   * @param {string} [operationId] - ID операции
   * @returns {Promise<string|null>}
   */
  async createBackupFromContent(filePath, content, operationId = 'default') {
    try {
      const timestamp = Date.now();
      const ext = path.extname(filePath) || '.json';
      const base = path.basename(filePath, ext);

      const backupPath = this.backupDir
        ? path.join(this.backupDir, `${base}.${timestamp}${ext}.bak`)
        : `${filePath}.${timestamp}.bak`;

      await fs.outputFile(backupPath, content);

      if (!this.backups.has(operationId)) {
        this.backups.set(operationId, []);
      }
      this.backups.get(operationId).push({
        original: filePath,
        backup: backupPath,
        timestamp,
        wasCreated: true // Файл был создан для бэкапа
      });

      logger.info(`Content backup created: ${backupPath}`, 'backup');
      return backupPath;
    } catch (error) {
      logger.error(`Content backup failed: ${error.message}`, 'backup');
      return null;
    }
  }
}

// Глобальный экземпляр для приложения
export const globalBackupManager = new BackupManager();
