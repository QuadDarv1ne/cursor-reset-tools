/**
 * Tests for ConfigBackupManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigBackupManager } from '../utils/configBackup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConfigBackupManager', () => {
  let backupManager;
  const testBackupDir = path.join(__dirname, '..', 'test-backups');

  beforeEach(async () => {
    backupManager = new ConfigBackupManager();
    backupManager.backupDir = testBackupDir;
    await fs.ensureDir(testBackupDir);
  });

  afterEach(async () => {
    await fs.remove(testBackupDir);
  });

  describe('export', () => {
    it('should export config to default location', async () => {
      const result = await backupManager.export();
      expect(result.success).toBe(true);
      expect(result.path).toContain('test-backups');
      expect(result.path).toContain('config-backup-');
      expect(result.config).toBeDefined();
      expect(result.config.version).toBe('2.6.0');
      expect(result.config).toHaveProperty('checksum');
      expect(result.config.checksum).toHaveProperty('algo', 'sha256');
      expect(typeof result.config.checksum.value).toBe('string');
    });

    it('should export config to custom path', async () => {
      const customPath = path.join(testBackupDir, 'custom-config.json');
      const result = await backupManager.export(customPath);
      expect(result.success).toBe(true);
      expect(result.path).toBe(customPath);
      expect(await fs.pathExists(customPath)).toBe(true);
    });

    it('should include managers config', async () => {
      const result = await backupManager.export();
      expect(result.config.managers).toBeDefined();
      expect(result.config.managers.proxy).toBeDefined();
      expect(result.config.managers.notifications).toBeDefined();
    });
  });

  describe('import', () => {
    it('should return error for non-existent file', async () => {
      const result = await backupManager.import('/non/existent/path.json');
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should import valid config', async () => {
      const testConfig = {
        version: '2.6.0',
        timestamp: new Date().toISOString(),
        managers: {
          proxy: { enabled: true },
          notifications: { enabled: false }
        },
        settings: {}
      };
      const testFile = path.join(testBackupDir, 'test-import.json');
      await fs.writeJson(testFile, testConfig);

      const result = await backupManager.import(testFile);
      expect(result.success).toBe(true);
      expect(result.config.version).toBe('2.6.0');
    });

    it('should reject config with bad checksum', async () => {
      const testConfig = {
        version: '2.6.0',
        timestamp: new Date().toISOString(),
        managers: { proxy: { enabled: true } },
        settings: {},
        checksum: { algo: 'sha256', value: 'deadbeef' }
      };
      const testFile = path.join(testBackupDir, 'test-bad-checksum.json');
      await fs.writeJson(testFile, testConfig);

      const result = await backupManager.import(testFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Checksum');
    });

    it('should reject invalid config (no version)', async () => {
      const testConfig = {
        managers: {
          proxy: { enabled: true }
        }
      };
      const testFile = path.join(testBackupDir, 'test-invalid.json');
      await fs.writeJson(testFile, testConfig);

      const result = await backupManager.import(testFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('version');
    });
  });

  describe('previewImport', () => {
    it('should preview changes without applying', async () => {
      const testConfig = {
        version: '2.6.0',
        timestamp: new Date().toISOString(),
        managers: { proxy: { enabled: true } },
        settings: { foo: 'bar' }
      };
      const testFile = path.join(testBackupDir, 'test-preview.json');
      await fs.writeJson(testFile, testConfig);

      const result = await backupManager.previewImport(testFile);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('diff');
      expect(result.diff).toHaveProperty('changes');
      expect(Array.isArray(result.diff.changes)).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('should return empty array when no backups', async () => {
      const backups = await backupManager.listBackups();
      expect(Array.isArray(backups)).toBe(true);
      expect(backups.length).toBe(0);
    });

    it('should list available backups', async () => {
      const testConfig = {
        version: '2.6.0',
        timestamp: new Date().toISOString(),
        managers: {},
        settings: {}
      };
      await fs.writeJson(path.join(testBackupDir, 'backup1.json'), testConfig);
      await fs.writeJson(path.join(testBackupDir, 'backup2.json'), testConfig);

      const backups = await backupManager.listBackups();
      expect(backups.length).toBe(2);
      expect(backups[0]).toHaveProperty('filename');
      expect(backups[0]).toHaveProperty('path');
      expect(backups[0]).toHaveProperty('size');
      expect(backups[0].version).toBe('2.6.0');
    });
  });

  describe('deleteBackup', () => {
    it('should delete existing backup', async () => {
      const testConfig = { version: '2.6.0', managers: {}, settings: {} };
      const testFile = path.join(testBackupDir, 'to-delete.json');
      await fs.writeJson(testFile, testConfig);

      const result = await backupManager.deleteBackup('to-delete.json');
      expect(result).toBe(true);
      expect(await fs.pathExists(testFile)).toBe(false);
    });

    it('should handle non-existent backup', async () => {
      const result = await backupManager.deleteBackup('non-existent.json');
      expect(result).toBe(true); // fs.remove returns true even if file doesn't exist
    });
  });

  describe('cleanup', () => {
    it('should not delete when under maxBackups', async () => {
      const testConfig = { version: '2.6.0', managers: {}, settings: {} };
      for (let i = 0; i < 5; i++) {
        await fs.writeJson(path.join(testBackupDir, `backup${i}.json`), testConfig);
      }

      backupManager.maxBackups = 10;
      const deleted = await backupManager.cleanup();
      expect(deleted).toBe(0);
    });

    it('should delete excess backups', async () => {
      const testConfig = { version: '2.6.0', managers: {}, settings: {} };
      for (let i = 0; i < 15; i++) {
        await fs.writeJson(path.join(testBackupDir, `backup${i}.json`), testConfig);
      }

      backupManager.maxBackups = 10;
      const deleted = await backupManager.cleanup();
      expect(deleted).toBe(5);

      const backups = await backupManager.listBackups();
      expect(backups.length).toBe(10);
    });
  });

  describe('getStats', () => {
    it('should return stats with no backups', async () => {
      const stats = await backupManager.getStats();
      expect(stats.totalBackups).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.maxBackups).toBe(10);
    });

    it('should return correct stats with backups', async () => {
      const testConfig = { version: '2.6.0', managers: {}, settings: {} };
      await fs.writeJson(path.join(testBackupDir, 'backup1.json'), testConfig);
      await fs.writeJson(path.join(testBackupDir, 'backup2.json'), testConfig);

      const stats = await backupManager.getStats();
      expect(stats.totalBackups).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.newestBackup).toBeDefined();
      expect(stats.oldestBackup).toBeDefined();
    });
  });

  describe('autoBackup', () => {
    it('should create backup with timestamp', async () => {
      const result = await backupManager.autoBackup();
      expect(result.success).toBe(true);
      expect(result.path).toContain('auto-backup-');
      expect(await fs.pathExists(result.path)).toBe(true);
    });
  });

  describe('resetStats', () => {
    it('should not throw', async () => {
      expect(() => backupManager.resetStats()).not.toThrow();
    });
  });
});
