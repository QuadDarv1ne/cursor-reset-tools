/**
 * Backup Router - API endpoints для бэкапов конфигурации
 */

import express from 'express';
import { globalConfigBackup } from '../utils/configBackup.js';
import { sanitizePath } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/config-backup/export
 * Экспорт конфигурации
 */
router.post('/export', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }

    // Санитизация пути для предотвращения path traversal
    const sanitizedPath = sanitizePath(filePath);
    const result = await globalConfigBackup.export(sanitizedPath);
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

    // Санитизация пути для предотвращения path traversal
    const sanitizedPath = sanitizePath(filePath);
    const result = await globalConfigBackup.import(sanitizedPath);
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

    // Санитизация пути для предотвращения path traversal
    const sanitizedPath = sanitizePath(filePath);
    const result = await globalConfigBackup.previewImport(sanitizedPath);
    return res.json(result);
  } catch (error) {
    logger.error(`Backup preview error: ${error.message}`, 'backup');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/config-backup/list
 * Список бэкапов с пагинацией
 */
router.get('/list', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Максимум 100
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    const backups = await globalConfigBackup.listBackups();

    // Применяем пагинацию
    const paginatedBackups = backups.slice(offsetNum, offsetNum + limitNum);

    return res.json({
      success: true,
      backups: paginatedBackups,
      pagination: {
        total: backups.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < backups.length
      }
    });
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

    // Валидация имени файла для предотвращения path traversal
    // Разрешаем только буквенно-цифровые символы, дефисы, точки и подчеркивания
    if (!/^[\w.-]+\.json$/.test(filename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format (must be alphanumeric with .json extension)'
      });
    }

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
