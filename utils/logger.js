import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Простой логгер для записи в файл и консоль
 */
export const logger = {
  logDir: path.join(__dirname, '..', 'logs'),

  async init() {
    await fs.ensureDir(this.logDir);
  },

  async write(level, message, context = '') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${context}: ${message}\n`;

    console.log(logLine.trim());

    try {
      await fs.appendFile(
        path.join(this.logDir, 'app.log'),
        logLine
      );
    } catch (e) {
      // Игнорируем ошибки логирования
    }
  },

  async info(message, context = 'app') {
    await this.write('info', message, context);
  },

  async warn(message, context = 'app') {
    await this.write('warn', message, context);
  },

  async error(message, context = 'app') {
    await this.write('error', message, context);
  },

  async debug(message, context = 'app') {
    if (process.env.DEBUG === 'true') {
      await this.write('debug', message, context);
    }
  }
};
