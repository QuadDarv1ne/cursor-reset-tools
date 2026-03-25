/**
 * System Proxy Manager - Настройка системного прокси
 * Поддержка Windows, macOS, Linux
 */

import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execPromise = promisify(exec);

/**
 * Менеджер системного прокси
 */
class SystemProxyManager {
  constructor() {
    this.platform = os.platform();
    this.originalSettings = null;
    this.proxySettings = null;
  }

  /**
   * Настройка системного прокси
   * @param {Object} config - Конфигурация прокси
   * @returns {Promise<Object>}
   */
  async configureProxy(config) {
    const { host, port, protocol = 'http', auth } = config;

    logger.info(`Configuring system proxy: ${host}:${port} (${protocol})`, 'system-proxy');

    try {
      // Сохранение оригинальных настроек
      await this.saveOriginalSettings();

      if (this.platform === 'win32') {
        return await this._configureWindows(host, port, protocol, auth);
      } else if (this.platform === 'darwin') {
        return await this._configureMacOS(host, port, protocol, auth);
      }
      return await this._configureLinux(host, port, protocol, auth);

    } catch (error) {
      logger.error(`System proxy config failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Сохранение оригинальных настроек
   * @private
   */
  async saveOriginalSettings() {
    try {
      if (this.platform === 'win32') {
        this.originalSettings = await this._getWindowsProxySettings();
      } else if (this.platform === 'darwin') {
        this.originalSettings = await this._getMacOSProxySettings();
      } else {
        this.originalSettings = await this._getLinuxProxySettings();
      }

      logger.info('Original proxy settings saved', 'system-proxy');
    } catch (error) {
      logger.warn(`Failed to save original settings: ${error.message}`, 'system-proxy');
    }
  }

  /**
   * Настройка прокси на Windows
   * @private
   */
  async _configureWindows(host, port, protocol, auth) {
    try {
      // Включение прокси через реестр
      const proxyAddress = auth
        ? `${auth.username}:${auth.password}@${host}:${port}`
        : `${host}:${port}`;

      // Установка прокси сервера
      await execPromise(
        `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${proxyAddress}" /f`,
        { shell: 'cmd.exe' }
      );

      // Включение прокси
      await execPromise(
        `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`,
        { shell: 'cmd.exe' }
      );

      // Настройка обхода прокси для локальных адресов
      await execPromise(
        `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "<local>" /f`,
        { shell: 'cmd.exe' }
      );

      // Применение настроек (перезапуск WinINET)
      await this._refreshWindowsInternetSettings();

      this.proxySettings = { host, port, protocol, auth };

      logger.info(`Windows proxy configured: ${host}:${port}`, 'system-proxy');

      return {
        success: true,
        host,
        port,
        message: 'Прокси настроен. Может потребоваться перезапуск приложений.'
      };
    } catch (error) {
      logger.error(`Windows proxy config failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Настройка прокси на macOS
   * @private
   */
  async _configureMacOS(host, port, protocol, auth) {
    try {
      // Получение списка сетевых сервисов
      const { stdout } = await execPromise('networksetup -listallnetworkservices');
      const services = stdout.split('\n').slice(1).filter(s => s.trim() && s !== '*');

      const results = [];

      for (const service of services) {
        try {
          // Настройка HTTP прокси
          if (protocol === 'http' || protocol === 'https') {
            await execPromise(`networksetup -setwebproxy "${service}" ${host} ${port}`);
            await execPromise(`networksetup -setsecurewebproxy "${service}" ${host} ${port}`);

            if (auth) {
              await execPromise(`networksetup -setwebproxyauthentication "${service}" "${auth.username}" "${auth.password}"`);
              await execPromise(`networksetup -setsecurewebproxyauthentication "${service}" "${auth.username}" "${auth.password}"`);
            }
          }

          // Настройка SOCKS прокси
          if (protocol === 'socks5' || protocol === 'socks4') {
            await execPromise(`networksetup -setsocksfirewallproxy "${service}" ${host} ${port}`);

            if (auth) {
              await execPromise(`networksetup -setsocksfirewallproxyauthentication "${service}" "${auth.username}" "${auth.password}"`);
            }
          }

          results.push({ service, success: true });
        } catch (e) {
          results.push({ service, success: false, error: e.message });
        }
      }

      this.proxySettings = { host, port, protocol, auth };

      logger.info(`macOS proxy configured: ${host}:${port}`, 'system-proxy');

      return {
        success: true,
        host,
        port,
        services: results,
        message: 'Прокси настроен для всех сетевых сервисов'
      };
    } catch (error) {
      logger.error(`macOS proxy config failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Настройка прокси на Linux
   * @private
   */
  async _configureLinux(host, port, protocol, auth) {
    try {
      const fs = await import('fs-extra');

      // Настройка переменных окружения
      const proxyUrl = auth
        ? `${protocol}://${auth.username}:${auth.password}@${host}:${port}`
        : `${protocol}://${host}:${port}`;

      // ~/.bashrc
      const bashrc = path.join(os.homedir(), '.bashrc');
      let bashrcContent = await fs.readFile(bashrc, 'utf8').catch(() => '');

      // Удаление старых настроек прокси
      bashrcContent = bashrcContent
        .split('\n')
        .filter(line => !line.includes('http_proxy') && !line.includes('https_proxy') && !line.includes('all_proxy'))
        .join('\n');

      // Добавление новых настроек
      bashrcContent += `\n# Proxy settings (cursor-reset-tools)\n`;
      bashrcContent += `export http_proxy="${proxyUrl}"\n`;
      bashrcContent += `export https_proxy="${proxyUrl}"\n`;
      bashrcContent += `export all_proxy="${proxyUrl}"\n`;
      bashrcContent += `export no_proxy="localhost,127.0.0.1,::1"\n`;

      await fs.writeFile(bashrc, bashrcContent);

      // ~/.profile (для GNOME/KDE)
      const profile = path.join(os.homedir(), '.profile');
      let profileContent = await fs.readFile(profile, 'utf8').catch(() => '');

      profileContent = profileContent
        .split('\n')
        .filter(line => !line.includes('http_proxy') && !line.includes('https_proxy'))
        .join('\n');

      profileContent += `\n# Proxy settings\n`;
      profileContent += `export http_proxy="${proxyUrl}"\n`;
      profileContent += `export https_proxy="${proxyUrl}"\n`;

      await fs.writeFile(profile, profileContent);

      // Системные настройки (если есть доступ)
      try {
        // /etc/environment
        const etcEnv = '/etc/environment';
        let etcContent = await fs.readFile(etcEnv, 'utf8').catch(() => '');

        etcContent = etcContent
          .split('\n')
          .filter(line => !line.includes('http_proxy') && !line.includes('https_proxy'))
          .join('\n');

        etcContent += `\nhttp_proxy="${proxyUrl}"\n`;
        etcContent += `https_proxy="${proxyUrl}"\n`;

        await fs.writeFile(etcEnv, etcContent);
      } catch (e) {
        logger.warn(`System-wide proxy config failed: ${e.message}`, 'system-proxy');
      }

      this.proxySettings = { host, port, protocol, auth };

      logger.info(`Linux proxy configured: ${host}:${port}`, 'system-proxy');

      return {
        success: true,
        host,
        port,
        message: 'Прокси настроен. Перезайдите в терминал для применения.'
      };
    } catch (error) {
      logger.error(`Linux proxy config failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение настроек прокси Windows
   * @private
   */
  async _getWindowsProxySettings() {
    try {
      const { stdout: proxyServer } = await execPromise(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
        { shell: 'cmd.exe' }
      );

      const { stdout: proxyEnable } = await execPromise(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
        { shell: 'cmd.exe' }
      );

      const proxyMatch = proxyServer.match(/REG_SZ\s+(.+)/);
      const enableMatch = proxyEnable.match(/REG_DWORD\s+0x(\d+)/);

      return {
        server: proxyMatch ? proxyMatch[1].trim() : null,
        enabled: enableMatch ? enableMatch[1] === '1' : false
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Получение настроек прокси macOS
   * @private
   */
  async _getMacOSProxySettings() {
    try {
      const { stdout } = await execPromise('networksetup -listallnetworkservices');
      const services = stdout.split('\n').slice(1).filter(s => s.trim() && s !== '*');

      const settings = {};

      for (const service of services) {
        try {
          const { stdout: webProxy } = await execPromise(`networksetup -getwebproxy "${service}"`);
          const { stdout: socksProxy } = await execPromise(`networksetup -getsocksfirewallproxy "${service}"`);

          settings[service] = {
            webProxy: webProxy.trim(),
            socksProxy: socksProxy.trim()
          };
        } catch (e) {
          settings[service] = { error: e.message };
        }
      }

      return settings;
    } catch (error) {
      return null;
    }
  }

  /**
   * Получение настроек прокси Linux
   * @private
   */
  async _getLinuxProxySettings() {
    try {
      const fs = await import('fs-extra');
      const bashrc = path.join(os.homedir(), '.bashrc');
      const content = await fs.readFile(bashrc, 'utf8');

      const httpProxy = content.match(/export http_proxy=["']?([^"'\n]+)["']?/);
      const httpsProxy = content.match(/export https_proxy=["']?([^"'\n]+)["']?/);

      return {
        httpProxy: httpProxy ? httpProxy[1] : null,
        httpsProxy: httpsProxy ? httpsProxy[1] : null
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Отключение системного прокси
   */
  async disableProxy() {
    logger.info('Disabling system proxy...', 'system-proxy');

    try {
      if (this.platform === 'win32') {
        return await this._disableWindowsProxy();
      } else if (this.platform === 'darwin') {
        return await this._disableMacOSProxy();
      }
      return await this._disableLinuxProxy();

    } catch (error) {
      logger.error(`Disable proxy failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение прокси на Windows
   * @private
   */
  async _disableWindowsProxy() {
    try {
      await execPromise(
        `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`,
        { shell: 'cmd.exe' }
      );

      await this._refreshWindowsInternetSettings();

      this.proxySettings = null;

      logger.info('Windows proxy disabled', 'system-proxy');

      return { success: true, message: 'Прокси отключён' };
    } catch (error) {
      logger.error(`Disable Windows proxy failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение прокси на macOS
   * @private
   */
  async _disableMacOSProxy() {
    try {
      const { stdout } = await execPromise('networksetup -listallnetworkservices');
      const services = stdout.split('\n').slice(1).filter(s => s.trim() && s !== '*');

      for (const service of services) {
        try {
          await execPromise(`networksetup -setwebproxystate "${service}" off`);
          await execPromise(`networksetup -setsecurewebproxystate "${service}" off`);
          await execPromise(`networksetup -setsocksfirewallproxystate "${service}" off`);
        } catch (e) {
          // Игнорировать
        }
      }

      this.proxySettings = null;

      logger.info('macOS proxy disabled', 'system-proxy');

      return { success: true, message: 'Прокси отключён' };
    } catch (error) {
      logger.error(`Disable macOS proxy failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение прокси на Linux
   * @private
   */
  async _disableLinuxProxy() {
    try {
      const fs = await import('fs-extra');
      const path = await import('path');

      const bashrc = path.join(os.homedir(), '.bashrc');
      let bashrcContent = await fs.readFile(bashrc, 'utf8');

      bashrcContent = bashrcContent
        .split('\n')
        .filter(line => !line.includes('http_proxy') && !line.includes('https_proxy') && !line.includes('all_proxy'))
        .join('\n');

      await fs.writeFile(bashrc, bashrcContent);

      this.proxySettings = null;

      logger.info('Linux proxy disabled', 'system-proxy');

      return { success: true, message: 'Прокси отключён. Перезайдите в терминал.' };
    } catch (error) {
      logger.error(`Disable Linux proxy failed: ${error.message}`, 'system-proxy');
      return { success: false, error: error.message };
    }
  }

  /**
   * Обновление настроек интернета Windows
   * @private
   */
  async _refreshWindowsInternetSettings() {
    try {
      // Уведомление об изменении настроек
      await execPromise(
        'RUNDLL32.EXE wininet.dll,SetProxySettingsChanged',
        { shell: 'cmd.exe' }
      );

      // Перезапуск проводника для применения
      await execPromise(
        'taskkill /F /IM explorer.exe && start explorer.exe',
        { shell: 'cmd.exe', timeout: 5000 }
      );
    } catch (error) {
      logger.debug(`Refresh settings failed: ${error.message}`, 'system-proxy');
    }
  }

  /**
   * Получение текущего статуса прокси
   */
  async getProxyStatus() {
    try {
      if (this.platform === 'win32') {
        return await this._getWindowsProxySettings();
      } else if (this.platform === 'darwin') {
        return await this._getMacOSProxySettings();
      }
      return await this._getLinuxProxySettings();

    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Получение текущей конфигурации
   */
  getConfig() {
    return {
      platform: this.platform,
      hasOriginalSettings: !!this.originalSettings,
      proxySettings: this.proxySettings
    };
  }

  /**
   * Восстановление оригинальных настроек
   */
  async restoreOriginalSettings() {
    if (!this.originalSettings) {
      logger.warn('No original settings to restore', 'system-proxy');
      return false;
    }

    logger.info('Restoring original proxy settings...', 'system-proxy');

    try {
      if (this.platform === 'win32') {
        return await this._restoreWindowsSettings();
      } else if (this.platform === 'darwin') {
        return await this._restoreMacOSSettings();
      }
      return await this._restoreLinuxSettings();

    } catch (error) {
      logger.error(`Restore settings failed: ${error.message}`, 'system-proxy');
      return false;
    }
  }

  /**
   * Восстановление настроек Windows
   * @private
   */
  async _restoreWindowsSettings() {
    try {
      if (this.originalSettings.server) {
        await execPromise(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${this.originalSettings.server}" /f`,
          { shell: 'cmd.exe' }
        );
      }

      await execPromise(
        `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d ${this.originalSettings.enabled ? 1 : 0} /f`,
        { shell: 'cmd.exe' }
      );

      await this._refreshWindowsInternetSettings();

      this.originalSettings = null;
      this.proxySettings = null;

      logger.info('Windows proxy settings restored', 'system-proxy');
      return true;
    } catch (error) {
      logger.error(`Restore Windows settings failed: ${error.message}`, 'system-proxy');
      return false;
    }
  }

  /**
   * Восстановление настроек macOS
   * @private
   */
  async _restoreMacOSSettings() {
    // macOS требует сложных настроек, просто отключаем прокси
    return this._disableMacOSProxy();
  }

  /**
   * Восстановление настроек Linux
   * @private
   */
  async _restoreLinuxSettings() {
    // Linux - восстанавливаем из оригинальных настроек
    if (this.originalSettings?.httpProxy || this.originalSettings?.httpsProxy) {
      const fs = await import('fs-extra');
      const path = await import('path');

      const bashrc = path.join(os.homedir(), '.bashrc');
      let bashrcContent = await fs.readFile(bashrc, 'utf8');

      bashrcContent = bashrcContent
        .split('\n')
        .filter(line => !line.includes('http_proxy') && !line.includes('https_proxy') && !line.includes('all_proxy'))
        .join('\n');

      if (this.originalSettings.httpProxy) {
        bashrcContent += `\nexport http_proxy="${this.originalSettings.httpProxy}"\n`;
      }
      if (this.originalSettings.httpsProxy) {
        bashrcContent += `\nexport https_proxy="${this.originalSettings.httpsProxy}"\n`;
      }

      await fs.writeFile(bashrc, bashrcContent);
    }

    this.originalSettings = null;
    this.proxySettings = null;

    logger.info('Linux proxy settings restored', 'system-proxy');
    return true;
  }
}

// Глобальный экземпляр
export const globalSystemProxyManager = new SystemProxyManager();
export default SystemProxyManager;
