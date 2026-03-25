/**
 * VPN Leak Fix - Комплексное исправление утечек при VPN
 * DNS, WebRTC, IPv6 утечки и системные настройки
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';
import { globalDNSManager } from './dnsManager.js';
// import { globalDoHManager } from './dohManager.js'; // Зарезервировано для будущего использования

const execPromise = promisify(exec);

/**
 * Класс для исправления VPN утечек
 */
class VPNLeakFix {
  constructor() {
    this.platform = os.platform();
    this.originalSettings = {};
    this.fixHistory = [];
  }

  /**
   * Комплексное исправление всех утечек
   * @returns {Promise<Object>}
   */
  async fixAll() {
    logger.info('Starting comprehensive leak fix...', 'vpn-leak-fix');

    const results = {
      dns: null,
      webrtc: null,
      ipv6: null,
      systemProxy: null,
      recommendations: []
    };

    // Сохранение текущих настроек
    await this.saveCurrentSettings();

    // Исправление DNS утечки
    results.dns = await this.fixDNSLeak();

    // Исправление WebRTC утечки
    results.webrtc = await this.fixWebRTCLEak();

    // Исправление IPv6 утечки
    results.ipv6 = await this.fixIPv6Leak();

    // Настройка системного прокси
    results.systemProxy = await this.configureSystemProxy();

    // Генерация рекомендаций
    results.recommendations = this.generateRecommendations(results);

    this.fixHistory.push({
      timestamp: Date.now(),
      results
    });

    logger.info(`Leak fix complete: DNS=${results.dns?.fixed}, WebRTC=${results.webrtc?.fixed}, IPv6=${results.ipv6?.fixed}`, 'vpn-leak-fix');

    return results;
  }

  /**
   * Сохранение текущих настроек
   */
  async saveCurrentSettings() {
    try {
      const currentDNS = await globalDNSManager.getCurrentDNS();
      this.originalSettings.dns = currentDNS;

      // Сохранение IPv6 статуса
      const interfaces = os.networkInterfaces();
      this.originalSettings.ipv6 = { interfaces: JSON.parse(JSON.stringify(interfaces)) };

      logger.info('Current settings saved', 'vpn-leak-fix');
    } catch (error) {
      logger.error(`Failed to save settings: ${error.message}`, 'vpn-leak-fix');
    }
  }

  /**
   * Исправление DNS утечки
   * Устанавливает публичные DNS и включает DoH
   */
  async fixDNSLeak() {
    logger.info('Fixing DNS leak...', 'vpn-leak-fix');

    try {
      // Установка Cloudflare DNS
      const dnsSuccess = await globalDNSManager.setDNS('cloudflare');

      // Включение DoH
      const { globalDoHManager } = await import('./dohManager.js');
      globalDoHManager.setProvider('cloudflare');

      // Очистка DNS кэша
      await globalDNSManager.flushDNSCache();

      const result = {
        fixed: dnsSuccess,
        dns: '1.1.1.1',
        dohEnabled: true,
        provider: 'Cloudflare'
      };

      logger.info(`DNS leak fix: ${dnsSuccess ? 'success' : 'failed'}`, 'vpn-leak-fix');

      return result;
    } catch (error) {
      logger.error(`DNS leak fix failed: ${error.message}`, 'vpn-leak-fix');
      return {
        fixed: false,
        error: error.message
      };
    }
  }

  /**
   * Исправление WebRTC утечки
   * Создаёт инструкцию и файл конфигурации для браузера
   */
  async fixWebRTCLEak() {
    logger.info('Fixing WebRTC leak...', 'vpn-leak-fix');

    try {
      const configDir = path.join(process.cwd(), 'data', 'browser-config');
      await fs.ensureDir(configDir);

      // Firefox конфигурация
      const firefoxConfig = {
        'media.peerconnection.enabled': false,
        'media.peerconnection.ice.default_address_only': true,
        'media.peerconnection.ice.no_host': true
      };

      // Chrome политики
      const chromePolicies = {
        'WebRTCIPHandlingPolicy': 'disable_non_proxied_udp'
      };

      // Сохранение конфигураций
      await fs.writeJson(
        path.join(configDir, 'firefox-webrtc-fix.json'),
        firefoxConfig,
        { spaces: 2 }
      );

      await fs.writeJson(
        path.join(configDir, 'chrome-webrtc-policies.json'),
        chromePolicies,
        { spaces: 2 }
      );

      // Создание инструкции
      const instructions = await this._createWebRTCInstructions(configDir);

      const result = {
        fixed: true,
        configPath: configDir,
        firefoxConfig: path.join(configDir, 'firefox-webrtc-fix.json'),
        chromeConfig: path.join(configDir, 'chrome-webrtc-policies.json'),
        instructions
      };

      logger.info(`WebRTC leak fix: config created at ${configDir}`, 'vpn-leak-fix');

      return result;
    } catch (error) {
      logger.error(`WebRTC leak fix failed: ${error.message}`, 'vpn-leak-fix');
      return {
        fixed: false,
        error: error.message
      };
    }
  }

  /**
   * Создание инструкции по отключению WebRTC
   * @private
   */
  async _createWebRTCInstructions(configDir) {
    const instructions = {
      firefox: {
        title: 'Отключение WebRTC в Firefox',
        steps: [
          'Откройте Firefox и введите в адресной строке: about:config',
          'Нажмите "Принять риск и продолжить"',
          'Найдите настройку: media.peerconnection.enabled',
          'Дважды кликните чтобы установить значение: false',
          'Найдите настройку: media.peerconnection.ice.default_address_only',
          'Установите значение: true',
          'Перезапустите браузер'
        ],
        configFile: path.join(configDir, 'firefox-webrtc-fix.json'),
        autoFix: 'Используйте файл конфигурации выше для автоматической настройки'
      },
      chrome: {
        title: 'Отключение WebRTC в Chrome',
        steps: [
          'Закройте Chrome полностью',
          'Создайте файл политик:',
          '  Windows: C:\\Program Files\\Google\\Chrome\\Policies\\Recommended\\webrtc.json',
          '  macOS: /Library/Google/Chrome/Policies/Recommended/webrtc.json',
          '  Linux: /etc/opt/chrome/policies/Recommended/webrtc.json',
          'Скопируйте содержимое из файла конфигурации',
          'Запустите Chrome'
        ],
        configFile: path.join(configDir, 'chrome-webrtc-policies.json'),
        extensions: [
          'WebRTC Leak Prevent (Chrome Web Store)',
          'WebRTC Control (Chrome Web Store)'
        ]
      },
      edge: {
        title: 'Отключение WebRTC в Edge',
        steps: [
          'Откройте Edge и перейдите в: edge://flags',
          'Найдите: WebRTC',
          'Установите: Disabled',
          'Перезапустите браузер'
        ]
      },
      opera: {
        title: 'Отключение WebRTC в Opera',
        steps: [
          'Настройки → Дополнительно → Безопасность',
          'Отключите: "Разрешить обнаружение локальных устройств"',
          'Или установите расширение: WebRTC Leak Prevent'
        ]
      }
    };

    await fs.writeFile(
      path.join(configDir, 'WEBRTC_INSTRUCTIONS_RU.md'),
      this._formatInstructionsMarkdown(instructions),
      'utf8'
    );

    return instructions;
  }

  /**
   * Форматирование инструкции в Markdown
   * @private
   */
  _formatInstructionsMarkdown(instructions) {
    let md = '# Инструкция по отключению WebRTC\n\n';
    md += '> WebRTC может показывать ваш реальный IP адрес даже при включенном VPN\n\n';

    for (const config of Object.values(instructions)) {
      md += `## ${config.title}\n\n`;

      if (config.steps) {
        md += '### Шаги:\n\n';
        config.steps.forEach((step, i) => {
          md += `${i + 1}. ${step}\n`;
        });
        md += '\n';
      }

      if (config.extensions) {
        md += '### Рекомендуемые расширения:\n\n';
        config.extensions.forEach(ext => {
          md += `- ${ext}\n`;
        });
        md += '\n';
      }

      if (config.configFile) {
        md += `### Файл конфигурации: \`${config.configFile}\`\n\n`;
      }
    }

    return md;
  }

  /**
   * Исправление IPv6 утечки
   * Отключает IPv6 если VPN не поддерживает туннелирование
   */
  async fixIPv6Leak() {
    logger.info('Fixing IPv6 leak...', 'vpn-leak-fix');

    try {
      const interfaces = os.networkInterfaces();
      const ipv6Interfaces = [];

      // Поиск активных IPv6 интерфейсов
      for (const [name, iface] of Object.entries(interfaces)) {
        if (!iface) {continue;}

        for (const addr of iface) {
          if (addr.family === 'IPv6' && !addr.internal && !addr.address.startsWith('fe80::')) {
            ipv6Interfaces.push({ name, address: addr.address });
          }
        }
      }

      if (ipv6Interfaces.length === 0) {
        logger.info('No public IPv6 addresses found, no fix needed', 'vpn-leak-fix');
        return {
          fixed: true,
          skipped: true,
          reason: 'No public IPv6 addresses'
        };
      }

      // Отключение IPv6 на уровне ОС
      let disabled = false;

      if (this.platform === 'win32') {
        disabled = await this._disableIPv6Windows();
      } else if (this.platform === 'darwin') {
        disabled = await this._disableIPv6MacOS();
      } else {
        disabled = await this._disableIPv6Linux();
      }

      const result = {
        fixed: disabled,
        interfacesFound: ipv6Interfaces.length,
        disabled,
        recommendation: disabled
          ? 'IPv6 отключён для предотвращения утечек'
          : 'IPv6 не был отключён (возможно требуется ручной доступ)'
      };

      logger.info(`IPv6 leak fix: ${disabled ? 'success' : 'failed'}`, 'vpn-leak-fix');

      return result;
    } catch (error) {
      logger.error(`IPv6 leak fix failed: ${error.message}`, 'vpn-leak-fix');
      return {
        fixed: false,
        error: error.message
      };
    }
  }

  /**
   * Отключение IPv6 на Windows
   * @private
   */
  async _disableIPv6Windows() {
    try {
      // Получение всех сетевых интерфейсов
      const { stdout } = await execPromise('Get-NetAdapter -Physical | Select-Object Name', {
        shell: 'powershell.exe'
      });

      const lines = stdout.split('\n').filter(line => line.trim());
      const interfaceNames = lines.slice(1).map(line => line.trim()).filter(name => name);

      // Отключение IPv6 на каждом интерфейсе
      for (const name of interfaceNames) {
        try {
          await execPromise(
            `Disable-NetAdapterBinding -Name "${name}" -ComponentID ms_tcpip6`,
            { shell: 'powershell.exe' }
          );
          logger.debug(`IPv6 disabled on interface: ${name}`, 'vpn-leak-fix');
        } catch (e) {
          logger.debug(`Failed to disable IPv6 on ${name}: ${e.message}`, 'vpn-leak-fix');
        }
      }

      // Альтернативный метод через реестр
      await execPromise(
        'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters" /v DisabledComponents /t REG_DWORD /d 255 /f',
        { shell: 'cmd.exe' }
      );

      logger.info('IPv6 disabled via registry (requires reboot)', 'vpn-leak-fix');

      return true;
    } catch (error) {
      logger.error(`Windows IPv6 disable failed: ${error.message}`, 'vpn-leak-fix');
      return false;
    }
  }

  /**
   * Отключение IPv6 на macOS
   * @private
   */
  async _disableIPv6MacOS() {
    try {
      // Получение списка интерфейсов
      const { stdout } = await execPromise('networksetup -listallnetworkservices');
      const services = stdout.split('\n').slice(1).filter(s => s.trim());

      // Отключение IPv6 на каждом сервисе
      for (const service of services) {
        try {
          await execPromise(`networksetup -setv6off "${service}"`);
          logger.debug(`IPv6 disabled on service: ${service}`, 'vpn-leak-fix');
        } catch (e) {
          logger.debug(`Failed to disable IPv6 on ${service}: ${e.message}`, 'vpn-leak-fix');
        }
      }

      logger.info('IPv6 disabled on macOS', 'vpn-leak-fix');
      return true;
    } catch (error) {
      logger.error(`macOS IPv6 disable failed: ${error.message}`, 'vpn-leak-fix');
      return false;
    }
  }

  /**
   * Отключение IPv6 на Linux
   * @private
   */
  async _disableIPv6Linux() {
    try {
      const fs = await import('fs-extra');

      // Отключение через sysctl
      const sysctlConfig = [
        'net.ipv6.conf.all.disable_ipv6 = 1',
        'net.ipv6.conf.default.disable_ipv6 = 1',
        'net.ipv6.conf.lo.disable_ipv6 = 1'
      ].join('\n');

      const sysctlFile = '/etc/sysctl.d/99-disable-ipv6.conf';
      await fs.writeFile(sysctlFile, sysctlConfig);
      await fs.chmod(sysctlFile, 0o644);

      // Применение настроек
      try {
        await execPromise('sysctl -p /etc/sysctl.d/99-disable-ipv6.conf');
      } catch (e) {
        logger.debug('sysctl apply skipped', 'vpn-leak-fix');
      }

      logger.info('IPv6 disabled on Linux', 'vpn-leak-fix');
      return true;
    } catch (error) {
      logger.error(`Linux IPv6 disable failed: ${error.message}`, 'vpn-leak-fix');
      return false;
    }
  }

  /**
   * Настройка системного прокси для VPN
   */
  async configureSystemProxy() {
    logger.info('Configuring system proxy for VPN...', 'vpn-leak-fix');

    try {
      // Системный прокси не требуется если VPN работает корректно
      // Но можно настроить для дополнительных приложений

      const result = {
        configured: false,
        note: 'VPN должен автоматически перехватывать весь трафик',
        recommendations: [
          'Убедитесь что VPN подключен до запуска Cursor',
          'Проверьте что VPN использует режим "Kill Switch"',
          'Включите "Split Tunneling" если нужно исключить приложения'
        ]
      };

      return result;
    } catch (error) {
      logger.error(`System proxy config failed: ${error.message}`, 'vpn-leak-fix');
      return {
        configured: false,
        error: error.message
      };
    }
  }

  /**
   * Восстановление оригинальных настроек
   */
  async restoreSettings() {
    logger.info('Restoring original settings...', 'vpn-leak-fix');

    try {
      // Восстановление DNS
      if (this.originalSettings.dns) {
        await globalDNSManager.restoreDNS();
      }

      // Восстановление IPv6
      if (this.originalSettings.ipv6) {
        await this._restoreIPv6();
      }

      logger.info('Settings restored', 'vpn-leak-fix');
      return true;
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`, 'vpn-leak-fix');
      return false;
    }
  }

  /**
   * Восстановление IPv6
   * @private
   */
  async _restoreIPv6() {
    try {
      if (this.platform === 'win32') {
        await execPromise(
          'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters" /v DisabledComponents /t REG_DWORD /d 0 /f',
          { shell: 'cmd.exe' }
        );
        logger.info('IPv6 enabled in registry (reboot required)', 'vpn-leak-fix');
      } else if (this.platform === 'darwin') {
        const { stdout } = await execPromise('networksetup -listallnetworkservices');
        const services = stdout.split('\n').slice(1).filter(s => s.trim());
        for (const service of services) {
          try {
            await execPromise(`networksetup -setv6automatic "${service}"`);
          } catch (e) {
            // Игнорировать
          }
        }
      } else {
        const fs = await import('fs-extra');
        await fs.remove('/etc/sysctl.d/99-disable-ipv6.conf');
      }
    } catch (error) {
      logger.error(`IPv6 restore failed: ${error.message}`, 'vpn-leak-fix');
    }
  }

  /**
   * Генерация рекомендаций
   * @private
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (!results.dns?.fixed) {
      recommendations.push({
        type: 'dns',
        priority: 'high',
        title: 'DNS утечка не исправлена',
        description: 'Вручную установите DNS 1.1.1.1 в настройках сети'
      });
    }

    if (!results.webrtc?.fixed) {
      recommendations.push({
        type: 'webrtc',
        priority: 'high',
        title: 'WebRTC утечка возможна',
        description: 'Отключите WebRTC в настройках браузера',
        configPath: results.webrtc?.configPath
      });
    }

    if (!results.ipv6?.fixed && !results.ipv6?.skipped) {
      recommendations.push({
        type: 'ipv6',
        priority: 'medium',
        title: 'IPv6 утечка возможна',
        description: 'Отключите IPv6 в настройках сетевого адаптера'
      });
    }

    recommendations.push({
      type: 'vpn',
      priority: 'high',
      title: 'Проверка VPN',
      description: 'Убедитесь что VPN подключен и использует Kill Switch'
    });

    return recommendations;
  }

  /**
   * Получить историю исправлений
   */
  getHistory() {
    return this.fixHistory;
  }

  /**
   * Проверка статуса утечек
   */
  async getLeakStatus() {
    const { globalLeakDetector } = await import('./leakDetector.js');
    return globalLeakDetector.checkAll();
  }
}

// Глобальный экземпляр
export const globalVPNLeakFix = new VPNLeakFix();
export default VPNLeakFix;
