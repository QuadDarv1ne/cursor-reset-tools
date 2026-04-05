/**
 * AutoSetup - Автоматическая настройка при старте
 * Проверяет окружение, создаёт директории, генерирует конфигурацию
 *
 * @module utils/autoSetup
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createLogger } from './logger.js';
import { appConfig } from './appConfig.js';
import { checkAdminRights } from './helpers.js';
import { SECURITY_CONSTANTS, FILE_CONSTANTS, LOG_CONSTANTS } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger({ level: appConfig.logging.level });

// ============================================
// Константы
// ============================================

const REQUIRED_DIRS = [
  'data',
  'logs',
  'backups',
  'data/vpn-configs',
  'data/wireguard',
  'data/openvpn',
  'data/openvpn-logs',
  'updates',
  'temp'
];

const REQUIRED_FILES = [
  'package.json',
  'app.js',
  'cli.js'
];

const PROFILES = {
  minimal: {
    description: 'Минимальная настройка - только основные функции',
    features: {
      monitoring: false,
      backup: false,
      proxy: false,
      vpn: false,
      dns: false,
      notifications: false,
      autoUpdate: true,
      metrics: false,
      smartBypass: true
    }
  },
  standard: {
    description: 'Стандартная настройка - баланс функций',
    features: {
      monitoring: true,
      backup: true,
      proxy: false,
      vpn: false,
      dns: true,
      notifications: false,
      autoUpdate: true,
      metrics: true,
      smartBypass: true
    }
  },
  full: {
    description: 'Полная настройка - все функции включены',
    features: {
      monitoring: true,
      backup: true,
      proxy: true,
      vpn: true,
      dns: true,
      notifications: true,
      autoUpdate: true,
      metrics: true,
      smartBypass: true
    }
  }
};

const DEFAULT_ENV_TEMPLATE = `# ============================================
# Cursor Reset Tools - Environment Configuration
# ============================================
# Сгенерировано автоматически при первом запуске
# Дата: {{DATE}}
# ============================================

# ============================================
# Сервер
# ============================================
PORT={{PORT}}
WS_PORT={{WS_PORT}}
HOST={{HOST}}
NODE_ENV={{NODE_ENV}}

# ============================================
# Логирование
# ============================================
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_FILES=30
LOG_MAX_SIZE=10m

# ============================================
# Автообновление
# ============================================
AUTO_UPDATE_ENABLED=true
UPDATE_CHECK_INTERVAL=86400000

# ============================================
# Уведомления (опционально)
# ============================================
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
# DISCORD_WEBHOOK_URL=

# ============================================
# Прокси (опционально)
# ============================================
PROXY_ENABLED=false
# PROXY_URL=
# PROXY_PROTOCOL=socks5

# ============================================
# VPN (опционально)
# ============================================
VPN_ENABLED=false
# VPN_TYPE=wireguard
# VPN_CONFIG_PATH=

# ============================================
# DNS (опционально)
# ============================================
DNS_PROVIDER=cloudflare

# ============================================
# Метрики и мониторинг
# ============================================
METRICS_ENABLED=true
METRICS_INTERVAL=60000

# ============================================
# Безопасность
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CSP_ENABLED=true

# ============================================
# Кэширование
# ============================================
CACHE_TTL_DEFAULT=5000
CACHE_MAX_SIZE=1000

# ============================================
# База данных (SQLite)
# ============================================
DB_PATH=data/app.db

# ============================================
# Резервное копирование
# ============================================
BACKUP_ENABLED=true
BACKUP_PATH=backups
BACKUP_MAX_COUNT=10
BACKUP_AUTO_INTERVAL=86400000
`;

/**
 * AutoSetup Manager
 */
export class AutoSetup {
  constructor() {
    this.initialized = false;
    this.profile = 'standard';
    this.checkResults = {
      environment: null,
      directories: null,
      files: null,
      config: null,
      permissions: null,
      dependencies: null
    };
    this.fixesApplied = [];
  }

  /**
   * Инициализация с автонастройкой
   * @param {Object} options - Опции инициализации
   * @param {string} options.profile - Профиль настройки (minimal/standard/full)
   * @param {boolean} options.autoFix - Автоматически исправлять проблемы
   * @param {boolean} options.generateEnv - Генерировать .env если нет
   * @param {boolean} options.strict - Строгий режим (прервать при ошибках)
   * @returns {Promise<Object>} Результаты проверки
   */
  async init(options = {}) {
    if (this.initialized) {
      return { success: true, message: 'Already initialized', results: this.checkResults };
    }

    const startTime = Date.now();
    this.profile = options.profile || process.env.AUTOSETUP_PROFILE || 'standard';
    const autoFix = options.autoFix !== false; // По умолчанию true
    const generateEnv = options.generateEnv !== false; // По умолчанию true
    const strict = options.strict || false;

    logger.info(`AutoSetup initialization started (profile: ${this.profile})`, 'autosetup');

    try {
      // Шаг 1: Проверка окружения
      this.checkResults.environment = await this.checkEnvironment();

      // Шаг 2: Проверка директорий
      this.checkResults.directories = await this.checkDirectories();

      // Шаг 3: Проверка файлов
      this.checkResults.files = await this.checkRequiredFiles();

      // Шаг 4: Проверка прав
      this.checkResults.permissions = await this.checkPermissions();

      // Шаг 5: Проверка зависимостей
      this.checkResults.dependencies = await this.checkDependencies();

      // Шаг 6: Проверка конфигурации
      this.checkResults.config = await this.checkConfig();

      // Шаг 7: Авто-исправление если включено
      if (autoFix) {
        await this.applyFixes();
      }

      // Шаг 8: Генерация .env если нужно
      if (generateEnv) {
        await this.generateEnvIfMissing();
      }

      // Шаг 9: Применение профиля
      await this.applyProfile();

      // Финальная валидация
      const validation = await this.validate();

      const duration = Date.now() - startTime;
      this.initialized = true;

      const result = {
        success: validation.valid || !strict,
        duration,
        profile: this.profile,
        checks: this.checkResults,
        fixes: this.fixesApplied,
        validation,
        warnings: validation.warnings || [],
        errors: validation.errors || []
      };

      if (result.success) {
        logger.info(`AutoSetup completed successfully in ${duration}ms`, 'autosetup');
      } else {
        logger.error(`AutoSetup completed with errors: ${validation.errors.join(', ')}`, 'autosetup');
      }

      return result;
    } catch (error) {
      logger.error(`AutoSetup initialization failed: ${error.message}`, 'autosetup');
      throw error;
    }
  }

  /**
   * Проверка окружения
   * @returns {Promise<Object>}
   */
  async checkEnvironment() {
    logger.debug('Checking environment...', 'autosetup');

    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    const homeDir = os.homedir();
    const tmpDir = os.tmpdir();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCount = os.cpus().length;

    const checks = {
      platform: { value: platform, valid: ['win32', 'darwin', 'linux', 'freebsd'].includes(platform) },
      architecture: { value: arch, valid: true },
      nodeVersion: { value: nodeVersion, valid: this.isNodeVersionValid(nodeVersion) },
      homeDirectory: { value: homeDir, valid: await fs.pathExists(homeDir) },
      tempDirectory: { value: tmpDir, valid: await fs.pathExists(tmpDir) },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        percentFree: ((freeMemory / totalMemory) * 100).toFixed(2),
        valid: freeMemory > 256 * 1024 * 1024 // Минимум 256MB
      },
      cpu: { count: cpuCount, valid: cpuCount > 0 }
    };

    const isValid = Object.values(checks).every(c => c.valid);

    return { checks, valid: isValid };
  }

  /**
   * Проверка требуемых директорий
   * @returns {Promise<Object>}
   */
  async checkDirectories() {
    logger.debug('Checking directories...', 'autosetup');

    const projectRoot = path.resolve(__dirname, '..');
    const results = [];

    for (const dir of REQUIRED_DIRS) {
      const fullPath = path.join(projectRoot, dir);
      const exists = await fs.pathExists(fullPath);
      const writable = exists ? await this.isWritable(fullPath) : false;

      results.push({
        path: dir,
        fullPath,
        exists,
        writable,
        valid: exists && writable
      });
    }

    const valid = results.every(r => r.valid);
    const missing = results.filter(r => !r.exists).map(r => r.path);

    return { results, valid, missing, total: results.length };
  }

  /**
   * Проверка требуемых файлов
   * @returns {Promise<Object>}
   */
  async checkRequiredFiles() {
    logger.debug('Checking required files...', 'autosetup');

    const projectRoot = path.resolve(__dirname, '..');
    const results = [];

    for (const file of REQUIRED_FILES) {
      const fullPath = path.join(projectRoot, file);
      const exists = await fs.pathExists(fullPath);

      results.push({
        path: file,
        fullPath,
        exists,
        valid: exists
      });
    }

    const valid = results.every(r => r.valid);
    const missing = results.filter(r => !r.exists).map(r => r.path);

    return { results, valid, missing, total: results.length };
  }

  /**
   * Проверка прав доступа
   * @returns {Promise<Object>}
   */
  async checkPermissions() {
    logger.debug('Checking permissions...', 'autosetup');

    const isAdmin = await checkAdminRights();
    const projectRoot = path.resolve(__dirname, '..');
    const isProjectWritable = await this.isWritable(projectRoot);

    return {
      isAdmin,
      isProjectWritable,
      needsAdmin: process.platform === 'win32' ? true : false,
      valid: isProjectWritable
    };
  }

  /**
   * Проверка зависимостей
   * @returns {Promise<Object>}
   */
  async checkDependencies() {
    logger.debug('Checking dependencies...', 'autosetup');

    const projectRoot = path.resolve(__dirname, '..');
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    const packageJsonPath = path.join(projectRoot, 'package.json');

    const nodeModulesExists = await fs.pathExists(nodeModulesPath);
    const packageJsonExists = await fs.pathExists(packageJsonPath);

    let installedPackages = [];
    let missingPackages = [];

    if (packageJsonExists) {
      try {
        const pkg = await fs.readJson(packageJsonPath);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        installedPackages = Object.keys(allDeps);

        if (nodeModulesExists) {
          missingPackages = installedPackages.filter(pkg => {
            const pkgPath = path.join(nodeModulesPath, pkg);
            return !fs.existsSync(pkgPath);
          });
        } else {
          missingPackages = [...installedPackages];
        }
      } catch (error) {
        logger.error(`Failed to read package.json: ${error.message}`, 'autosetup');
      }
    }

    return {
      nodeModulesExists,
      packageJsonExists,
      totalPackages: installedPackages.length,
      missingPackages,
      valid: nodeModulesExists && missingPackages.length === 0
    };
  }

  /**
   * Проверка конфигурации
   * @returns {Promise<Object>}
   */
  async checkConfig() {
    logger.debug('Checking configuration...', 'autosetup');

    const projectRoot = path.resolve(__dirname, '..');
    const envPath = path.join(projectRoot, '.env');
    const envExists = await fs.pathExists(envPath);

    const validation = appConfig.validate ? appConfig.validate() : { valid: true, errors: [] };

    return {
      envExists,
      envPath,
      validation,
      valid: validation.valid
    };
  }

  /**
   * Применение исправлений
   */
  async applyFixes() {
    logger.info('Applying automatic fixes...', 'autosetup');

    // Создание недостающих директорий
    if (this.checkResults.directories && this.checkResults.directories.missing.length > 0) {
      await this.createMissingDirectories();
    }

    // Предупреждение о правах
    if (this.checkResults.permissions && !this.checkResults.permissions.isProjectWritable) {
      logger.warn('Project directory is not writable. Some features may not work correctly.', 'autosetup');
    }

    // Предупреждение о зависимостях
    if (this.checkResults.dependencies && !this.checkResults.dependencies.valid) {
      await this.fixDependencies();
    }
  }

  /**
   * Создание недостающих директорий
   */
  async createMissingDirectories() {
    const projectRoot = path.resolve(__dirname, '..');
    const missing = this.checkResults.directories?.missing || [];

    for (const dir of missing) {
      const fullPath = path.join(projectRoot, dir);
      try {
        await fs.ensureDir(fullPath);
        logger.info(`Created directory: ${dir}`, 'autosetup');
        this.fixesApplied.push({ type: 'directory', action: 'created', path: dir });
      } catch (error) {
        logger.error(`Failed to create directory ${dir}: ${error.message}`, 'autosetup');
      }
    }
  }

  /**
   * Исправление зависимостей
   */
  async fixDependencies() {
    const missing = this.checkResults.dependencies?.missingPackages || [];

    if (missing.length > 0) {
      logger.warn(`Missing dependencies: ${missing.join(', ')}. Run 'npm install' to fix.`, 'autosetup');
      this.fixesApplied.push({ type: 'dependencies', action: 'warning', packages: missing });
    }

    if (!this.checkResults.dependencies?.nodeModulesExists) {
      logger.error('node_modules not found. Run "npm install" before starting the application.', 'autosetup');
      this.fixesApplied.push({ type: 'dependencies', action: 'error', message: 'Run npm install' });
    }
  }

  /**
   * Генерация .env файла если его нет
   */
  async generateEnvIfMissing() {
    if (this.checkResults.config?.envExists) {
      return;
    }

    const projectRoot = path.resolve(__dirname, '..');
    const envPath = path.join(projectRoot, '.env');

    try {
      const envContent = this.generateEnvContent();
      await fs.writeFile(envPath, envContent, { encoding: 'utf8' });

      logger.info(`Generated .env file at ${envPath}`, 'autosetup');
      this.fixesApplied.push({ type: 'config', action: 'generated', path: '.env' });
    } catch (error) {
      logger.error(`Failed to generate .env file: ${error.message}`, 'autosetup');
    }
  }

  /**
   * Генерация содержимого .env файла
   * @returns {string}
   */
  generateEnvContent() {
    const now = new Date().toISOString();
    const port = process.env.PORT || appConfig.network.port;
    const wsPort = process.env.WS_PORT || appConfig.network.wsPort;
    const host = process.env.HOST || appConfig.network.host;
    const nodeEnv = process.env.NODE_ENV || appConfig.network.nodeEnv;

    return DEFAULT_ENV_TEMPLATE
      .replace('{{DATE}}', now)
      .replace('{{PORT}}', port)
      .replace('{{WS_PORT}}', wsPort)
      .replace('{{HOST}}', host)
      .replace('{{NODE_ENV}}', nodeEnv);
  }

  /**
   * Применение профиля
   */
  async applyProfile() {
    const profile = PROFILES[this.profile];
    if (!profile) {
      logger.warn(`Unknown profile: ${this.profile}, using standard`, 'autosetup');
      return;
    }

    logger.info(`Applying profile: ${this.profile} - ${profile.description}`, 'autosetup');
    this.fixesApplied.push({ type: 'profile', action: 'applied', profile: this.profile, features: profile.features });
  }

  /**
   * Финальная валидация
   * @returns {Promise<Object>}
   */
  async validate() {
    const errors = [];
    const warnings = [];

    // Критические ошибки
    if (!this.checkResults.environment?.valid) {
      errors.push('Invalid environment configuration');
    }

    if (!this.checkResults.files?.valid) {
      errors.push(`Missing required files: ${this.checkResults.files.missing.join(', ')}`);
    }

    // Предупреждения
    if (!this.checkResults.directories?.valid) {
      warnings.push(`Some directories missing or not writable`);
    }

    if (!this.checkResults.permissions?.isAdmin && this.checkResults.permissions?.needsAdmin) {
      warnings.push('Administrator rights recommended for full functionality');
    }

    if (!this.checkResults.dependencies?.valid) {
      if (this.checkResults.dependencies.missingPackages.length > 0) {
        warnings.push(`Missing packages: ${this.checkResults.dependencies.missingPackages.slice(0, 5).join(', ')}`);
      }
    }

    if (!this.checkResults.config?.envExists) {
      warnings.push('.env file not found, using defaults');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      profile: this.profile,
      fixesApplied: this.fixesApplied.length
    };
  }

  /**
   * Проверка версии Node.js
   * @param {string} version
   * @returns {boolean}
   */
  isNodeVersionValid(version) {
    const major = parseInt(version.slice(1).split('.')[0], 10);
    return major >= 18; // Минимум Node.js 18
  }

  /**
   * Проверка записи в директорию
   * @param {string} dirPath
   * @returns {Promise<boolean>}
   */
  async isWritable(dirPath) {
    try {
      const testFile = path.join(dirPath, `.writetest-${Date.now()}`);
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить статус автонастройки
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      profile: this.profile,
      checks: this.checkResults,
      fixes: this.fixesApplied
    };
  }

  /**
   * Получить доступные профили
   * @returns {Object}
   */
  getProfiles() {
    return PROFILES;
  }

  /**
   * Сброс состояния
   */
  reset() {
    this.initialized = false;
    this.profile = 'standard';
    this.checkResults = {
      environment: null,
      directories: null,
      files: null,
      config: null,
      permissions: null,
      dependencies: null
    };
    this.fixesApplied = [];
  }
}

// ============================================
// Синглтон
// ============================================
export const globalAutoSetup = new AutoSetup();
export default globalAutoSetup;
