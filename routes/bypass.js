/**
 * Bypass Router - API endpoints для тестирования обхода
 */

import express from 'express';
import { globalBypassTester } from '../utils/bypassTester.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/bypass/test/full
 * Полный тест обхода
 */
router.get('/test/full', async (req, res) => {
  try {
    const result = await globalBypassTester.runFullTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Bypass full test error: ${error.message}`, 'bypass');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bypass/test/quick
 * Быстрый тест обхода
 */
router.get('/test/quick', async (req, res) => {
  try {
    const result = await globalBypassTester.runQuickTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Bypass quick test error: ${error.message}`, 'bypass');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bypass/results
 * Последние результаты тестов
 */
router.get('/results', async (req, res) => {
  try {
    const results = globalBypassTester.getLastResults();
    return res.json({ success: true, results });
  } catch (error) {
    logger.error(`Bypass results error: ${error.message}`, 'bypass');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bypass/recommendations
 * Рекомендации по обходу
 */
router.get('/recommendations', async (req, res) => {
  try {
    const text = globalBypassTester.getFormattedRecommendations();
    return res.json({ success: true, text });
  } catch (error) {
    logger.error(`Bypass recommendations error: ${error.message}`, 'bypass');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
