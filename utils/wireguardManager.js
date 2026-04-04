/**
 * WireGuard Manager - Управление WireGuard соединениями
 * Интеграция WireGuard для надёжного обхода блокировок
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { logger } from './logger.js';

const execPromise = promisify(exec);

class WireGuardManager {
  constructor() {
    this.configs = [];
    this.activeInterface = null;
    this.wgPath = null;
    this.configDir = null;
    this.initialized = false;

    // Статус соединения
    this.connectionStatus = {
      connected: false,
      interface: null,
      publicKey: null,
      endpoint: null,
      allowedIPs: null,
      lastHandshake: null,
      transfer: { received: 0, sent: 0 }
    };

    // Рекомендуемые endpoint'ы
    this.recommendedEndpoints = [
      { country: 'NL', city: 'Amsterdam', endpoint: '185.x.x.x:51820' },
      { country: 'DE', city: 'Frankfurt', endpoint: '185.x.x.x:51820' },
      { country: 'US', city: 'New York', endpoint: '185.x.x.x:51820' },
      { country: 'SG', city: 'Singapore', endpoint: '185.x.x.x:51820' },
      { country: 'JP', city: 'Tokyo', endpoint: '185.x.x.x:51820' }
    ];
  }

  /**
   * Инициализация менеджера
   */
  async init() {
    if (this.initialized) {return true;}

    logger.info('Initializing WireGuard manager...', 'wireguard');

    // Находим WireGuard
    this.wgPath = await this.findWireGuard();

    if (!this.wgPath) {
      logger.warn('WireGuard not found, some features will be unavailable', 'wireguard');
      this.initialized = true;
      return false;
    }

    // Устанавливаем директорию конфигов
    this.configDir = await this.getConfigDirectory();
    await fs.ensureDir(this.configDir);

    // Загружаем существующие конфигурации
    await this.loadConfigs();

    this.initialized = true;
    logger.info(`WireGuard manager initialized, ${this.configs.length} configs loaded`, 'wireguard');

    return true;
  }

  /**
   * Найти WireGuard executable
   */
  async findWireGuard() {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        // Windows: проверяем стандартные пути
        const paths = [
          'C:\\Program Files\\WireGuard\\wg.exe',
          'C:\\Program Files (x86)\\WireGuard\\wg.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'WireGuard', 'wg.exe')
        ];

        for (const p of paths) {
          if (await fs.pathExists(p)) {
            return p;
          }
        }

        // Проверяем PATH
        const { stdout } = await execPromise('where wg 2>nul || echo not_found');
        if (!stdout.includes('not_found')) {
          return 'wg';
        }
      } else {
        // Linux/macOS
        const { stdout } = await execPromise('which wg 2>/dev/null || echo not_found');
        if (!stdout.includes('not_found')) {
          return 'wg';
        }
      }
    } catch {
      // WireGuard не установлен
    }

    return null;
  }

  /**
   * Получить директорию для конфигов
   */
  async getConfigDirectory() {
    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'win32') {
      return path.join(home, 'Documents', '.cursor-free-vip', 'wireguard');
    } else if (platform === 'darwin') {
      return path.join(home, '.cursor-free-vip', 'wireguard');
    }
    return path.join(home, '.config', 'cursor-free-vip', 'wireguard');

  }

  /**
   * Загрузить существующие конфигурации
   */
  async loadConfigs() {
    try {
      const files = await fs.readdir(this.configDir);

      for (const file of files) {
        if (file.endsWith('.conf')) {
          const configPath = path.join(this.configDir, file);
          const config = await this.parseConfig(configPath);
          if (config) {
            config.name = file.replace('.conf', '');
            config.path = configPath;
            this.configs.push(config);
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to load configs: ${error.message}`, 'wireguard');
    }
  }

  /**
   * Парсинг конфигурационного файла WireGuard
   */
  async parseConfig(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const config = {
        interface: {},
        peer: {}
      };

      let section = null;

      for (const line of content.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.startsWith('[')) {
          section = trimmed.replace(/\[[\]]/g, '').toLowerCase();
          continue;
        }

        if (!trimmed || trimmed.startsWith('#')) {continue;}

        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        const keyLower = key.trim().toLowerCase();

        if (section === 'interface') {
          config.interface[keyLower] = value;
        } else if (section === 'peer') {
          config.peer[keyLower] = value;
        }
      }

      return config;
    } catch (error) {
      logger.warn(`Failed to parse config ${configPath}: ${error.message}`, 'wireguard');
      return null;
    }
  }

  /**
   * Генерация ключей WireGuard
   * Примечание: это упрощённая генерация. Для production рекомендуется
   * использовать реальный Curve25519 через библиотеку tweetnacl или аналог
   */
  async generateKeyPair() {
    try {
      // Генерация криптографически стойкого приватного ключа (32 байта, base64)
      const privateKey = crypto.randomBytes(32);
      const privateKeyBase64 = privateKey.toString('base64');

      // Для WireGuard нужен реальный Curve25519 публичный ключ
      // В production используйте: npm install tweetnacl
      // Здесь генерируем placeholder - реальный ключ получится только с Curve25519
      const publicKey = crypto.randomBytes(32);
      const publicKeyBase64 = publicKey.toString('base64');

      logger.warn('WireGuard key generation uses placeholder. Install tweetnacl for real Curve25519.', 'wireguard');

      return {
        privateKey: privateKeyBase64,
        publicKey: publicKeyBase64
      };
    } catch (error) {
      logger.error(`Key generation failed: ${error.message}`, 'wireguard');
      return null;
    }
  }

  /**
   * Создание конфигурации WireGuard
   */
  async createConfig(options) {
    const {
      name = `wg${Date.now()}`,
      endpoint,
      publicKey,
      privateKey,
      allowedIPs = '0.0.0.0/0',
      dns = '1.1.1.1',
      mtu = 1420
    } = options;

    // Генерируем ключи если не предоставлены
    const keys = privateKey ? null : await this.generateKeyPair();
    const actualPrivateKey = privateKey || keys?.privateKey;
    const clientPublicKey = keys?.publicKey;

    const config = {
      interface: {
        privateKey: actualPrivateKey,
        address: options.address || '10.0.0.2/24',
        dns,
        mtu: mtu.toString()
      },
      peer: {
        publicKey,
        endpoint,
        allowedIPs,
        persistentKeepalive: '25'
      },
      name,
      path: path.join(this.configDir, `${name}.conf`)
    };

    // Записываем конфигурационный файл
    const configContent = this.generateConfigContent(config);
    await fs.writeFile(config.path, configContent, 'utf8');

    this.configs.push(config);
    logger.info(`WireGuard config created: ${name}`, 'wireguard');

    return {
      name,
      path: config.path,
      clientPublicKey,
      config
    };
  }

  /**
   * Генерация содержимого конфиг-файла
   */
  generateConfigContent(config) {
    const lines = [
      '[Interface]',
      `PrivateKey = ${config.interface.privateKey}`,
      `Address = ${config.interface.address}`,
      `DNS = ${config.interface.dns}`,
      `MTU = ${config.interface.mtu}`,
      '',
      '[Peer]',
      `PublicKey = ${config.peer.publicKey}`,
      `Endpoint = ${config.peer.endpoint}`,
      `AllowedIPs = ${config.peer.allowedIPs}`,
      `PersistentKeepalive = ${config.peer.persistentKeepalive}`
    ];

    return lines.join('\n');
  }

  /**
   * Запуск WireGuard соединения
   */
  async connect(configName) {
    if (!this.wgPath) {
      return { success: false, error: 'WireGuard not installed' };
    }

    const config = this.configs.find(c => c.name === configName);
    if (!config) {
      return { success: false, error: 'Config not found' };
    }

    try {
      const platform = os.platform();
      const interfaceName = `wg${this.configs.indexOf(config)}`;

      if (platform === 'win32') {
        // Windows: используем wireguard-windows
        await execPromise(`wireguard /installtunnelservice "${config.path}"`);
      } else if (platform === 'linux') {
        // Linux: wg-quick
        await execPromise(`sudo wg-quick up ${config.path}`);
      } else if (platform === 'darwin') {
        // macOS: используем wg
        await execPromise(`sudo wg setconf ${interfaceName} ${config.path}`);
      }

      this.activeInterface = interfaceName;
      this.connectionStatus.connected = true;
      this.connectionStatus.interface = interfaceName;
      this.connectionStatus.endpoint = config.peer.endpoint;
      this.connectionStatus.publicKey = config.peer.publicKey;

      logger.info(`WireGuard connected: ${configName}`, 'wireguard');

      return { success: true, interface: interfaceName };
    } catch (error) {
      logger.error(`WireGuard connection failed: ${error.message}`, 'wireguard');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение WireGuard
   */
  async disconnect() {
    if (!this.activeInterface) {
      return { success: true, message: 'No active connection' };
    }

    try {
      const platform = os.platform();

      if (platform === 'win32') {
        await execPromise(`wireguard /uninstalltunnelservice ${this.activeInterface}`);
      } else if (platform === 'linux') {
        await execPromise(`sudo wg-quick down ${this.activeInterface}`);
      } else if (platform === 'darwin') {
        await execPromise(`sudo wg show ${this.activeInterface} && sudo ip link delete ${this.activeInterface}`);
      }

      this.activeInterface = null;
      this.connectionStatus.connected = false;
      this.connectionStatus.interface = null;

      logger.info('WireGuard disconnected', 'wireguard');

      return { success: true };
    } catch (error) {
      logger.error(`WireGuard disconnection failed: ${error.message}`, 'wireguard');
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить статус соединения
   */
  async getStatus() {
    if (!this.wgPath || !this.activeInterface) {
      return { connected: false };
    }

    try {
      const { stdout } = await execPromise(`${this.wgPath} show ${this.activeInterface}`);

      // Парсинг вывода wg show
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('latest handshake')) {
          this.connectionStatus.lastHandshake = line.split(':')[1].trim();
        } else if (line.includes('transfer:')) {
          const match = line.match(/transfer:\s*(\d+)\s*\w+\s*received,\s*(\d+)\s*\w+\s*sent/);
          if (match) {
            this.connectionStatus.transfer.received = parseInt(match[1], 10);
            this.connectionStatus.transfer.sent = parseInt(match[2], 10);
          }
        }
      }

      return { ...this.connectionStatus };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Проверка доступности endpoint
   */
  async testEndpoint(endpoint) {
    const [host, port] = endpoint.split(':');
    const startTime = Date.now();
    const net = await import('net');

    return new Promise(resolve => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ success: false, error: 'timeout' });
      }, 5000);

      socket.connect(parseInt(port, 10) || 51820, host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          success: true,
          responseTime: Date.now() - startTime,
          endpoint
        });
      });

      socket.on('error', error => {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Тестирование всех endpoint'ов
   */
  async testAllEndpoints() {
    const results = [];

    for (const endpoint of this.recommendedEndpoints) {
      const result = await this.testEndpoint(endpoint.endpoint);
      results.push({
        ...endpoint,
        ...result
      });
    }

    // Сортировка по времени отклика
    results.sort((a, b) => {
      if (!a.success) {return 1;}
      if (!b.success) {return -1;}
      return a.responseTime - b.responseTime;
    });

    return results;
  }

  /**
   * Получить список конфигураций
   */
  getConfigs() {
    return this.configs.map(c => ({
      name: c.name,
      endpoint: c.peer.endpoint,
      allowedIPs: c.peer.allowedIPs,
      dns: c.interface.dns,
      path: c.path
    }));
  }

  /**
   * Удалить конфигурацию
   */
  async deleteConfig(configName) {
    const index = this.configs.findIndex(c => c.name === configName);
    if (index === -1) {
      return { success: false, error: 'Config not found' };
    }

    const config = this.configs[index];

    // Отключаем если активно
    if (this.activeInterface && this.connectionStatus.endpoint === config.peer.endpoint) {
      await this.disconnect();
    }

    // Удаляем файл
    await fs.remove(config.path);
    this.configs.splice(index, 1);

    logger.info(`WireGuard config deleted: ${configName}`, 'wireguard');

    return { success: true };
  }

  /**
   * Рекомендации по настройке
   */
  getRecommendations() {
    return [
      {
        type: 'endpoint',
        priority: 'high',
        title: 'Выберите ближайший endpoint',
        description: 'Для минимальной задержки выберите сервер в вашем регионе'
      },
      {
        type: 'mtu',
        priority: 'medium',
        title: 'Оптимизируйте MTU',
        description: 'Рекомендуется MTU 1420 для предотвращения фрагментации'
      },
      {
        type: 'dns',
        priority: 'high',
        title: 'Используйте безопасный DNS',
        description: 'Настройте DNS на 1.1.1.1 или 9.9.9.9 для защиты DNS запросов'
      },
      {
        type: 'keepalive',
        priority: 'low',
        title: 'Persistent Keepalive',
        description: 'Включите keepalive (25 сек) для поддержания соединения через NAT'
      }
    ];
  }

  /**
   * Экспорт конфигурации для QR кода
   */
  async exportForQR(configName) {
    const config = this.configs.find(c => c.name === configName);
    if (!config) {
      return null;
    }

    return this.generateConfigContent(config);
  }

  /**
   * Импорт конфигурации из файла
   */
  async importConfig(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const name = path.basename(filePath, '.conf');
      const destPath = path.join(this.configDir, path.basename(filePath));

      await fs.writeFile(destPath, content, 'utf8');

      const config = await this.parseConfig(destPath);
      if (config) {
        config.name = name;
        config.path = destPath;
        this.configs.push(config);
        logger.info(`WireGuard config imported: ${name}`, 'wireguard');
        return { success: true, name };
      }

      return { success: false, error: 'Invalid config format' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton
export const globalWireGuardManager = new WireGuardManager();
export default WireGuardManager;
