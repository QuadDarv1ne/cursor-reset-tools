import os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs-extra';
import { config } from './config.js';

const execPromise = promisify(exec);

/**
 * Проверка прав администратора
 * @returns {Promise<boolean>}
 */
export const checkAdminRights = async () => {
  try {
    if (os.platform() === 'win32') {
      await execPromise('net session');
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
export const validatePaths = (paths) => {
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
export const checkFileExists = async (filePath, timeout = 5000) => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
      clearTimeout(timer);
      resolve(!err);
    });
  });
};

/**
 * Форматирование размера файла
 * @param {number} bytes 
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Задержка в мс
 * @param {number} ms 
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получение версий Cursor из package.json
 * @param {string} appPath - Путь к приложению
 * @returns {Promise<string|null>}
 */
export const getCursorVersion = async (appPath) => {
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
export const isCursorVersionSupported = (version) => {
  if (!version) return false;
  
  const supported = config.supportedCursorVersions;
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
export const checkCursorProcess = async (platform, timeout = config.timeouts.processCheck) => {
  try {
    const checkPromise = new Promise((resolve) => {
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
