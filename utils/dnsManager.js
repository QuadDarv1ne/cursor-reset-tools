/**
 * DNS Manager - Управление DNS серверами для обхода блокировок
 * Поддержка Windows, macOS, Linux
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execPromise = promisify(exec);

/**
 * Предустановленные DNS серверы
 */
export const DNS_SERVERS = {
  cloudflare: {
    primary: '1.1.1.1',
    secondary: '1.0.0.1',
    ipv6Primary: '2606:4700:4700::1111',
    ipv6Secondary: '2606:4700:4700::1001',
    name: 'Cloudflare'
  },
  google: {
    primary: '8.8.8.8',
    secondary: '8.8.4.4',
    ipv6Primary: '2001:4860:4860::8888',
    ipv6Secondary: '2001:4860:4860::8844',
    name: 'Google'
  },
  quad9: {
    primary: '9.9.9.9',
    secondary: '149.112.112.112',
    ipv6Primary: '2620:fe::fe',
    ipv6Secondary: '2620:fe::9',
    name: 'Quad9'
  },
  opendns: {
    primary: '208.67.222.222',
    secondary: '208.67.220.220',
    ipv6Primary: '2620:119:35::35',
    ipv6Secondary: '2620:119:53::53',
    name: 'OpenDNS'
  },
  adguard: {
    primary: '94.140.14.14',
    secondary: '94.140.15.15',
    ipv6Primary: '2a10:50c0::ad1:ff',
    ipv6Secondary: '2a10:50c0::ad2:ff',
    name: 'AdGuard DNS'
  },
  cyclone: {
    primary: '45.90.28.89',
    secondary: '45.90.30.89',
    name: 'Cyclone DNS'
  },
  automatic: {
    primary: 'auto',
    secondary: 'auto',
    name: 'Automatic (DHCP)'
  }
};

/**
 * Класс для управления DNS
 */
export class DNSManager {
  constructor() {
    this.platform = os.platform();
    this.originalDNS = null;
    this.currentDNS = null;
  }

  /**
   * Получение текущего DNS сервера
   * @returns {Promise<Object>}
   */
  async getCurrentDNS() {
    try {
      if (this.platform === 'win32') {
        return await this._getWindowsDNS();
      } else if (this.platform === 'darwin') {
        return await this._getMacOSDNS();
      }
      return await this._getLinuxDNS();

    } catch (error) {
      logger.error(`Failed to get current DNS: ${error.message}`, 'dns');
      return { primary: 'unknown', secondary: 'unknown' };
    }
  }

  /**
   * Получение DNS на Windows
   * @private
   */
  async _getWindowsDNS() {
    try {
      const { stdout } = await execPromise('ipconfig /all');
      const lines = stdout.split('\n');
      const dnsServers = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('dns servers')) {
          // Извлечение DNS серверов из следующих строк
          for (let j = i + 1; j < lines.length && j < i + 5; j++) {
            const dnsLine = lines[j].trim();
            const match = dnsLine.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (match) {
              dnsServers.push(match[1]);
            }
            if (!dnsLine.startsWith(' ')) {break;}
          }
          break;
        }
      }

      return {
        primary: dnsServers[0] || 'unknown',
        secondary: dnsServers[1] || 'unknown',
        servers: dnsServers
      };
    } catch (error) {
      logger.debug(`Windows DNS detection failed: ${error.message}`, 'dns');
      return { primary: 'unknown', secondary: 'unknown' };
    }
  }

  /**
   * Получение DNS на macOS
   * @private
   */
  async _getMacOSDNS() {
    try {
      const { stdout } = await execPromise('scutil --dns');
      const lines = stdout.split('\n');
      const dnsServers = [];

      for (const line of lines) {
        const match = line.match(/nameserver\[\d+\]\s*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (match) {
          dnsServers.push(match[1]);
        }
      }

      return {
        primary: dnsServers[0] || 'unknown',
        secondary: dnsServers[1] || 'unknown',
        servers: dnsServers
      };
    } catch (error) {
      logger.debug(`macOS DNS detection failed: ${error.message}`, 'dns');
      return { primary: 'unknown', secondary: 'unknown' };
    }
  }

  /**
   * Получение DNS на Linux
   * @private
   */
  async _getLinuxDNS() {
    try {
      const fs = await import('fs-extra');
      const resolvConf = await fs.readFile('/etc/resolv.conf', 'utf8');
      const lines = resolvConf.split('\n');
      const dnsServers = [];

      for (const line of lines) {
        const match = line.match(/^nameserver\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (match) {
          dnsServers.push(match[1]);
        }
      }

      return {
        primary: dnsServers[0] || 'unknown',
        secondary: dnsServers[1] || 'unknown',
        servers: dnsServers
      };
    } catch (error) {
      logger.debug(`Linux DNS detection failed: ${error.message}`, 'dns');
      return { primary: 'unknown', secondary: 'unknown' };
    }
  }

  /**
   * Сохранение текущих DNS настроек
   * @returns {Promise<Object>}
   */
  async backupDNS() {
    this.originalDNS = await this.getCurrentDNS();
    logger.info(`DNS backup: ${JSON.stringify(this.originalDNS)}`, 'dns');
    return this.originalDNS;
  }

  /**
   * Установка DNS серверов
   * @param {string} provider - Название провайдера (cloudflare, google, и т.д.)
   * @returns {Promise<boolean>}
   */
  async setDNS(provider) {
    const dnsConfig = DNS_SERVERS[provider];

    if (!dnsConfig) {
      logger.error(`Unknown DNS provider: ${provider}`, 'dns');
      return false;
    }

    // Сохраняем текущие настройки если ещё не сохранены
    if (!this.originalDNS) {
      await this.backupDNS();
    }

    try {
      if (this.platform === 'win32') {
        return await this._setWindowsDNS(dnsConfig);
      } else if (this.platform === 'darwin') {
        return await this._setMacOSDNS(dnsConfig);
      }
      return await this._setLinuxDNS(dnsConfig);

    } catch (error) {
      logger.error(`Failed to set DNS: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Установка DNS на Windows
   * @private
   */
  async _setWindowsDNS(dnsConfig) {
    try {
      // Получение имени активного сетевого интерфейса
      const { stdout } = await execPromise('netsh interface show interface');
      const lines = stdout.split('\n');
      let interfaceName = null;

      for (const line of lines) {
        if (line.includes('Connected') || line.includes('Подключено')) {
          const parts = line.split(/\s+/);
          interfaceName = parts[parts.length - 1];
          break;
        }
      }

      if (!interfaceName) {
        interfaceName = 'Ethernet'; // Интерфейс по умолчанию
      }

      // Установка первичного DNS
      await execPromise(`netsh interface ipv4 set dns name="${interfaceName}" static ${dnsConfig.primary} primary`);

      // Установка вторичного DNS
      if (dnsConfig.secondary && dnsConfig.secondary !== 'auto') {
        await execPromise(`netsh interface ipv4 add dns name="${interfaceName}" ${dnsConfig.secondary} index=2`);
      }

      this.currentDNS = { provider: dnsConfig.name, ...dnsConfig };
      logger.info(`Windows DNS set to ${dnsConfig.name}: ${dnsConfig.primary}, ${dnsConfig.secondary}`, 'dns');
      return true;
    } catch (error) {
      logger.error(`Windows DNS setup failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Установка DNS на macOS
   * @private
   */
  async _setMacOSDNS(dnsConfig) {
    try {
      // Получение активного сетевого интерфейса
      const { stdout } = await execPromise('route -n get default 2>/dev/null | grep interface');
      const interfaceMatch = stdout.match(/interface:\s*(\w+)/);
      const interfaceName = interfaceMatch ? interfaceMatch[1] : 'en0';

      // Создание конфигурационного файла DNS
      const fs = await import('fs-extra');
      const resolverDir = '/etc/resolver';
      const resolverFile = `${resolverDir}/macos-dns`;

      await fs.ensureDir(resolverDir);

      let content = `nameserver ${dnsConfig.primary}\n`;
      if (dnsConfig.secondary && dnsConfig.secondary !== 'auto') {
        content += `nameserver ${dnsConfig.secondary}\n`;
      }

      await fs.writeFile(resolverFile, content);
      await fs.chmod(resolverFile, 0o644);

      // Перезапуск DNS сервиса
      try {
        await execPromise('sudo killall -HUP mDNSResponder');
      } catch (e) {
        logger.debug('mDNSResponder restart skipped', 'dns');
      }

      this.currentDNS = { provider: dnsConfig.name, ...dnsConfig };
      logger.info(`macOS DNS set to ${dnsConfig.name}: ${dnsConfig.primary}, ${dnsConfig.secondary}`, 'dns');
      return true;
    } catch (error) {
      logger.error(`macOS DNS setup failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Установка DNS на Linux
   * @private
   */
  async _setLinuxDNS(dnsConfig) {
    try {
      const fs = await import('fs-extra');
      const resolvConf = '/etc/resolv.conf';

      // Чтение текущего файла
      const content = await fs.readFile(resolvConf, 'utf8');
      const lines = content.split('\n');

      // Удаление старых nameserver записей
      const newLines = lines.filter(line => !line.startsWith('nameserver'));

      // Добавление новых DNS серверов
      newLines.unshift(`nameserver ${dnsConfig.primary}`);
      if (dnsConfig.secondary && dnsConfig.secondary !== 'auto') {
        newLines.unshift(`nameserver ${dnsConfig.secondary}`);
      }

      // Сохранение с резервной копией
      await fs.copy(resolvConf, `${resolvConf}.backup`);
      await fs.writeFile(resolvConf, newLines.join('\n'));
      await fs.chmod(resolvConf, 0o644);

      // Перезапуск DNS сервиса (если есть)
      const services = ['systemd-resolved', 'NetworkManager', 'dnsmasq', 'nscd'];
      for (const service of services) {
        try {
          await execPromise(`systemctl restart ${service} 2>/dev/null || true`);
        } catch (e) {
          // Сервис не найден или не активен
        }
      }

      this.currentDNS = { provider: dnsConfig.name, ...dnsConfig };
      logger.info(`Linux DNS set to ${dnsConfig.name}: ${dnsConfig.primary}, ${dnsConfig.secondary}`, 'dns');
      return true;
    } catch (error) {
      logger.error(`Linux DNS setup failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Восстановление оригинальных DNS настроек
   * @returns {Promise<boolean>}
   */
  async restoreDNS() {
    if (!this.originalDNS) {
      logger.warn('No DNS backup to restore', 'dns');
      return false;
    }

    try {
      if (this.platform === 'win32') {
        return await this._restoreWindowsDNS();
      } else if (this.platform === 'darwin') {
        return await this._restoreMacOSDNS();
      }
      return await this._restoreLinuxDNS();

    } catch (error) {
      logger.error(`Failed to restore DNS: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Восстановление DNS на Windows
   * @private
   */
  async _restoreWindowsDNS() {
    try {
      const { stdout } = await execPromise('netsh interface show interface');
      const lines = stdout.split('\n');
      let interfaceName = null;

      for (const line of lines) {
        if (line.includes('Connected') || line.includes('Подключено')) {
          const parts = line.split(/\s+/);
          interfaceName = parts[parts.length - 1];
          break;
        }
      }

      if (!interfaceName) {
        interfaceName = 'Ethernet';
      }

      // Сброс на автоматическое получение DNS
      await execPromise(`netsh interface ipv4 set dns name="${interfaceName}" source=dhcp`);

      this.currentDNS = null;
      logger.info('Windows DNS restored to automatic (DHCP)', 'dns');
      return true;
    } catch (error) {
      logger.error(`Windows DNS restore failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Восстановление DNS на macOS
   * @private
   */
  async _restoreMacOSDNS() {
    try {
      const fs = await import('fs-extra');
      const resolverFile = '/etc/resolver/macos-dns';

      if (await fs.pathExists(resolverFile)) {
        await fs.remove(resolverFile);
      }

      // Перезапуск DNS сервиса
      try {
        await execPromise('sudo killall -HUP mDNSResponder');
      } catch (e) {
        // Игнорировать
      }

      this.currentDNS = null;
      logger.info('macOS DNS restored to automatic (DHCP)', 'dns');
      return true;
    } catch (error) {
      logger.error(`macOS DNS restore failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Восстановление DNS на Linux
   * @private
   */
  async _restoreLinuxDNS() {
    try {
      const fs = await import('fs-extra');
      const resolvConf = '/etc/resolv.conf';
      const backupFile = `${resolvConf}.backup`;

      if (await fs.pathExists(backupFile)) {
        await fs.copy(backupFile, resolvConf);
        await fs.remove(backupFile);
      }

      this.currentDNS = null;
      logger.info('Linux DNS restored to automatic (DHCP)', 'dns');
      return true;
    } catch (error) {
      logger.error(`Linux DNS restore failed: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Очистка DNS кэша
   * @returns {Promise<boolean>}
   */
  async flushDNSCache() {
    try {
      if (this.platform === 'win32') {
        await execPromise('ipconfig /flushdns');
        logger.info('Windows DNS cache flushed', 'dns');
      } else if (this.platform === 'darwin') {
        await execPromise('sudo killall -HUP mDNSResponder');
        logger.info('macOS DNS cache flushed', 'dns');
      } else {
        // Linux - различные сервисы
        const services = ['systemd-resolved', 'dnsmasq', 'nscd'];
        for (const service of services) {
          try {
            await execPromise(`systemctl restart ${service} 2>/dev/null || true`);
          } catch (e) {
            // Игнорировать
          }
        }
        logger.info('Linux DNS cache flushed', 'dns');
      }
      return true;
    } catch (error) {
      logger.error(`Failed to flush DNS cache: ${error.message}`, 'dns');
      return false;
    }
  }

  /**
   * Получение списка доступных DNS провайдеров
   * @returns {Object}
   */
  getAvailableProviders() {
    return Object.entries(DNS_SERVERS).reduce((acc, [key, value]) => {
      acc[key] = {
        name: value.name,
        primary: value.primary,
        secondary: value.secondary
      };
      return acc;
    }, {});
  }

  /**
   * Получение текущей конфигурации
   * @returns {Object}
   */
  getConfig() {
    return {
      platform: this.platform,
      originalDNS: this.originalDNS,
      currentDNS: this.currentDNS,
      hasBackup: !!this.originalDNS,
      isCustomDNS: !!this.currentDNS
    };
  }
}

// Глобальный экземпляр
export const globalDNSManager = new DNSManager();

export default DNSManager;
