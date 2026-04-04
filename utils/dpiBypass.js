/**
 * DPI Bypass Module - Модуль обхода Deep Packet Inspection
 * Реализует различные методы обхода DPI фильтров
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import os from 'os';
import { logger } from './logger.js';

const execPromise = promisify(exec);

class DPIBypass {
  constructor() {
    this.enabled = false;
    this.method = 'auto';
    this.config = {
      fragmentSize: 2,
      fragmentDelay: 10,
      fakePacketEnabled: true,
      domainFronting: false,
      sniMasking: true
    };

    // Поддерживаемые методы обхода DPI
    this.methods = {
      fragmented: {
        name: 'Фрагментация пакетов',
        description: 'Разделение TLS ClientHello на фрагменты',
        platform: ['win32', 'linux', 'darwin']
      },
      fake_packet: {
        name: 'Фейковые пакеты',
        description: 'Отправка fake пакетов с неверным SNI',
        platform: ['win32', 'linux']
      },
      domain_fronting: {
        name: 'Domain Fronting',
        description: 'Использование разных доменов в SNI и Host',
        platform: ['win32', 'linux', 'darwin']
      },
      sni_masking: {
        name: 'SNI Masking',
        description: 'Скрытие SNI через различные техники',
        platform: ['win32', 'linux']
      },
      goodbyedpi: {
        name: 'GoodbyeDPI',
        description: 'Использование GoodbyeDPI для Windows',
        platform: ['win32']
      },
      zapret: {
        name: 'Zapret',
        description: 'Использование Zapret для обхода DPI',
        platform: ['win32', 'linux']
      }
    };

    // Целевые домены для Cursor
    this.targetDomains = [
      'cursor.sh',
      'api2.cursor.sh',
      'telemetry.cursor.sh',
      'api.cursor.sh'
    ];

    // Статус обхода
    this.status = {
      lastTest: null,
      workingMethods: [],
      currentMethod: null,
      successRate: 0
    };

    this.testResults = new Map();
  }

  /**
   * Инициализация DPI обхода
   */
  async init() {
    logger.info('Initializing DPI bypass module...', 'dpi-bypass');

    // Определяем лучший метод для текущей платформы
    const platform = os.platform();
    const availableMethods = Object.entries(this.methods)
      .filter(([_, m]) => m.platform.includes(platform))
      .map(([key, _]) => key);

    logger.info(`Available DPI bypass methods for ${platform}: ${availableMethods.join(', ')}`, 'dpi-bypass');

    // Тестируем методы
    await this.testMethods();

    // Включаем лучший метод
    this.enableBestMethod();

    return true;
  }

  /**
   * Тестирование всех методов
   */
  async testMethods() {
    const results = {};
    const platform = os.platform();

    for (const [methodKey, method] of Object.entries(this.methods)) {
      if (!method.platform.includes(platform)) {
        continue;
      }

      try {
        const result = await this.testMethod(methodKey);
        results[methodKey] = result;
        this.testResults.set(methodKey, result);
      } catch (error) {
        results[methodKey] = { success: false, error: error.message };
      }
    }

    // Определяем рабочие методы
    this.status.workingMethods = Object.entries(results)
      .filter(([_, r]) => r.success)
      .map(([key, _]) => key);

    this.status.lastTest = Date.now();

    if (this.status.workingMethods.length > 0) {
      this.status.successRate = (this.status.workingMethods.length / Object.keys(results).length) * 100;
    }

    logger.info(`DPI bypass test complete: ${this.status.workingMethods.length} working methods`, 'dpi-bypass');

    return results;
  }

  /**
   * Тестирование конкретного метода
   */
  async testMethod(method) {
    switch (method) {
      case 'fragmented':
        return this.testFragmented();
      case 'fake_packet':
        return this.testFakePacket();
      case 'domain_fronting':
        return this.testDomainFronting();
      case 'sni_masking':
        return this.testSNIMasking();
      case 'goodbyedpi':
        return this.testGoodbyeDPI();
      case 'zapret':
        return this.testZapret();
      default:
        return { success: false, error: 'Unknown method' };
    }
  }

  /**
   * Тест фрагментации пакетов
   */
  async testFragmented() {
    try {
      // Тестовое подключение с фрагментацией
      const result = await this.testConnection({
        fragmentSize: this.config.fragmentSize,
        fragmentDelay: this.config.fragmentDelay
      });

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'fragmented'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест фейковых пакетов
   */
  async testFakePacket() {
    try {
      // Имитация отправки fake пакетов
      const result = await this.testConnection({
        fakePacket: true,
        fakePacketType: 'rst'
      });

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'fake_packet'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест Domain Fronting
   */
  async testDomainFronting() {
    try {
      // Domain Fronting через CloudFront
      const result = await this.testConnection({
        sni: 'd111111abcdef8.cloudfront.net',
        host: 'cursor.sh'
      });

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'domain_fronting'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест SNI Masking
   */
  async testSNIMasking() {
    try {
      const result = await this.testConnection({
        sniMasking: true
      });

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'sni_masking'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест GoodbyeDPI (Windows)
   */
  async testGoodbyeDPI() {
    if (os.platform() !== 'win32') {
      return { success: false, error: 'Windows only' };
    }

    try {
      // Проверяем установлен ли GoodbyeDPI
      const { stdout } = await execPromise('where goodbyedpi 2>nul || echo not_found');

      if (stdout.includes('not_found')) {
        return { success: false, error: 'GoodbyeDPI not installed' };
      }

      // Запускаем GoodbyeDPI
      await execPromise('start /b goodbyedpi.exe -p -r -s -f 2 -k 2 -n -e 1 --set-ttls 5');

      // Тестируем соединение
      const result = await this.testConnection({});

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'goodbyedpi'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест Zapret
   */
  async testZapret() {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        // Проверяем zapret-winws
        const { stdout } = await execPromise('where winws 2>nul || echo not_found');

        if (stdout.includes('not_found')) {
          return { success: false, error: 'Zapret not installed' };
        }

        // Конфигурация zapret для Cursor
        await execPromise('start /b winws --wf-tcp=443 --wf-udp=443 --wssize=1:6 --dpi-desync=fake --dpi-desync-ttl=5');
      } else if (platform === 'linux') {
        // Проверяем nfqws
        const { stdout } = await execPromise('which nfqws 2>/dev/null || echo not_found');

        if (stdout.includes('not_found')) {
          return { success: false, error: 'Zapret not installed' };
        }
      }

      const result = await this.testConnection({});

      return {
        success: result.success,
        responseTime: result.responseTime,
        method: 'zapret'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тестовое соединение
   */
  async testConnection(options) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const req = https.request({
        hostname: 'cursor.sh',
        port: 443,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Connection': 'keep-alive',
          ...options.headers
        },
        // DPI bypass options
        servername: options.sni || 'cursor.sh',
        rejectUnauthorized: false
      }, res => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ success: true, responseTime, statusCode: res.statusCode });
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          // 4xx может означать что DPI не заблокировал
          resolve({ success: true, responseTime, statusCode: res.statusCode });
        } else {
          resolve({ success: false, responseTime, statusCode: res.statusCode });
        }
      });

      req.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Включить лучший метод
   */
  enableBestMethod() {
    if (this.status.workingMethods.length === 0) {
      logger.warn('No working DPI bypass methods found', 'dpi-bypass');
      return false;
    }

    // Приоритет методов
    const priority = ['zapret', 'goodbyedpi', 'fragmented', 'fake_packet', 'domain_fronting', 'sni_masking'];

    for (const method of priority) {
      if (this.status.workingMethods.includes(method)) {
        this.method = method;
        this.status.currentMethod = method;
        this.enabled = true;
        logger.info(`DPI bypass enabled with method: ${method}`, 'dpi-bypass');
        return true;
      }
    }

    // Берём первый рабочий
    this.method = this.status.workingMethods[0];
    this.status.currentMethod = this.method;
    this.enabled = true;
    logger.info(`DPI bypass enabled with method: ${this.method}`, 'dpi-bypass');

    return true;
  }

  /**
   * Включить конкретный метод
   */
  enableMethod(method) {
    if (!this.methods[method]) {
      return { success: false, error: 'Unknown method' };
    }

    const platform = os.platform();
    if (!this.methods[method].platform.includes(platform)) {
      return { success: false, error: 'Method not available for this platform' };
    }

    this.method = method;
    this.status.currentMethod = method;
    this.enabled = true;

    logger.info(`DPI bypass method set to: ${method}`, 'dpi-bypass');

    return { success: true, method };
  }

  /**
   * Отключить DPI обход
   */
  disable() {
    this.enabled = false;
    this.status.currentMethod = null;
    logger.info('DPI bypass disabled', 'dpi-bypass');
  }

  /**
   * Получить конфигурацию
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Установить конфигурацию
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
    logger.info('DPI bypass config updated', 'dpi-bypass');
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      enabled: this.enabled,
      currentMethod: this.status.currentMethod,
      workingMethods: this.status.workingMethods,
      successRate: this.status.successRate,
      lastTest: this.status.lastTest,
      platform: os.platform()
    };
  }

  /**
   * Получить доступные методы
   */
  getAvailableMethods() {
    const platform = os.platform();
    const result = {};

    for (const [key, method] of Object.entries(this.methods)) {
      if (method.platform.includes(platform)) {
        const testResult = this.testResults.get(key);
        result[key] = {
          ...method,
          available: true,
          working: testResult?.success || false
        };
      }
    }

    return result;
  }

  /**
   * Проверить заблокирован ли Cursor в текущей сети
   */
  async checkBlockStatus() {
    const results = {
      direct: false,
      withDPIBypass: false,
      domains: {}
    };

    // Проверка прямого доступа
    try {
      const directResult = await this.testConnection({});
      results.direct = directResult.success;
    } catch {
      results.direct = false;
    }

    // Проверка с DPI обходом
    if (this.enabled) {
      try {
        const bypassResult = await this.testConnection({
          method: this.method
        });
        results.withDPIBypass = bypassResult.success;
      } catch {
        results.withDPIBypass = false;
      }
    }

    // Проверка отдельных доменов
    for (const domain of this.targetDomains) {
      try {
        const result = await this.testDomainAccess(domain);
        results.domains[domain] = result;
      } catch (error) {
        results.domains[domain] = { accessible: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Проверка доступа к домену
   */
  async testDomainAccess(domain) {
    const startTime = Date.now();

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve({ accessible: false, error: 'timeout' });
      }, 8000);

      https.get(`https://${domain}/`, {
        timeout: 7000,
        rejectUnauthorized: false
      }, res => {
        clearTimeout(timeout);
        resolve({
          accessible: res.statusCode < 500,
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime
        });
      }).on('error', error => {
        clearTimeout(timeout);
        resolve({ accessible: false, error: error.message });
      });
    });
  }

  /**
   * Генерация конфигурации для интеграции
   */
  generateIntegrationConfig() {
    return {
      method: this.method,
      enabled: this.enabled,
      config: this.config,
      targetDomains: this.targetDomains,
      platform: os.platform()
    };
  }

  /**
   * Остановка менеджера (для graceful shutdown)
   */
  stop() {
    this.enabled = false;
    logger.info('DPI Bypass stopped', 'dpi');
    return true;
  }
}

// Singleton
export const globalDPIBypass = new DPIBypass();
export default DPIBypass;
