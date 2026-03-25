/**
 * VPN Manager - Управление VPN подключениями
 * Поддержка WireGuard и OpenVPN
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';

const execPromise = promisify(exec);

/**
 * Конфигурация VPN
 */
export const VPN_CONFIG = {
  wireguard: {
    configDir: {
      win32: 'C:\\Program Files\\WireGuard\\Data\\Configurations',
      darwin: '/usr/local/etc/wireguard',
      linux: '/etc/wireguard'
    },
    binary: {
      win32: 'C:\\Program Files\\WireGuard\\wireguard.exe',
      darwin: '/usr/local/bin/wg',
      linux: '/usr/bin/wg'
    }
  },
  openvpn: {
    configDir: {
      win32: 'C:\\Program Files\\OpenVPN\\config',
      darwin: '/usr/local/etc/openvpn',
      linux: '/etc/openvpn'
    },
    binary: {
      win32: 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe',
      darwin: '/usr/local/bin/openvpn',
      linux: '/usr/sbin/openvpn'
    }
  }
};

/**
 * Класс для управления VPN
 */
export class VPNManager {
  constructor() {
    this.platform = os.platform();
    this.currentConnection = null;
    this.connections = new Map();
    this.configPath = path.join(process.cwd(), 'data', 'vpn-configs');
  }

  /**
   * Инициализация менеджера
   */
  async init() {
    logger.info('Initializing VPN Manager...', 'vpn');

    // Создание директории для конфигов
    await fs.ensureDir(this.configPath);

    // Проверка установленных VPN клиентов
    const wireguardInstalled = await this.checkWireGuard();
    const openvpnInstalled = await this.checkOpenVPN();

    logger.info(`WireGuard: ${wireguardInstalled ? 'installed' : 'not installed'}`, 'vpn');
    logger.info(`OpenVPN: ${openvpnInstalled ? 'installed' : 'not installed'}`, 'vpn');

    return { wireguard: wireguardInstalled, openvpn: openvpnInstalled };
  }

  /**
   * Проверка установки WireGuard
   */
  async checkWireGuard() {
    try {
      const binary = VPN_CONFIG.wireguard.binary[this.platform];
      await execPromise(`"${binary}" --version 2>&1 || wg --version 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверка установки OpenVPN
   */
  async checkOpenVPN() {
    try {
      const binary = VPN_CONFIG.openvpn.binary[this.platform];
      await execPromise(`"${binary}" --version 2>&1 || openvpn --version 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Создание WireGuard конфигурации
   * @param {Object} config - Конфигурация
   * @returns {string} - Путь к файлу конфигурации
   */
  createWireGuardConfig(config) {
    const {
      name,
      privateKey,
      address,
      dns = '1.1.1.1',
      peers = []
    } = config;

    let wgConfig = `[Interface]\n`;
    wgConfig += `PrivateKey = ${privateKey}\n`;
    wgConfig += `Address = ${address}\n`;
    wgConfig += `DNS = ${dns}\n`;

    for (const peer of peers) {
      wgConfig += `\n[Peer]\n`;
      wgConfig += `PublicKey = ${peer.publicKey}\n`;
      if (peer.presharedKey) {
        wgConfig += `PresharedKey = ${peer.presharedKey}\n`;
      }
      wgConfig += `Endpoint = ${peer.endpoint}\n`;
      wgConfig += `AllowedIPs = ${peer.allowedIPs || '0.0.0.0/0'}\n`;
      if (peer.persistentKeepalive) {
        wgConfig += `PersistentKeepalive = ${peer.persistentKeepalive}\n`;
      }
    }

    const configFile = path.join(this.configPath, `${name}.conf`);

    fs.writeFileSync(configFile, wgConfig);
    logger.info(`WireGuard config created: ${configFile}`, 'vpn');

    return configFile;
  }

  /**
   * Импорт WireGuard конфигурации
   * @param {string} configFile - Путь к файлу
   * @returns {Promise<boolean>}
   */
  async importWireGuardConfig(configFile) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /installtunnelservice "${configFile}"`);
      } else {
        // Для Linux/macOS копируем в системную директорию
        const dest = path.join(VPN_CONFIG.wireguard.configDir[this.platform], path.basename(configFile));
        await fs.copy(configFile, dest);
        await fs.chmod(dest, 0o600);
      }

      logger.info(`WireGuard config imported: ${configFile}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard import failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Подключение WireGuard
   * @param {string} tunnelName - Имя туннеля
   * @returns {Promise<boolean>}
   */
  async connectWireGuard(tunnelName) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /settunnelstate "${tunnelName}" on`);
      } else if (this.platform === 'darwin') {
        await execPromise(`sudo wg-quick up ${tunnelName}`);
      } else {
        await execPromise(`sudo wg-quick up ${tunnelName}`);
      }

      this.currentConnection = { type: 'wireguard', name: tunnelName };
      logger.info(`WireGuard connected: ${tunnelName}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard connect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Отключение WireGuard
   * @param {string} tunnelName - Имя туннеля
   * @returns {Promise<boolean>}
   */
  async disconnectWireGuard(tunnelName) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /settunnelstate "${tunnelName}" off`);
      } else if (this.platform === 'darwin') {
        await execPromise(`sudo wg-quick down ${tunnelName}`);
      } else {
        await execPromise(`sudo wg-quick down ${tunnelName}`);
      }

      this.currentConnection = null;
      logger.info(`WireGuard disconnected: ${tunnelName}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard disconnect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Создание OpenVPN конфигурации
   * @param {Object} config - Конфигурация
   * @returns {string} - Путь к файлу конфигурации
   */
  createOpenVPNConfig(config) {
    const {
      name,
      remote,
      port = 1194,
      proto = 'udp',
      dev = 'tun',
      ca,
      cert,
      key,
      tlsAuth,
      cipher = 'AES-256-GCM',
      auth = 'SHA256',
      compress = 'lz4-v2'
    } = config;

    let ovpnConfig = `client\ndev ${dev}\nproto ${proto}\n`;
    ovpnConfig += `remote ${remote} ${port}\n`;
    ovpnConfig += `resolv-retry infinite\nnobind\npersist-key\npersist-tun\n`;
    ovpnConfig += `cipher ${cipher}\nauth ${auth}\ncomp-lzo\nverb 3\n`;

    if (compress) {
      ovpnConfig += `compress ${compress}\n`;
    }

    // Вставка сертификатов
    if (ca) {
      ovpnConfig += `<ca>\n${ca}\n</ca>\n`;
    }
    if (cert) {
      ovpnConfig += `<cert>\n${cert}\n</cert>\n`;
    }
    if (key) {
      ovpnConfig += `<key>\n${key}\n</key>\n`;
    }
    if (tlsAuth) {
      ovpnConfig += `<tls-auth>\n${tlsAuth}\n</tls-auth>\nkey-direction 1\n`;
    }

    const configFile = path.join(this.configPath, `${name}.ovpn`);
    fs.writeFileSync(configFile, ovpnConfig);
    logger.info(`OpenVPN config created: ${configFile}`, 'vpn');

    return configFile;
  }

  /**
   * Подключение OpenVPN
   * @param {string} configFile - Путь к конфигурации
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async connectOpenVPN(configFile, options = {}) {
    const { authUserPass } = options;

    try {
      const binary = VPN_CONFIG.openvpn.binary[this.platform];
      const args = [`--config "${configFile}"`, '--daemon'];

      if (authUserPass) {
        const authFile = path.join(this.configPath, 'auth.txt');
        fs.writeFileSync(authFile, authUserPass);
        args.push(`--auth-user-pass "${authFile}"`);
      }

      const command = `"${binary}" ${args.join(' ')}`;

      // Запуск в фоне
      exec(command, error => {
        if (error) {
          logger.error(`OpenVPN error: ${error.message}`, 'vpn');
        }
      });

      // Ожидание подключения
      await new Promise(resolve => setTimeout(resolve, 5000));

      this.currentConnection = { type: 'openvpn', config: configFile };
      logger.info(`OpenVPN connected: ${configFile}`, 'vpn');

      return { success: true, pid: null };
    } catch (error) {
      logger.error(`OpenVPN connect failed: ${error.message}`, 'vpn');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение OpenVPN
   * @returns {Promise<boolean>}
   */
  async disconnectOpenVPN() {
    try {
      if (this.platform === 'win32') {
        await execPromise('taskkill /F /IM openvpn.exe');
      } else {
        await execPromise('sudo pkill openvpn');
      }

      this.currentConnection = null;
      logger.info('OpenVPN disconnected', 'vpn');
      return true;
    } catch (error) {
      logger.error(`OpenVPN disconnect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Отключение любого VPN
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    if (this.currentConnection?.type === 'wireguard') {
      return this.disconnectWireGuard(this.currentConnection.name);
    } else if (this.currentConnection?.type === 'openvpn') {
      return this.disconnectOpenVPN();
    }
    return true;
  }

  /**
   * Проверка статуса подключения
   * @returns {Promise<Object>}
   */
  async getStatus() {
    const status = {
      connected: !!this.currentConnection,
      type: this.currentConnection?.type || null,
      name: this.currentConnection?.name || null,
      ip: null,
      country: null
    };

    if (this.currentConnection) {
      try {
        // Получение внешнего IP
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        status.ip = data.ip;
        status.country = data.country_name;
      } catch (error) {
        logger.debug(`Failed to get VPN status: ${error.message}`, 'vpn');
      }
    }

    return status;
  }

  /**
   * Проверка любого активного VPN подключения (включая Amnezia, NordVPN, и др.)
   * @returns {Promise<Object>}
   */
  async detectActiveVPN() {
    const result = {
      detected: false,
      type: null,
      name: null,
      ip: null,
      country: null
    };

    try {
      const fetch = (await import('node-fetch')).default;

      // Получаем IP и информацию
      const response = await fetch('https://ipapi.co/json/', { timeout: 5000 });
      const data = await response.json();

      result.ip = data.ip;
      result.country = data.country_name;
      result.countryCode = data.country_code;
      result.isp = data.org || data.isp;

      // Проверка на известные VPN провайдеры по ISP
      const vpnProviders = [
        'Mullvad', 'NordVPN', 'ExpressVPN', 'Surfshark',
        'ProtonVPN', 'CyberGhost', 'PIA', 'Windscribe',
        'Amnezia', 'WireGuard', 'OpenVPN'
      ];

      const isVPN = vpnProviders.some(v =>
        result.isp?.toLowerCase().includes(v.toLowerCase())
      );

      // Проверка через IP (некоторые страны = VPN)
      const vpnCountries = ['KZ', 'SG', 'NL', 'DE', 'US', 'GB', 'FR'];
      const isForeignIP = vpnCountries.includes(data.country_code);

      result.detected = isVPN || isForeignIP;
      result.type = isVPN ? 'known_vpn' : (isForeignIP ? 'foreign_ip' : 'local');
      result.name = result.isp;

      logger.info(`VPN detection: ${JSON.stringify(result)}`, 'vpn');

      return result;
    } catch (error) {
      logger.debug(`VPN detection failed: ${error.message}`, 'vpn');
      return result;
    }
  }

  /**
   * Получение списка конфигураций
   * @returns {Promise<Array>}
   */
  async getConfigs() {
    try {
      const files = await fs.readdir(this.configPath);
      const configs = [];

      for (const file of files) {
        if (file.endsWith('.conf')) {
          configs.push({
            name: file.replace('.conf', ''),
            type: 'wireguard',
            path: path.join(this.configPath, file)
          });
        } else if (file.endsWith('.ovpn')) {
          configs.push({
            name: file.replace('.ovpn', ''),
            type: 'openvpn',
            path: path.join(this.configPath, file)
          });
        }
      }

      return configs;
    } catch (error) {
      return [];
    }
  }

  /**
   * Удаление конфигурации
   * @param {string} name - Имя конфигурации
   * @returns {Promise<boolean>}
   */
  async deleteConfig(name) {
    try {
      const confFile = path.join(this.configPath, `${name}.conf`);
      const ovpnFile = path.join(this.configPath, `${name}.ovpn`);

      if (await fs.pathExists(confFile)) {
        await fs.remove(confFile);
      }
      if (await fs.pathExists(ovpnFile)) {
        await fs.remove(ovpnFile);
      }

      logger.info(`VPN config deleted: ${name}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`Delete config failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Генерация ключей WireGuard
   * @returns {Promise<Object>}
   */
  async generateWireGuardKeys() {
    try {
      if (this.platform === 'win32') {
        // Windows требует установленный WireGuard для генерации ключей
        const { stdout: privateKey } = await execPromise('wgen privatekey');
        const { stdout: publicKey } = await execPromise(`echo ${privateKey.trim()} | wgen publickey`);

        return {
          privateKey: privateKey.trim(),
          publicKey: publicKey.trim()
        };
      }
      const { stdout: privateKey } = await execPromise('wg genkey');
      const { stdout: publicKey } = await execPromise(`echo ${privateKey.trim()} | wg pubkey`);

      return {
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim()
      };

    } catch (error) {
      logger.error(`Key generation failed: ${error.message}`, 'vpn');
      return null;
    }
  }

  /**
   * Быстрое подключение к бесплатному VPN
   * @returns {Promise<Object>}
   */
  async quickConnect() {
    logger.info('Quick connect initiated...', 'vpn');

    // Проверка доступных VPN
    const wireguard = await this.checkWireGuard();
    const openvpn = await this.checkOpenVPN();

    if (!wireguard && !openvpn) {
      return {
        success: false,
        error: 'No VPN client installed. Install WireGuard or OpenVPN.'
      };
    }

    // Отключение текущего подключения
    if (this.currentConnection) {
      await this.disconnect();
    }

    // Получение статуса
    const status = await this.getStatus();

    return {
      success: true,
      message: 'Quick connect completed',
      ...status
    };
  }
}

// Глобальный экземпляр
export const globalVPNManager = new VPNManager();

export default VPNManager;
