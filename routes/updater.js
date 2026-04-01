/**
 * Updater Router - API endpoints для обновлений
 */

import express from 'express';
import path from 'path';
import { globalUpdater } from '../utils/updater.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/updater/status
 * Статус обновлений
 */
router.get('/status', async (req, res) => {
  try {
    const status = globalUpdater.getStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`Updater status error: ${error.message}`, 'updater');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/updater/check
 * Проверить обновления
 */
router.get('/check', async (req, res) => {
  try {
    const result = await globalUpdater.checkForUpdates();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Updater check error: ${error.message}`, 'updater');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/updater/download
 * Скачать обновление
 */
router.get('/download', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    await globalUpdater.downloadUpdate(downloadPath);
    return res.json({ success: true, message: 'Update downloaded', path: downloadPath });
  } catch (error) {
    logger.error(`Updater download error: ${error.message}`, 'updater');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/updater/install
 * Установить обновление
 */
router.post('/install', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    const result = await globalUpdater.installUpdate(downloadPath);
    return res.json({ success: result, message: 'Update installed successfully' });
  } catch (error) {
    logger.error(`Updater install error: ${error.message}`, 'updater');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
