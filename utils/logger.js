import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs-extra';

// Цвета для уровней логирования
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  verbose: 'cyan'
};

winston.addColors(colors);

// Формат для консоли с цветами
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context }) => `${timestamp} [${level}]: ${context ? `[${context}] ` : ''}${message}`)
);

// Формат для файла
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

/**
 * Создание логгера с поддержкой ротации файлов
 * @param {Object} options - Опции логгера
 * @param {string} options.level - Уровень логирования (error, warn, info, debug, verbose)
 * @param {string} options.filename - Путь к файлу логов
 * @param {number} options.maxFiles - Максимальное количество файлов для хранения
 * @param {string} options.maxSize - Максимальный размер файла перед ротацией
 * @returns {winston.Logger} Настроенный логгер
 */
export function createLogger(options = {}) {
  const {
    level = 'info',
    filename = 'logs/app.log',
    maxFiles = 30,
    maxSize = '10m'
  } = options;

  const logDir = path.dirname(filename);
  fs.ensureDirSync(logDir);

  // Транспорт для консоли
  const consoleTransport = new winston.transports.Console({
    format: consoleFormat,
    level
  });

  // Транспорт для файла с ротацией
  const fileTransport = new winston.transports.DailyRotateFile({
    filename: filename.replace('.log', '-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize,
    maxFiles,
    format: fileFormat,
    level,
    createSymlink: true,
    symlinkName: filename.replace('.log', '-current.log')
  });

  // Транспорт для ошибок (отдельный файл)
  const errorTransport = new winston.transports.DailyRotateFile({
    filename: filename.replace('.log', '-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize,
    maxFiles,
    level: 'error',
    format: fileFormat
  });

  const logger = winston.createLogger({
    level,
    transports: [consoleTransport, fileTransport, errorTransport],
    exitOnError: false,
    defaultMeta: { service: 'cursor-reset-tools' }
  });

  return logger;
}

// Логгер по умолчанию для обратной совместимости
export const logger = createLogger();

/**
 * Контекстный логгер для использования в модулях
 * @param {string} context - Контекст для логирования (например, имя модуля)
 * @returns {Object} Объект с методами логирования
 */
export function createScopedLogger(context) {
  return {
    info: (message, meta) => logger.info(message, { context, ...meta }),
    warn: (message, meta) => logger.warn(message, { context, ...meta }),
    error: (message, meta) => logger.error(message, { context, ...meta }),
    debug: (message, meta) => logger.debug(message, { context, ...meta }),
    verbose: (message, meta) => logger.verbose(message, { context, ...meta })
  };
}
