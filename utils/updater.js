/**
 * Updater - Автообновление приложения
 * Проверка версий на GitHub, загрузка и установка обновлений
 */

import https from 'https';
import http from 'http';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { logger } from './logger.js';
import { appConfig } from './appConfig.js';
import { withRetry } from './helpers.js';
import { globalCircuitBreakerManager } from './circuitBreaker.js';

const execPromise = promisify(exec);

/**
 * Конфигурация updater из appConfig
 */
export const UPDATER_CONFIG = {
  owner: 'QuadDarv1ne',
  repo: 'cursor-reset-tools',
  branch: 'main',
  checkInterval: appConfig.updater.checkInterval, // 24 часа по умолчанию
  timeout: appConfig.updater.timeout,
  backupDir: path.join(process.cwd(), 'updates', 'backup')
};

/**
 * Текущая версия приложения (синхронизировано с package.json)
 */
export const CURRENT_VERSION = '2.8.0-dev';

/**
 * Класс Updater
 */
export class Updater {
  constructor() {
    this.currentVersion = CURRENT_VERSION;
    this.latestVersion = null;
    this.updateAvailable = false;
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.isDownloading = false;
    this.isInstalling = false;
  }

  /**
   * Проверка наличия обновлений
   * @returns {Promise<Object>}
   */
  async checkForUpdates() {
    logger.info('Checking for updates...', 'updater');

    try {
      // Retry для сетевого запроса
      const releaseData = await withRetry(
        () => this.fetchLatestRelease(),
        {
          maxAttempts: appConfig.updater.maxRetries || 3,
          baseDelay: 1000,
          maxDelay: 10000,
          exponential: true
        }
      );

      this.latestVersion = releaseData.tag_name?.replace('v', '') || null;
      this.updateAvailable = this.compareVersions(this.latestVersion, this.currentVersion) > 0;

      if (this.updateAvailable) {
        this.updateInfo = {
          currentVersion: this.currentVersion,
          latestVersion: this.latestVersion,
          name: releaseData.name,
          description: releaseData.body,
          publishedAt: releaseData.published_at,
          downloadUrl: releaseData.zipball_url,
          tarballUrl: releaseData.tarball_url,
          assets: releaseData.assets || []
        };

        logger.info(`Update available: ${this.currentVersion} → ${this.latestVersion}`, 'updater');
      } else {
        logger.info('No updates available', 'updater');
      }

      return {
        updateAvailable: this.updateAvailable,
        currentVersion: this.currentVersion,
        latestVersion: this.latestVersion,
        info: this.updateInfo
      };

    } catch (error) {
      logger.error(`Update check failed: ${error.message}`, 'updater');
      throw error;
    }
  }

  /**
   * Получение последнего релиза с GitHub
   * @returns {Promise<Object>}
   */
  async fetchLatestRelease() {
    const circuitBreaker = globalCircuitBreakerManager.get('updater:service');
    
    return await circuitBreaker.execute(async () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${UPDATER_CONFIG.owner}/${UPDATER_CONFIG.repo}/releases/latest`,
          method: 'GET',
          headers: {
            'User-Agent': 'cursor-reset-tools-updater',
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: UPDATER_CONFIG.timeout
        };

        const req = https.get(options, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('GitHub API timeout'));
        });
      });
    });
  }

  /**
   * Сравнение версий
   * @param {string} v1 - Версия 1
   * @param {string} v2 - Версия 2
   * @returns {number}
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) {return 1;}
      if (num1 < num2) {return -1;}
    }

    return 0;
  }

  /**
   * Загрузка обновления
   * @param {string} downloadPath - Путь для сохранения
   * @returns {Promise<string>}
   */
  async downloadUpdate(downloadPath) {
    if (!this.updateInfo) {
      throw new Error('No update info available. Run checkForUpdates first.');
    }

    logger.info(`Downloading update ${this.latestVersion}...`, 'updater');
    this.isDownloading = true;
    this.downloadProgress = 0;

    try {
      await fs.ensureDir(path.dirname(downloadPath));

      return new Promise((resolve, reject) => {
        const url = this.updateInfo.downloadUrl;
        const file = fs.createWriteStream(downloadPath);

        const get = url.startsWith('https') ? https : http;

        get(url, res => {
          const totalSize = parseInt(res.headers['content-length'], 10);
          let downloadedSize = 0;

          res.on('data', chunk => {
            downloadedSize += chunk.length;
            this.downloadProgress = Math.round((downloadedSize / totalSize) * 100);
            logger.debug(`Download progress: ${this.downloadProgress}%`, 'updater');
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            this.isDownloading = false;
            logger.info(`Download complete: ${downloadPath}`, 'updater');
            resolve(downloadPath);
          });
        }).on('error', error => {
          fs.unlink(downloadPath, () => {});
          this.isDownloading = false;
          reject(error);
        });
      });

    } catch (error) {
      this.isDownloading = false;
      logger.error(`Download failed: ${error.message}`, 'updater');
      throw error;
    }
  }

  /**
   * Установка обновления
   * @param {string} archivePath - Путь к архиву
   * @returns {Promise<boolean>}
   */
  async installUpdate(archivePath) {
    logger.info(`Installing update ${this.latestVersion}...`, 'updater');
    this.isInstalling = true;

    try {
      const extractDir = path.join(process.cwd(), 'updates', 'extracted');
      await fs.ensureDir(extractDir);
      await fs.ensureDir(UPDATER_CONFIG.backupDir);

      // Создание бэкапа текущей версии
      await this.createBackup();

      // Распаковка архива
      await this.extractArchive(archivePath, extractDir);

      // Копирование новых файлов
      await this.copyNewFiles(extractDir);

      // Обновление package.json версии
      await this.updatePackageVersion();

      this.isInstalling = false;
      logger.info(`Update ${this.latestVersion} installed successfully`, 'updater');

      return true;

    } catch (error) {
      this.isInstalling = false;
      logger.error(`Installation failed: ${error.message}`, 'updater');

      // Попытка отката
      await this.restoreFromBackup();

      throw error;
    }
  }

  /**
   * Создание бэкапа
   */
  async createBackup() {
    const backupPath = path.join(UPDATER_CONFIG.backupDir, `backup-${Date.now()}`);
    await fs.ensureDir(backupPath);

    const filesToBackup = [
      'app.js',
      'routes',
      'utils',
      'views',
      'public',
      'package.json'
    ];

    for (const file of filesToBackup) {
      const src = path.join(process.cwd(), file);
      const dest = path.join(backupPath, file);

      if (await fs.pathExists(src)) {
        await fs.copy(src, dest);
      }
    }

    logger.info(`Backup created: ${backupPath}`, 'updater');
  }

  /**
   * Распаковка архива
   */
  async extractArchive(archivePath, extractDir) {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows - используем PowerShell
      await execPromise(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`
      );
    } else {
      // Linux/macOS - используем unzip или tar
      try {
        await execPromise(`unzip -o '${archivePath}' -d '${extractDir}'`);
      } catch (e) {
        await execPromise(`tar -xzf '${archivePath}' -C '${extractDir}'`);
      }
    }

    logger.info(`Archive extracted: ${extractDir}`, 'updater');
  }

  /**
   * Копирование новых файлов
   */
  async copyNewFiles(extractDir) {
    // Поиск извлечённой директории (GitHub добавляет префикс)
    const entries = await fs.readdir(extractDir);
    const sourceDir = entries.find(entry => entry.includes('cursor-reset-tools'))
      ? path.join(extractDir, entries.find(e => e.includes('cursor-reset-tools')))
      : extractDir;

    const filesToCopy = [
      'app.js',
      'cli.js',
      'routes',
      'utils',
      'views',
      'public',
      'server',
      'package.json'
    ];

    for (const file of filesToCopy) {
      const src = path.join(sourceDir, file);
      const dest = path.join(process.cwd(), file);

      if (await fs.pathExists(src)) {
        await fs.copy(src, dest, { overwrite: true });
        logger.debug(`Copied: ${file}`, 'updater');
      }
    }
  }

  /**
   * Обновление версии в package.json
   */
  async updatePackageVersion() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageData = await fs.readJson(packagePath);

    packageData.version = this.latestVersion;

    await fs.writeJson(packagePath, packageData, { spaces: 2 });

    logger.info(`package.json updated to ${this.latestVersion}`, 'updater');
  }

  /**
   * Восстановление из бэкапа
   */
  async restoreFromBackup() {
    logger.info('Restoring from backup...', 'updater');

    const backups = await fs.readdir(UPDATER_CONFIG.backupDir);

    if (backups.length === 0) {
      logger.error('No backups available', 'updater');
      return false;
    }

    const latestBackup = path.join(UPDATER_CONFIG.backupDir, backups[backups.length - 1]);

    const filesToRestore = [
      'app.js',
      'routes',
      'utils',
      'views',
      'public',
      'package.json'
    ];

    for (const file of filesToRestore) {
      const src = path.join(latestBackup, file);
      const dest = path.join(process.cwd(), file);

      if (await fs.pathExists(src)) {
        await fs.copy(src, dest, { overwrite: true });
      }
    }

    logger.info('Backup restored', 'updater');
    return true;
  }

  /**
   * Автоматическая проверка и установка
   * @param {Object} options - Опции
   */
  async autoUpdate(options = {}) {
    const {
      downloadPath = path.join(process.cwd(), 'updates', 'update.zip'),
      install = true
    } = options;

    try {
      const checkResult = await this.checkForUpdates();

      if (!checkResult.updateAvailable) {
        return { updated: false, reason: 'No updates available' };
      }

      if (install) {
        await this.downloadUpdate(downloadPath);
        await this.installUpdate(downloadPath);

        return {
          updated: true,
          version: this.latestVersion,
          requiresRestart: true
        };
      }
      return {
        updated: false,
        downloadAvailable: true,
        version: this.latestVersion
      };


    } catch (error) {
      return {
        updated: false,
        error: error.message
      };
    }
  }

  /**
   * Получение статуса
   */
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      updateAvailable: this.updateAvailable,
      isDownloading: this.isDownloading,
      isInstalling: this.isInstalling,
      downloadProgress: this.downloadProgress
    };
  }

  /**
   * Сброс статуса
   */
  reset() {
    this.downloadProgress = 0;
    this.isDownloading = false;
    this.isInstalling = false;
  }
}

// Глобальный экземпляр
export const globalUpdater = new Updater();

export default Updater;
