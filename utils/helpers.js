import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { logger } from './logger.js';
import { FILE_CONSTANTS, PROCESS_CONSTANTS } from './constants.js';

const execPromise = promisify(exec);

/**
 * Retry конфигурация из config.automation
 * Улучшенная с экспоненциальной задержкой и jitter
 */
export const RETRY_CONFIG = {
  maxAttempts: config.automation.autoRetryMaxAttempts,
  baseDelay: config.automation.autoRetryBaseDelay,
  maxDelay: 10000,
  exponential: true,
  jitter: 0.1 // Добавление случайности для предотвращения thundering herd
};

/**
 * Выполнение операции с retry logic
 * Улучшенная версия с экспоненциальной задержкой и jitter
 * @param {Function} operation - Асинхронная операция
 * @param {Object} options - Опции retry
 * @returns {Promise<any>}
 */
export const withRetry = async (operation, options = {}) => {
  const {
    maxAttempts = RETRY_CONFIG.maxAttempts,
    baseDelay = RETRY_CONFIG.baseDelay,
    maxDelay = RETRY_CONFIG.maxDelay,
    exponential = RETRY_CONFIG.exponential,
    jitter = RETRY_CONFIG.jitter,
    onRetry,
    name = 'operation'
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts) {
        logger.error(
          `${name} failed after ${attempt} attempts: ${error.message}`,
          'retry'
        );
        break;
      }

      // Расчёт задержки с экспоненциальным ростом и jitter
      let delayTime = exponential
        ? baseDelay * Math.pow(2, attempt - 1)
        : baseDelay;

      // Ограничение максимальной задержки
      delayTime = Math.min(delayTime, maxDelay);

      // Добавление jitter для предотвращения thundering herd
      if (jitter > 0) {
        const jitterAmount = delayTime * jitter * (Math.random() * 2 - 1);
        delayTime += jitterAmount;
      }

      delayTime = Math.max(0, Math.round(delayTime));

      logger.debug(
        `${name} attempt ${attempt}/${maxAttempts} failed, retrying in ${delayTime}ms...`,
        'retry'
      );

      if (onRetry) {
        await onRetry(error, attempt, delayTime);
      }

      await delay(delayTime);
    }
  }

  throw lastError;
};

/**
 * Проверка прав администратора
 * @returns {Promise<boolean>}
 */
export const checkAdminRights = async () => {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      await execPromise('net session');
      return true;
    }
    if (platform === 'freebsd') {
      await execPromise('sudo -v');
      return true;
    }
    return os.userInfo().uid === 0;
  } catch {
    return false;
  }
};

/**
 * Валидация критических путей
 * @param {Object} paths - Объект с путями
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export const validatePaths = paths => {
  const required = {
    mp: 'Machine ID',
    sp: 'Storage',
    dp: 'Database'
  };

  const missing = [];
  for (const [key, name] of Object.entries(required)) {
    if (!paths[key]) {
      missing.push(`${name} (${key})`);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Проверка существования файла с таймаутом
 * @param {string} filePath
 * @param {number} timeout - мс
 * @returns {Promise<boolean>}
 */
export const checkFileExists = async (filePath, timeout = FILE_CONSTANTS.FILE_CHECK_TIMEOUT) => new Promise(resolve => {
  const timer = setTimeout(() => resolve(false), timeout);
  timer.unref(); // Не блокирует graceful shutdown

  fs.access(filePath, fs.constants.F_OK, err => {
    clearTimeout(timer);
    resolve(!err);
  });
});

/**
 * Задержка в мс
 * @param {number} ms
 * @returns {Promise<void>}
 */
export const delay = ms => new Promise(resolve => {
  const timer = setTimeout(resolve, ms);
  timer.unref(); // Не блокирует graceful shutdown
});

/**
 * Получение версий Cursor из package.json
 * @param {string} appPath - Путь к приложению
 * @returns {Promise<string|null>}
 */
export const getCursorVersion = async appPath => {
  try {
    const packageJson = `${appPath}/package.json`;
    if (await checkFileExists(packageJson, 1000)) {
      const pkg = JSON.parse(await fs.readFile(packageJson, 'utf8'));
      return pkg.version || null;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Проверка совместимости версии Cursor
 * @param {string} version
 * @returns {boolean}
 */
export const isCursorVersionSupported = version => {
  if (!version) {return false;}

  const minVersion = config.minCursorVersion;

  // Проверка по семверу (упрощённо)
  const [major] = version.split('.').map(Number);
  const [minMajor] = minVersion.split('.').map(Number);

  return major >= minMajor;
};

/**
 * Проверка процесса Cursor с таймаутом
 * @param {string} platform
 * @param {number} timeout - мс
 * @returns {Promise<boolean>}
 */
export const checkCursorProcess = async (platform, timeout = PROCESS_CONSTANTS.PROCESS_CHECK_TIMEOUT) => {
  try {
    const checkPromise = new Promise(resolve => {
      try {
        if (platform === 'win32') {
          exec('tasklist /FI "IMAGENAME eq Cursor.exe" /NH', (err, stdout) => {
            resolve(!err && stdout.includes('Cursor.exe'));
          });
        } else {
          exec('ps aux | grep -i [C]ursor | grep -v grep', (err, stdout) => {
            resolve(!err && stdout.trim().length > 0);
          });
        }
      } catch {
        resolve(false);
      }
    });

    return await Promise.race([
      checkPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Process check timeout')), timeout)
      )
    ]);
  } catch {
    return false;
  }
};

/**
 * Очистка ключей Keychain на macOS
 * @returns {Promise<boolean>}
 */
export const clearKeychain = async () => {
  if (os.platform() !== 'darwin') {return false;}

  try {
    await execPromise('security delete-generic-password -s "Cursor" -a "token" 2>/dev/null');
    await execPromise('security delete-generic-password -s "Cursor" -a "refreshToken" 2>/dev/null');
    return true;
  } catch {
    return false;
  }
};

/**
 * Обновление реестра Windows
 * ОПТИМИЗАЦИЯ: Параллельное выполнение команд реестра
 * @param {string} newGuid - Новый GUID
 * @returns {Promise<boolean>}
 */
export const updateWindowsRegistry = async newGuid => {
  if (os.platform() !== 'win32') {return false;}

  try {
    const safeGuid1 = uuidv4().replace(/[^a-zA-Z0-9\-]/g, '');
    const safeGuid2 = newGuid.replace(/[^a-zA-Z0-9\-]/g, '');

    if (!safeGuid1 || !safeGuid2) {
      logger.error('Invalid GUID format detected', 'helpers');
      return false;
    }

    const cmds = [
      `REG ADD HKCU\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid /t REG_SZ /d ${safeGuid1} /f`,
      `REG ADD HKCU\\SOFTWARE\\Microsoft\\SQMClient /v MachineId /t REG_SZ /d ${safeGuid2} /f`,
      `REG ADD HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid /t REG_SZ /d ${safeGuid1} /f`,
      `REG ADD HKLM\\SOFTWARE\\Microsoft\\SQMClient /v MachineId /t REG_SZ /d ${safeGuid2} /f`,
      `REG ADD HKCU\\Software\\Cursor /v MachineId /t REG_SZ /d ${safeGuid2} /f /reg:64`
    ];

    const results = await Promise.allSettled(cmds.map(cmd => execPromise(cmd)));

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    if (failed.length > 0) {
      failed.forEach((result, idx) => {
        if (result.status === 'rejected') {
          logger.error(`Registry command ${idx} failed: ${result.reason?.message || 'unknown error'}`, 'helpers');
        }
      });
      logger.warn(`Registry update: ${success} succeeded, ${failed.length} failed`, 'helpers');
    } else {
      logger.info(`Registry update: all ${success} commands succeeded`, 'helpers');
    }

    return success > 0;
  } catch (error) {
    logger.error(`Registry update failed: ${error.message}`, 'helpers');
    return false;
  }
};

/**
 * Обновление платформенных UUID на macOS
 * @param {string} id - Новый UUID
 * @returns {Promise<boolean>}
 */
export const updateMacOSPlatformUUID = async id => {
  if (os.platform() !== 'darwin') {return false;}

  try {
    const p = '/Library/Preferences/SystemConfiguration/com.apple.platform.uuid.plist';
    const hp = path.join(os.homedir(), p);

    try {
      await execPromise(`defaults write ${hp} "UUID" "${id}"`);
      await execPromise(`sudo defaults write ${p} "UUID" "${id}"`);
      return true;
    } catch (error) {
      logger.error(`macOS Platform UUID update failed: ${error.message}`, 'helpers');
      return false;
    }
  } catch (error) {
    logger.error(`macOS PlatformUUID outer error: ${error.message}`, 'helpers');
    return false;
  }
};

/**
 * Проверка целостности workbench файла после модификации
 * Проверяет базовую структуру JavaScript файла
 * @param {string} filePath - Путь к workbench файлу
 * @returns {Promise<{valid: boolean, errors: string[], size: number}>}
 */
export const validateWorkbenchIntegrity = async filePath => {
  const errors = [];
  let size = 0;

  try {
    if (!await checkFileExists(filePath, 2000)) {
      return { valid: false, errors: ['File not found'], size: 0 };
    }

    const content = await fs.readFile(filePath, 'utf8');
    size = Buffer.byteLength(content, 'utf8');

    // Проверка минимального размера (workbench не может быть слишком маленьким)
    if (size < FILE_CONSTANTS.WORKBENCH_MIN_SIZE) {
      errors.push(`File too small (${size} bytes), possible corruption`);
    }

    // Проверка максимальной размер (не более 50MB)
    if (size > FILE_CONSTANTS.WORKBENCH_MAX_SIZE) {
      errors.push(`File too large (${size} bytes), possible corruption`);
    }

    // Проверка базовой структуры JavaScript
    const hasValidStart = /^[\s\S]*?(?:function|const|let|var|class|import|export|define|require|\(function)/m.test(content);
    if (!hasValidStart) {
      errors.push('No valid JavaScript structure found');
    }

    // Проверка на пустой файл
    if (content.trim().length === 0) {
      errors.push('File is empty');
    }

    // Проверка баланса базовых скобок
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;

    if (Math.abs(openBraces - closeBraces) > FILE_CONSTANTS.WORKBENCH_BRACE_TOLERANCE) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    if (Math.abs(openParens - closeParens) > FILE_CONSTANTS.WORKBENCH_BRACE_TOLERANCE) {
      errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    // Проверка на наличие критических паттернов Cursor
    const hasCursorReferences = /cursor|Cursor|workbench/i.test(content);
    if (!hasCursorReferences) {
      errors.push('No Cursor-related references found');
    }

    return {
      valid: errors.length === 0,
      errors,
      size
    };
  } catch (error) {
    logger.error(`Workbench integrity check failed: ${error.message}`, 'integrity');
    return { valid: false, errors: [`Integrity check error: ${error.message}`], size: 0 };
  }
};

/**
 * Создание контрольной суммы файла
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string|null>} SHA256 хэш файла
 */
export const getFileHash = async filePath => {
  try {
    const crypto = await import('crypto');
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
};
