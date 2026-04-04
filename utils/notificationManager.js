/**
 * Notification Manager - Уведомления в Telegram и Discord
 * Отправка событий и алертов в мессенджеры
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { withRetry } from './helpers.js';

/**
 * Конфигурация уведомлений
 */
export const NOTIFICATION_CONFIG = {
  enabled: false,
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    parseMode: 'HTML'
  },
  discord: {
    enabled: false,
    webhookUrl: ''
  },
  events: {
    sendOnStart: false,
    sendOnStop: false,
    sendOnAlert: true,
    sendOnProxyRotate: false,
    sendOnCursorReset: true
  }
};

/**
 * Класс для управления уведомлениями
 */
export class NotificationManager {
  constructor() {
    this.config = { ...NOTIFICATION_CONFIG };
    this.queue = [];
    this.isProcessing = false;
    this.sentCount = 0;
    this.failedCount = 0;
    this.lastSent = null;
  }

  /**
   * Инициализация менеджера уведомлений
   */
  init() {
    logger.info('Initializing Notification Manager...', 'notification');

    // Загрузка конфигурации из env (опционально)
    this._loadFromEnv();

    logger.info('Notification Manager initialized', 'notification');
    return this;
  }

  /**
   * Загрузка настроек из переменных окружения
   */
  _loadFromEnv() {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

    if (telegramToken && telegramChatId) {
      this.config.telegram.enabled = true;
      this.config.telegram.botToken = telegramToken;
      this.config.telegram.chatId = telegramChatId;
      this.config.enabled = true;
      logger.info('Telegram notifications enabled from env', 'notification');
    }

    if (discordWebhook) {
      this.config.discord.enabled = true;
      this.config.discord.webhookUrl = discordWebhook;
      this.config.enabled = true;
      logger.info('Discord notifications enabled from env', 'notification');
    }
  }

  /**
   * Настроить Telegram
   */
  configureTelegram(botToken, chatId) {
    this.config.telegram.botToken = botToken;
    this.config.telegram.chatId = chatId;
    this.config.telegram.enabled = true;
    this.config.enabled = true;
    logger.info('Telegram configured', 'notification');
  }

  /**
   * Настроить Discord
   */
  configureDiscord(webhookUrl) {
    this.config.discord.webhookUrl = webhookUrl;
    this.config.discord.enabled = true;
    this.config.enabled = true;
    logger.info('Discord configured', 'notification');
  }

  /**
   * Включить/выключить уведомления
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    logger.info(`Notifications ${enabled ? 'enabled' : 'disabled'}`, 'notification');
  }

  /**
   * Настроить события для отправки
   */
  configureEvents(events) {
    this.config.events = { ...this.config.events, ...events };
  }

  /**
   * Отправить уведомление
   * @param {string} title - Заголовок
   * @param {string} message - Сообщение
   * @param {string} level - Уровень (info, warning, error, success)
   */
  async send(title, message, level = 'info') {
    if (!this.config.enabled) {
      return { success: false, reason: 'disabled' };
    }

    const notification = {
      title,
      message,
      level,
      timestamp: Date.now()
    };

    this.queue.push(notification);
    this._processQueue();

    return { success: true, queued: true };
  }

  /**
   * Обработка очереди уведомлений
   */
  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const notification = this.queue.shift();
      await this._sendNotification(notification);
    }

    this.isProcessing = false;
  }

  /**
   * Отправка одного уведомления
   */
  async _sendNotification(notification) {
    const promises = [];

    if (this.config.telegram.enabled) {
      promises.push(this._sendToTelegram(notification));
    }

    if (this.config.discord.enabled) {
      promises.push(this._sendToDiscord(notification));
    }

    try {
      const results = await Promise.allSettled(promises);
      const success = results.every(r => r.status === 'fulfilled' && r.value);

      if (success) {
        this.sentCount++;
        this.lastSent = Date.now();
        logger.debug(`Notification sent: ${notification.title}`, 'notification');
      } else {
        this.failedCount++;
        logger.warn(`Notification failed: ${notification.title}`, 'notification');
      }

      return success;
    } catch (error) {
      this.failedCount++;
      logger.error(`Notification error: ${error.message}`, 'notification');
      return false;
    }
  }

  /**
   * Отправка в Telegram
   */
  async _sendToTelegram(notification) {
    const { botToken, chatId, parseMode } = this.config.telegram;

    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    const text = `
${emoji[notification.level] || 'ℹ️'} <b>${notification.title}</b>

${notification.message}

<i>${new Date(notification.timestamp).toLocaleString()}</i>
    `.trim();

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    await withRetry(
      async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: parseMode
          })
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Telegram API error: ${error}`);
        }
        return res;
      },
      { maxAttempts: 3, baseDelay: 1000, exponential: true }
    );

    return true;
  }

  /**
   * Отправка в Discord
   */
  async _sendToDiscord(notification) {
    const { webhookUrl } = this.config.discord;

    const color = {
      info: 3447003, // синий
      warning: 15158332, // оранжевый
      error: 15548997, // красный
      success: 3066993 // зелёный
    };

    const embed = {
      title: notification.title,
      description: notification.message,
      color: color[notification.level] || color.info,
      timestamp: new Date(notification.timestamp).toISOString(),
      footer: {
        text: 'Cursor Reset Tools'
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord webhook error: ${error}`);
    }

    return true;
  }

  /**
   * Отправить событие (с учётом настроек)
   */
  async sendEvent(eventType, data = {}) {
    // Проверка включено ли событие
    const eventConfigKey = `sendOn${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
    const eventEnabled = this.config.events[eventConfigKey];

    // Если событие явно выключено, не отправляем (но не ошибка)
    if (eventEnabled === false) {
      return { success: true, skipped: true, reason: 'event disabled' };
    }

    const templates = {
      start: {
        title: '🚀 Приложение запущено',
        message: `Cursor Reset Tools запущен\nВерсия: ${data.version || 'unknown'}`
      },
      stop: {
        title: '🛑 Приложение остановлено',
        message: `Приложение корректно завершает работу\nUptime: ${data.uptime || 'unknown'}`
      },
      alert: {
        title: '⚠️ Предупреждение',
        message: data.message || 'Произошло событие, требующее внимания'
      },
      proxyRotate: {
        title: '🔄 Прокси ротирован',
        message: `Новый прокси: ${data.proxy || 'unknown'}`
      },
      cursorReset: {
        title: '✅ Cursor сброшен',
        message: `Machine ID успешно сброшен\n${data.details || ''}`
      }
    };

    const template = templates[eventType];

    if (!template) {
      return { success: false, reason: 'unknown event' };
    }

    return this.send(template.title, template.message, data.level || 'info');
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      enabled: this.config.enabled,
      telegram: {
        enabled: this.config.telegram.enabled,
        configured: !!this.config.telegram.botToken && !!this.config.telegram.chatId
      },
      discord: {
        enabled: this.config.discord.enabled,
        configured: !!this.config.discord.webhookUrl
      },
      queue: this.queue.length,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      lastSent: this.lastSent,
      events: this.config.events
    };
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      ...this.getStats(),
      isProcessing: this.isProcessing
    };
  }

  /**
   * Тестовое уведомление
   */
  async sendTest() {
    return this.send(
      '🧪 Тестовое уведомление',
      'Если вы видите это сообщение, уведомления работают корректно',
      'success'
    );
  }

  /**
   * Очистить очередь
   */
  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    logger.info(`Cleared ${count} pending notifications`, 'notification');
    return count;
  }

  /**
   * Экспорт конфигурации
   */
  exportConfig() {
    return {
      ...this.config,
      telegram: {
        ...this.config.telegram,
        botToken: this.config.telegram.botToken ? '***' : ''
      },
      discord: {
        ...this.config.discord,
        webhookUrl: this.config.discord.webhookUrl ? '***' : ''
      }
    };
  }
}

// Глобальный экземпляр
export const globalNotificationManager = new NotificationManager();

export default NotificationManager;
