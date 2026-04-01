/**
 * Resources Router - API endpoints для мониторинга ресурсов
 * CPU, RAM, Disk мониторинг
 */

import express from 'express';
import { globalResourceMonitor } from '../utils/resourceMonitor.js';
import { globalStatsCache } from '../utils/statsCache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/resources/status
 * Текущий статус ресурсов
 */
router.get('/status', async (req, res) => {
  const cacheKey = 'resources:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalResourceMonitor.getCurrentStats();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 3000); // 3 секунды TTL
    return res.json(data);
  } catch (error) {
    logger.error(`Resources status error: ${error.message}`, 'resources');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/resources/summary
 * Сводка по ресурсам
 */
router.get('/summary', async (req, res) => {
  const cacheKey = 'resources:summary';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const summary = globalResourceMonitor.getSummary();
    const data = { success: true, ...summary };
    globalStatsCache.set(cacheKey, data, 5000); // 5 секунд TTL
    return res.json(data);
  } catch (error) {
    logger.error(`Resources summary error: ${error.message}`, 'resources');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/resources/history
 * История использования ресурсов
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const history = globalResourceMonitor.getHistory(parseInt(limit, 10));
    return res.json({ success: true, history });
  } catch (error) {
    logger.error(`Resources history error: ${error.message}`, 'resources');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/resources/alerts
 * Алерты по ресурсам
 */
router.get('/alerts', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const alerts = globalResourceMonitor.getAlerts(parseInt(limit, 10));
    return res.json({ success: true, alerts });
  } catch (error) {
    logger.error(`Resources alerts error: ${error.message}`, 'resources');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/resources/alerts/clear
 * Очистка алертов
 */
router.post('/alerts/clear', async (req, res) => {
  try {
    globalResourceMonitor.clearAlerts();
    return res.json({ success: true, message: 'Alerts cleared' });
  } catch (error) {
    logger.error(`Clear alerts error: ${error.message}`, 'resources');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
