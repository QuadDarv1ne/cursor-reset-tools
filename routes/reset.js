import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { checkAdminRights, validatePaths, getCursorVersion, isCursorVersionSupported, checkCursorProcess, clearKeychain, updateWindowsRegistry, updateMacOSPlatformUUID, withRetry } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { globalBackupManager } from '../utils/rollback.js';
import { validateRequest } from '../utils/validator.js';
import { globalFileValidator } from '../utils/fileValidator.js';
import { globalIPManager } from '../utils/ipManager.js';
import { globalFingerprintManager } from '../utils/fingerprintManager.js';
import { globalEmailManager } from '../utils/emailManager.js';
import { globalMonitorManager } from '../utils/monitorManager.js';
import { globalCursorRegistrar } from '../utils/cursorRegistrar.js';
import { globalDoHManager } from '../utils/dohManager.js';
import { globalSmartBypassManager } from '../utils/smartBypassManager.js';
import { globalStatsCache } from '../utils/statsCache.js';
import { globalResourceMonitor } from '../utils/resourceMonitor.js';
import { globalMetricsManager } from '../utils/metricsManager.js';
import { globalUpdater } from '../utils/updater.js';
import { globalDNSManager } from '../utils/dnsManager.js';
import { globalVPNManager } from '../utils/vpnManager.js';
import { globalProxyManager } from '../utils/proxyManager.js';

const rt = express.Router();
const execPromise = promisify(exec);

// Инициализация логгера
logger.init();

// Request ID для трассировки
rt.use((req, res, next) => {
  const existing = req.headers['x-request-id'];
  // Ограничение длины x-request-id для предотвращения инъекций
  const requestId = (typeof existing === 'string' && existing.trim().length <= 128) ? existing.trim() : uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

const gp = () => {
  const pt = os.platform();
  const hm = os.homedir();
  const dc = path.join(hm, 'Documents', '.cursor-free-vip');
  const cf = path.join(dc, 'config.ini');

  // Используем пути из конфигурации
  const paths = config.platformPaths[pt] || config.platformPaths.win32;

  const mp = paths.machineId(hm);
  const sp = paths.storage(hm);
  const dp = paths.database(hm);
  const ap = paths.app(hm);
  const cp = paths.cursor(hm);
  const up = paths.update(hm);

  return { mp, sp, dp, ap, cp, up, pt, dc, cf };
};

/**
 * Создать бэкап файла
 * @param {string} filePath - Путь к файлу
 * @param {string} [operationId] - ID операции для группировки
 * @returns {Promise<string|null>}
 */
const bk = async (filePath, operationId = 'default') => {
  try {
    const bkPath = await globalBackupManager.createBackup(filePath, operationId);
    return bkPath;
  } catch (error) {
    logger.error(`Backup error: ${error.message}`, 'backup');
    return null;
  }
};

const gm = () => uuidv4().toUpperCase();

const cs = seed => crypto.createHash('sha256').update(seed).digest('hex');

const rm = async () => {
  const logs = [];
  // eslint-disable-next-line no-unused-vars
  const { mp, sp, dp, ap, cp, pt, dc, cf } = gp();
  const operationId = `reset_${Date.now()}`;

  try {
    logs.push('ℹ️ Checking Config File...');

    // Проверка прав администратора
    const isAdmin = await checkAdminRights();
    if (!isAdmin) {
      logs.push('⚠️ Warning: No administrator privileges, some operations may fail');
      logger.warn('No admin rights for reset operation');
    }

    // Валидация путей
    const validation = validatePaths({ mp, sp, dp });
    if (!validation.valid) {
      logs.push(`❌ Missing critical paths: ${validation.missing.join(', ')}`);
      logger.error(`Missing paths: ${validation.missing.join(', ')}`);
      return ld(logs, 'Machine ID Reset');
    }

    if (!fs.existsSync(dc)) {
      await fs.ensureDir(dc);
      logs.push('ℹ️ Created config directory');
    }

    logs.push('📄 Reading Current Config...');

    if (!fs.existsSync(sp)) {
      logs.push('⚠️ Warning: Storage file not found, will create if needed');
    }

    // Валидация файлов перед модификацией
    const filesToValidate = [sp, dp, mp, cp].filter(f => f && fs.existsSync(f));
    if (filesToValidate.length > 0) {
      try {
        const validationResults = await globalFileValidator.validateFiles(filesToValidate, {
          requireExists: false
        });

        if (!validationResults.success) {
          const errors = validationResults.errors.map(e => `${e.file}: ${e.errors.join(', ')}`);
          logs.push(`⚠️ File validation warnings: ${errors.join('; ')}`);
          logger.warn(`File validation warnings: ${JSON.stringify(validationResults.errors)}`, 'reset');
        }
      } catch (err) {
        logs.push(`⚠️ File validation skipped: ${err.message}`);
        logger.debug(`File validation skipped: ${err.message}`, 'reset');
      }
    }

    // Создаём бэкапы всех файлов перед модификацией (ПАРАЛЛЕЛЬНО)
    const filesToBackup = [sp, dp, mp, cp].filter(f => f && fs.existsSync(f));
    if (filesToBackup.length > 0) {
      logs.push(`📦 Creating ${filesToBackup.length} backups in parallel...`);
      const backupResults = await Promise.allSettled(
        filesToBackup.map(file => bk(file, operationId))
      );

      for (let i = 0; i < backupResults.length; i++) {
        const result = backupResults[i];
        const file = filesToBackup[i];
        if (result.status === 'fulfilled' && result.value) {
          logs.push(`💾 Backup: ${path.basename(result.value)} (${path.basename(file)})`);
        } else if (result.status === 'rejected') {
          logs.push(`⚠️ Backup failed: ${path.basename(file)} - ${result.reason?.message || 'Unknown error'}`);
          logger.warn(`Backup failed for ${file}: ${result.reason?.message}`, 'backup');
        }
      }
    }

    logs.push('🔄 Generating New Machine ID...');

    const newGuid = `{${gm().replace(/-/g, '-').toUpperCase()}}`;
    const machId = uuidv4();
    const deviceId = uuidv4();
    const sqmId = newGuid;
    const macId = crypto.randomBytes(64).toString('hex');

    logs.push('📄 Saving New Config to JSON...');

    // TOCTOU FIX: Прямая обработка ошибок вместо existsSync
    try {
      const storageData = JSON.parse(await fs.readFile(sp, 'utf8'));
      storageData['update.mode'] = 'none';
      storageData.serviceMachineId = deviceId;
      storageData['telemetry.devDeviceId'] = deviceId;
      storageData['telemetry.macMachineId'] = macId;
      storageData['telemetry.machineId'] = cs(machId);
      storageData['telemetry.sqmId'] = sqmId;
      await fs.writeFile(sp, JSON.stringify(storageData, null, 2));
      logs.push('✅ Storage file updated');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Файл не существует - создаём новый
        const newStorageData = {
          'update.mode': 'none',
          'serviceMachineId': deviceId,
          'telemetry.devDeviceId': deviceId,
          'telemetry.macMachineId': macId,
          'telemetry.machineId': cs(machId),
          'telemetry.sqmId': sqmId
        };
        await fs.ensureDir(path.dirname(sp));
        await fs.writeFile(sp, JSON.stringify(newStorageData, null, 2));
        logs.push('✅ Storage file created');
      } else {
        logs.push(`⚠️ Storage file error: ${err.message}`);
        logger.warn(`Storage error: ${err.message}`, 'reset');
      }
    }

    logs.push('ℹ️ Updating SQLite Database...');

    const newIds = {
      'telemetry.devDeviceId': deviceId,
      'telemetry.macMachineId': macId,
      'telemetry.machineId': cs(machId),
      'telemetry.sqmId': sqmId,
      'storage.serviceMachineId': deviceId
    };

    if (fs.existsSync(dp)) {
      await bk(dp);

      try {
        // RETRY LOGIC: Открытие БД с повторными попытками
        const db = await withRetry(
          () => open({
            filename: dp,
            driver: sqlite3.Database
          }),
          { maxAttempts: 3, baseDelay: 500 }
        );

        // RETRY LOGIC: Создание таблицы с индексами
        await withRetry(
          () => db.exec(`
            CREATE TABLE IF NOT EXISTS ItemTable (
              key TEXT PRIMARY KEY,
              value TEXT
            )
          `),
          { maxAttempts: 2 }
        );

        // Добавляем индексы для ускорения поиска по ключам
        await withRetry(
          () => db.exec(`
            CREATE INDEX IF NOT EXISTS idx_key_prefix ON ItemTable(key);
            CREATE INDEX IF NOT EXISTS idx_cursor_keys ON ItemTable(key) WHERE key LIKE '%cursor%';
            CREATE INDEX IF NOT EXISTS idx_telemetry_keys ON ItemTable(key) WHERE key LIKE '%telemetry%';
          `),
          { maxAttempts: 2 }
        );

        for (const [key, value] of Object.entries(newIds)) {
          await db.run(`
            INSERT OR REPLACE INTO ItemTable (key, value)
            VALUES (?, ?)
          `, [key, JSON.stringify(value)]);
          logs.push(`ℹ️ Updating Key-Value Pair: ${key}`);
        }

        // OPTIMIZATION: Используем транзакцию для группировки запросов
        await db.run('BEGIN TRANSACTION');
        try {
          // OPTIMIZATION: Заменены LIKE на более специфичные паттерны
          await db.run(`UPDATE ItemTable SET value = ? WHERE key GLOB '*cursor*usage*'`,
            [JSON.stringify({ global: { usage: { sessionCount: 0, tokenCount: 0 } } })]);
          await db.run(`UPDATE ItemTable SET value = ? WHERE key GLOB '*cursor*tier*'`, ['"pro"']);
          await db.run(`DELETE FROM ItemTable WHERE key GLOB '*cursor.lastUpdateCheck*'`);
          await db.run(`DELETE FROM ItemTable WHERE key GLOB '*cursor.trialStartTime*'`);
          await db.run(`DELETE FROM ItemTable WHERE key GLOB '*cursor.trialEndTime*'`);
          await db.run('COMMIT');
        } catch (txErr) {
          await db.run('ROLLBACK');
          logger.warn(`Transaction failed: ${txErr.message}`, 'reset');
        }

        await db.close();
        logs.push('✅ SQLite Database Updated Successfully');
      } catch (err) {
        logs.push(`⚠️ SQLite Update Error: ${err.message}`);
      }
    } else {
      logs.push('⚠️ SQLite Database not found, skipping database updates');
    }

    logs.push('ℹ️ Updating System IDs...');

    // TOCTOU FIX: Machine ID file
    try {
      await bk(mp);
      await fs.writeFile(mp, machId);
      logs.push('✅ Machine ID File Updated');
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.ensureDir(path.dirname(mp));
        await fs.writeFile(mp, machId);
        logs.push('✅ Machine ID File Created');
      } else {
        logs.push(`⚠️ Machine ID error: ${err.message}`);
      }
    }

    // TOCTOU FIX: Cursor.json file
    try {
      await bk(cp);
      const cursorData = JSON.parse(await fs.readFile(cp, 'utf8'));
      if (cursorData) {
        if (cursorData.global && cursorData.global.usage) {
          cursorData.global.usage.sessionCount = 0;
          cursorData.global.usage.tokenCount = 0;
        } else {
          cursorData.global = {
            usage: {
              sessionCount: 0,
              tokenCount: 0
            }
          };
        }
        cursorData.tier = 'pro';
        await fs.writeFile(cp, JSON.stringify(cursorData, null, 2));
        logs.push('✅ Cursor.json Updated Successfully');
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logs.push(`⚠️ Cursor.json Update Error: ${err.message}`);
      }
    }

    if (pt === 'win32') {
      try {
        const wr = await updateWindowsRegistry(newGuid);
        if (wr) {
          logs.push('✅ Windows Machine GUID Updated Successfully');
          logs.push(`ℹ️ New Machine ID: ${newGuid}`);
          logs.push('✅ Windows Machine ID Updated Successfully');
        }
      } catch (err) {
        logs.push(`⚠️ Windows Registry Update Error: ${err.message}`);
      }
    } else if (pt === 'darwin') {
      try {
        const mr = await updateMacOSPlatformUUID(macId);
        if (mr) {
          logs.push('✅ macOS Platform UUID Updated Successfully');
        }

        const kr = await clearKeychain();
        if (kr) {
          logs.push('✅ macOS Keychain Cleared Successfully');
        }
      } catch (err) {
        logs.push(`⚠️ macOS Update Error: ${err.message}`);
      }
    }

    logs.push('✅ Machine ID Reset Successfully');
    logs.push('\nℹ️ New IDs:');
    for (const [key, value] of Object.entries(newIds)) {
      logs.push(`ℹ️ ${key}: ${value}`);
    }

    return ld(logs, 'Machine ID Reset');
  } catch (err) {
    logs.push(`❌ Process Error: ${err.message}`);
    logger.error(`Reset failed: ${err.message}`, 'reset');

    // Откат изменений при ошибке
    logger.info('Attempting rollback...', 'rollback');
    const rollbackResult = await globalBackupManager.rollback(operationId);
    if (rollbackResult.restored > 0) {
      logs.push(`🔄 Rollback: ${rollbackResult.restored} files restored, ${rollbackResult.failed} failed`);
      logger.info(`Rollback completed: ${rollbackResult.restored} restored, ${rollbackResult.failed} failed`, 'rollback');
    }

    return ld(logs, 'Machine ID Reset');
  }
};

const gw = () => {
  const { ap } = gp();
  return path.join(ap, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
};

const bt = async () => {
  const logs = [];
  const { dp } = gp();
  const workbenchPath = gw();
  const operationId = `bypass_${Date.now()}`;

  try {
    logs.push('ℹ️ Starting token limit bypass...');

    if (!fs.existsSync(workbenchPath)) {
      logs.push(`❌ Workbench file not found at: ${workbenchPath}`);
      logger.error(`Workbench not found: ${workbenchPath}`, 'bypass');
      return ld(logs, 'Bypass Token Limit');
    }

    const bkPath = await bk(workbenchPath, operationId);
    logs.push(`💾 Created backup: ${bkPath}`);
    logger.info(`Backup created: ${bkPath}`, 'bypass');

    const content = await fs.readFile(workbenchPath, 'utf8');

    // Используем паттерны из конфигурации
    let modified = content;
    for (const [key, { pattern, replacement }] of Object.entries(config.workbenchPatterns)) {
      try {
        const regex = new RegExp(pattern, 'g');
        modified = modified.replace(regex, replacement);
        logger.debug(`Applied pattern ${key}`, 'bypass');
      } catch (e) {
        logger.warn(`Failed to apply pattern ${key}: ${e.message}`, 'bypass');
      }
    }

    await fs.writeFile(workbenchPath, modified);
    logs.push('✅ Workbench file modified successfully');

    if (fs.existsSync(dp)) {
      logs.push('ℹ️ Updating SQLite database for token limits...');
      await bk(dp);

      try {
        const db = await open({
          filename: dp,
          driver: sqlite3.Database
        });

        // OPTIMIZATION: Используем транзакцию и параметризованный запрос
        await db.run('BEGIN TRANSACTION');
        try {
          await db.run(`UPDATE ItemTable SET value = ? WHERE key GLOB '*cursor*usage*'`,
            [JSON.stringify({ global: { usage: { sessionCount: 0, tokenCount: 0 } } })]);
          await db.run('COMMIT');
        } catch (txErr) {
          await db.run('ROLLBACK');
          logger.warn(`Bypass transaction failed: ${txErr.message}`, 'bypass');
        }
        await db.close();
        logs.push('✅ SQLite database updated for token limits');
      } catch (err) {
        logs.push(`⚠️ SQLite update error: ${err.message}`);
      }
    }

    logs.push('✅ Token limit bypass completed successfully');
    return ld(logs, 'Bypass Token Limit');
  } catch (err) {
    logs.push(`❌ Token limit bypass error: ${err.message}`);
    logger.error(`Bypass failed: ${err.message}`, 'bypass');

    // Откат изменений при ошибке
    const rollbackResult = await globalBackupManager.rollback(operationId);
    if (rollbackResult.restored > 0) {
      logs.push(`🔄 Rollback: ${rollbackResult.restored} files restored`);
    }

    return ld(logs, 'Bypass Token Limit');
  }
};

const du = async () => {
  const { ap, pt, up } = gp();
  const logs = [];
  const operationId = `disable_update_${Date.now()}`;

  try {
    logs.push('ℹ️ Starting auto-update disabling process...');

    logs.push('🔄 Terminating any running Cursor processes...');
    try {
      if (pt === 'win32') {
        await execPromise('taskkill /F /IM Cursor.exe /T');
      } else {
        await execPromise('pkill -f Cursor');
      }
      logs.push('✅ Cursor processes terminated successfully');
    } catch (e) {
      logs.push('ℹ️ No running Cursor processes found');
    }

    let updaterPath;
    if (pt === 'win32') {
      updaterPath = path.join(os.homedir(), 'AppData', 'Local', 'cursor-updater');
    } else if (pt === 'darwin') {
      updaterPath = path.join(os.homedir(), 'Library', 'Application Support', 'cursor-updater');
    } else if (pt === 'linux') {
      updaterPath = path.join(os.homedir(), '.config', 'cursor-updater');
    }

    logs.push(`🔄 Removing updater directory: ${updaterPath}`);
    if (fs.existsSync(updaterPath)) {
      try {
        if (fs.statSync(updaterPath).isDirectory()) {
          await fs.rm(updaterPath, { recursive: true, force: true });
        } else {
          await fs.unlink(updaterPath);
        }
        logs.push('✅ Updater directory successfully removed');
      } catch (e) {
        logs.push(`⚠️ Updater directory is locked, skipping removal: ${e.message}`);
      }
    } else {
      logs.push('ℹ️ Updater directory not found, creating blocker file');
    }

    if (!up) {
      logs.push('⚠️ Update.yml path not found for this platform');
    } else {
      logs.push(`🔄 Clearing update.yml file: ${up}`);
      try {
        if (fs.existsSync(up)) {
          await bk(up);
          await fs.writeFile(up, '', 'utf8');
          logs.push('✅ Update.yml file successfully cleared');
        } else {
          logs.push('ℹ️ Update.yml file not found, creating new one');
          await fs.ensureDir(path.dirname(up));
        }
      } catch (e) {
        logs.push(`⚠️ Failed to clear update.yml file: ${e.message}`);
      }
    }

    logs.push('🔄 Creating blocker files to prevent auto-updates...');

    try {
      await fs.ensureDir(path.dirname(updaterPath));
      await fs.writeFile(updaterPath, '', 'utf8');

      if (pt === 'win32') {
        try {
          await execPromise(`attrib +r "${updaterPath}"`);
        } catch (e) {
          logs.push(`⚠️ Failed to set updater file as read-only: ${e.message}`);
        }
      } else {
        try {
          fs.chmodSync(updaterPath, 0o444);
        } catch (e) {
          logs.push(`⚠️ Failed to set updater file permissions: ${e.message}`);
        }
      }
      logs.push('✅ Updater blocker file created successfully');
    } catch (e) {
      logs.push(`⚠️ Failed to create updater blocker file: ${e.message}`);
    }

    if (up) {
      try {
        await fs.ensureDir(path.dirname(up));
        await fs.writeFile(up, '# This file is locked to prevent auto-updates\nversion: 0.0.0\n', 'utf8');

        if (pt === 'win32') {
          try {
            await execPromise(`attrib +r "${up}"`);
          } catch (e) {
            logs.push(`⚠️ Failed to set update.yml as read-only: ${e.message}`);
          }
        } else {
          try {
            fs.chmodSync(up, 0o444);
          } catch (e) {
            logs.push(`⚠️ Failed to set update.yml permissions: ${e.message}`);
          }
        }
        logs.push('✅ Update.yml blocker file created successfully');
      } catch (e) {
        logs.push(`⚠️ Failed to create update.yml blocker file: ${e.message}`);
      }
    }

    const pj = path.join(ap, 'product.json');
    if (fs.existsSync(pj)) {
      logs.push(`🔄 Modifying product.json to remove update URLs: ${pj}`);
      try {
        const bkPath = await bk(pj);
        logs.push(`💾 Created backup: ${bkPath}`);

        let content = await fs.readFile(pj, 'utf8');

        content = content.replace(/https:\/\/api2\.cursor\.sh\/aiserver\.v1\.AuthService\/DownloadUpdate/g, '')
          .replace(/https:\/\/api2\.cursor\.sh\/updates/g, '')
          .replace(/http:\/\/cursorapi\.com\/updates/g, '');

        await fs.writeFile(pj, content, 'utf8');
        logs.push('✅ Update URLs successfully removed from product.json');
      } catch (e) {
        logs.push(`⚠️ Failed to modify product.json: ${e.message}`);
      }
    } else {
      logs.push(`⚠️ Product.json not found at: ${pj}`);
    }

    logs.push('✅ Auto-updates successfully disabled');

    return ld(logs, 'Disable Auto-Update');
  } catch (e) {
    logs.push(`❌ Error disabling auto-updates: ${e.message}`);
    logger.error(`Disable update failed: ${e.message}`, 'disable-update');

    // Откат изменений при ошибке
    const rollbackResult = await globalBackupManager.rollback(operationId);
    if (rollbackResult.restored > 0) {
      logs.push(`🔄 Rollback: ${rollbackResult.restored} files restored`);
    }

    return ld(logs, 'Disable Auto-Update');
  }
};

const pc = async () => {
  const logs = [];
  const { dp } = gp();
  const workbenchPath = gw();
  const operationId = `pro_conversion_${Date.now()}`;

  try {
    logs.push('ℹ️ Starting Pro conversion...');

    if (fs.existsSync(dp)) {
      logs.push('ℹ️ Updating SQLite database for Pro features...');
      await bk(dp);

      try {
        const db = await open({
          filename: dp,
          driver: sqlite3.Database
        });

        // OPTIMIZATION: Используем транзакцию и параметризованный запрос
        await db.run('BEGIN TRANSACTION');
        try {
          await db.run(`UPDATE ItemTable SET value = ? WHERE key GLOB '*cursor*tier*'`, ['"pro"']);
          await db.run('COMMIT');
        } catch (txErr) {
          await db.run('ROLLBACK');
          logger.warn(`Pro conversion transaction failed: ${txErr.message}`, 'pro');
        }
        await db.close();
        logs.push('✅ Pro features enabled in SQLite database');
      } catch (err) {
        logs.push(`⚠️ SQLite update error: ${err.message}`);
      }
    } else {
      logs.push('⚠️ SQLite database not found, skipping database update');
    }

    if (fs.existsSync(workbenchPath)) {
      logs.push('ℹ️ Modifying workbench file for Pro UI...');
      const bkPath = await bk(workbenchPath);
      logs.push(`💾 Created backup: ${bkPath}`);

      const content = await fs.readFile(workbenchPath, 'utf8');

      // Комбинируем паттерны для Pro конвертации
      let modified = content;

      // Применяем паттерны для Pro UI
      for (const [key, { pattern, replacement }] of Object.entries(config.proConversionPatterns)) {
        try {
          const regex = new RegExp(pattern, 'g');
          modified = modified.replace(regex, replacement);
          logger.debug(`Applied Pro pattern ${key}`, 'pro');
        } catch (e) {
          logger.warn(`Failed to apply Pro pattern ${key}: ${e.message}`, 'pro');
        }
      }

      await fs.writeFile(workbenchPath, modified);
      logs.push('✅ Workbench file modified for Pro UI');
    } else {
      logs.push(`⚠️ Workbench file not found at: ${workbenchPath}`);
    }

    logs.push('✅ Pro conversion completed successfully');
    return ld(logs, 'Pro Conversion + Custom UI');
  } catch (err) {
    logs.push(`❌ Pro conversion error: ${err.message}`);
    logger.error(`Pro conversion failed: ${err.message}`, 'pro');

    // Откат изменений при ошибке
    const rollbackResult = await globalBackupManager.rollback(operationId);
    if (rollbackResult.restored > 0) {
      logs.push(`🔄 Rollback: ${rollbackResult.restored} files restored`);
    }

    return ld(logs, 'Pro Conversion + Custom UI');
  }
};

const ld = async (logs, toolName) => {
  const hd = '==================================================';
  const t1 = `🔄 Cursor ${toolName} Tool`;

  const lg = [];
  lg.push(hd);
  lg.push(t1);
  lg.push(hd);

  logs.forEach(l => {
    lg.push(l);
  });

  return lg.join('\n');
};

rt.post('/reset', async (req, res) => {
  try {
    const result = await rm();
    res.json({ success: true, log: result });
  } catch (err) {
    logger.error(`Reset API error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
  }
});

rt.post('/patch', async (req, res) => {
  try {
    // Валидация action параметра
    const validActions = ['bypass', 'disable', 'pro'];
    const action = req.body.action || req.query.action || 'bypass';

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`
      });
    }

    let result;

    if (action === 'bypass') {
      result = await bt();
    } else if (action === 'disable') {
      result = await du();
    } else if (action === 'pro') {
      result = await pc();
    } else {
      result = await bt();
    }

    res.json({ success: true, log: result });
  } catch (err) {
    logger.error(`Patch API error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
  }
});

rt.get('/paths', async (req, res) => {
  try {
    const { mp, sp, dp, ap, cp, up, pt } = gp();

    // Кэшированная проверка процесса Cursor
    const cacheKey = `cursor_running_${pt}`;
    const isRunning = await globalStatsCache.getOrCompute(
      cacheKey,
      () => checkCursorProcess(pt),
      2000 // 2 секунды кэш
    );

    // Получение версии Cursor
    const version = await getCursorVersion(ap);
    const isSupported = isCursorVersionSupported(version);

    const info = {
      platform: pt,
      osVersion: os.release(),
      arch: os.arch(),
      homedir: os.homedir(),
      machinePath: mp,
      storagePath: sp,
      dbPath: dp,
      appPath: ap,
      cursorPath: cp,
      updatePath: up,
      isRunning,
      cursorVersion: version,
      isSupported,
      exists: {
        machineId: fs.existsSync(mp),
        storage: fs.existsSync(sp),
        database: fs.existsSync(dp),
        app: fs.existsSync(ap),
        cursor: fs.existsSync(cp),
        update: fs.existsSync(up)
      }
    };

    if (fs.existsSync(sp)) {
      try {
        const data = await fs.readFile(sp, 'utf8');
        const json = JSON.parse(data);
        info.storage = {
          machineId: json['telemetry.machineId'] || json.serviceMachineId,
          devDeviceId: json['telemetry.devDeviceId'],
          tier: json['cursor.tier'] || 'unknown'
        };
      } catch (e) {
        logger.debug(`Failed to parse storage.json: ${e.message}`, 'reset');
      }
    }

    if (fs.existsSync(dp)) {
      try {
        const db = await open({
          filename: dp,
          driver: sqlite3.Database
        });
        const rows = await db.all('SELECT key, value FROM ItemTable WHERE key LIKE "%cursor%" OR key LIKE "%telemetry%" LIMIT 10');
        info.database = rows.reduce((acc, row) => {
          try {
            acc[row.key] = JSON.parse(row.value);
          } catch (e) {
            acc[row.key] = row.value;
          }
          return acc;
        }, {});
        await db.close();
      } catch (e) {
        logger.debug(`Failed to read preferences database: ${e.message}`, 'reset');
      }
    }

    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Diagnostics export (без секретов)
 */
rt.get('/diagnostics/export', async (req, res) => {
  const redact = (payload, mode) => {
    if (mode !== 'strict') {
      return payload;
    }

    // В strict режиме убираем потенциально чувствительные детали
    const cloned = JSON.parse(JSON.stringify(payload));
    if (cloned?.modules?.statsCache?.ok && cloned.modules.statsCache.data) {
      delete cloned.modules.statsCache.data.requests;
    }
    return cloned;
  };

  const safeCall = async fn => {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  };

  const diagnostics = {
    success: true,
    timestamp: Date.now(),
    requestId: req.requestId,
    process: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime()
    },
    modules: {
      resourceMonitor: await safeCall(async () => ({
        current: globalResourceMonitor.getCurrentStats(),
        summary: globalResourceMonitor.getSummary(),
        alerts: globalResourceMonitor.getAlerts(10),
        history: globalResourceMonitor.getHistory(10)
      })),
      statsCache: await safeCall(async () => globalStatsCache.getStats()),
      metrics: await safeCall(async () => globalMetricsManager.getStatus?.() || { enabled: false }),
      updater: await safeCall(async () => globalUpdater.getStatus?.() || { enabled: false })
    }
  };

  const { redact: redactMode } = req.query;
  res.json(redact(diagnostics, redactMode));
});

/**
 * Diagnostics download (attachment)
 */
rt.get('/diagnostics/download', async (req, res) => {
  // Переиспользуем export-логику (вызовем локально через функцию)
  // Чтобы не дублировать — просто соберём такой же объект
  const safeCall = async fn => {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  };

  const diagnostics = {
    success: true,
    timestamp: Date.now(),
    requestId: req.requestId,
    process: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime()
    },
    modules: {
      resourceMonitor: await safeCall(async () => ({
        current: globalResourceMonitor.getCurrentStats(),
        summary: globalResourceMonitor.getSummary(),
        alerts: globalResourceMonitor.getAlerts(10),
        history: globalResourceMonitor.getHistory(10)
      })),
      statsCache: await safeCall(async () => globalStatsCache.getStats()),
      metrics: await safeCall(async () => globalMetricsManager.getStatus?.() || { enabled: false }),
      updater: await safeCall(async () => globalUpdater.getStatus?.() || { enabled: false })
    }
  };

  const { redact: redactMode } = req.query;
  if (redactMode === 'strict' && diagnostics?.modules?.statsCache?.ok && diagnostics.modules.statsCache.data) {
    delete diagnostics.modules.statsCache.data.requests;
  }

  const stamp = new Date(diagnostics.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `diagnostics-${stamp}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(diagnostics, null, 2));
});

// =========================================
// Proxy, DNS, VPN endpoints удалены - дублируются в routes/proxy.js и routes/network.js
// Все соответствующие эндпоинты теперь находятся в специализированных роутах
// =========================================

rt.post('/dns/restore', async (req, res) => {
  try {
    const success = await globalDNSManager.restoreDNS();
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/dns/flush', async (req, res) => {
  try {
    const success = await globalDNSManager.flushDNSCache();
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DNS endpoints удалены - дублируются в routes/network.js

/**
 * IP API
 */
rt.get('/ip/check', async (req, res) => {
  try {
    const { details = false } = req.query;
    const ipData = await globalIPManager.getCurrentIP({ includeDetails: details === 'true' });
    const blocks = await globalIPManager.detectBlocks();
    res.json({ success: true, ip: ipData, blocks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/ip/history', (req, res) => {
  try {
    const history = globalIPManager.getIPHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fingerprint API
 */
rt.get('/fingerprint/info', async (req, res) => {
  try {
    const info = await globalFingerprintManager.getFingerprintInfo();
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/fingerprint/reset', async (req, res) => {
  try {
    // Валидация входных данных
    const validation = validateRequest(req.body, {
      changeMAC: {
        type: 'boolean',
        default: true
      },
      changeHostname: {
        type: 'boolean',
        default: true
      },
      flushDNS: {
        type: 'boolean',
        default: true
      }
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    const { changeMAC, changeHostname, flushDNS } = validation.data;
    const result = await globalFingerprintManager.resetFingerprint({ changeMAC, changeHostname, flushDNS });
    res.json({ success: true, result });
  } catch (err) {
    logger.error(`Fingerprint reset error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: err.message });
  }
});

rt.post('/fingerprint/mac', async (req, res) => {
  try {
    const result = await globalFingerprintManager.changeAllMAC();
    res.json({ success: true, result });
  } catch (err) {
    logger.error(`Fingerprint reset error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * VPN API
 */
rt.get('/vpn/status', async (req, res) => {
  try {
    const status = await globalVPNManager.detectActiveVPN();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

rt.post('/fingerprint/hostname', async (req, res) => {
  try {
    const { name } = req.body;
    if (name) {
      await globalFingerprintManager.setHostname(name);
    } else {
      await globalFingerprintManager.changeHostname();
    }
    res.json({ success: true, hostname: globalFingerprintManager.getHostname() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Email API
 */
rt.get('/email/session', (req, res) => {
  try {
    const session = globalEmailManager.getSessionInfo();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/email/create', async (req, res) => {
  try {
    // Валидация входных данных
    const validation = validateRequest(req.body, {
      service: {
        type: 'string',
        default: 'guerrillamail',
        validate: value => {
          const validServices = ['guerrillamail', 'tempmail', 'maildrop'];
          if (!validServices.includes(value)) {
            return { valid: false, error: `Invalid service. Available: ${validServices.join(', ')}` };
          }
          return { valid: true };
        }
      }
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    const { service } = validation.data;
    const result = await globalEmailManager.createEmail(service);
    res.json(result);
  } catch (err) {
    logger.error(`Email create error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: err.message });
  }
});

rt.get('/email/messages', async (req, res) => {
  try {
    const messages = await globalEmailManager.getMessages();
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/email/wait', async (req, res) => {
  try {
    // Валидация входных данных
    const validation = validateRequest(req.body, {
      subjectContains: {
        type: 'string',
        default: 'cursor',
        maxLength: 100
      },
      timeout: {
        type: 'number',
        min: 5000,
        max: 600000,
        default: 120000
      }
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    const { subjectContains, timeout } = validation.data;
    const message = await globalEmailManager.waitForMessage({ subjectContains, timeout });

    if (message) {
      const code = globalEmailManager.extractVerificationCode(message.body);
      const link = globalEmailManager.extractVerificationLink(message.body);
      res.json({ success: true, message, code, link });
    } else {
      res.status(408).json({ error: 'Timeout waiting for message' });
    }
  } catch (err) {
    logger.error(`Email wait error: ${err.message}`, 'api');
    res.status(500).json({ success: false, error: err.message });
  }
});

rt.get('/email/services', (req, res) => {
  try {
    const services = globalEmailManager.getAvailableServices();
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Monitor API
 */
rt.get('/monitor/check', async (req, res) => {
  try {
    const report = await globalMonitorManager.fullCheck();
    res.json({ success: true, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/monitor/status', (req, res) => {
  try {
    const status = globalMonitorManager.getCurrentStatus();
    const stats = globalMonitorManager.getStats();
    res.json({ success: true, status, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/monitor/start', (req, res) => {
  try {
    const { interval = 60000 } = req.body;
    globalMonitorManager.startMonitoring(interval);
    res.json({ success: true, message: 'Monitoring started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/monitor/stop', (req, res) => {
  try {
    globalMonitorManager.stopMonitoring();
    res.json({ success: true, message: 'Monitoring stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Combined bypass API
 */
rt.post('/bypass/auto', async (req, res) => {
  try {
    const {
      changeProxy = true,
      changeDNS = true,
      changeFingerprint = false
    } = req.body;

    const results = {
      proxy: null,
      dns: null,
      fingerprint: null,
      ipBefore: null,
      ipAfter: null
    };

    // Проверка IP до изменений
    results.ipBefore = await globalIPManager.getCurrentIP();

    // Смена прокси
    if (changeProxy) {
      const proxy = globalProxyManager.rotateProxy();
      if (proxy) {
        results.proxy = { success: true, proxy: proxy.url };
      } else {
        results.proxy = { success: false, error: 'No working proxies' };
      }
    }

    // Смена DNS
    if (changeDNS) {
      const dnsSuccess = await globalDNSManager.setDNS('cloudflare');
      results.dns = { success: dnsSuccess };
    }

    // Смена fingerprint
    if (changeFingerprint) {
      const fpResult = await globalFingerprintManager.resetFingerprint();
      results.fingerprint = fpResult;
    }

    // Проверка IP после изменений
    results.ipAfter = await globalIPManager.getCurrentIP({ useCache: false });
    results.ipChanged = results.ipBefore?.ip !== results.ipAfter?.ip;

    // Проверка доступности Cursor
    const cursorAvailable = await globalMonitorManager.isCursorAvailable();
    results.cursorAvailable = cursorAvailable;

    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VPN endpoints удалены - дублируются в routes/network.js

/**
 * Cursor Registrar API
 */
rt.get('/cursor/session', (req, res) => {
  try {
    const session = globalCursorRegistrar.getSession();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/cursor/register', async (req, res) => {
  try {
    const { emailService = 'guerrillamail', autoVerify = true, timeout = 120000 } = req.body;
    const result = await globalCursorRegistrar.register({
      emailService, autoVerify, timeout
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/cursor/auto-register', async (req, res) => {
  try {
    const { emailService = 'guerrillamail', checkProStatus = true, timeout = 180000 } = req.body;
    const result = await globalCursorRegistrar.autoRegister({
      emailService, checkProStatus, timeout
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/cursor/signin', async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await globalCursorRegistrar.signIn(email, code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/cursor/profile', async (req, res) => {
  try {
    const result = await globalCursorRegistrar.getUserProfile();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/cursor/subscription', async (req, res) => {
  try {
    const result = await globalCursorRegistrar.getSubscriptionStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/cursor/signout', async (req, res) => {
  try {
    const result = await globalCursorRegistrar.signOut();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/cursor/set-token', (req, res) => {
  try {
    const { token } = req.body;
    globalCursorRegistrar.setToken(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.delete('/cursor/clear', (req, res) => {
  try {
    globalCursorRegistrar.clear();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Smart Bypass API
 */
rt.get('/smart/status', (req, res) => {
  try {
    const status = globalSmartBypassManager.getStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/smart/test', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.testAllMethods();
    res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod(),
      recommendations: globalSmartBypassManager.getRecommendations()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/smart/apply', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.applyBestMethod();
    res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DoH API
 */
rt.get('/doh/resolve', async (req, res) => {
  try {
    const { domain, provider = 'cloudflare' } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'Domain required' });
    }
    const result = await globalDoHManager.resolve(domain, provider);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/doh/providers', async (req, res) => {
  try {
    const providers = await globalDoHManager.getAvailableProviders();
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.post('/doh/set-provider', (req, res) => {
  try {
    const { provider } = req.body;
    const success = globalDoHManager.setProvider(provider);
    res.json({ success, provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

rt.get('/doh/stats', (req, res) => {
  try {
    const stats = globalDoHManager.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default rt;
