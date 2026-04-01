/**
 * Backup Router - API endpoints для бэкапов конфигурации
 */

import express from 'express';
import { globalConfigBackup } from '../utils/configBackup.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/config-backup/export
 * Экспорт конфигурации
 */
router.post('/export', async (req, res) => {
  try {
    const { filePath } = req.body;
    const result = await globalConfigBackup.export(filePath);
    return res.json(result);
  } catch (error) {
    logger.error(`Backup export error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/config-backup/import
 * Импорт конфигурации
 */
router.post('/import', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }
    const result = await globalConfigBackup.import(filePath);
    return res.json(result);
  } catch (error) {
    logger.error(`Backup import error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/config-backup/preview
 * Preview импорта
 */
router.post('/preview', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }
    const result = await globalConfigBackup.previewImport(filePath);
    return res.json(result);
  } catch (error) {
    logger.error(`Backup preview error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/config-backup/list
 * Список бэкапов
 */
router.get('/list', async (req, res) => {
  try {
    const backups = await globalConfigBackup.listBackups();
    return res.json({ success: true, backups });
  } catch (error) {
    logger.error(`Backup list error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/config-backup/auto
 * Автобэкап
 */
router.post('/auto', async (req, res) => {
  try {
    const result = await globalConfigBackup.autoBackup();
    return res.json(result);
  } catch (error) {
    logger.error(`Backup auto error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/config-backup/delete/:filename
 * Удалить бэкап
 */
router.delete('/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const success = await globalConfigBackup.deleteBackup(filename);
    return res.json({ success, message: success ? 'Backup deleted' : 'Delete failed' });
  } catch (error) {
    logger.error(`Backup delete error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/config-backup/cleanup
 * Очистка старых бэкапов
 */
router.post('/cleanup', async (req, res) => {
  try {
    const deleted = await globalConfigBackup.cleanup();
    return res.json({ success: true, deleted });
  } catch (error) {
    logger.error(`Backup cleanup error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/config-backup/stats
 * Статистика бэкапов
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await globalConfigBackup.getStats();
    return res.json({ success: true, ...stats });
  } catch (error) {
    logger.error(`Backup stats error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
