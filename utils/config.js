/**
 * Конфигурация приложения с поддержкой переменных окружения
 * Все значения можно переопределить через .env файл
 */

import os from 'os';
import path from 'path';

/**
 * Безопасное получение числа из env с fallback
 */
const envInt = (key, fallback) => {
  const val = process.env[key];
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
};

/**
 * Безопасное получения булевого значения из env
 */
const envBool = (key, fallback) => {
  const val = process.env[key];
  if (val === undefined) {return fallback;}
  return ['true', '1', 'yes'].includes(val.toLowerCase());
};

/**
 * Безопасное получение строки из env с fallback
 */
const envStr = (key, fallback) => process.env[key] || fallback;

/**
 * Парсинг списка из env (разделитель — запятая)
 */
const envList = (key, fallback) => {
  const val = process.env[key];
  if (!val) {return fallback;}
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

// ============================================
// Версии Cursor
// ============================================
const supportedCursorVersions = envList('CURSOR_SUPPORTED_VERSIONS', ['0.49.x', '0.50.x', '0.51.x', '0.52.x', '1.0.x', '2.0.x']);
const minCursorVersion = envStr('CURSOR_MIN_VERSION', '0.49.0');

// ============================================
// Лимиты токенов (константы для патчинга)
// ============================================
const tokenLimits = {
  default: envInt('TOKEN_LIMIT_DEFAULT', 200000),
  bypassed: envInt('TOKEN_LIMIT_BYPASSED', 9000000),
  maxModel: envInt('TOKEN_LIMIT_MAX_MODEL', 900000),
  unlimited: envInt('TOKEN_LIMIT_UNLIMITED', 999999),
  zero: 0
};

// ============================================
// Таймауты (мс)
// ============================================
const timeouts = {
  fileOperation: envInt('TIMEOUT_FILE_OPERATION', 10000),
  processCheck: envInt('TIMEOUT_PROCESS_CHECK', 5000),
  apiRequest: envInt('TIMEOUT_API_REQUEST', 30000),
  cacheTTL: envInt('TIMEOUT_CACHE_TTL', 5000),
  ipService: envInt('TIMEOUT_IP_SERVICE', 5000),
  proxyDatabase: envInt('TIMEOUT_PROXY_DATABASE', 15000),
  updater: envInt('TIMEOUT_UPDATER', 30000),
  emailWait: envInt('TIMEOUT_EMAIL_WAIT', 120000),
  registration: envInt('TIMEOUT_REGISTRATION', 180000),
  vpnApi: envInt('TIMEOUT_VPN_API', 5000),
  dnsFlush: envInt('TIMEOUT_DNS_FLUSH', 10000)
};

// ============================================
// Паттерны для патчинга workbench
// ============================================
const workbenchPatterns = {
  proTrial: {
    pattern: '<div>Pro Trial',
    replacement: '<div>Pro'
  },
  bypassVersionPin: {
    pattern: 'py-1">Auto-select',
    replacement: 'py-1">Bypass-Version-Pin'
  },
  tokenLimit: {
    pattern: 'async getEffectiveTokenLimit\\(e\\)\\{const n=e\\.modelName;if\\(!n\\)return 2e5;',
    replacement: 'async getEffectiveTokenLimit(e){return 9000000;const n=e.modelName;if(!n)return 900000;'
  },
  proUser: {
    pattern: 'isProUser\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
    replacement: 'isProUser(){return true}'
  },
  isPro: {
    pattern: 'isPro\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
    replacement: 'isPro(){return true}'
  },
  tokenLimitFunc: {
    pattern: 'getTokenLimit\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
    replacement: 'getTokenLimit(){return 999999}'
  },
  tokensRemaining: {
    pattern: 'getTokensRemaining\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
    replacement: 'getTokensRemaining(){return 999999}'
  },
  tokensUsed: {
    pattern: 'getTokensUsed\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
    replacement: 'getTokensUsed(){return 0}'
  },
  hasReachedTokenLimit: {
    pattern: 'hasReachedTokenLimit\\(\\w+\\)\\s*\\{[^}]+\\}',
    replacement: 'hasReachedTokenLimit(e){return false}'
  },
  notificationsToasts: {
    pattern: 'notifications-toasts',
    replacement: 'notifications-toasts hidden'
  },
  proUI: {
    pattern: 'var DWr=ne\\("<div class=settings__item_description>You are currently signed in with <strong></strong>\\.\\)"\\;',
    replacement: 'var DWr=ne("<div class=settings__item_description>You are currently signed in with <strong></strong>. <h1>Pro</h1>");'
  }
};

// ============================================
// Паттерны для Pro конвертации
// ============================================
const proConversionPatterns = {
  upgradeToPro: {
    pattern: 'Upgrade to Pro',
    replacement: 'Sazumi Github'
  },
  paywallLink: {
    pattern: 'return t\\.pay',
    replacement: 'return function(){window.open("https://github.com/QuadDarv1ne","_blank")}'
  },
  rocketIcon: {
    pattern: 'rocket',
    replacement: 'github'
  }
};

// ============================================
// Пути для Data директории (платформо-зависимые)
// ============================================
const getDataDir = () => {
  const home = os.homedir();
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return path.join(home, 'Documents', '.cursor-free-vip');
    case 'darwin':
      return path.join(home, '.cursor-free-vip');
    case 'linux':
      return path.join(home, '.config', 'cursor-free-vip');
    case 'freebsd':
      return path.join(home, '.config', 'cursor-free-vip');
    default:
      return path.join(home, '.cursor-free-vip');
  }
};

const dataDir = envStr('DATA_DIR', getDataDir());

// ============================================
// Пути для разных платформ (Cursor paths)
// ============================================
const platformPaths = {
  win32: {
    machineId: homedir => path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'machineId'),
    storage: homedir => path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'),
    database: homedir => path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    app: homedir => path.join(homedir, 'AppData', 'Local', 'Programs', 'Cursor', 'resources', 'app'),
    cursor: homedir => path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'cursor.json'),
    update: homedir => path.join(homedir, 'AppData', 'Local', 'Programs', 'Cursor', 'resources', 'app-update.yml'),
    updater: homedir => path.join(homedir, 'AppData', 'Local', 'cursor-updater')
  },
  darwin: {
    machineId: homedir => path.join(homedir, 'Library', 'Application Support', 'Cursor', 'machineId'),
    storage: homedir => path.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'storage.json'),
    database: homedir => path.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    app: () => '/Applications/Cursor.app/Contents/Resources/app',
    cursor: homedir => path.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'cursor.json'),
    update: () => '/Applications/Cursor.app/Contents/Resources/app-update.yml',
    updater: homedir => path.join(homedir, 'Library', 'Application Support', 'cursor-updater')
  },
  linux: {
    machineId: homedir => path.join(homedir, '.config', 'cursor', 'machineId'),
    storage: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'storage.json'),
    database: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'state.vscdb'),
    app: () => '/usr/share/cursor/resources/app',
    cursor: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'cursor.json'),
    update: () => '/usr/share/cursor/resources/app-update.yml',
    updater: homedir => path.join(homedir, '.config', 'cursor-updater')
  },
  freebsd: {
    machineId: homedir => path.join(homedir, '.config', 'cursor', 'machineId'),
    storage: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'storage.json'),
    database: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'state.vscdb'),
    app: () => '/usr/local/share/cursor/resources/app',
    cursor: homedir => path.join(homedir, '.config', 'cursor', 'User', 'globalStorage', 'cursor.json'),
    update: () => '/usr/local/share/cursor/resources/app-update.yml',
    updater: homedir => path.join(homedir, '.config', 'cursor-updater')
  }
};

// ============================================
// Ключи телеметрии для сброса
// ============================================
const telemetryKeys = envList('TELEMETRY_KEYS', [
  'telemetry.machineId',
  'telemetry.devDeviceId',
  'telemetry.macMachineId',
  'telemetry.sqmId',
  'serviceMachineId',
  'cursor.lastUpdateCheck',
  'cursor.trialStartTime',
  'cursor.trialEndTime',
  'cursor.tier',
  'cursor.usage'
]);

// ============================================
// Настройки автоматизации
// ============================================
const automation = {
  autoUpdateEnabled: envBool('AUTO_UPDATE_ENABLED', false),
  autoUpdateInterval: envInt('AUTO_UPDATE_INTERVAL', 3600000), // 1 час
  autoRollbackEnabled: envBool('AUTO_ROLLBACK_ENABLED', true),
  autoMonitorEnabled: envBool('AUTO_MONITOR_ENABLED', true),
  autoMonitorInterval: envInt('AUTO_MONITOR_INTERVAL', 60000), // 1 минута
  autoResourceMonitoring: envBool('AUTO_RESOURCE_MONITORING', true),
  autoResourceInterval: envInt('AUTO_RESOURCE_INTERVAL', 5000),
  autoMetricsEnabled: envBool('AUTO_METRICS_ENABLED', true),
  autoRetryEnabled: envBool('AUTO_RETRY_ENABLED', true),
  autoRetryMaxAttempts: envInt('AUTO_RETRY_MAX_ATTEMPTS', 3),
  autoRetryBaseDelay: envInt('AUTO_RETRY_BASE_DELAY', 500)
};

// ============================================
// Экспорт конфигурации
// ============================================
export const config = {
  supportedCursorVersions,
  minCursorVersion,
  tokenLimits,
  timeouts,
  workbenchPatterns,
  proConversionPatterns,
  platformPaths,
  telemetryKeys,
  automation,
  dataDir,

  // Валидация конфигурации
  validate() {
    const errors = [];

    if (this.tokenLimits.default < 0) {errors.push('TOKEN_LIMIT_DEFAULT must be >= 0');}
    if (this.tokenLimits.bypassed < this.tokenLimits.default) {errors.push('TOKEN_LIMIT_BYPASSED must be >= TOKEN_LIMIT_DEFAULT');}
    if (this.timeouts.fileOperation <= 0) {errors.push('TIMEOUT_FILE_OPERATION must be > 0');}
    if (this.timeouts.processCheck <= 0) {errors.push('TIMEOUT_PROCESS_CHECK must be > 0');}
    if (this.timeouts.apiRequest <= 0) {errors.push('TIMEOUT_API_REQUEST must be > 0');}
    if (this.automation.autoUpdateInterval < 60000) {errors.push('AUTO_UPDATE_INTERVAL must be >= 60000 (1 min)');}
    if (this.automation.autoMonitorInterval < 10000) {errors.push('AUTO_MONITOR_INTERVAL must be >= 10000 (10 sec)');}
    if (this.automation.autoResourceInterval < 1000) {errors.push('AUTO_RESOURCE_INTERVAL must be >= 1000 (1 sec)');}
    if (this.automation.autoRetryMaxAttempts < 1) {errors.push('AUTO_RETRY_MAX_ATTEMPTS must be >= 1');}
    if (this.automation.autoRetryBaseDelay < 100) {errors.push('AUTO_RETRY_BASE_DELAY must be >= 100');}

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
