/**
 * Application Constants - Централизованные константы
 * Все magic numbers и константы приложения
 *
 * @module utils/constants
 */

/**
 * Константы файловой системы
 */
export const FILE_CONSTANTS = Object.freeze({
  // Workbench файл
  WORKBENCH_MIN_SIZE: 10000, // Минимальный размер (байты)
  WORKBENCH_MAX_SIZE: 50 * 1024 * 1024, // Максимальный размер (50MB)
  WORKBENCH_BRACE_TOLERANCE: 100, // Допустимый дисбаланс скобок

  // Файловые пути
  MAX_PATH_LENGTH: 260, // Windows MAX_PATH
  BACKUP_RETENTION_DAYS: 30, // Дни хранения бэкапов
  MAX_BACKUPS: 10, // Максимальное количество бэкапов

  // Валидация файлов
  FILE_CHECK_TIMEOUT: 2000, // мс на проверку существования файла
  MIN_FILE_SIZE: 0,
  MAX_FILE_SIZE: 100 * 1024 * 1024 // 100MB
});

/**
 * Константы безопасности
 */
export const SECURITY_CONSTANTS = Object.freeze({
  // Rate limiting
  RESET_RATE_LIMIT_MAX: 5, // Максимум reset запросов
  RESET_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 минут (мс)
  NETWORK_RATE_LIMIT_MAX: 10, // Максимум network запросов
  NETWORK_RATE_LIMIT_WINDOW: 10 * 60 * 1000, // 10 минут (мс)

  // Валидация ввода
  MAX_REQUEST_ID_LENGTH: 128,
  MAX_URL_LENGTH: 2048,
  MAX_DOMAIN_LENGTH: 253,
  MAX_EMAIL_LENGTH: 254,
  MAX_CACHE_KEY_LENGTH: 256,
  MAX_CACHE_PREFIX_LENGTH: 128,

  // XSS паттерны
  XSS_PATTERNS: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ],

  // Content Security Policy
  CSP_REPORT_ONLY: false,
  MAX_UPLOAD_SIZE: '1mb'
});

/**
 * Константы процессов
 */
export const PROCESS_CONSTANTS = Object.freeze({
  // Таймауты
  PROCESS_CHECK_TIMEOUT: 5000, // мс на проверку процесса
  GRACEFUL_CLOSE_TIMEOUT: 10000, // мс на graceful закрытие
  RETRY_DELAY: 2000, // мс между попытками

  // Кэширование статуса процесса
  PROCESS_STATUS_CACHE_TTL: 30000, // 30 секунд

  // Максимальное количество попыток
  MAX_KILL_ATTEMPTS: 3
});

/**
 * Константы SQLite
 */
export const SQLITE_CONSTANTS = Object.freeze({
  // Retry конфигурация
  SQLITE_MAX_RETRIES: 3,
  SQLITE_RETRY_BASE_DELAY: 500, // мс
  SQLITE_RETRY_MAX_DELAY: 10000, // мс

  // Размер пула соединений
  SQLITE_POOL_SIZE: 1, // SQLite не поддерживает пулинг

  // Таймауты
  SQLITE_BUSY_TIMEOUT: 5000, // мс
  SQLITE_QUERY_TIMEOUT: 30000, // мс

  // Оптимизация
  SQLITE_INDEX_KEYS: [
    'idx_key_prefix',
    'idx_cursor_keys',
    'idx_telemetry_keys'
  ]
});

/**
 * Константы кэширования
 */
export const CACHE_CONSTANTS = Object.freeze({
  // TTL для разных типов кэша (в мс)
  HEALTH_CACHE_TTL: 5000, // 5 секунд
  PROXY_STATUS_CACHE_TTL: 3000, // 3 секунды
  PROXY_ROTATION_CACHE_TTL: 3000, // 3 секунды
  RESOURCES_STATUS_CACHE_TTL: 3000, // 3 секунды
  RESOURCES_SUMMARY_CACHE_TTL: 5000, // 5 секунд
  NOTIFICATIONS_CACHE_TTL: 5000, // 5 секунд
  CACHE_STATUS_CACHE_TTL: 2000, // 2 секунды

  // Лимиты
  MAX_CACHE_ENTRIES: 1000,
  MAX_CACHE_SIZE_MB: 50,
  CACHE_CLEANUP_INTERVAL: 300000 // 5 минут
});

/**
 * Константы сети
 */
export const NETWORK_CONSTANTS = Object.freeze({
  // Прокси
  PROXY_TIMEOUT: 30000, // 30 секунд
  PROXY_CHECK_INTERVAL: 60000, // 1 минута
  PROXY_ROTATION_MIN_INTERVAL: 60000, // 1 минута
  PROXY_ROTATION_MAX_INTERVAL: 86400000, // 24 часа

  // Порты
  DEFAULT_HTTP_PORT: 3000,
  DEFAULT_WS_PORT: 3001,
  DEFAULT_BYPASS_PORT: 3002,
  MAX_PORT: 65535,
  MIN_PORT: 1,

  // Bypass Server
  BYPASS_MAX_CLIENTS: 100,
  BYPASS_PROXY_TIMEOUT: 30000,
  BYPASS_HEALTH_CHECK_INTERVAL: 60000,
  BYPASS_RATE_LIMIT_WINDOW: 60000,
  BYPASS_RATE_LIMIT_MAX: 100,

  // WebSocket
  WS_HEARTBEAT_INTERVAL: 30000, // 30 секунд
  WS_MAX_PAYLOAD_SIZE: 10 * 1024 * 1024, // 10MB

  // DNS
  DNS_FLUSH_TIMEOUT: 10000, // 10 секунд
});

/**
 * Константы VPN
 */
export const VPN_CONSTANTS = Object.freeze({
  // WireGuard
  WIREGUARD_CONFIG_DIR: 'data/wireguard',
  WIREGUARD_INTERFACE: 'wg0',

  // OpenVPN
  OPENVPN_CONFIG_DIR: 'data/openvpn',
  OPENVPN_LOG_DIR: 'data/openvpn-logs',

  // VPN configs
  VPN_CONFIG_DIR: 'data/vpn-configs',
  VPN_MAX_CONFIGS: 100,
  VPN_CHECK_TIMEOUT: 10000, // 10 секунд

  // VPN API timeout
  VPN_API_TIMEOUT: 5000 // 5 секунд
});

/**
 * Константы регистрации Cursor
 */
export const CURSOR_CONSTANTS = Object.freeze({
  // API endpoints
  CURSOR_AUTH_URL: 'https://authenticator.cursor.sh',
  CURSOR_API_URL: 'https://api2.cursor.sh',

  // Таймауты
  REGISTRATION_TIMEOUT: 180000, // 3 минуты
  VERIFICATION_POLL_INTERVAL: 5000, // 5 секунд
  MAX_VERIFICATION_ATTEMPTS: 36, // 3 минуты / 5 секунд

  // Email сервисы
  EMAIL_SERVICES: ['guerrillamail', 'tempmail', 'sazumi', 'mailinator']
});

/**
 * Константы логирования
 */
export const LOG_CONSTANTS = Object.freeze({
  // Winston
  DEFAULT_LOG_LEVEL: 'info',
  DEFAULT_LOG_FILE: 'logs/app.log',
  DEFAULT_MAX_FILES: 30,
  DEFAULT_MAX_SIZE: '10m',

  // Уровни логирования
  LOG_LEVELS: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  }
});

/**
 * Константы email
 */
export const EMAIL_CONSTANTS = Object.freeze({
  // Таймауты
  EMAIL_WAIT_TIMEOUT: 120000, // 2 минуты
  EMAIL_CHECK_INTERVAL: 5000, // 5 секунд
  MAX_EMAIL_CHECK_ATTEMPTS: 24, // 2 минуты / 5 секунд

  // Валидация
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
});

/**
 * Константы мониторинга ресурсов
 */
export const RESOURCE_CONSTANTS = Object.freeze({
  // Пороги алертов
  CPU_ALERT_THRESHOLD: 90, // %
  MEMORY_ALERT_THRESHOLD: 90, // %
  DISK_ALERT_THRESHOLD: 95, // %

  // Интервалы
  MONITOR_INTERVAL: 5000, // 5 секунд
  HISTORY_MAX_ENTRIES: 1000,
  ALERTS_MAX_ENTRIES: 100,

  // Лимиты запросов
  HISTORY_MAX_LIMIT: 1000,
  ALERTS_MAX_LIMIT: 100
});

/**
 * Экспорт всех констант для импорта
 */
export const CONSTANTS = Object.freeze({
  FILE: FILE_CONSTANTS,
  SECURITY: SECURITY_CONSTANTS,
  PROCESS: PROCESS_CONSTANTS,
  SQLITE: SQLITE_CONSTANTS,
  CACHE: CACHE_CONSTANTS,
  NETWORK: NETWORK_CONSTANTS,
  VPN: VPN_CONSTANTS,
  CURSOR: CURSOR_CONSTANTS,
  LOG: LOG_CONSTANTS,
  EMAIL: EMAIL_CONSTANTS,
  RESOURCE: RESOURCE_CONSTANTS
});

export default CONSTANTS;
