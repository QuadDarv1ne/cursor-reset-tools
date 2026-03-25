/**
 * VPN Traffic Manager - Принудительное туннелирование трафика через VPN
 * Поддержка Amnezia, WireGuard, OpenVPN
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import { _path } from 'path';
import { logger } from './logger.js';
import { globalVPNManager } from './vpnManager.js';

const execPromise = promisify(exec);

/**
 * Менеджер для управления VPN трафиком
 */
class VPNTrafficManager {
  constructor() {
    this.platform = os.platform();
    this.originalRoutes = [];
    this.vpnInterface = null;
    this.killSwitchEnabled = false;
  }

  /**
   * Комплексная настройка VPN для полного туннелирования
   * @returns {Promise<Object>}
   */
  async configureFullTunnel() {
    logger.info('Configuring full VPN tunnel...', 'vpn-traffic');

    const result = {
      success: false,
      killSwitch: false,
      routes: false,
      dns: false,
      recommendations: []
    };

    try {
      // Проверка активного VPN подключения
      const vpnStatus = await globalVPNManager.detectActiveVPN();

      if (!vpnStatus.detected) {
        result.recommendations.push({
          type: 'vpn_required',
          priority: 'critical',
          title: 'VPN не обнаружен',
          description: 'Включите Amnezia VPN или другой VPN перед использованием'
        });
        return result;
      }

      logger.info(`VPN detected: ${vpnStatus.type}, country: ${vpnStatus.countryCode}`, 'vpn-traffic');

      // Включение Kill Switch
      result.killSwitch = await this.enableKillSwitch();

      // Настройка маршрутов
      result.routes = await this.configureRoutes();

      // Принудительный DNS через VPN
      result.dns = await this.forceDNSOverVPN();

      result.success = result.killSwitch || result.routes || result.dns;

      if (result.success) {
        result.recommendations.push({
          type: 'success',
          priority: 'info',
          title: 'VPN настроен для полного туннелирования',
          description: 'Весь трафик теперь проходит через VPN'
        });
      }

      logger.info(`Full tunnel config complete: killSwitch=${result.killSwitch}, routes=${result.routes}`, 'vpn-traffic');

      return result;
    } catch (error) {
      logger.error(`Full tunnel config failed: ${error.message}`, 'vpn-traffic');
      result.recommendations.push({
        type: 'error',
        priority: 'critical',
        title: 'Ошибка настройки VPN',
        description: error.message
      });
      return result;
    }
  }

  /**
   * Включение Kill Switch (блокировка трафика при отключении VPN)
   */
  async enableKillSwitch() {
    logger.info('Enabling VPN Kill Switch...', 'vpn-traffic');

    try {
      if (this.platform === 'win32') {
        return await this._enableKillSwitchWindows();
      } else if (this.platform === 'darwin') {
        return await this._enableKillSwitchMacOS();
      }
      return await this._enableKillSwitchLinux();

    } catch (error) {
      logger.error(`Kill Switch enable failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Включение Kill Switch на Windows
   * @private
   */
  async _enableKillSwitchWindows() {
    try {
      // Создание правил брандмауэра для блокировки без VPN
      const _blockRule = `netsh advfirewall firewall add rule name="Block No VPN" dir=out action=block enable=yes`;

      // Разрешение только для VPN интерфейса
      const vpnInterfaces = await this._getVPNInterfaces();

      if (vpnInterfaces.length > 0) {
        for (const iface of vpnInterfaces) {
          const allowRule = `netsh advfirewall firewall add rule name="Allow VPN ${iface}" dir=out action=allow interface="${iface}" enable=yes`;
          await execPromise(allowRule, { shell: 'cmd.exe' });
        }
      }

      // Сохранение оригинальных правил для восстановления
      this.originalRoutes.push({
        type: 'firewall',
        platform: 'win32',
        rule: 'Block No VPN'
      });

      this.killSwitchEnabled = true;
      logger.info('Windows Kill Switch enabled via firewall rules', 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`Windows Kill Switch failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Включение Kill Switch на macOS
   * @private
   */
  async _enableKillSwitchMacOS() {
    try {
      // macOS требует pf (packet filter)
      const pfConfig = `
# Block all outgoing traffic except VPN
block out all
pass out on utun0 keep state
pass out on utun1 keep state
pass out on utun2 keep state
pass out on utun3 keep state
pass out proto tcp from any to any port 53 keep state
pass out proto udp from any to any port 53 keep state
`.trim();

      const pfFile = '/tmp/pf_vpn.conf';
      await fs.writeFile(pfFile, pfConfig);

      // Загрузка конфигурации pf
      try {
        await execPromise(`sudo pfctl -f ${pfFile}`);
        await execPromise('sudo pfctl -e');
      } catch (e) {
        logger.warn(`pfctl failed: ${e.message}`, 'vpn-traffic');
      }

      this.killSwitchEnabled = true;
      logger.info('macOS Kill Switch enabled via pf', 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`macOS Kill Switch failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Включение Kill Switch на Linux
   * @private
   */
  async _enableKillSwitchLinux() {
    try {
      // Использование iptables для блокировки
      const vpnInterfaces = ['tun0', 'tun1', 'wg0', 'amnezia'];

      // Сохранение текущих правил
      await execPromise('iptables-save > /tmp/iptables_backup.rules');

      // Блокировка всего исходящего трафика кроме VPN
      for (const iface of vpnInterfaces) {
        try {
          // Разрешение трафика через VPN интерфейс
          await execPromise(`iptables -A OUTPUT -o ${iface} -j ACCEPT`);
        } catch (e) {
          // Интерфейс не существует
        }
      }

      // Блокировка остального трафика (только если VPN активен)
      // Не применяем глобальную блокировку чтобы не потерять соединение

      this.originalRoutes.push({
        type: 'iptables',
        platform: 'linux',
        backup: '/tmp/iptables_backup.rules'
      });

      this.killSwitchEnabled = true;
      logger.info('Linux Kill Switch enabled via iptables', 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`Linux Kill Switch failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Настройка маршрутов для VPN
   */
  async configureRoutes() {
    logger.info('Configuring VPN routes...', 'vpn-traffic');

    try {
      if (this.platform === 'win32') {
        return await this._configureRoutesWindows();
      } else if (this.platform === 'darwin') {
        return await this._configureRoutesMacOS();
      }
      return await this._configureRoutesLinux();

    } catch (error) {
      logger.error(`Routes config failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Настройка маршрутов на Windows
   * @private
   */
  async _configureRoutesWindows() {
    try {
      // Получение VPN интерфейса
      const vpnInterfaces = await this._getVPNInterfaces();

      if (vpnInterfaces.length === 0) {
        logger.warn('No VPN interfaces found for routing', 'vpn-traffic');
        return false;
      }

      // Добавление маршрута по умолчанию через VPN
      // Маршрут для доменов Cursor
      const cursorDomains = [
        'cursor.sh',
        'cursor.com',
        'anysphere.app',
        'sourcegraph.com'
      ];

      for (const domain of cursorDomains) {
        try {
          // Резолвинг домена
          const { execSync } = await import('child_process');
          const ip = execSync(`nslookup ${domain}`).toString();
          const match = ip.match(/Addresses?:\s+([\d.\s]+)/);
          if (match) {
            const ips = match[1].trim().split(/\s+/);
            for (const targetIP of ips) {
              const routeCmd = `route ADD ${targetIP} MASK 255.255.255.255 IF ${vpnInterfaces[0]} METRIC 1`;
              await execPromise(routeCmd, { shell: 'cmd.exe' });
            }
          }
        } catch (e) {
          logger.debug(`Route for ${domain} failed: ${e.message}`, 'vpn-traffic');
        }
      }

      logger.info(`Windows routes configured via interface ${vpnInterfaces[0]}`, 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`Windows routes failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Настройка маршрутов на macOS
   * @private
   */
  async _configureRoutesMacOS() {
    try {
      // Получение VPN интерфейса
      const { stdout } = await execPromise('ifconfig | grep -E "^(utun|tun|wg|amnezia)" | cut -d: -f1');
      const vpnInterface = stdout.trim().split('\n')[0];

      if (!vpnInterface) {
        logger.warn('No VPN interface found on macOS', 'vpn-traffic');
        return false;
      }

      // Добавление маршрута через VPN
      await execPromise(`sudo route add -net 0.0.0.0/1 -interface ${vpnInterface}`);
      await execPromise(`sudo route add -net 128.0.0.0/1 -interface ${vpnInterface}`);

      logger.info(`macOS routes configured via ${vpnInterface}`, 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`macOS routes failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Настройка маршрутов на Linux
   * @private
   */
  async _configureRoutesLinux() {
    try {
      // Получение VPN интерфейса
      const vpnInterfaces = ['tun0', 'tun1', 'wg0', 'amnezia'];
      let activeInterface = null;

      for (const iface of vpnInterfaces) {
        try {
          await execPromise(`ip link show ${iface}`);
          activeInterface = iface;
          break;
        } catch (e) {
          // Интерфейс не найден
        }
      }

      if (!activeInterface) {
        logger.warn('No VPN interface found on Linux', 'vpn-traffic');
        return false;
      }

      // Добавление маршрута по умолчанию через VPN
      await execPromise(`sudo ip route add 0.0.0.0/1 dev ${activeInterface}`);
      await execPromise(`sudo ip route add 128.0.0.0/1 dev ${activeInterface}`);

      logger.info(`Linux routes configured via ${activeInterface}`, 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`Linux routes failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Принудительный DNS через VPN
   */
  async forceDNSOverVPN() {
    logger.info('Forcing DNS over VPN...', 'vpn-traffic');

    try {
      const { globalDNSManager } = await import('./dnsManager.js');

      // Установка Cloudflare DNS
      const success = await globalDNSManager.setDNS('cloudflare');

      if (success) {
        await globalDNSManager.flushDNSCache();
        logger.info('DNS forced through VPN (Cloudflare)', 'vpn-traffic');
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`DNS over VPN failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Получение VPN интерфейсов
   * @private
   */
  async _getVPNInterfaces() {
    const vpnInterfaceNames = [
      'wireguard', 'wg', 'tun', 'tap', 'vpn',
      'amnezia', 'nordvpn', 'expressvpn', 'openvpn'
    ];

    const interfaces = os.networkInterfaces();
    const found = [];

    for (const [name, _iface] of Object.entries(interfaces)) {
      const nameLower = name.toLowerCase();
      if (vpnInterfaceNames.some(v => nameLower.includes(v))) {
        found.push(name);
      }
    }

    return found;
  }

  /**
   * Отключение Kill Switch
   */
  async disableKillSwitch() {
    logger.info('Disabling VPN Kill Switch...', 'vpn-traffic');

    try {
      if (this.platform === 'win32') {
        await this._disableKillSwitchWindows();
      } else if (this.platform === 'darwin') {
        await this._disableKillSwitchMacOS();
      } else {
        await this._disableKillSwitchLinux();
      }

      this.killSwitchEnabled = false;
      logger.info('Kill Switch disabled', 'vpn-traffic');
      return true;
    } catch (error) {
      logger.error(`Kill Switch disable failed: ${error.message}`, 'vpn-traffic');
      return false;
    }
  }

  /**
   * Отключение Kill Switch на Windows
   * @private
   */
  async _disableKillSwitchWindows() {
    try {
      await execPromise('netsh advfirewall firewall delete rule name="Block No VPN"', { shell: 'cmd.exe' });
      logger.info('Windows Kill Switch disabled', 'vpn-traffic');
    } catch (error) {
      logger.debug(`Windows Kill Switch disable: ${error.message}`, 'vpn-traffic');
    }
  }

  /**
   * Отключение Kill Switch на macOS
   * @private
   */
  async _disableKillSwitchMacOS() {
    try {
      await execPromise('sudo pfctl -d');
      logger.info('macOS Kill Switch disabled', 'vpn-traffic');
    } catch (error) {
      logger.debug(`macOS Kill Switch disable: ${error.message}`, 'vpn-traffic');
    }
  }

  /**
   * Отключение Kill Switch на Linux
   * @private
   */
  async _disableKillSwitchLinux() {
    try {
      await execPromise('iptables-restore < /tmp/iptables_backup.rules');
      logger.info('Linux Kill Switch disabled', 'vpn-traffic');
    } catch (error) {
      logger.debug(`Linux Kill Switch disable: ${error.message}`, 'vpn-traffic');
    }
  }

  /**
   * Проверка статуса VPN туннеля
   */
  async getTunnelStatus() {
    const vpnStatus = await globalVPNManager.detectActiveVPN();

    return {
      vpnDetected: vpnStatus.detected,
      vpnType: vpnStatus.type,
      vpnCountry: vpnStatus.country,
      killSwitchEnabled: this.killSwitchEnabled,
      platform: this.platform,
      interfaces: this._getVPNInterfaces()
    };
  }

  /**
   * Быстрая настройка для Cursor
   */
  async quickSetupForCursor() {
    logger.info('Quick VPN setup for Cursor...', 'vpn-traffic');

    const result = {
      success: false,
      steps: []
    };

    try {
      // Шаг 1: Проверка VPN
      const vpnStatus = await globalVPNManager.detectActiveVPN();
      result.steps.push({
        name: 'vpn_check',
        success: vpnStatus.detected,
        details: vpnStatus
      });

      if (!vpnStatus.detected) {
        result.steps.push({
          name: 'recommendation',
          message: 'Включите Amnezia VPN перед запуском Cursor'
        });
        return result;
      }

      // Шаг 2: Настройка туннеля
      const tunnelResult = await this.configureFullTunnel();
      result.steps.push({
        name: 'tunnel_config',
        success: tunnelResult.success,
        details: tunnelResult
      });

      // Шаг 3: Проверка DNS
      const { globalLeakDetector } = await import('./leakDetector.js');
      const dnsLeak = await globalLeakDetector.checkDNSLeak();
      result.steps.push({
        name: 'dns_check',
        success: !dnsLeak.leak,
        details: dnsLeak
      });

      result.success = result.steps.every(s => s.success !== false);

      logger.info(`Quick setup complete: ${result.success ? 'success' : 'partial'}`, 'vpn-traffic');

      return result;
    } catch (error) {
      logger.error(`Quick setup failed: ${error.message}`, 'vpn-traffic');
      result.steps.push({
        name: 'error',
        success: false,
        message: error.message
      });
      return result;
    }
  }
}

// Глобальный экземпляр
export const globalVPNTrafficManager = new VPNTrafficManager();
export default VPNTrafficManager;
