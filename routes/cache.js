/**
 * Cache Router - API endpoints для управления кэшем
 * Stats Cache управление
 */

import express from 'express';
import { globalStatsCache } from '../utils/statsCache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/cache/status
 * Статус кэша
 */
router.get('/status', async (req, res) => {
  const cacheKey = 'cache:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalStatsCache.getStats();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 2000); // 2 секунды TTL
    return res.json(data);
  } catch (error) {
    logger.error(`Cache status error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cache/stats
 * Экспорт статистики кэша
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = globalStatsCache.export();
    return res.json({ success: true, ...stats });
  } catch (error) {
    logger.error(`Cache stats error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cache/clear
 * Очистка кэша
 */
router.post('/clear', async (req, res) => {
  try {
    globalStatsCache.clear();
    return res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    logger.error(`Cache clear error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cache/reset-stats
 * Сброс статистики кэша
 */
router.post('/reset-stats', async (req, res) => {
  try {
    globalStatsCache.resetStats();
    return res.json({ success: true, message: 'Stats reset' });
  } catch (error) {
    logger.error(`Cache reset-stats error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cache/key
 * Получение значения по ключу
 */
router.get('/key', async (req, res) => {
  try {
    const { key, includeValue } = req.query;
    if (!key) {
      return res.status(400).json({ success: false, error: 'key is required' });
    }

    const entry = globalStatsCache.getEntry(String(key), { includeValue: includeValue === 'true' });
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Key not found' });
    }

    return res.json({ success: true, entry });
  } catch (error) {
    logger.error(`Cache key error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cache/invalidate
 * Инвалидация по префиксу
 */
router.post('/invalidate', async (req, res) => {
  try {
    const { prefix } = req.body || {};
    if (!prefix) {
      return res.status(400).json({ success: false, error: 'prefix is required' });
    }
    const deleted = globalStatsCache.deleteByPrefix(String(prefix));
    return res.json({ success: true, deleted });
  } catch (error) {
    logger.error(`Cache invalidate error: ${error.message}`, 'cache');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
