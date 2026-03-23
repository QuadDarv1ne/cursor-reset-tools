/**
 * Fingerprint Manager - Обход системных идентификаторов
 * Сброс MAC адреса, смена hostname, очистка кэшей
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';
import crypto from 'crypto';

const execPromise = promisify(exec);

/**
 * Класс для управления системными идентификаторами
 */
export class FingerprintManager {
  constructor() {
    this.platform = os.platform();
    this.originalHostname = os.hostname();
    this.originalMAC = null;
    this.backedUp = false;
  }

  /**
   * Генерация случайного MAC адреса
   * @returns {string}
   */
  generateRandomMAC() {
    // Генерация случайного MAC с локально-администрируемым битом
    const mac = [];
    for (let i = 0; i < 6; i++) {
      let byte = crypto.randomBytes(1)[0];
      
      // Для первого байта устанавливаем бит локальной адресации
      if (i === 0) {
        byte = (byte | 0x02) & 0xFE; // Локально-администрируемый, не multicast
      }
      
      mac.push(byte.toString(16).padStart(2, '0'));
    }
    
    return mac.join(':').toUpperCase();
  }

  /**
   * Получение текущего MAC адреса
   * @returns {Promise<Array<Object>>}
   */
  async getCurrentMAC() {
    try {
      if (this.platform === 'win32') {
        return await this._getWindowsMAC();
      } else if (this.platform === 'darwin') {
        return await this._getMacOSMAC();
      } else {
        return await this._getLinuxMAC();
      }
    } catch (error) {
      logger.error(`Failed to get MAC address: ${error.message}`, 'fingerprint');
      return [];
    }
  }

  /**
   * Получение MAC адресов на Windows
   * @private
   */
  async _getWindowsMAC() {
    try {
      const { stdout } = await execPromise('getmac /fo csv /nh');
      const lines = stdout.trim().split('\r\n');
      const interfaces = [];

      for (const line of lines) {
        const parts = line.split(',');
        const mac = parts[parts.length - 1]?.replace(/"/g, '').trim();
        if (mac && mac !== 'N/A') {
          interfaces.push({
            name: parts[0]?.replace(/"/g, '') || 'Unknown',
            mac: mac,
            transport: parts[parts.length - 2]?.replace(/"/g, '') || ''
          });
        }
      }

      return interfaces;
    } catch (error) {
      logger.debug(`Windows MAC detection failed: ${error.message}`, 'fingerprint');
      return [];
    }
  }

  /**
   * Получение MAC адресов на macOS
   * @private
   */
  async _getMacOSMAC() {
    try {
      const { stdout } = await execPromise('ifconfig -a');
      const interfaces = [];
      const lines = stdout.split('\n');

      let currentInterface = null;
      for (const line of lines) {
        const match = line.match(/^(\w+):\s/);
        if (match) {
          currentInterface = match[1];
        }
        
        const macMatch = line.match(/ether\s+([0-9a-fA-F:]+)/);
        if (macMatch && currentInterface) {
          interfaces.push({
            name: currentInterface,
            mac: macMatch[1].toUpperCase()
          });
        }
      }

      return interfaces;
    } catch (error) {
      logger.debug(`macOS MAC detection failed: ${error.message}`, 'fingerprint');
      return [];
    }
  }

  /**
   * Получение MAC адресов на Linux
   * @private
   */
  async _getLinuxMAC() {
    try {
      const { stdout } = await execPromise('ip link show');
      const interfaces = [];
      const lines = stdout.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\d+:\s+(\w+):\s/);
        if (match) {
          const name = match[1];
          
          // Поиск MAC в следующей строке
          if (i + 1 < lines.length) {
            const macMatch = lines[i + 1].match(/link\/ether\s+([0-9a-fA-F:]+)/);
            if (macMatch) {
              interfaces.push({
                name: name,
                mac: macMatch[1].toUpperCase()
              });
            }
          }
        }
      }

      return interfaces;
    } catch (error) {
      logger.debug(`Linux MAC detection failed: ${error.message}`, 'fingerprint');
      return [];
    }
  }

  /**
   * Сохранение оригинальных MAC адресов
   * @returns {Promise<Array<Object>>}
   */
  async backupMAC() {
    this.originalMAC = await this.getCurrentMAC();
    this.backedUp = true;
    logger.info(`MAC backup saved: ${this.originalMAC.length} interfaces`, 'fingerprint');
    return this.originalMAC;
  }

  /**
   * Изменение MAC адреса (Windows)
   * @param {string} interfaceName - Имя интерфейса
   * @param {string} newMAC - Новый MAC адрес
   * @returns {Promise<boolean>}
   */
  async setWindowsMAC(interfaceName, newMAC) {
    try {
      // Получение списка сетевых адаптеров из реестра
      const { stdout } = await execPromise(
        'wmic nic where "PhysicalAdapter=true" get Name,MACAddress /format:csv'
      );
      
      const lines = stdout.trim().split('\r\n');
      let targetAdapter = null;

      for (const line of lines) {
        if (line.includes(interfaceName)) {
          targetAdapter = line;
          break;
        }
      }

      if (!targetAdapter) {
        logger.warn(`Network adapter not found: ${interfaceName}`, 'fingerprint');
        return false;
      }

      // Изменение через реестр Windows
      const adapterId = targetAdapter.split(',')[0]?.replace('LUID', '').trim();
      
      // Альтернативный метод через PowerShell
      await execPromise(
        `powershell -Command "Set-NetAdapter -Name '${interfaceName}' -MacAddress '${newMAC}' -Confirm:$false" 2>$null`
      );

      logger.info(`Windows MAC set for ${interfaceName}: ${newMAC}`, 'fingerprint');
      return true;
    } catch (error) {
      logger.error(`Windows MAC change failed: ${error.message}`, 'fingerprint');
      
      // Попытка через реестр
      try {
        const regPath = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}';
        await execPromise(`reg add "${regPath}" /v NetworkAddress /t REG_SZ /d "${newMAC.replace(/:/g, '')}" /f 2>$null`);
        logger.info(`Windows MAC set via registry: ${newMAC}`, 'fingerprint');
        return true;
      } catch (e) {
        logger.error(`Registry MAC change failed: ${e.message}`, 'fingerprint');
        return false;
      }
    }
  }

  /**
   * Изменение MAC адреса (macOS)
   * @param {string} interfaceName - Имя интерфейса
   * @param {string} newMAC - Новый MAC адрес
   * @returns {Promise<boolean>}
   */
  async setMacOSMAC(interfaceName, newMAC) {
    try {
      await execPromise(`sudo ifconfig ${interfaceName} ether ${newMAC.toLowerCase()}`);
      logger.info(`macOS MAC set for ${interfaceName}: ${newMAC}`, 'fingerprint');
      return true;
    } catch (error) {
      logger.error(`macOS MAC change failed: ${error.message}`, 'fingerprint');
      return false;
    }
  }

  /**
   * Изменение MAC адреса (Linux)
   * @param {string} interfaceName - Имя интерфейса
   * @param {string} newMAC - Новый MAC адрес
   * @returns {Promise<boolean>}
   */
  async setLinuxMAC(interfaceName, newMAC) {
    try {
      // Отключение интерфейса
      await execPromise(`sudo ip link set ${interfaceName} down`);
      
      // Изменение MAC
      await execPromise(`sudo ip link set ${interfaceName} address ${newMAC.toLowerCase()}`);
      
      // Включение интерфейса
      await execPromise(`sudo ip link set ${interfaceName} up`);
      
      logger.info(`Linux MAC set for ${interfaceName}: ${newMAC}`, 'fingerprint');
      return true;
    } catch (error) {
      logger.error(`Linux MAC change failed: ${error.message}`, 'fingerprint');
      return false;
    }
  }

  /**
   * Изменение MAC адреса для всех интерфейсов
   * @param {Array<string>} [interfaces] - Список интерфейсов (опционально)
   * @returns {Promise<Object>}
   */
  async changeAllMAC(interfaces = null) {
    if (!this.backedUp) {
      await this.backupMAC();
    }

    const currentInterfaces = interfaces || await this.getCurrentMAC();
    const results = [];

    for (const iface of currentInterfaces) {
      // Пропуск виртуальных и loopback интерфейсов
      if (iface.name.toLowerCase().includes('loopback') || 
          iface.name.toLowerCase().includes('virtual') ||
          iface.mac === '00:00:00:00:00:00') {
        continue;
      }

      const newMAC = this.generateRandomMAC();
      let success = false;

      if (this.platform === 'win32') {
        success = await this.setWindowsMAC(iface.name, newMAC);
      } else if (this.platform === 'darwin') {
        success = await this.setMacOSMAC(iface.name, newMAC);
      } else {
        success = await this.setLinuxMAC(iface.name, newMAC);
      }

      results.push({
        interface: iface.name,
        oldMAC: iface.mac,
        newMAC: success ? newMAC : iface.mac,
        success
      });

      logger.info(`MAC change for ${iface.name}: ${success ? 'success' : 'failed'}`, 'fingerprint');
    }

    return {
      results,
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }

  /**
   * Восстановление оригинальных MAC адресов
   * @returns {Promise<Object>}
   */
  async restoreMAC() {
    if (!this.originalMAC || !this.backedUp) {
      logger.warn('No MAC backup to restore', 'fingerprint');
      return { restored: 0 };
    }

    const results = [];
    for (const iface of this.originalMAC) {
      let success = false;

      if (this.platform === 'win32') {
        success = await this.setWindowsMAC(iface.name, iface.mac);
      } else if (this.platform === 'darwin') {
        success = await this.setMacOSMAC(iface.name, iface.mac);
      } else {
        success = await this.setLinuxMAC(iface.name, iface.mac);
      }

      results.push({
        interface: iface.name,
        mac: iface.mac,
        success
      });
    }

    this.backedUp = false;
    logger.info(`MAC restore: ${results.filter(r => r.success).length} interfaces`, 'fingerprint');
    
    return {
      results,
      restored: results.filter(r => r.success).length
    };
  }

  /**
   * Получение текущего hostname
   * @returns {string}
   */
  getHostname() {
    return os.hostname();
  }

  /**
   * Генерация случайного hostname
   * @returns {string}
   */
  generateRandomHostname() {
    const prefixes = ['user', 'dev', 'work', 'home', 'pc', 'desktop', 'laptop'];
    const suffix = crypto.randomBytes(4).toString('hex');
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${prefix}-${suffix}`;
  }

  /**
   * Изменение hostname системы
   * @param {string} newHostname - Новый hostname
   * @returns {Promise<boolean>}
   */
  async setHostname(newHostname) {
    try {
      if (this.platform === 'win32') {
        // Windows: через PowerShell
        await execPromise(`powershell -Command "Rename-Computer -NewName '${newHostname}' -Force" 2>$null`);
        logger.info(`Windows hostname changed to ${newHostname} (restart required)`, 'fingerprint');
        return true;
      } else if (this.platform === 'darwin') {
        // macOS
        await execPromise(`sudo scutil --set HostName ${newHostname}`);
        await execPromise(`sudo scutil --set LocalHostName ${newHostname}`);
        await execPromise(`sudo scutil --set ComputerName ${newHostname}`);
        logger.info(`macOS hostname changed to ${newHostname}`, 'fingerprint');
        return true;
      } else {
        // Linux
        await execPromise(`sudo hostnamectl set-hostname ${newHostname}`);
        
        // Обновление /etc/hosts
        const fs = await import('fs-extra');
        const hostsFile = '/etc/hosts';
        const content = await fs.readFile(hostsFile, 'utf8');
        
        // Замена старого hostname на новый
        const oldHostname = this.originalHostname;
        const updated = content.replace(
          new RegExp(`\\b${oldHostname}\\b`, 'g'),
          newHostname
        );
        
        await fs.writeFile(hostsFile, updated);
        logger.info(`Linux hostname changed to ${newHostname}`, 'fingerprint');
        return true;
      }
    } catch (error) {
      logger.error(`Hostname change failed: ${error.message}`, 'fingerprint');
      return false;
    }
  }

  /**
   * Изменение hostname на случайное
   * @returns {Promise<boolean>}
   */
  async changeHostname() {
    const newHostname = this.generateRandomHostname();
    return await this.setHostname(newHostname);
  }

  /**
   * Восстановление оригинального hostname
   * @returns {Promise<boolean>}
   */
  async restoreHostname() {
    return await this.setHostname(this.originalHostname);
  }

  /**
   * Полный сброс fingerprint
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async resetFingerprint(options = {}) {
    const {
      changeMAC = true,
      changeHostname = true,
      flushDNS = true
    } = options;

    const results = {
      mac: null,
      hostname: null,
      dns: null
    };

    if (changeMAC) {
      results.mac = await this.changeAllMAC();
    }

    if (changeHostname) {
      const hostnameSuccess = await this.changeHostname();
      results.hostname = { success: hostnameSuccess, new: this.getHostname() };
    }

    if (flushDNS) {
      try {
        if (this.platform === 'win32') {
          await execPromise('ipconfig /flushdns');
        } else if (this.platform === 'darwin') {
          await execPromise('sudo killall -HUP mDNSResponder');
        } else {
          await execPromise('sudo systemctl restart systemd-resolved 2>/dev/null || true');
        }
        results.dns = { success: true };
      } catch (e) {
        results.dns = { success: false, error: e.message };
      }
    }

    logger.info('Fingerprint reset completed', 'fingerprint');
    return results;
  }

  /**
   * Получение информации о fingerprint
   * @returns {Promise<Object>}
   */
  async getFingerprintInfo() {
    const macInterfaces = await this.getCurrentMAC();
    
    return {
      platform: this.platform,
      hostname: this.getHostname(),
      originalHostname: this.originalHostname,
      macAddresses: macInterfaces,
      hasBackup: this.backedUp,
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      uptime: os.uptime()
    };
  }
}

// Глобальный экземпляр
export const globalFingerprintManager = new FingerprintManager();

export default FingerprintManager;
