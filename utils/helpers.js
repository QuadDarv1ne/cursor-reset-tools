import os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

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
  const fs = await import('fs-extra');
  
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
