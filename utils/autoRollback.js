/**
 * Auto Rollback Manager - Автоматическое восстановление при ошибках
 * Расширенная система отката изменений с валидацией и логированием
 */

import fs from 'fs-extra';
import crypto from 'crypto';
import { logger } from './logger.js';
import { globalBackupManager } from './rollback.js';

/**
 * Класс для управления автоматическим откатом операций
 */
export class AutoRollbackManager {
  constructor(options = {}) {
    this.backupManager = globalBackupManager;
    this.operationStack = new Map(); // Стек операций
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 секунда
    this.validationEnabled = options.validationEnabled !== false;
    this.autoRollbackEnabled = options.autoRollbackEnabled !== false;
    this.hashAlgorithm = 'sha256';
    this.maxOperations = 100; // Лимит для предотвращения утечки памяти
  }

  /**
   * Вычислить хэш файла
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<string|null>}
   */
  async computeFileHash(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return null;
      }
      const content = await fs.readFile(filePath);
      return crypto.createHash(this.hashAlgorithm).update(content).digest('hex');
    } catch (error) {
      logger.error(`Hash computation failed for ${filePath}: ${error.message}`, 'autoRollback');
      return null;
    }
  }

  /**
   * Начать новую операцию с отслеживанием
   * @param {string} operationId - Уникальный ID операции
   * @param {Object} metadata - Метаданные операции
   * @returns {OperationContext}
   */
  beginOperation(operationId, metadata = {}) {
    const context = new OperationContext(operationId, this);
    context.metadata = {
      ...metadata,
      startTime: Date.now(),
      filesModified: [],
      hashesBefore: new Map()
    };

    // Очистка старых операций при превышении лимита
    if (this.operationStack.size >= this.maxOperations) {
      const oldestKey = this.operationStack.keys().next().value;
      this.operationStack.delete(oldestKey);
      logger.warn(`Operation stack limit reached, removed oldest: ${oldestKey}`, 'autoRollback');
    }

    this.operationStack.set(operationId, context);
    logger.info(`Operation started: ${operationId}`, 'autoRollback');
    return context;
  }

  /**
   * Завершить операцию успешно
   * @param {string} operationId - ID операции
   * @param {Object} result - Результат операции
   * @returns {Object}
   */
  async commitOperation(operationId, result = {}) {
    const context = this.operationStack.get(operationId);
    if (!context) {
      logger.warn(`Operation context not found: ${operationId}`, 'autoRollback');
      return { success: false, error: 'Operation context not found' };
    }

    // Валидация после изменения
    if (this.validationEnabled) {
      const validation = await this.validateOperation(context);
      if (!validation.valid) {
        logger.error(`Post-operation validation failed: ${validation.errors.join(', ')}`, 'autoRollback');
        if (this.autoRollbackEnabled) {
          await this.rollbackOperation(operationId);
        }
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
          rolledBack: this.autoRollbackEnabled
        };
      }
    }

    // Очистка контекста
    this.operationStack.delete(operationId);
    logger.info(`Operation committed: ${operationId}`, 'autoRollback');

    return {
      success: true,
      ...result,
      duration: Date.now() - context.metadata.startTime
    };
  }

  /**
   * Откатить операцию при ошибке
   * @param {string} operationId - ID операции
   * @param {Error} error - Ошибка, вызвавшая откат
   * @returns {Promise<Object>}
   */
  async rollbackOperation(operationId, error = null) {
    const context = this.operationStack.get(operationId);
    if (!context) {
      logger.warn(`Operation context not found for rollback: ${operationId}`, 'autoRollback');
      return { restored: 0, failed: 0 };
    }

    logger.error(`Rolling back operation ${operationId}: ${error?.message || 'Unknown error'}`, 'autoRollback');

    const rollbackResult = await this.backupManager.rollback(operationId);

    // Восстановление хэшей
    const hashRestores = [];
    for (const [filePath, originalHash] of context.metadata.hashesBefore.entries()) {
      const currentHash = await this.computeFileHash(filePath);
      if (currentHash !== originalHash) {
        hashRestores.push({ file: filePath, expected: originalHash, actual: currentHash });
      }
    }

    // Очистка контекста
    this.operationStack.delete(operationId);

    const result = {
      restored: rollbackResult.restored,
      failed: rollbackResult.failed,
      hashMismatches: hashRestores.length,
      hashDetails: hashRestores,
      error: error?.message
    };

    logger.info(`Rollback completed: ${JSON.stringify(result)}`, 'autoRollback');
    return result;
  }

  /**
   * Выполнить операцию с автоматическим откатом при ошибке
   * @param {string} operationId - ID операции
   * @param {Function} operationFn - Функция операции
   * @param {Object} options - Опции выполнения
   * @returns {Promise<Object>}
   */
  async executeWithAutoRollback(operationId, operationFn, options = {}) {
    const context = this.beginOperation(operationId, options.metadata);
    const maxAttempts = options.retries || this.maxRetries;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`Executing operation ${operationId} (attempt ${attempt}/${maxAttempts})`, 'autoRollback');

        // Предоперационная валидация
        if (this.validationEnabled && options.validateBefore) {
          const preValidation = await this.validateFiles(options.validateBefore.files);
          if (!preValidation.valid) {
            throw new Error(`Pre-validation failed: ${preValidation.errors.join(', ')}`);
          }
        }

        // Создание бэкапов перед модификацией
        if (options.filesToBackup && options.filesToBackup.length > 0) {
          await this.createBackups(options.filesToBackup, operationId);
        }

        // Выполнение операции
        const result = await operationFn(context);

        // Фиксация операции
        return await this.commitOperation(operationId, result);

      } catch (error) {
        logger.error(`Attempt ${attempt} failed: ${error.message}`, 'autoRollback');

        if (attempt === maxAttempts) {
          // Последняя попытка неудачна - откат
          const rollbackResult = await this.rollbackOperation(operationId, error);
          return {
            success: false,
            error: error.message,
            attempts: maxAttempts,
            ...rollbackResult
          };
        }

        // Экспоненциальная задержка перед следующей попыткой
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`, 'autoRollback');
        await this.sleep(delay);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Создать бэкапы файлов
   * @param {Array<string>} files - Список файлов
   * @param {string} operationId - ID операции
   * @returns {Promise<Array>}
   */
  async createBackups(files, operationId) {
    const backupResults = await Promise.allSettled(
      files.map(async file => {
        if (!await fs.pathExists(file)) {
          logger.debug(`File not found for backup: ${file}`, 'autoRollback');
          return { file, backup: null, exists: false };
        }

        // Сохранение хэша до модификации
        const hash = await this.computeFileHash(file);
        const context = this.operationStack.get(operationId);
        if (context) {
          context.metadata.hashesBefore.set(file, hash);
        }

        const backupPath = await this.backupManager.createBackup(file, operationId);
        return { file, backup: backupPath, exists: true, hash };
      })
    );

    const results = backupResults.map((result, index) => ({
      file: files[index],
      success: result.status === 'fulfilled',
      ...result.value,
      error: result.status === 'rejected' ? result.reason?.message : null
    }));

    logger.info(`Created ${results.filter(r => r.backup).length} backups`, 'autoRollback');
    return results;
  }

  /**
   * Валидировать файлы после операции
   * @param {OperationContext} context - Контекст операции
   * @returns {Promise<Object>}
   */
  async validateOperation(context) {
    const errors = [];
    const filesToValidate = context.metadata.filesModified;

    if (!filesToValidate || filesToValidate.length === 0) {
      return { valid: true, errors: [] };
    }

    for (const file of filesToValidate) {
      try {
        if (!await fs.pathExists(file)) {
          errors.push(`File missing after operation: ${file}`);
          continue;
        }

        const stats = await fs.stat(file);
        if (stats.size === 0) {
          errors.push(`File is empty after operation: ${file}`);
        }

        // Проверка на валидный JSON если файл JSON
        if (file.endsWith('.json')) {
          const content = await fs.readFile(file, 'utf8');
          try {
            JSON.parse(content);
          } catch (e) {
            errors.push(`Invalid JSON in ${file}: ${e.message}`);
          }
        }
      } catch (e) {
        errors.push(`Validation error for ${file}: ${e.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Валидировать файлы перед операцией
   * @param {Array<string>} files - Список файлов для валидации
   * @returns {Promise<Object>}
   */
  async validateFiles(files) {
    const errors = [];
    const warnings = [];

    for (const file of files) {
      try {
        if (!await fs.pathExists(file)) {
          warnings.push(`File does not exist: ${file}`);
          continue;
        }

        const stats = await fs.stat(file);
        if (!stats.isFile()) {
          errors.push(`Path is not a file: ${file}`);
          continue;
        }

        // Проверка прав доступа
        try {
          await fs.access(file, fs.constants.R_OK | fs.constants.W_OK);
        } catch (e) {
          errors.push(`No read/write permissions for ${file}`);
        }

        // Проверка размера
        if (stats.size === 0) {
          warnings.push(`File is empty: ${file}`);
        }

        // Проверка хэша (если нужно)
        const hash = await this.computeFileHash(file);
        if (!hash) {
          warnings.push(`Could not compute hash for ${file}`);
        }

      } catch (e) {
        errors.push(`Validation failed for ${file}: ${e.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Получить статус операции
   * @param {string} operationId - ID операции
   * @returns {Object}
   */
  getOperationStatus(operationId) {
    const context = this.operationStack.get(operationId);
    if (!context) {
      return { exists: false };
    }

    return {
      exists: true,
      operationId,
      startTime: context.metadata.startTime,
      duration: Date.now() - context.metadata.startTime,
      filesModified: context.metadata.filesModified.length,
      backupsCreated: context.metadata.backups?.length || 0,
      hashesBefore: context.metadata.hashesBefore.size
    };
  }

  /**
   * Получить все активные операции
   * @returns {Array<Object>}
   */
  getActiveOperations() {
    const operations = [];
    for (const [id] of this.operationStack.entries()) {
      operations.push(this.getOperationStatus(id));
    }
    return operations;
  }

  /**
   * Утилита: задержка
   * @param {number} ms - Миллисекунды
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Очистить все операции
   * @param {boolean} deleteBackups - Удалить бэкапы
   * @returns {Promise<number>}
   */
  async clearAll(deleteBackups = false) {
    const count = this.operationStack.size;
    this.operationStack.clear();

    if (deleteBackups) {
      return this.backupManager.clearAll(true);
    }

    return count;
  }
}

/**
 * Контекст операции - отслеживает изменения в рамках одной операции
 */
class OperationContext {
  constructor(operationId, manager) {
    this.operationId = operationId;
    this.manager = manager;
    this.metadata = {
      startTime: Date.now(),
      filesModified: [],
      backups: [],
      hashesBefore: new Map()
    };
  }

  /**
   * Добавить файл к отслеживаемым
   * @param {string} filePath - Путь к файлу
   */
  trackFile(filePath) {
    if (!this.metadata.filesModified.includes(filePath)) {
      this.metadata.filesModified.push(filePath);
    }
  }

  /**
   * Отметить файл как изменённый
   * @param {string} filePath - Путь к файлу
   */
  markAsModified(filePath) {
    this.trackFile(filePath);
    logger.debug(`File marked as modified: ${filePath}`, 'autoRollback');
  }

  /**
   * Получить хэш файла до изменений
   * @param {string} filePath - Путь к файлу
   * @returns {string|null}
   */
  getOriginalHash(filePath) {
    return this.metadata.hashesBefore.get(filePath) || null;
  }
}

// Глобальный экземпляр
export const globalAutoRollbackManager = new AutoRollbackManager({
  maxRetries: 3,
  baseDelay: 1000,
  validationEnabled: true,
  autoRollbackEnabled: true
});

// Экспорт для совместимости
export { OperationContext };
