/**
 * Metrics Router - API endpoints для метрик
 * Metrics Manager управление
 */

import express from 'express';
import { globalMetricsManager } from '../utils/metricsManager.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/metrics/status
 * Статус метрик
 */
router.get('/status', async (req, res) => {
  try {
    const status = globalMetricsManager.getStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`Metrics status error: ${error.message}`, 'metrics');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/metrics/enable
 * Включить метрики
 */
router.post('/enable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(true);
    return res.json({ success: true, message: 'Metrics enabled' });
  } catch (error) {
    logger.error(`Metrics enable error: ${error.message}`, 'metrics');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/metrics/disable
 * Отключить метрики
 */
router.post('/disable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(false);
    return res.json({ success: true, message: 'Metrics disabled' });
  } catch (error) {
    logger.error(`Metrics disable error: ${error.message}`, 'metrics');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/metrics/export
 * Экспорт метрик
 */
router.get('/export', async (req, res) => {
  try {
    const data = await globalMetricsManager.export();
    return res.json({ success: true, ...data });
  } catch (error) {
    logger.error(`Metrics export error: ${error.message}`, 'metrics');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/metrics/clear
 * Очистка метрик
 */
router.delete('/clear', async (req, res) => {
  try {
    await globalMetricsManager.clear();
    return res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    logger.error(`Metrics clear error: ${error.message}`, 'metrics');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
