/**
 * Fingerprint Manager - Управление отпечатками устройства
 * MAC адреса, hostname, platform UUID
 */

import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';

const execPromise = promisify(exec);

class FingerprintManager {
  constructor() {
    this.backupPath = null;
    this.originalHostname = null;
    this.originalMACs = null;
  }

  /**
   * Инициализация менеджера
   */
  async init() {
    const configDir = path.join(os.homedir(), 'Documents', '.cursor-free-vip');
    await fs.ensureDir(configDir);
    this.backupPath = path.join(configDir, 'fingerprint_backup.json');

    // Сохранение оригинальных значений
    await this.saveOriginalValues();

    logger.info('Fingerprint Manager initialized', 'fingerprint');
  }

  /**
   * Сохранить оригинальные значения
   */
  async saveOriginalValues() {
    try {
      const backup = {
        hostname: os.hostname(),
        macAddresses: await this.getMACAddresses(),
        platform: os.platform(),
        savedAt: Date.now()
      };

      this.originalHostname = backup.hostname;
      this.originalMACs = backup.macAddresses;

      await fs.writeFile(this.backupPath, JSON.stringify(backup, null, 2));
      logger.debug('Original fingerprint values saved', 'fingerprint');
    } catch (error) {
      logger.warn(`Failed to save original values: ${error.message}`, 'fingerprint');
    }
  }

  /**
   * Получить MAC адреса всех интерфейсов
   */
  async getMACAddresses() {
    const interfaces = os.networkInterfaces();
    const macs = [];

    for (const [name, details] of Object.entries(interfaces)) {
      const mac = details?.find(d => d.mac && d.mac !== '00:00:00:00:00:00')?.mac;
      if (mac) {
        macs.push({ name, mac });
      }
    }

    return macs;
  }

  /**
   * Сгенерировать случайный MAC адрес
   */
  generateRandomMAC() {
    const bytes = crypto.randomBytes(6);
    // Устанавливаем бит локально администрируемого адреса
    bytes[0] = (bytes[0] & 0xfe) | 0x02;
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
  }

  /**
   * Изменить MAC адреса (Windows)
   */
  async changeMACWindows() {
    const results = [];

    try {
      const interfaces = await this.getMACAddresses();

      for (const iface of interfaces) {
        try {
          const newMAC = this.generateRandomMAC();

          // Попытка через PowerShell
          await execPromise(
            `powershell -Command "Set-NetAdapter -Name '${iface.name}' -MacAddress '${newMAC.replace(/:/g, '-')}" -ErrorAction SilentlyContinue`
          );

          results.push({ name: iface.name, old: iface.mac, new: newMAC, success: true });
          logger.info(`MAC change for ${iface.mac}: success`, 'fingerprint');
        } catch (error) {
          // Альтернатива через реестр
          try {
            const newMAC = this.generateRandomMAC().replace(/:/g, '');
            const adapterKey = `HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}`;

            await execPromise(
              `reg add "${adapterKey}" /v NetworkAddress /t REG_SZ /d "${newMAC}" /f 2>nul`
            );

            results.push({ name: iface.name, old: iface.mac, new: newMAC, success: true, method: 'registry' });
            logger.info(`Windows MAC set via registry: ${newMAC}`, 'fingerprint');
          } catch (regError) {
            results.push({ name: iface.name, old: iface.mac, error: regError.message, success: false });
            logger.warn(`Windows MAC change failed: ${regError.message}`, 'fingerprint');
          }
        }
      }
    } catch (error) {
      logger.error(`MAC change error: ${error.message}`, 'fingerprint');
    }

    return results;
  }

  /**
   * Изменить MAC адреса (macOS)
   */
  async changeMACMacOS() {
    const results = [];

    try {
      const interfaces = await this.getMACAddresses();

      for (const iface of interfaces) {
        try {
          const newMAC = this.generateRandomMAC();
          await execPromise(`sudo ifconfig ${iface.name} ether ${newMAC}`);
          results.push({ name: iface.name, old: iface.mac, new: newMAC, success: true });
          logger.info(`macOS MAC changed for ${iface.name}: ${newMAC}`, 'fingerprint');
        } catch (error) {
          results.push({ name: iface.name, old: iface.mac, error: error.message, success: false });
          logger.warn(`macOS MAC change failed: ${error.message}`, 'fingerprint');
        }
      }
    } catch (error) {
      logger.error(`MAC change error: ${error.message}`, 'fingerprint');
    }

    return results;
  }

  /**
   * Изменить MAC адреса (Linux)
   */
  async changeMACLinux() {
    const results = [];

    try {
      const interfaces = await this.getMACAddresses();

      for (const iface of interfaces) {
        try {
          const newMAC = this.generateRandomMAC();
          await execPromise(`ip link set dev ${iface.name} down`);
          await execPromise(`ip link set dev ${iface.name} address ${newMAC}`);
          await execPromise(`ip link set dev ${iface.name} up`);
          results.push({ name: iface.name, old: iface.mac, new: newMAC, success: true });
          logger.info(`Linux MAC changed for ${iface.name}: ${newMAC}`, 'fingerprint');
        } catch (error) {
          results.push({ name: iface.name, old: iface.mac, error: error.message, success: false });
          logger.warn(`Linux MAC change failed: ${error.message}`, 'fingerprint');
        }
      }
    } catch (error) {
      logger.error(`MAC change error: ${error.message}`, 'fingerprint');
    }

    return results;
  }

  /**
   * Изменить MAC адреса (кроссплатформенно)
   */
  async changeMAC() {
    const platform = os.platform();

    if (platform === 'win32') {
      return this.changeMACWindows();
    } else if (platform === 'darwin') {
      return this.changeMACMacOS();
    }
    return this.changeMACLinux();
  }

  /**
   * Изменить hostname (Windows)
   */
  async changeHostnameWindows(newName) {
    try {
      await execPromise(`wmic computersystem where name="%computername%" call rename name="${newName}"`);
      logger.info(`Windows hostname changed to ${newName} (restart required)`, 'fingerprint');
      return { success: true, restartRequired: true };
    } catch (error) {
      // Альтернатива через PowerShell
      try {
        await execPromise(`powershell -Command "Rename-Computer -NewName '${newName}' -Force"`);
        logger.info(`Windows hostname changed to ${newName} via PowerShell (restart required)`, 'fingerprint');
        return { success: true, restartRequired: true };
      } catch (psError) {
        logger.error(`Hostname change failed: ${psError.message}`, 'fingerprint');
        return { success: false, error: psError.message };
      }
    }
  }

  /**
   * Изменить hostname (macOS/Linux)
   */
  async changeHostnameUnix(newName) {
    try {
      await execPromise(`sudo hostnamectl set-hostname ${newName}`);
      logger.info(`Unix hostname changed to ${newName}`, 'fingerprint');
      return { success: true };
    } catch (error) {
      logger.error(`Hostname change failed: ${error.message}`, 'fingerprint');
      return { success: false, error: error.message };
    }
  }

  /**
   * Изменить hostname
   */
  async changeHostname(newName) {
    const platform = os.platform();

    if (platform === 'win32') {
      return this.changeHostnameWindows(newName);
    }
    return this.changeHostnameUnix(newName);
  }

  /**
   * Получить информацию о fingerprint
   */
  async getInfo() {
    const macs = await this.getMACAddresses();

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: os.totalmem(),
      cpus: os.cpus().length,
      macAddresses: macs,
      macCount: macs.length,
      uptime: os.uptime()
    };
  }

  /**
   * Восстановить оригинальные значения
   */
  async restore() {
    try {
      if (await fs.pathExists(this.backupPath)) {
        const backup = await fs.readJson(this.backupPath);

        if (backup.hostname && backup.hostname !== os.hostname()) {
          await this.changeHostname(backup.hostname);
        }

        logger.info('Fingerprint restored from backup', 'fingerprint');
        return { success: true };
      }

      return { success: false, error: 'No backup found' };
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`, 'fingerprint');
      return { success: false, error: error.message };
    }
  }

  /**
   * Полный сброс fingerprint
   */
  async reset() {
    const results = {
      mac: await this.changeMAC(),
      hostname: await this.changeHostname(`desktop-${crypto.randomBytes(4).toString('hex')}`),
      info: await this.getInfo()
    };

    logger.info('Fingerprint reset completed', 'fingerprint');
    return results;
  }

  /**
   * Сброс fingerprint (алиас)
   */
  async resetFingerprint() {
    return this.reset();
  }
}

export const globalFingerprintManager = new FingerprintManager();
export default FingerprintManager;
