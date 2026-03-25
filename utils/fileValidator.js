/**
 * File Validator - Валидация файлов перед модификацией
 * Проверка целостности, хэшей, прав доступа и совместимости
 */

import fs from 'fs-extra';
import crypto from 'crypto';
import path from 'path';
import { logger } from './logger.js';

/**
 * Менеджер валидации файлов
 */
export class FileValidator {
  constructor(options = {}) {
    this.hashAlgorithm = options.hashAlgorithm || 'sha256';
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB
    this.checkPermissions = options.checkPermissions !== false;
    this.validateJSON = options.validateJSON !== false;
    this.knownHashes = new Map(); // Кэш известных хэшей
  }

  /**
   * Вычислить хэш файла
   * @param {string} filePath - Путь к файлу
   * @param {string} [algorithm] - Алгоритм хэширования
   * @returns {Promise<Object>}
   */
  async computeHash(filePath, algorithm = this.hashAlgorithm) {
    const result = {
      path: filePath,
      algorithm,
      hash: null,
      error: null,
      timestamp: Date.now()
    };

    try {
      if (!await fs.pathExists(filePath)) {
        result.error = 'File not found';
        return result;
      }

      const content = await fs.readFile(filePath);
      result.hash = crypto.createHash(algorithm).update(content).digest('hex');
      result.size = content.length;
    } catch (error) {
      result.error = error.message;
      logger.error(`Hash computation failed for ${filePath}: ${error.message}`, 'validator');
    }

    return result;
  }

  /**
   * Проверить целостность файла по хэшу
   * @param {string} filePath - Путь к файлу
   * @param {string} expectedHash - Ожидаемый хэш
   * @param {string} [algorithm] - Алгоритм
   * @returns {Promise<Object>}
   */
  async verifyIntegrity(filePath, expectedHash, algorithm = this.hashAlgorithm) {
    const result = {
      path: filePath,
      valid: false,
      expected: expectedHash,
      actual: null,
      algorithm,
      error: null
    };

    try {
      const hashResult = await this.computeHash(filePath, algorithm);
      result.actual = hashResult.hash;
      result.valid = hashResult.hash === expectedHash;

      if (!result.valid && hashResult.hash) {
        logger.warn(`Hash mismatch for ${filePath}: expected ${expectedHash}, got ${hashResult.hash}`, 'validator');
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Комплексная валидация файла перед модификацией
   * @param {string} filePath - Путь к файлу
   * @param {Object} [options] - Опции валидации
   * @returns {Promise<Object>}
   */
  async validateFile(filePath, options = {}) {
    const result = {
      path: filePath,
      valid: true,
      errors: [],
      warnings: [],
      info: {},
      timestamp: Date.now()
    };

    try {
      // 1. Проверка существования
      if (!await fs.pathExists(filePath)) {
        if (options.requireExists !== false) {
          result.errors.push('File does not exist');
          result.valid = false;
        } else {
          result.warnings.push('File does not exist (will be created)');
        }
        return result;
      }

      // 2. Получение информации о файле
      const stats = await fs.stat(filePath);
      result.info = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mode: stats.mode
      };

      // 3. Проверка типа
      if (!stats.isFile()) {
        result.errors.push(`Path is not a file: ${stats.isDirectory() ? 'directory' : 'other'}`);
        result.valid = false;
        return result;
      }

      // 4. Проверка размера
      if (stats.size > this.maxFileSize) {
        result.errors.push(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
        result.valid = false;
      }

      if (stats.size === 0) {
        result.warnings.push('File is empty');
      }

      // 5. Проверка прав доступа
      if (this.checkPermissions) {
        const perms = await this.checkFilePermissions(filePath);
        result.info.permissions = perms;

        if (!perms.readable) {
          result.errors.push('File is not readable');
          result.valid = false;
        }
        if (!perms.writable) {
          result.warnings.push('File is not writable');
        }
      }

      // 6. Валидация JSON
      if (this.validateJSON && filePath.endsWith('.json')) {
        const jsonValidation = await this.validateJSONFile(filePath);
        result.info.json = jsonValidation;

        if (!jsonValidation.valid) {
          result.errors.push(`Invalid JSON: ${jsonValidation.error}`);
          result.valid = false;
        }
      }

      // 7. Вычисление хэша
      const hashResult = await this.computeHash(filePath);
      result.info.hash = hashResult.hash;
      result.info.hashAlgorithm = hashResult.algorithm;

      // 8. Проверка по известным хэшам (если предоставлены)
      if (options.knownHash) {
        const integrityCheck = await this.verifyIntegrity(filePath, options.knownHash);
        result.info.integrity = integrityCheck;

        if (!integrityCheck.valid) {
          result.errors.push(`Integrity check failed: expected ${integrityCheck.expected}, got ${integrityCheck.actual}`);
          result.valid = false;
        }
      }

      // 9. Проверка кодировки (для текстовых файлов)
      if (this.isTextFile(filePath)) {
        const encodingCheck = await this.checkTextEncoding(filePath);
        result.info.encoding = encodingCheck;
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.valid = false;
      logger.error(`Validation failed for ${filePath}: ${error.message}`, 'validator');
    }

    return result;
  }

  /**
   * Валидировать несколько файлов
   * @param {Array<string>} filePaths - Список путей к файлам
   * @param {Object} [options] - Опции
   * @returns {Promise<Object>}
   */
  async validateFiles(filePaths, options = {}) {
    const results = {
      total: filePaths.length,
      valid: 0,
      invalid: 0,
      files: [],
      errors: [],
      timestamp: Date.now()
    };

    const validations = await Promise.all(
      filePaths.map(filePath => this.validateFile(filePath, options))
    );

    for (const validation of validations) {
      results.files.push(validation);

      if (validation.valid) {
        results.valid++;
      } else {
        results.invalid++;
        results.errors.push({
          file: validation.path,
          errors: validation.errors
        });
      }
    }

    results.success = results.invalid === 0;
    return results;
  }

  /**
   * Проверить права доступа к файлу
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<Object>}
   */
  async checkFilePermissions(filePath) {
    const result = {
      readable: false,
      writable: false,
      executable: false,
      mode: null,
      owner: null,
      group: null
    };

    try {
      const stats = await fs.stat(filePath);
      result.mode = stats.mode.toString(8);
      result.owner = stats.uid;
      result.group = stats.gid;

      // Проверка прав на чтение
      try {
        await fs.access(filePath, fs.constants.R_OK);
        result.readable = true;
      } catch (e) {
        result.readable = false;
      }

      // Проверка прав на запись
      try {
        await fs.access(filePath, fs.constants.W_OK);
        result.writable = true;
      } catch (e) {
        result.writable = false;
      }

      // Проверка прав на выполнение
      try {
        await fs.access(filePath, fs.constants.X_OK);
        result.executable = true;
      } catch (e) {
        result.executable = false;
      }
    } catch (error) {
      logger.error(`Permission check failed for ${filePath}: ${error.message}`, 'validator');
    }

    return result;
  }

  /**
   * Валидировать JSON файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<Object>}
   */
  async validateJSONFile(filePath) {
    const result = {
      valid: false,
      error: null,
      structure: null,
      keys: []
    };

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);

      result.valid = true;
      result.structure = this.analyzeJSONStructure(parsed);
      result.keys = Object.keys(parsed);
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Проанализировать структуру JSON
   * @param {Object} obj - JSON объект
   * @returns {Object}
   */
  analyzeJSONStructure(obj) {
    const analysis = {
      type: typeof obj,
      isArray: Array.isArray(obj),
      depth: 0,
      keys: 0,
      nestedObjects: 0
    };

    if (obj && typeof obj === 'object') {
      analysis.keys = Object.keys(obj).length;
      analysis.depth = this.calculateJSONDepth(obj);
      analysis.nestedObjects = this.countNestedObjects(obj);
    }

    return analysis;
  }

  /**
   * Вычислить глубину JSON объекта
   * @param {Object} obj - JSON объект
   * @returns {number}
   */
  calculateJSONDepth(obj) {
    if (!obj || typeof obj !== 'object') {
      return 0;
    }

    let maxDepth = 0;
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const depth = this.calculateJSONDepth(value);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth + 1;
  }

  /**
   * Подсчитать количество вложенных объектов
   * @param {Object} obj - JSON объект
   * @returns {number}
   */
  countNestedObjects(obj) {
    let count = 0;

    if (!obj || typeof obj !== 'object') {
      return count;
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        count++;
        count += this.countNestedObjects(value);
      }
    }

    return count;
  }

  /**
   * Проверить кодировку текстового файла
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<Object>}
   */
  async checkTextEncoding(filePath) {
    const result = {
      encoding: 'unknown',
      bom: false,
      valid: true,
      error: null
    };

    try {
      const buffer = await fs.readFile(filePath);

      // Проверка BOM
      if (buffer.length >= 3) {
        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          result.encoding = 'utf-8-bom';
          result.bom = true;
        } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
          result.encoding = 'utf-16be';
          result.bom = true;
        } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
          result.encoding = 'utf-16le';
          result.bom = true;
        } else {
          result.encoding = 'utf-8';
        }
      }

      // Попытка декодировать как UTF-8
      try {
        buffer.toString('utf8');
        result.valid = true;
      } catch (e) {
        result.valid = false;
        result.error = 'Invalid UTF-8 encoding';
      }
    } catch (error) {
      result.error = error.message;
      result.valid = false;
    }

    return result;
  }

  /**
   * Определить, является ли файл текстовым
   * @param {string} filePath - Путь к файлу
   * @returns {boolean}
   */
  isTextFile(filePath) {
    const textExtensions = ['.json', '.js', '.ts', '.txt', '.md', '.xml', '.html', '.css', '.yml', '.yaml'];
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext);
  }

  /**
   * Сохранить хэш файла в кэш
   * @param {string} filePath - Путь к файлу
   * @param {string} hash - Хэш
   */
  cacheHash(filePath, hash) {
    this.knownHashes.set(filePath, {
      hash,
      timestamp: Date.now()
    });
  }

  /**
   * Получить хэш из кэша
   * @param {string} filePath - Путь к файлу
   * @returns {string|null}
   */
  getCachedHash(filePath) {
    const cached = this.knownHashes.get(filePath);
    return cached ? cached.hash : null;
  }

  /**
   * Очистить кэш хэшей
   */
  clearCache() {
    this.knownHashes.clear();
  }

  /**
   * Создать отчёт о валидации
   * @param {Array<Object>} validations - Результаты валидации
   * @returns {string}
   */
  generateReport(validations) {
    const report = [];
    report.push('='.repeat(60));
    report.push('FILE VALIDATION REPORT');
    report.push('='.repeat(60));
    report.push(`Timestamp: ${new Date().toISOString()}`);
    report.push(`Total Files: ${validations.length}`);

    const valid = validations.filter(v => v.valid);
    const invalid = validations.filter(v => !v.valid);

    report.push(`Valid: ${valid.length}`);
    report.push(`Invalid: ${invalid.length}`);
    report.push('');

    if (invalid.length > 0) {
      report.push('ERRORS:');
      report.push('-'.repeat(60));
      for (const validation of invalid) {
        report.push(`\nFile: ${validation.path}`);
        for (const error of validation.errors) {
          report.push(`  ❌ ${error}`);
        }
      }
    }

    if (valid.length > 0) {
      report.push('\n\nVALID FILES:');
      report.push('-'.repeat(60));
      for (const validation of valid) {
        report.push(`\n✓ ${validation.path}`);
        if (validation.info.hash) {
          report.push(`  Hash (${validation.info.hashAlgorithm}): ${validation.info.hash.substring(0, 16)}...`);
        }
        if (validation.info.size) {
          report.push(`  Size: ${validation.info.size} bytes`);
        }
      }
    }

    report.push('\n' + '='.repeat(60));
    return report.join('\n');
  }
}

// Глобальный экземпляр
export const globalFileValidator = new FileValidator({
  hashAlgorithm: 'sha256',
  maxFileSize: 100 * 1024 * 1024,
  checkPermissions: true,
  validateJSON: true
});
