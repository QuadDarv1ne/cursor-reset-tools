/**
 * AppConfig - Единая система конфигурации из .env файлов
 * Централизованное управление всеми настройками приложения
 *
 * @module utils/appConfig
 */

import dotenv from 'dotenv';

// Загрузка .env файла (если существует)
dotenv.config();

/**
 * Парсинг числовых значений с fallback
 */
const parseNumber = (value, fallback) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * Парсинг boolean значений
 */
const parseBool = (value, fallback) => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return typeof value === 'boolean' ? value : fallback;
};

/**
 * Конфигурация приложения
 * Все значения читаются из .env файла с fallback на значения по умолчанию
 */
export const appConfig = {
  // ============================================
  // СЕТЬ
  // ============================================
  network: {
    /** Основной HTTP порт */
    port: parseNumber(process.env.PORT, 3000),

    /** WebSocket порт (используется тот же что HTTP, но можно разделить) */
    wsPort: parseNumber(process.env.WS_PORT, 3000),

    /** Хост для bind */
    host: process.env.HOST || '0.0.0.0',

    /** Режим окружения */
    nodeEnv: process.env.NODE_ENV || 'development',

    /** Проверять доступность порта при старте */
    checkPortAvailability: parseBool(process.env.CHECK_PORT_AVAILABILITY, true),

    /** Диапазон портов для авто-выбора */
    portRangeStart: parseNumber(process.env.PORT_RANGE_START, 3000),
    portRangeMaxAttempts: parseNumber(process.env.PORT_MAX_ATTEMPTS, 20)
  },

  // ============================================
  // WEBSOCKET
  // ============================================
  websocket: {
    /** Максимальное количество клиентов */
    maxClients: parseNumber(process.env.WS_MAX_CLIENTS, 100),

    /** Таймаут неактивности клиента (мс) */
    clientTimeout: parseNumber(process.env.WS_CLIENT_TIMEOUT, 300000),

    /** Интервал ping/pong (мс) */
    pingInterval: parseNumber(process.env.WS_PING_INTERVAL, 30000),

    /** Максимальный размер сообщения (байты) */
    maxMessageSize: parseNumber(process.env.WS_MAX_MESSAGE_SIZE, 1024 * 1024),

    /** Максимальное количество подписок на канал */
    maxSubscriptions: parseNumber(process.env.WS_MAX_SUBSCRIPTIONS, 10),

    /** Порог сжатия сообщений (байты) */
    compressionThreshold: parseNumber(process.env.WS_COMPRESSION_THRESHOLD, 1024),

    /** TTL кэша статуса (мс) */
    cacheTTL: parseNumber(process.env.WS_CACHE_TTL, 5000),

    /** Окно дедупликации (мс) */
    dedupWindow: parseNumber(process.env.WS_DEDUP_WINDOW, 1000),

    /** Лимит сообщений в секунду на клиента */
    rateLimit: parseNumber(process.env.WS_RATE_LIMIT, 50),

    /** Интервал broadcast (мс) */
    broadcastInterval: parseNumber(process.env.WS_BROADCAST_INTERVAL, 10000),

    /** Минимальный интервал вещания (мс) */
    broadcastThrottle: parseNumber(process.env.WS_BROADCAST_THROTTLE, 100)
  },

  // ============================================
  // БЕЗОПАСНОСТЬ
  // ============================================
  security: {
    /** Включить Content Security Policy */
    cspEnabled: parseBool(process.env.CSP_ENABLED, true),

    /** Rate limiting window (мс) */
    rateLimitWindow: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),

    /** Максимум запросов в окно */
    rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),

    /** Максимальный размер загружаемых данных */
    maxUploadSize: process.env.MAX_UPLOAD_SIZE || '1mb'
  },

  // ============================================
  // ЛОГИРОВАНИЕ
  // ============================================
  logging: {
    /** Уровень логирования (debug, info, warn, error) */
    level: process.env.LOG_LEVEL || 'info',

    /** Путь к файлу лога */
    file: process.env.LOG_FILE || 'logs/app.log',

    /** Максимальное количество файлов */
    maxFiles: parseNumber(process.env.LOG_MAX_FILES, 30),

    /** Максимальный размер файла */
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },

  // ============================================
  // ОБНОВЛЕНИЯ
  // ============================================
  updater: {
    /** Включить автоматическую проверку обновлений */
    enabled: parseBool(process.env.AUTO_UPDATE_ENABLED, true),

    /** Интервал проверки обновлений (мс) */
    checkInterval: parseNumber(process.env.UPDATE_CHECK_INTERVAL, 24 * 60 * 60 * 1000), // 24 часа по умолчанию

    /** Таймаут запроса обновления (мс) */
    timeout: parseNumber(process.env.UPDATE_TIMEOUT, 30000)
  },

  // ============================================
  // МОНИТОРИНГ
  // ============================================
  monitoring: {
    /** Включить мониторинг метрик */
    metricsEnabled: parseBool(process.env.METRICS_ENABLED, true),

    /** Интервал сбора метрик (мс) */
    metricsInterval: parseNumber(process.env.METRICS_INTERVAL, 60000),

    /** Интервал авто-проверки IP (мс) */
    autoCheckInterval: parseNumber(process.env.MONITOR_AUTO_CHECK_INTERVAL, 60000),

    /** Интервал мониторинга ресурсов (мс) */
    resourceSampleInterval: parseNumber(process.env.RESOURCE_SAMPLE_INTERVAL, 5000),

    /** Порог CPU для алерта (%) */
    cpuThreshold: parseNumber(process.env.RESOURCE_CPU_THRESHOLD, 90),

    /** Порог памяти для алерта (%) */
    memoryThreshold: parseNumber(process.env.RESOURCE_MEMORY_THRESHOLD, 90),

    /** Порог диска для алерта (%) */
    diskThreshold: parseNumber(process.env.RESOURCE_DISK_THRESHOLD, 95),

    /** История метрик (количество записей) */
    historyLimit: parseNumber(process.env.METRICS_HISTORY_LIMIT, 100)
  },

  // ============================================
  // ПРОКСИ
  // ============================================
  proxy: {
    /** Включить прокси */
    enabled: parseBool(process.env.PROXY_ENABLED, false),

    /** Таймаут проверки прокси (мс) */
    checkTimeout: parseNumber(process.env.PROXY_CHECK_TIMEOUT, 30000),

    /** Интервал авто-ротации (мс) */
    autoRotationInterval: parseNumber(process.env.PROXY_AUTO_ROTATION_INTERVAL, 300000),

    /** TTL кэша прокси (мс) */
    cacheTTL: parseNumber(process.env.PROXY_CACHE_TTL, 300000),

    /** Максимальный размер кэша прокси */
    maxCacheSize: parseNumber(process.env.PROXY_MAX_CACHE_SIZE, 100)
  },

  // ============================================
  // DNS
  // ============================================
  dns: {
    /** DNS провайдер (cloudflare, google, quad9) */
    provider: process.env.DNS_PROVIDER || 'cloudflare',

    /** Таймаут DNS запроса (мс) */
    timeout: parseNumber(process.env.DNS_TIMEOUT, 10000)
  },

  // ============================================
  // РЕЗЕРВНОЕ КОПИРОВАНИЕ
  // ============================================
  backup: {
    /** Включить автоматическое резервное копирование */
    enabled: parseBool(process.env.BACKUP_ENABLED, true),

    /** Путь для хранения бэкапов */
    path: process.env.BACKUP_PATH || 'backups',

    /** Максимальное количество бэкапов */
    maxCount: parseNumber(process.env.BACKUP_MAX_COUNT, 10),

    /** Интервал авто-бэкапа (мс) */
    autoInterval: parseNumber(process.env.BACKUP_AUTO_INTERVAL, 24 * 60 * 60 * 1000) // 24 часа
  },

  // ============================================
  // УВЕДОМЛЕНИЯ
  // ============================================
  notifications: {
    /** Telegram Bot Token */
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,

    /** Telegram Chat ID */
    telegramChatId: process.env.TELEGRAM_CHAT_ID || null,

    /** Discord Webhook URL */
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null
  },

  // ============================================
  // КЭШ
  // ============================================
  cache: {
    /** TTL кэша по умолчанию (мс) */
    defaultTTL: parseNumber(process.env.CACHE_TTL_DEFAULT, 5000),

    /** Максимальный размер кэша (записи) */
    maxEntries: parseNumber(process.env.CACHE_MAX_SIZE, 1000),

    /** Интервал очистки кэша (мс) */
    cleanupInterval: parseNumber(process.env.CACHE_CLEANUP_INTERVAL, 60000)
  },

  // ============================================
  // GRACEFUL SHUTDOWN
  // ============================================
  shutdown: {
    /** Таймаут graceful shutdown (мс) */
    timeout: parseNumber(process.env.SHUTDOWN_TIMEOUT, 30000),

    /** Таймаут закрытия HTTP сервера (мс) */
    serverCloseTimeout: parseNumber(process.env.SHUTDOWN_SERVER_TIMEOUT, 10000),

    /** Таймаут закрытия WebSocket (мс) */
    wsCloseTimeout: parseNumber(process.env.SHUTDOWN_WS_TIMEOUT, 5000)
  },

  // ============================================
  // УТИЛИТЫ
  // ============================================
  
  /** Получить значение конфигурации по пути (напр. 'network.port') */
  get(path, fallback = undefined) {
    const parts = path.split('.');
    let value = this;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return fallback;
      }
    }
    return value;
  },

  /** Проверить включена ли функция */
  isEnabled(feature) {
    const featureMap = {
      proxy: this.proxy.enabled,
      metrics: this.monitoring.metricsEnabled,
      backup: this.backup.enabled,
      autoUpdate: this.updater.enabled,
      csp: this.security.cspEnabled
    };
    return featureMap[feature] ?? false;
  },

  /** Получить конфигурацию для передачи во фронтенд */
  toPublicConfig() {
    return {
      wsPort: this.network.wsPort,
      features: {
        proxy: this.proxy.enabled,
        metrics: this.monitoring.metricsEnabled,
        monitoring: true,
        smartBypass: true
      },
      limits: {
        maxClients: this.websocket.maxClients,
        rateLimit: this.websocket.rateLimit
      }
    };
  }
};

// Заморозка конфигурации для предотвращения изменений
Object.freeze(appConfig.network);
Object.freeze(appConfig.websocket);
Object.freeze(appConfig.security);
Object.freeze(appConfig.logging);
Object.freeze(appConfig.updater);
Object.freeze(appConfig.monitoring);
Object.freeze(appConfig.proxy);
Object.freeze(appConfig.dns);
Object.freeze(appConfig.backup);
Object.freeze(appConfig.notifications);
Object.freeze(appConfig.cache);
Object.freeze(appConfig.shutdown);

export default appConfig;
