/**
 * Notifications Router - API endpoints для уведомлений
 * Telegram, Discord уведомления
 */

import express from 'express';
import { globalNotificationManager } from '../utils/notificationManager.js';
import { globalStatsCache } from '../utils/statsCache.js';
import { validateUrl } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/notifications/status
 * Статус уведомлений
 */
router.get('/status', async (req, res) => {
  const cacheKey = 'notifications:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalNotificationManager.getStatus();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 5000); // 5 секунд TTL
    return res.json(data);
  } catch (error) {
    logger.error(`Notifications status error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/configure/telegram
 * Настройка Telegram
 */
router.post('/configure/telegram', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.status(400).json({ success: false, error: 'botToken and chatId required' });
    }

    // Валидация формата botToken (формат: цифры:хеш)
    const tokenPattern = /^\d+:[\w-]+$/;
    if (!tokenPattern.test(botToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid botToken format (expected: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)'
      });
    }

    // Валидация chatId (должно быть числом или начинаться с - для групп)
    const chatIdStr = String(chatId);
    if (!/^-?\d+$/.test(chatIdStr)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chatId format (expected: numeric ID, e.g. 123456789 or -1001234567890)'
      });
    }

    globalNotificationManager.configureTelegram(botToken, chatId);
    return res.json({ success: true, message: 'Telegram configured' });
  } catch (error) {
    logger.error(`Telegram configure error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/configure/discord
 * Настройка Discord
 */
router.post('/configure/discord', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'webhookUrl required' });
    }

    // Валидация Discord webhook URL (должен быть HTTPS)
    if (!webhookUrl.startsWith('https://') || !validateUrl(webhookUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhookUrl format (must be HTTPS URL)'
      });
    }

    // Проверка что URL действительно Discord webhook
    if (!webhookUrl.includes('discord.com') && !webhookUrl.includes('discordapp.com')) {
      return res.status(400).json({
        success: false,
        error: 'webhookUrl must be a Discord webhook URL'
      });
    }

    globalNotificationManager.configureDiscord(webhookUrl);
    return res.json({ success: true, message: 'Discord configured' });
  } catch (error) {
    logger.error(`Discord configure error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/enable
 * Включить уведомления
 */
router.post('/enable', async (req, res) => {
  try {
    globalNotificationManager.setEnabled(true);
    return res.json({ success: true, message: 'Notifications enabled' });
  } catch (error) {
    logger.error(`Notifications enable error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/disable
 * Отключить уведомления
 */
router.post('/disable', async (req, res) => {
  try {
    globalNotificationManager.setEnabled(false);
    return res.json({ success: true, message: 'Notifications disabled' });
  } catch (error) {
    logger.error(`Notifications disable error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/test
 * Тестовое уведомление
 */
router.post('/test', async (req, res) => {
  try {
    const result = await globalNotificationManager.sendTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Notifications test error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/export
 * Экспорт конфигурации
 */
router.get('/export', async (req, res) => {
  try {
    const config = globalNotificationManager.exportConfig();
    return res.json({ success: true, config });
  } catch (error) {
    logger.error(`Notifications export error: ${error.message}`, 'notifications');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
