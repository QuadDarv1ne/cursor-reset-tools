/**
 * Тесты для NotificationManager
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { NotificationManager } from '../utils/notificationManager.js';

describe('NotificationManager', () => {
  let notifier;

  beforeEach(() => {
    notifier = new NotificationManager();
    notifier.init();
  });

  describe('Инициализация', () => {
    test('должен создаваться новый экземпляр', () => {
      expect(notifier).toBeInstanceOf(NotificationManager);
    });

    test('init должен возвращать this для chaining', () => {
      const result = notifier.init();
      expect(result).toBe(notifier);
    });

    test('должен иметь начальную конфигурацию', () => {
      expect(notifier.config).toBeDefined();
      expect(notifier.config.enabled).toBe(false);
    });

    test('должен иметь пустую очередь', () => {
      expect(notifier.queue).toEqual([]);
    });

    test('должен иметь начальную статистику', () => {
      expect(notifier.sentCount).toBe(0);
      expect(notifier.failedCount).toBe(0);
    });
  });

  describe('Конфигурация Telegram', () => {
    test('configureTelegram должен устанавливать параметры', () => {
      notifier.configureTelegram('test-token', 'test-chat-id');

      expect(notifier.config.telegram.enabled).toBe(true);
      expect(notifier.config.telegram.botToken).toBe('test-token');
      expect(notifier.config.telegram.chatId).toBe('test-chat-id');
      expect(notifier.config.enabled).toBe(true);
    });

    test('configureTelegram должен включать уведомления', () => {
      notifier.configureTelegram('token', 'chat');
      expect(notifier.config.enabled).toBe(true);
    });
  });

  describe('Конфигурация Discord', () => {
    test('configureDiscord должен устанавливать webhook', () => {
      notifier.configureDiscord('https://discord.com/api/webhooks/test');

      expect(notifier.config.discord.enabled).toBe(true);
      expect(notifier.config.discord.webhookUrl).toBe('https://discord.com/api/webhooks/test');
      expect(notifier.config.enabled).toBe(true);
    });
  });

  describe('Включение/Выключение', () => {
    test('setEnabled(true) должен включать уведомления', () => {
      notifier.setEnabled(true);
      expect(notifier.config.enabled).toBe(true);
    });

    test('setEnabled(false) должен выключать уведомления', () => {
      notifier.setEnabled(true);
      notifier.setEnabled(false);
      expect(notifier.config.enabled).toBe(false);
    });
  });

  describe('Конфигурация событий', () => {
    test('configureEvents должен обновлять настройки событий', () => {
      notifier.configureEvents({ sendOnStart: true, sendOnStop: false });

      expect(notifier.config.events.sendOnStart).toBe(true);
      expect(notifier.config.events.sendOnStop).toBe(false);
    });

    test('configureEvents должен сохранять остальные настройки', () => {
      notifier.configureEvents({ sendOnStart: true });

      expect(notifier.config.events.sendOnAlert).toBe(true); // default
    });
  });

  describe('Отправка уведомлений', () => {
    test('send должен возвращать disabled когда enabled=false', async () => {
      const result = await notifier.send('Title', 'Message', 'info');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    test('send должен добавлять в очередь когда enabled=true', async () => {
      notifier.setEnabled(true);
      const initialLength = notifier.queue.length;

      await notifier.send('Title', 'Message');

      expect(notifier.queue.length).toBeGreaterThan(initialLength);
    });
  });

  describe('Отправка событий', () => {
    test('sendEvent должен возвращать success для start', async () => {
      notifier.setEnabled(true);
      const result = await notifier.sendEvent('start', { version: '2.4.0' });

      expect(result.success).toBe(true);
    });

    test('sendEvent должен возвращать success для stop', async () => {
      notifier.setEnabled(true);
      const result = await notifier.sendEvent('stop', { uptime: '1h' });

      expect(result.success).toBe(true);
    });

    test('sendEvent должен возвращать success для alert', async () => {
      notifier.setEnabled(true);
      const result = await notifier.sendEvent('alert', { message: 'Test alert' });

      expect(result.success).toBe(true);
    });

    test('sendEvent должен возвращать success для cursorReset', async () => {
      notifier.setEnabled(true);
      const result = await notifier.sendEvent('cursorReset', { details: 'Success' });

      expect(result.success).toBe(true);
    });

    test('sendEvent должен возвращать ошибку для неизвестного события', async () => {
      const result = await notifier.sendEvent('unknown-event');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unknown event');
    });
  });

  describe('Статистика', () => {
    test('getStats должен возвращать статистику', () => {
      const stats = notifier.getStats();

      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('telegram');
      expect(stats).toHaveProperty('discord');
      expect(stats).toHaveProperty('queue');
      expect(stats).toHaveProperty('sentCount');
      expect(stats).toHaveProperty('failedCount');
    });

    test('getStats должен показывать статус Telegram', () => {
      notifier.configureTelegram('token', 'chat');
      const stats = notifier.getStats();

      expect(stats.telegram.enabled).toBe(true);
      expect(stats.telegram.configured).toBe(true);
    });

    test('getStats должен показывать статус Discord', () => {
      notifier.configureDiscord('webhook-url');
      const stats = notifier.getStats();

      expect(stats.discord.enabled).toBe(true);
      expect(stats.discord.configured).toBe(true);
    });

    test('getStatus должен возвращать расширенный статус', () => {
      const status = notifier.getStatus();

      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('queue');
    });
  });

  describe('Тестовое уведомление', () => {
    test('sendTest должен возвращать queued', async () => {
      notifier.setEnabled(true);
      const result = await notifier.sendTest();

      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
    });
  });

  describe('Очистка очереди', () => {
    test('clearQueue должен очищать очередь', () => {
      notifier.queue.push({ title: 'Test', message: 'Message' });
      notifier.queue.push({ title: 'Test2', message: 'Message2' });

      const count = notifier.clearQueue();

      expect(count).toBe(2);
      expect(notifier.queue.length).toBe(0);
    });

    test('clearQueue должен возвращать 0 для пустой очереди', () => {
      const count = notifier.clearQueue();
      expect(count).toBe(0);
    });
  });

  describe('Экспорт конфигурации', () => {
    test('exportConfig должен возвращать конфигурацию', () => {
      notifier.configureTelegram('secret-token', 'chat-id');
      notifier.configureDiscord('secret-webhook');

      const config = notifier.exportConfig();

      expect(config).toHaveProperty('telegram');
      expect(config).toHaveProperty('discord');
      expect(config.telegram.botToken).toBe('***'); // Скрыто
      expect(config.discord.webhookUrl).toBe('***'); // Скрыто
    });

    test('exportConfig должен скрывать чувствительные данные', () => {
      notifier.configureTelegram('my-secret-token', 'chat');
      const config = notifier.exportConfig();

      expect(config.telegram.botToken).not.toBe('my-secret-token');
      expect(config.telegram.botToken).toBe('***');
    });
  });

  describe('Загрузка из ENV', () => {
    test('должен загружать Telegram из переменных окружения', () => {
      // Сохраняем оригинальные значения
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      const originalChatId = process.env.TELEGRAM_CHAT_ID;

      // Устанавливаем тестовые значения
      process.env.TELEGRAM_BOT_TOKEN = 'env-token';
      process.env.TELEGRAM_CHAT_ID = 'env-chat-id';

      const newNotifier = new NotificationManager();
      newNotifier.init();

      expect(newNotifier.config.telegram.enabled).toBe(true);
      expect(newNotifier.config.telegram.botToken).toBe('env-token');
      expect(newNotifier.config.telegram.chatId).toBe('env-chat-id');

      // Восстанавливаем оригинальные значения
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
      process.env.TELEGRAM_CHAT_ID = originalChatId;
    });

    test('должен загружать Discord из переменных окружения', () => {
      const originalWebhook = process.env.DISCORD_WEBHOOK_URL;

      process.env.DISCORD_WEBHOOK_URL = 'env-webhook-url';

      const newNotifier = new NotificationManager();
      newNotifier.init();

      expect(newNotifier.config.discord.enabled).toBe(true);
      expect(newNotifier.config.discord.webhookUrl).toBe('env-webhook-url');

      process.env.DISCORD_WEBHOOK_URL = originalWebhook;
    });
  });
});
