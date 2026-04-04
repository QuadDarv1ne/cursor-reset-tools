/**
 * Cursor Process Manager - Централизованное управление процессом Cursor
 * Проверка, завершение и мониторинг процессов Cursor IDE
 *
 * @module utils/cursorProcess
 * @example
 * import { cursorProcess } from './utils/cursorProcess.js';
 *
 * // Проверка процесса
 * const isRunning = await cursorProcess.isRunning();
 *
 * // Завершение с ожиданием
 * const result = await cursorProcess.gracefulClose({ timeout: 10000 });
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { logger } from './logger.js';

const execPromise = promisify(exec);

/**
 * Константы для управления процессами
 */
const PROCESS_CONFIG = {
  // Имена процессов для разных платформ
  processNames: {
    win32: ['Cursor.exe', 'cursor.exe'],
    darwin: ['Cursor', 'cursor'],
    linux: ['cursor', 'Cursor']
  },

  // Команды для поиска процессов
  searchCommands: {
    win32: 'tasklist /FI "IMAGENAME eq Cursor.exe" /NH',
    darwin: 'ps aux | grep -i [C]ursor | grep -v grep',
    linux: 'ps aux | grep -i [C]ursor | grep -v grep',
    freebsd: 'ps aux | grep -i [C]ursor | grep -v grep'
  },

  // Команды для завершения процессов
  killCommands: {
    win32: 'taskkill /F /IM Cursor.exe /T',
    darwin: 'pkill -f Cursor',
    linux: 'pkill -f Cursor',
    freebsd: 'pkill -f Cursor'
  },

  // Таймауты
  timeouts: {
    processCheck: 5000, // 5 секунд на проверку
    gracefulClose: 10000, // 10 секунд на закрытие
    retryDelay: 2000 // 2 секунды между попытками
  },

  // Максимальное количество попыток
  maxAttempts: 3
};

/**
 * Класс для управления процессами Cursor
 */
export class CursorProcessManager {
  constructor(config = PROCESS_CONFIG) {
    this.config = config;
    this.platform = os.platform();
    this._lastCheckTime = null;
    this._cachedStatus = null;
    this._cacheTTL = 30000; // 30 секунд кэш
  }

  /**
   * Проверка запущен ли Cursor
   * @returns {Promise<boolean>}
   */
  async isRunning() {
    const result = await this._checkProcess();
    return result.isRunning;
  }

  /**
   * Проверка процесса с деталями
   * @returns {Promise<{isRunning: boolean, count: number, pids: string[]}>}
   */
  async checkStatus() {
    // Проверяем кэш
    const now = Date.now();
    if (this._cachedStatus && (now - this._lastCheckTime) < this._cacheTTL) {
      return this._cachedStatus;
    }

    const result = await this._checkProcess();
    this._cachedStatus = result;
    this._lastCheckTime = now;

    return result;
  }

  /**
   * Внутренняя проверка процесса
   * @private
   */
  async _checkProcess() {
    try {
      const platform = this.platform;
      const command = this.config.searchCommands[platform];

      if (!command) {
        logger.warn(`Unsupported platform for process check: ${platform}`, 'cursor-process');
        return { isRunning: false, count: 0, pids: [] };
      }

      const checkPromise = new Promise(resolve => {
        exec(command, (error, stdout, stderr) => {
          if (error || stderr) {
            resolve({ isRunning: false, count: 0, pids: [] });
            return;
          }

          const output = stdout.trim();
          const isRunning = output.length > 0;

          // Парсим PID для Windows
          const pids = [];
          if (platform === 'win32' && isRunning) {
            const lines = output.split('\n');
            for (const line of lines) {
              const match = line.match(/Console\s+\d+\s+(\d+)\s+K/);
              if (match) {
                pids.push(match[1]);
              }
            }
          }

          // Парсим PID для Unix-подобных
          if (platform !== 'win32' && isRunning) {
            const lines = output.split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                pids.push(parts[1]);
              }
            }
          }

          resolve({
            isRunning,
            count: isRunning ? output.split('\n').length : 0,
            pids
          });
        });
      });

      const result = await Promise.race([
        checkPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Process check timeout')), this.config.timeouts.processCheck)
        )
      ]);

      return result;
    } catch (error) {
      logger.debug(`Process check failed: ${error.message}`, 'cursor-process');
      return { isRunning: false, count: 0, pids: [] };
    }
  }

  /**
   * Graceful закрытие процесса Cursor
   * @param {Object} options - Опции
   * @param {number} options.timeout - Таймаут ожидания (мс)
   * @param {boolean} options.force - Принудительное завершение
   * @returns {Promise<{success: boolean, message: string, killed: boolean}>}
   */
  async gracefulClose(options = {}) {
    const { timeout = this.config.timeouts.gracefulClose, force = false } = options;
    const logs = [];

    try {
      // Проверяем запущен ли процесс
      const status = await this.checkStatus();

      if (!status.isRunning) {
        return {
          success: true,
          message: 'Cursor is not running',
          killed: false
        };
      }

      logs.push(`Found ${status.count} Cursor process(es)`);

      // Если не force, пытаемся закрыть gracefully
      if (!force) {
        logs.push('Attempting graceful close...');

        // На macOS/Linux пробуем закрыть через AppleScript (если доступно)
        if (this.platform === 'darwin') {
          try {
            await execPromise('osascript -e \'tell application "Cursor" to quit\'');
            logs.push('Sent quit signal to Cursor');

            // Ждём завершения
            await this._waitForClose(timeout);
          } catch {
            logs.push('Graceful close failed, will force kill');
          }
        }

        // Проверяем завершился ли процесс
        const statusAfter = await this.checkStatus();
        if (!statusAfter.isRunning) {
          logs.push('Cursor closed gracefully');
          this._invalidateCache();
          return {
            success: true,
            message: 'Cursor closed gracefully',
            killed: false
          };
        }
      }

      // Force kill
      logs.push('Force killing Cursor...');
      const killCommand = this.config.killCommands[this.platform];

      if (!killCommand) {
        return {
          success: false,
          message: `Unsupported platform: ${this.platform}`,
          killed: false
        };
      }

      await execPromise(killCommand);
      logs.push('Cursor processes terminated');

      // Инвалидируем кэш
      this._invalidateCache();

      return {
        success: true,
        message: 'Cursor force killed',
        killed: true
      };
    } catch (error) {
      logs.push(`Error: ${error.message}`);
      logger.error(`Cursor graceful close failed: ${error.message}`, 'cursor-process');

      return {
        success: false,
        message: error.message,
        killed: false
      };
    }
  }

  /**
   * Ожидание завершения процесса
   * @private
   */
  async _waitForClose(timeout) {
    const startTime = Date.now();
    const checkInterval = this.config.timeouts.retryDelay;

    while (Date.now() - startTime < timeout) {
      const status = await this.checkStatus();
      if (!status.isRunning) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Очистка кэша
   * @private
   */
  _invalidateCache() {
    this._cachedStatus = null;
    this._lastCheckTime = null;
  }

  /**
   * Принудительная очистка кэша
   */
  clearCache() {
    this._invalidateCache();
  }

  /**
   * Получение конфигурации
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Предупреждение если Cursor запущен (для использования в UI/API)
   * @returns {Promise<{warning: boolean, message: string, count: number}>}
   */
  async getRunningWarning() {
    const status = await this.checkStatus();

    if (status.isRunning) {
      return {
        warning: true,
        message: `Cursor is running (${status.count} process(es)). Please close Cursor before proceeding.`,
        count: status.count
      };
    }

    return {
      warning: false,
      message: 'Cursor is not running',
      count: 0
    };
  }
}

// Глобальный экземпляр
export const globalCursorProcess = new CursorProcessManager();

export default CursorProcessManager;
