/**
 * CLI Manager - Headless режим для автоматизации
 */

import { globalProxyManager } from './proxyManager.js';
import { globalProxyDatabase } from './proxyDatabase.js';
import { globalDNSManager, DNS_SERVERS } from './dnsManager.js';
import { globalIPManager } from './ipManager.js';
import { globalFingerprintManager } from './fingerprintManager.js';
import { globalEmailManager } from './emailManager.js';
import { globalMonitorManager } from './monitorManager.js';
import { globalVPNManager } from './vpnManager.js';
import { globalCursorRegistrar } from './cursorRegistrar.js';
import { globalUpdater } from './updater.js';
import { globalBypassServer } from '../server/bypassServer.js';
import { globalConfigBackup } from './configBackup.js';
import { logger } from './logger.js';
import { validateUrl, validateProxyProtocol } from './validator.js';
import { EMAIL_CONSTANTS, CURSOR_CONSTANTS } from './constants.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Команды CLI
 */
export const CLI_COMMANDS = {
  // Proxy команды
  'proxy:add': {
    description: 'Добавить прокси',
    usage: 'proxy:add <host:port> [--protocol socks5|http] [--auth user:pass]',
    handler: handleProxyAdd
  },
  'proxy:list': {
    description: 'Список прокси',
    usage: 'proxy:list',
    handler: handleProxyList
  },
  'proxy:check': {
    description: 'Проверить прокси',
    usage: 'proxy:check',
    handler: handleProxyCheck
  },
  'proxy:rotate': {
    description: 'Сменить прокси',
    usage: 'proxy:rotate',
    handler: handleProxyRotate
  },
  'proxy:clear': {
    description: 'Очистить прокси',
    usage: 'proxy:clear',
    handler: handleProxyClear
  },

  // Proxy Database команды
  'proxy-db:init': {
    description: 'Инициализировать базу прокси',
    usage: 'proxy-db:init',
    handler: handleProxyDbInit
  },
  'proxy-db:list': {
    description: 'Список прокси в базе',
    usage: 'proxy-db:list [--country US] [--protocol socks5] [--working]',
    handler: handleProxyDbList
  },
  'proxy-db:stats': {
    description: 'Статистика базы прокси',
    usage: 'proxy-db:stats',
    handler: handleProxyDbStats
  },
  'proxy-db:refresh': {
    description: 'Обновить базу прокси',
    usage: 'proxy-db:refresh',
    handler: handleProxyDbRefresh
  },
  'proxy-db:check': {
    description: 'Проверить все прокси в базе',
    usage: 'proxy-db:check [--concurrency 5]',
    handler: handleProxyDbCheck
  },
  'proxy-db:random': {
    description: 'Случайный рабочий прокси',
    usage: 'proxy-db:random [--protocol socks5]',
    handler: handleProxyDbRandom
  },
  'proxy-db:countries': {
    description: 'Список стран',
    usage: 'proxy-db:countries',
    handler: handleProxyDbCountries
  },
  'proxy-db:auto': {
    description: 'Авто-обновление',
    usage: 'proxy-db:auto [--enable] [--disable] [--interval 300000]',
    handler: handleProxyDbAuto
  },

  // VPN команды
  'vpn:init': {
    description: 'Инициализировать VPN',
    usage: 'vpn:init',
    handler: handleVPNInit
  },
  'vpn:status': {
    description: 'Статус VPN',
    usage: 'vpn:status',
    handler: handleVPNStatus
  },
  'vpn:quick': {
    description: 'Быстрое подключение',
    usage: 'vpn:quick',
    handler: handleVPNQuick
  },
  'vpn:disconnect': {
    description: 'Отключить VPN',
    usage: 'vpn:disconnect',
    handler: handleVPNDisconnect
  },
  'vpn:configs': {
    description: 'Список конфигураций',
    usage: 'vpn:configs',
    handler: handleVPNConfigs
  },

  // Cursor Registrar команды
  'cursor:register': {
    description: 'Регистрация Cursor',
    usage: 'cursor:register [--email-service guerrillamail]',
    handler: handleCursorRegister
  },
  'cursor:auto-register': {
    description: 'Авто-регистрация',
    usage: 'cursor:auto-register [--email-service guerrillamail]',
    handler: handleCursorAutoRegister
  },
  'cursor:signin': {
    description: 'Вход в Cursor',
    usage: 'cursor:signin <email>',
    handler: handleCursorSignIn
  },
  'cursor:profile': {
    description: 'Профиль пользователя',
    usage: 'cursor:profile',
    handler: handleCursorProfile
  },
  'cursor:subscription': {
    description: 'Статус подписки',
    usage: 'cursor:subscription',
    handler: handleCursorSubscription
  },
  'cursor:signout': {
    description: 'Выход из Cursor',
    usage: 'cursor:signout',
    handler: handleCursorSignOut
  },
  'cursor:session': {
    description: 'Текущая сессия',
    usage: 'cursor:session',
    handler: handleCursorSession
  },

  // Bypass Server команды
  'server:start': {
    description: 'Запустить Bypass Server',
    usage: 'server:start [--port 3001]',
    handler: handleServerStart
  },
  'server:status': {
    description: 'Статус сервера',
    usage: 'server:status',
    handler: handleServerStatus
  },
  'server:stop': {
    description: 'Остановить сервер',
    usage: 'server:stop',
    handler: handleServerStop
  },

  // Updater команды
  'updater:check': {
    description: 'Проверить обновления',
    usage: 'updater:check',
    handler: handleUpdaterCheck
  },
  'updater:download': {
    description: 'Скачать обновление',
    usage: 'updater:download',
    handler: handleUpdaterDownload
  },
  'updater:install': {
    description: 'Установить обновление',
    usage: 'updater:install',
    handler: handleUpdaterInstall
  },
  'updater:auto': {
    description: 'Авто-обновление',
    usage: 'updater:auto',
    handler: handleUpdaterAuto
  },
  'updater:status': {
    description: 'Статус обновлений',
    usage: 'updater:status',
    handler: handleUpdaterStatus
  },

  // DNS команды
  'dns:set': {
    description: 'Установить DNS',
    usage: 'dns:set <cloudflare|google|quad9|opendns|adguard|auto>',
    handler: handleDNSSet
  },
  'dns:current': {
    description: 'Текущий DNS',
    usage: 'dns:current',
    handler: handleDNSCurrent
  },
  'dns:restore': {
    description: 'Восстановить DNS',
    usage: 'dns:restore',
    handler: handleDNSRestore
  },
  'dns:flush': {
    description: 'Очистить DNS кэш',
    usage: 'dns:flush',
    handler: handleDNSFlush
  },

  // IP команды
  'ip:check': {
    description: 'Проверить IP',
    usage: 'ip:check [--details]',
    handler: handleIPCheck
  },
  'ip:history': {
    description: 'История IP',
    usage: 'ip:history',
    handler: handleIPHistory
  },

  // Fingerprint команды
  'fingerprint:reset': {
    description: 'Сброс fingerprint',
    usage: 'fingerprint:reset [--no-mac] [--no-hostname] [--no-dns]',
    handler: handleFingerprintReset
  },
  'fingerprint:mac': {
    description: 'Сменить MAC адрес',
    usage: 'fingerprint:mac',
    handler: handleMACChange
  },
  'fingerprint:hostname': {
    description: 'Сменить hostname',
    usage: 'fingerprint:hostname [--name <newname>]',
    handler: handleHostnameChange
  },
  'fingerprint:info': {
    description: 'Информация о fingerprint',
    usage: 'fingerprint:info',
    handler: handleFingerprintInfo
  },

  // Email команды
  'email:create': {
    description: 'Создать временный email',
    usage: 'email:create [--service guerrillamail|tempmail|sazumi|mailinator]',
    handler: handleEmailCreate
  },
  'email:check': {
    description: 'Проверить почту',
    usage: 'email:check',
    handler: handleEmailCheck
  },
  'email:wait': {
    description: 'Ждать письмо от Cursor',
    usage: 'email:wait [--timeout 120000]',
    handler: handleEmailWait
  },

  // Monitor команды
  'monitor:check': {
    description: 'Проверить статус Cursor',
    usage: 'monitor:check',
    handler: handleMonitorCheck
  },
  'monitor:start': {
    description: 'Запустить мониторинг',
    usage: 'monitor:start [--interval 60000]',
    handler: handleMonitorStart
  },
  'monitor:stop': {
    description: 'Остановить мониторинг',
    usage: 'monitor:stop',
    handler: handleMonitorStop
  },
  'monitor:status': {
    description: 'Статус мониторинга',
    usage: 'monitor:status',
    handler: handleMonitorStatus
  },

  // Reset команды
  'reset': {
    description: 'Сброс Machine ID',
    usage: 'reset',
    handler: handleReset
  },
  'reset:all': {
    description: 'Полный сброс (Machine ID + Fingerprint)',
    usage: 'reset:all',
    handler: handleResetAll
  },

  // Info команды
  'info': {
    description: 'Общая информация',
    usage: 'info',
    handler: handleInfo
  },
  'help': {
    description: 'Помощь',
    usage: 'help [command]',
    handler: handleHelp
  },

  // Config Backup команды
  'backup:export': {
    description: 'Экспорт конфигурации',
    usage: 'backup:export [--file <path>]',
    handler: handleBackupExport
  },
  'backup:import': {
    description: 'Импорт конфигурации',
    usage: 'backup:import <file>',
    handler: handleBackupImport
  },
  'backup:list': {
    description: 'Список бэкапов',
    usage: 'backup:list',
    handler: handleBackupList
  },
  'backup:auto': {
    description: 'Автобэкап',
    usage: 'backup:auto',
    handler: handleBackupAuto
  },
  'backup:delete': {
    description: 'Удалить бэкап',
    usage: 'backup:delete <filename>',
    handler: handleBackupDelete
  },
  'backup:cleanup': {
    description: 'Очистка старых бэкапов',
    usage: 'backup:cleanup',
    handler: handleBackupCleanup
  },
  'backup:stats': {
    description: 'Статистика бэкапов',
    usage: 'backup:stats',
    handler: handleBackupStats
  }
};

/**
 * Парсинг аргументов
 * @param {Array<string>} args
 * @returns {Object}
 */
function parseArgs(args) {
  const result = {
    command: null,
    params: [],
    flags: {}
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const flag = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        result.flags[flag] = nextArg;
        i += 2;
      } else {
        result.flags[flag] = true;
        i++;
      }
    } else if (!result.command) {
      result.command = arg;
      i++;
    } else {
      result.params.push(arg);
      i++;
    }
  }

  return result;
}

/**
 * Форматированный вывод
 * @param {string} message
 * @param {string} type
 */
function output(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    process: '🔄'
  };

  console.log(`${icons[type] || 'ℹ️'} ${message}`);
}

/**
 * Обработчики команд
 */

async function handleProxyAdd(args) {
  const { params, flags } = args;

  if (params.length < 1) {
    output('Укажите прокси: proxy:add <host:port>', 'error');
    return;
  }

  const proxyStr = params[0];
  const protocol = flags.protocol || 'socks5';

  // Валидация протокола
  const protocolValidation = validateProxyProtocol(protocol);
  if (!protocolValidation.valid) {
    output(`Недопустимый протокол: ${protocolValidation.error}`, 'error');
    return;
  }

  // Базовая валидация URL
  const fullUrl = `${protocol}://${proxyStr}`;
  const urlValidation = validateUrl(fullUrl);
  if (!urlValidation.valid) {
    output(`Недопустимый URL прокси: ${urlValidation.error}`, 'error');
    return;
  }

  globalProxyManager.addProxy(proxyStr, protocolValidation.value);
  output(`Прокси добавлен: ${proxyStr} (${protocolValidation.value})`, 'success');

  // Проверка прокси
  output('Проверка прокси...', 'process');
  const isWorking = await globalProxyManager.checkProxy(
    globalProxyManager.parseProxy(proxyStr, protocolValidation.value),
    protocolValidation.value
  );

  output(isWorking ? 'Пркси работает' : 'Прокси не работает', isWorking ? 'success' : 'warning');
}

async function handleProxyList() {
  const proxies = globalProxyManager.getProxyList();
  const stats = globalProxyManager.getStats();

  output(`Прокси: ${stats.working}/${stats.total} рабочих`, 'info');

  if (proxies.length === 0) {
    output('Список прокси пуст', 'warning');
    return;
  }

  proxies.forEach((p, i) => {
    const status = p.working ? '🟢' : '🔴';
    const current = p.url === stats.currentProxy ? ' ← текущий' : '';
    console.log(`  ${status} ${i + 1}. ${p.url}${current}`);
  });
}

async function handleProxyCheck() {
  output('Проверка всех прокси...', 'process');
  const result = await globalProxyManager.checkAllProxies();
  output(`Проверено: ${result.working.length} рабочих, ${result.failed.length} нерабочих`, 'success');
}

async function handleProxyRotate() {
  const proxy = globalProxyManager.rotateProxy();

  if (proxy) {
    output(`Прокси сменён: ${proxy.url}`, 'success');
  } else {
    output('Нет рабочих прокси для ротации', 'error');
  }
}

async function handleProxyClear() {
  globalProxyManager.clearProxy();
  output('Прокси очищен', 'success');
}

// Proxy Database обработчики
async function handleProxyDbInit() {
  output('Инициализация базы прокси...', 'process');
  await globalProxyDatabase.init();
  const info = globalProxyDatabase.getInfo();
  output(`База инициализирована: ${info.total} прокси`, 'success');
}

async function handleProxyDbList(args) {
  const { flags } = args;

  output('Загрузка списка прокси...', 'process');
  const proxies = globalProxyDatabase.getProxies({
    country: flags.country,
    protocol: flags.protocol,
    workingOnly: flags.working,
    limit: 50
  });

  if (proxies.length === 0) {
    output('Прокси не найдены', 'warning');
    return;
  }

  output(`Найдено: ${proxies.length} прокси`, 'info');
  proxies.forEach((p, i) => {
    const status = p.working === true ? '🟢' : p.working === false ? '🔴' : '⚪';
    console.log(`  ${i + 1}. ${status} ${p.url} (${p.country}) [${p.protocol}]`);
  });
}

async function handleProxyDbStats() {
  const stats = globalProxyDatabase.getStats();

  output('Статистика базы прокси:', 'info');
  console.log(`  Всего: ${stats.total}`);
  console.log(`  Рабочих: ${stats.working}`);
  console.log(`  Нерабочих: ${stats.failed}`);
  console.log(`  По протоколам: ${JSON.stringify(stats.byProtocol)}`);
  console.log(`  По странам: ${JSON.stringify(stats.byCountry)}`);
}

async function handleProxyDbRefresh() {
  output('Обновление базы прокси...', 'process');
  await globalProxyDatabase.refresh();
  const info = globalProxyDatabase.getInfo();
  output(`Обновлено: ${info.total} прокси в базе`, 'success');
}

async function handleProxyDbCheck(args) {
  const { flags } = args;
  const concurrency = parseInt(flags.concurrency, 10) || 5;

  output(`Проверка всех прокси (concurrency: ${concurrency})...`, 'process');
  const result = await globalProxyDatabase.checkAllProxies(concurrency);
  output(`Проверено: ${result.checked}, рабочих: ${result.working.length}, нерабочих: ${result.failed.length}`, 'success');
}

async function handleProxyDbRandom(args) {
  const { flags } = args;

  output('Поиск случайного рабочего прокси...', 'process');
  const proxy = globalProxyDatabase.getRandomWorking(flags.protocol);

  if (proxy) {
    output(`Найден: ${proxy.url} (${proxy.country}) [${proxy.protocol}]`, 'success');
  } else {
    output('Рабочие прокси не найдены', 'error');
  }
}

async function handleProxyDbCountries() {
  const countries = globalProxyDatabase.getAvailableCountries();

  output(`Доступные страны (${countries.length}):`, 'info');
  countries.forEach(c => {
    const count = globalProxyDatabase.getStats().byCountry[c];
    console.log(`  ${c}: ${count} прокси`);
  });
}

async function handleProxyDbAuto(args) {
  const { flags } = args;
  const interval = parseInt(flags.interval, 10) || 300000;

  if (flags.disable) {
    globalProxyDatabase.disableAutoUpdate();
    output('Авто-обновление отключено', 'success');
  } else {
    globalProxyDatabase.enableAutoUpdate(interval);
    output(`Авто-обновление включено (интервал: ${interval}ms)`, 'success');
  }
}

// VPN обработчики
async function handleVPNInit() {
  output('Инициализация VPN...', 'process');
  const result = await globalVPNManager.init();

  output(`WireGuard: ${result.wireguard ? 'установлен' : 'не установлен'}`, result.wireguard ? 'success' : 'warning');
  output(`OpenVPN: ${result.openvpn ? 'установлен' : 'не установлен'}`, result.openvpn ? 'success' : 'warning');
}

async function handleVPNStatus() {
  output('Проверка статуса VPN...', 'process');
  const status = await globalVPNManager.getStatus();

  if (status.connected) {
    output(`Подключено: ${status.type} (${status.name || 'unknown'})`, 'success');
    output(`IP: ${status.ip || 'unknown'}`, 'info');
    output(`Страна: ${status.country || 'unknown'}`, 'info');
  } else {
    output('VPN не подключен', 'warning');
  }
}

async function handleVPNQuick() {
  output('Быстрое подключение VPN...', 'process');
  const result = await globalVPNManager.quickConnect();

  if (result.success) {
    output('VPN подключен', 'success');
    if (result.ip) {output(`IP: ${result.ip}`, 'info');}
    if (result.country) {output(`Страна: ${result.country}`, 'info');}
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleVPNDisconnect() {
  output('Отключение VPN...', 'process');
  const success = await globalVPNManager.disconnect();

  if (success) {
    output('VPN отключен', 'success');
  } else {
    output('Ошибка при отключении', 'error');
  }
}

async function handleVPNConfigs() {
  output('Загрузка конфигураций...', 'process');
  const configs = await globalVPNManager.getConfigs();

  if (configs.length === 0) {
    output('Конфигурации не найдены', 'warning');
    return;
  }

  output(`Найдено конфигураций: ${configs.length}`, 'info');
  configs.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.type})`);
  });
}

// Cursor Registrar обработчики
async function handleCursorRegister(args) {
  const { flags } = args;
  const emailService = flags['email-service'] || 'guerrillamail';

  output(`Регистрация Cursor (${emailService})...`, 'process');
  const result = await globalCursorRegistrar.register({
    emailService,
    autoVerify: true,
    timeout: CURSOR_CONSTANTS.REGISTRATION_TIMEOUT
  });

  if (result.success) {
    output(`Email: ${result.email}`, 'success');
    output(`Подтверждено: ${result.verified ? 'Да' : 'Нет'}`, result.verified ? 'success' : 'warning');
    if (result.token) {output('Токен получен', 'success');}
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorAutoRegister(args) {
  const { flags } = args;
  const emailService = flags['email-service'] || 'guerrillamail';

  output(`Авто-регистрация Cursor (${emailService})...`, 'process');
  const result = await globalCursorRegistrar.autoRegister({
    emailService,
    checkProStatus: true,
    timeout: CURSOR_CONSTANTS.REGISTRATION_TIMEOUT
  });

  if (result.success) {
    output(`Email: ${result.email}`, 'success');
    output(`Статус: ${result.isPro ? 'Pro' : result.isTrial ? 'Trial' : 'Free'}`, 'info');
    result.steps?.forEach(step => console.log(`  ${step}`));
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorSignIn(args) {
  const { params } = args;

  if (params.length < 1) {
    output('Укажите email: cursor:signin <email>', 'error');
    return;
  }

  const email = params[0];
  output(`Вход в Cursor: ${email}...`, 'process');

  // Запрос кода
  const result = await globalCursorRegistrar.signIn(email);

  if (result.success && result.requiresCode) {
    output('Код отправлен на email', 'success');
    const code = prompt('Введите код подтверждения:');
    if (code) {
      const verifyResult = await globalCursorRegistrar.signIn(email, code);
      if (verifyResult.success) {
        output('Вход выполнен', 'success');
      } else {
        output(`Ошибка: ${verifyResult.error}`, 'error');
      }
    }
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorProfile() {
  output('Загрузка профиля...', 'process');
  const result = await globalCursorRegistrar.getUserProfile();

  if (result.success) {
    output('Профиль загружен', 'success');
    console.log(JSON.stringify(result, null, 2));
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorSubscription() {
  output('Проверка подписки...', 'process');
  const result = await globalCursorRegistrar.getSubscriptionStatus();

  if (result.success) {
    output(`Статус: ${result.tier || 'unknown'}`, 'info');
    output(`Pro: ${result.isPro ? 'Да' : 'Нет'}`, result.isPro ? 'success' : 'info');
    output(`Trial: ${result.isTrial ? 'Да' : 'Нет'}`, 'info');
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorSignOut() {
  output('Выход из Cursor...', 'process');
  const result = await globalCursorRegistrar.signOut();

  if (result.success) {
    output('Выход выполнен', 'success');
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleCursorSession() {
  const session = globalCursorRegistrar.getSession();

  output('Текущая сессия:', 'info');
  console.log(`  Email: ${session.email || 'Нет'}`);
  console.log(`  Подтверждено: ${session.verified ? 'Да' : 'Нет'}`);
  console.log(`  Авторизовано: ${session.authenticated ? 'Да' : 'Нет'}`);
}

// Bypass Server обработчики
async function handleServerStart(args) {
  const { flags } = args;
  const port = flags.port ? parseInt(flags.port, 10) : 3001;

  output(`Запуск Bypass Server на порту ${port}...`, 'process');

  try {
    process.env.BYPASS_PORT = port;
    await globalBypassServer.init();
    await globalBypassServer.start();

    output(`Bypass Server запущен`, 'success');
    output(`HTTP: http://localhost:${port}`, 'info');
    output(`WebSocket: ws://localhost:${port}/ws`, 'info');
    output('Нажмите Ctrl+C для остановки', 'info');
  } catch (error) {
    output(`Ошибка запуска: ${error.message}`, 'error');
  }
}

async function handleServerStatus() {
  output('Проверка статуса сервера...', 'process');
  const stats = globalBypassServer.getStats();

  output('Статус Bypass Server:', 'info');
  console.log(`  Активных клиентов: ${stats.activeClients}`);
  console.log(`  Всего запросов: ${stats.totalRequests}`);
  console.log(`  Проксировано байт: ${stats.proxiedBytes}`);
  console.log(`  Время работы: ${Math.round(stats.uptime / 1000)}с`);
}

async function handleServerStop() {
  output('Остановка Bypass Server...', 'process');
  await globalBypassServer.stop();
  output('Сервер остановлен', 'success');
}

// Updater обработчики
async function handleUpdaterCheck() {
  output('Проверка обновлений...', 'process');

  try {
    const result = await globalUpdater.checkForUpdates();

    if (result.updateAvailable) {
      output(`Доступно обновление: ${result.currentVersion} → ${result.latestVersion}`, 'success');
      output(`Описание: ${result.info?.name || ''}`, 'info');
      console.log(`${result.info?.description?.substring(0, 200)}...`);
    } else {
      output('Обновлений нет. У вас последняя версия.', 'success');
    }
  } catch (error) {
    output(`Ошибка проверки: ${error.message}`, 'error');
  }
}

async function handleUpdaterDownload() {
  output('Проверка обновлений...', 'process');

  try {
    await globalUpdater.checkForUpdates();

    if (!globalUpdater.updateAvailable) {
      output('Обновлений нет', 'info');
      return;
    }

    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    output(`Загрузка обновления ${globalUpdater.latestVersion}...`, 'process');

    await globalUpdater.downloadUpdate(downloadPath);

    output(`Загрузка завершена: ${downloadPath}`, 'success');
  } catch (error) {
    output(`Ошибка загрузки: ${error.message}`, 'error');
  }
}

async function handleUpdaterInstall() {
  output('Установка обновления...', 'process');

  try {
    await globalUpdater.checkForUpdates();

    if (!globalUpdater.updateAvailable) {
      output('Обновлений нет', 'info');
      return;
    }

    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');

    // Проверка наличия загруженного файла
    if (!await fs.pathExists(downloadPath)) {
      output('Файл обновления не найден. Сначала выполните download.', 'warning');
      return;
    }

    await globalUpdater.installUpdate(downloadPath);

    output(`Обновление ${globalUpdater.latestVersion} установлено!`, 'success');
    output('Перезапустите приложение для применения обновлений.', 'info');
  } catch (error) {
    output(`Ошибка установки: ${error.message}`, 'error');
  }
}

async function handleUpdaterAuto() {
  output('Авто-обновление...', 'process');

  try {
    const result = await globalUpdater.autoUpdate({
      downloadPath: path.join(process.cwd(), 'updates', 'update.zip'),
      install: true
    });

    if (result.updated) {
      output(`Обновление до ${result.version} завершено!`, 'success');
      if (result.requiresRestart) {
        output('Требуется перезапуск приложения.', 'info');
      }
    } else if (result.downloadAvailable) {
      output(`Обновление ${result.version} доступно для загрузки.`, 'info');
    } else {
      output(result.reason || 'Обновлений нет', 'info');
    }
  } catch (error) {
    output(`Ошибка: ${error.message}`, 'error');
  }
}

async function handleUpdaterStatus() {
  const status = globalUpdater.getStatus();

  output('Статус обновлений:', 'info');
  console.log(`  Текущая версия: ${status.currentVersion}`);
  console.log(`  Последняя версия: ${status.latestVersion || 'Неизвестно'}`);
  console.log(`  Доступно обновление: ${status.updateAvailable ? 'Да' : 'Нет'}`);
  console.log(`  Загрузка: ${status.isDownloading ? 'В процессе...' : 'Нет'}`);
  console.log(`  Установка: ${status.isInstalling ? 'В процессе...' : 'Нет'}`);
  if (status.isDownloading) {
    console.log(`  Прогресс: ${status.downloadProgress}%`);
  }
}

async function handleDNSSet(args) {
  const { params } = args;

  if (params.length < 1) {
    output('Укажите DNS провайдер: dns:set <cloudflare|google|quad9|opendns|adguard|auto>', 'error');
    return;
  }

  const provider = params[0];

  if (!DNS_SERVERS[provider]) {
    output(`Неизвестный провайдер: ${provider}`, 'error');
    output(`Доступные: ${Object.keys(DNS_SERVERS).join(', ')}`, 'info');
    return;
  }

  output(`Установка DNS: ${DNS_SERVERS[provider].name}...`, 'process');
  const success = await globalDNSManager.setDNS(provider);

  if (success) {
    output(`DNS установлен: ${DNS_SERVERS[provider].name} (${DNS_SERVERS[provider].primary})`, 'success');
  } else {
    output('Не удалось установить DNS (требуются права администратора)', 'error');
  }
}

async function handleDNSCurrent() {
  const dns = await globalDNSManager.getCurrentDNS();
  const config = globalDNSManager.getConfig();

  output(`Текущий DNS: ${dns.primary} (вторичный: ${dns.secondary})`, 'info');
  output(`Платформа: ${os.platform()}`, 'info');
  output(`Кастомный DNS: ${config.isCustomDNS ? 'Да' : 'Нет'}`, 'info');
}

async function handleDNSRestore() {
  output('Восстановление DNS...', 'process');
  const success = await globalDNSManager.restoreDNS();

  if (success) {
    output('DNS восстановлен к настройкам по умолчанию (DHCP)', 'success');
  } else {
    output('Не удалось восстановить DNS', 'error');
  }
}

async function handleDNSFlush() {
  output('Очистка DNS кэша...', 'process');
  const success = await globalDNSManager.flushDNSCache();

  if (success) {
    output('DNS кэш очищен', 'success');
  } else {
    output('Не удалось очистить DNS кэш', 'error');
  }
}

async function handleIPCheck(args) {
  const { flags } = args;

  output('Проверка IP...', 'process');
  const ipData = await globalIPManager.getCurrentIP({ includeDetails: flags.details });

  output(`IP: ${ipData.ip}`, 'info');
  if (ipData.country) {
    output(`Страна: ${ipData.country} (${ipData.countryCode})`, 'info');
  }
  if (ipData.city) {
    output(`Город: ${ipData.city}`, 'info');
  }
  if (ipData.isp) {
    output(`Провайдер: ${ipData.isp}`, 'info');
  }

  // Проверка блокировок
  output('Проверка доступности Cursor...', 'process');
  const blocks = await globalIPManager.detectBlocks();

  if (blocks.cursorBlocked) {
    output('Cursor API заблокирован!', 'error');
  } else if (blocks.cursorPartiallyBlocked) {
    output('Cursor API работает нестабильно', 'warning');
  } else {
    output('Cursor API доступен', 'success');
  }

  if (blocks.recommendations.length > 0) {
    output('Рекомендации:', 'info');
    blocks.recommendations.forEach(r => {
      console.log(`  • ${r.message}`);
      console.log(`    → ${r.action}`);
    });
  }
}

async function handleIPHistory() {
  const history = globalIPManager.getIPHistory();

  if (history.length === 0) {
    output('История IP пуста', 'warning');
    return;
  }

  output(`История IP (${history.length} записей):`, 'info');
  history.forEach((entry, i) => {
    const date = new Date(entry.timestamp).toLocaleTimeString();
    console.log(`  ${i + 1}. ${entry.ip} (${entry.country}) - ${date}`);
  });
}

async function handleFingerprintReset(args) {
  const { flags } = args;

  const options = {
    changeMAC: !flags['no-mac'],
    changeHostname: !flags['no-hostname'],
    flushDNS: !flags['no-dns']
  };

  output('Сброс fingerprint...', 'process');
  const result = await globalFingerprintManager.resetFingerprint(options);

  if (result.mac) {
    output(`MAC: ${result.mac.success}/${result.mac.total} интерфейсов изменено`, 'success');
  }
  if (result.hostname) {
    output(`Hostname: ${result.hostname.success ? 'изменён' : 'ошибка'}`, result.hostname.success ? 'success' : 'error');
  }
  if (result.dns) {
    output(`DNS кэш: ${result.dns.success ? 'очищен' : 'ошибка'}`, result.dns.success ? 'success' : 'error');
  }

  output('Fingerprint сброс завершён', 'success');
}

async function handleMACChange() {
  output('Смена MAC адресов...', 'process');
  const result = await globalFingerprintManager.changeAllMAC();

  output(`Изменено: ${result.success}/${result.total} интерфейсов`, result.success > 0 ? 'success' : 'error');

  result.results.forEach(r => {
    console.log(`  ${r.interface}: ${r.oldMAC} → ${r.newMAC}`);
  });
}

async function handleHostnameChange(args) {
  const { flags } = args;

  if (flags.name) {
    output(`Смена hostname на: ${flags.name}`, 'process');
    const success = await globalFingerprintManager.setHostname(flags.name);
    output(success ? 'Hostname изменён' : 'Ошибка смены hostname', success ? 'success' : 'error');
  } else {
    output('Смена hostname на случайный...', 'process');
    const success = await globalFingerprintManager.changeHostname();
    output(success ? 'Hostname изменён' : 'Ошибка смены hostname', success ? 'success' : 'error');
  }
}

async function handleFingerprintInfo() {
  const info = await globalFingerprintManager.getFingerprintInfo();

  output('Fingerprint информация:', 'info');
  console.log(`  Платформа: ${info.platform}`);
  console.log(`  Hostname: ${info.hostname}`);
  console.log(`  MAC адреса: ${info.macAddresses.length}`);
  info.macAddresses.forEach(m => {
    console.log(`    • ${m.name}: ${m.mac}`);
  });
  console.log(`  CPU: ${info.cpus} ядер`);
  console.log(`  RAM: ${(info.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
}

async function handleEmailCreate(args) {
  const { flags } = args;
  const service = flags.service || 'guerrillamail';

  output(`Создание email (${service})...`, 'process');
  const result = await globalEmailManager.createEmail(service);

  if (result.success) {
    output(`Email: ${result.email}`, 'success');
    output(`Сервис: ${result.service}`, 'info');
    output('Используйте email:check для проверки сообщений', 'info');
  } else {
    output(`Ошибка: ${result.error}`, 'error');
  }
}

async function handleEmailCheck() {
  const session = globalEmailManager.getSessionInfo();

  if (!session.email) {
    output('Нет активного email сеанса', 'error');
    return;
  }

  output(`Проверка ${session.email}...`, 'process');
  const messages = await globalEmailManager.getMessages();

  if (messages.length === 0) {
    output('Сообщений нет', 'info');
    return;
  }

  output(`Сообщений: ${messages.length}`, 'success');
  messages.forEach((msg, i) => {
    console.log(`  ${i + 1}. ${msg.subject || 'Без темы'} (от: ${msg.from})`);
  });
}

async function handleEmailWait(args) {
  const { flags } = args;
  const timeout = parseInt(flags.timeout, 10) || EMAIL_CONSTANTS.EMAIL_WAIT_TIMEOUT;

  output(`Ожидание письма от Cursor (timeout: ${timeout}ms)...`, 'process');
  const result = await globalEmailManager.waitForMessage({
    subjectContains: 'cursor',
    timeout
  });

  if (result) {
    output(`Письмо получено: ${result.subject}`, 'success');

    const code = globalEmailManager.extractVerificationCode(result.body);
    const link = globalEmailManager.extractVerificationLink(result.body);

    if (code) {
      output(`Код подтверждения: ${code}`, 'success');
    }
    if (link) {
      output(`Ссылка: ${link}`, 'info');
    }
  } else {
    output('Письмо не получено (timeout)', 'error');
  }
}

async function handleMonitorCheck() {
  output('Проверка статуса сервисов...', 'process');
  const report = await globalMonitorManager.fullCheck();

  output(`Cursor: ${report.cursorAvailable ? 'доступен' : 'недоступен'}`, report.cursorAvailable ? 'success' : 'error');

  Object.entries(report.services).forEach(([name, data]) => {
    const icon = data.availabilityPercent === 100 ? '🟢' : data.availabilityPercent >= 50 ? '🟡' : '🔴';
    console.log(`  ${icon} ${name}: ${data.availabilityPercent}%`);
  });

  if (report.recommendations.length > 0) {
    output('Рекомендации:', 'info');
    report.recommendations.forEach(r => {
      console.log(`  [${r.type}] ${r.message}`);
    });
  }
}

async function handleMonitorStart(args) {
  const { flags } = args;
  const interval = parseInt(flags.interval, 10) || 60000;

  globalMonitorManager.startMonitoring(interval);
  output(`Мониторинг запущен (интервал: ${interval}ms)`, 'success');
}

async function handleMonitorStop() {
  globalMonitorManager.stopMonitoring();
  output('Мониторинг остановлен', 'success');
}

async function handleMonitorStatus() {
  const status = globalMonitorManager.getCurrentStatus();
  const stats = globalMonitorManager.getStats();

  output('Статус мониторинга:', 'info');
  console.log(`  Запущен: ${status.isMonitoring ? 'Да' : 'Нет'}`);
  console.log(`  Последняя проверка: ${status.lastCheck ? new Date(status.lastCheck).toLocaleString() : 'Никогда'}`);
  console.log(`  Всего проверок: ${stats.totalChecks}`);
  console.log(`  Средний uptime: ${stats.uptimePercent}%`);
}

async function handleReset() {
  output('Сброс Machine ID...', 'process');
  output('Используйте веб-интерфейс или API для сброса Machine ID', 'info');
  output('POST /api/reset', 'info');
}

async function handleResetAll() {
  output('Полный сброс...', 'process');

  // Сброс fingerprint
  await globalFingerprintManager.resetFingerprint();
  output('Fingerprint сброшен', 'success');

  output('Для сброса Machine ID используйте веб-интерфейс или API', 'info');
  output('POST /api/reset', 'info');

  output('Полный сброс завершён', 'success');
}

async function handleInfo() {
  const platform = os.platform();
  const version = os.release();
  const arch = os.arch();

  output('Cursor Reset Tools - Информация:', 'info');
  console.log(`  Платформа: ${platform} ${version} (${arch})`);
  console.log(`  Hostname: ${os.hostname()}`);
  console.log(`  Node.js: ${process.version}`);

  const proxyStats = globalProxyManager.getStats();
  console.log(`  Прокси: ${proxyStats.working}/${proxyStats.total} рабочих`);

  const dnsConfig = globalDNSManager.getConfig();
  console.log(`  Кастомный DNS: ${dnsConfig.isCustomDNS ? 'Да' : 'Нет'}`);

  const monitorStatus = globalMonitorManager.getCurrentStatus();
  console.log(`  Мониторинг: ${monitorStatus.isMonitoring ? 'Запущен' : 'Остановлен'}`);
}

// Config Backup обработчики
async function handleBackupExport(args) {
  const { flags } = args;
  const filePath = flags.file;

  output('Экспорт конфигурации...', 'process');
  const result = await globalConfigBackup.export(filePath);

  if (result.success) {
    output(`Конфигурация экспортирована: ${result.path}`, 'success');
  } else {
    output(`Ошибка экспорта: ${result.error}`, 'error');
  }
}

async function handleBackupImport(args) {
  const { params } = args;

  if (params.length < 1) {
    output('Укажите файл: backup:import <file>', 'error');
    return;
  }

  const filePath = params[0];
  output(`Импорт конфигурации из ${filePath}...`, 'process');
  const result = await globalConfigBackup.import(filePath);

  if (result.success) {
    output('Конфигурация импортирована (применится после перезапуска)', 'success');
  } else {
    output(`Ошибка импорта: ${result.error}`, 'error');
  }
}

async function handleBackupList() {
  output('Загрузка списка бэкапов...', 'process');
  const backups = await globalConfigBackup.listBackups();

  if (backups.length === 0) {
    output('Бэкапы не найдены', 'warning');
    return;
  }

  output(`Найдено бэкапов: ${backups.length}`, 'info');
  backups.forEach((b, i) => {
    const sizeKB = (b.size / 1024).toFixed(2);
    const date = new Date(b.modifiedAt).toLocaleString('ru-RU');
    console.log(`  ${i + 1}. ${b.filename} (${sizeKB} KB) - ${date}`);
  });
}

async function handleBackupAuto() {
  output('Создание автобэкапа...', 'process');
  const result = await globalConfigBackup.autoBackup();

  if (result.success) {
    output(`Автобэкап создан: ${result.path}`, 'success');
  } else {
    output(`Ошибка автобэкапа: ${result.error}`, 'error');
  }
}

async function handleBackupDelete(args) {
  const { params } = args;

  if (params.length < 1) {
    output('Укажите файл: backup:delete <filename>', 'error');
    return;
  }

  const filename = params[0];
  output(`Удаление бэкапа ${filename}...`, 'process');
  const success = await globalConfigBackup.deleteBackup(filename);

  if (success) {
    output('Бэкап удалён', 'success');
  } else {
    output('Ошибка удаления бэкапа', 'error');
  }
}

async function handleBackupCleanup() {
  output('Очистка старых бэкапов...', 'process');
  const deleted = await globalConfigBackup.cleanup();
  output(`Удалено бэкапов: ${deleted}`, 'success');
}

async function handleBackupStats() {
  const stats = await globalConfigBackup.getStats();

  output('Статистика бэкапов:', 'info');
  console.log(`  Всего бэкапов: ${stats.totalBackups}`);
  console.log(`  Общий размер: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`  Максимум бэкапов: ${stats.maxBackups}`);
  if (stats.newestBackup) {
    console.log(`  Последний: ${stats.newestBackup.filename} (${new Date(stats.newestBackup.modifiedAt).toLocaleString('ru-RU')})`);
  }
  if (stats.oldestBackup) {
    console.log(`  Старейший: ${stats.oldestBackup.filename}`);
  }
}

async function handleHelp(args) {
  const { params } = args;

  if (params.length > 0) {
    const cmdName = params[0];
    const cmd = CLI_COMMANDS[cmdName];

    if (cmd) {
      output(`${cmdName}:`, 'info');
      console.log(`  Описание: ${cmd.description}`);
      console.log(`  Использование: ${cmd.usage}`);
    } else {
      output(`Команда не найдена: ${cmdName}`, 'error');
    }
    return;
  }

  output('Cursor Reset Tools - CLI помощь', 'info');
  console.log('');
  console.log('Использование: node cli.js <command> [options]');
  console.log('');
  console.log('Команды:');

  const categories = {
    'Proxy': ['proxy:add', 'proxy:list', 'proxy:check', 'proxy:rotate', 'proxy:clear'],
    'Proxy Database': ['proxy-db:init', 'proxy-db:list', 'proxy-db:stats', 'proxy-db:refresh', 'proxy-db:check', 'proxy-db:random', 'proxy-db:countries', 'proxy-db:auto'],
    'VPN': ['vpn:init', 'vpn:status', 'vpn:quick', 'vpn:disconnect', 'vpn:configs'],
    'Cursor': ['cursor:register', 'cursor:auto-register', 'cursor:signin', 'cursor:profile', 'cursor:subscription', 'cursor:signout', 'cursor:session'],
    'Server': ['server:start', 'server:status', 'server:stop'],
    'Updater': ['updater:check', 'updater:download', 'updater:install', 'updater:auto', 'updater:status'],
    'DNS': ['dns:set', 'dns:current', 'dns:restore', 'dns:flush'],
    'IP': ['ip:check', 'ip:history'],
    'Fingerprint': ['fingerprint:reset', 'fingerprint:mac', 'fingerprint:hostname', 'fingerprint:info'],
    'Email': ['email:create', 'email:check', 'email:wait'],
    'Monitor': ['monitor:check', 'monitor:start', 'monitor:stop', 'monitor:status'],
    'Reset': ['reset', 'reset:all'],
    'Backup': ['backup:export', 'backup:import', 'backup:list', 'backup:auto', 'backup:delete', 'backup:cleanup', 'backup:stats'],
    'Info': ['info', 'help']
  };

  for (const [category, commands] of Object.entries(categories)) {
    console.log(`\n  ${category}:`);
    for (const cmdName of commands) {
      const cmd = CLI_COMMANDS[cmdName];
      console.log(`    ${cmdName.padEnd(20)} - ${cmd.description}`);
    }
  }

  console.log('');
  output('Используйте "help <command>" для подробной информации', 'info');
}

/**
 * Главная функция CLI
 * @param {Array<string>} args - Аргументы командной строки
 */
export async function runCLI(args = process.argv.slice(2)) {
  logger.init();

  if (args.length === 0) {
    handleHelp({ params: [] });
    return;
  }

  const parsed = parseArgs(args);
  const command = CLI_COMMANDS[parsed.command];

  if (!command) {
    output(`Неизвестная команда: ${parsed.command}`, 'error');
    output('Используйте "help" для списка команд', 'info');
    return;
  }

  try {
    await command.handler(parsed);
  } catch (error) {
    // Детальная обработка ошибок CLI
    const errorMessage = formatCLIError(error, parsed.command);
    output(errorMessage.message, 'error');

    if (errorMessage.hints?.length > 0) {
      console.log('');
      output('Рекомендации:', 'warning');
      errorMessage.hints.forEach(hint => console.log(`  • ${hint}`));
    }

    logger.error(`CLI error: ${error.message}`, 'cli', {
      command: parsed.command,
      stack: error.stack,
      code: error.code
    });
  }
}

/**
 * Форматирование ошибок CLI с рекомендациями
 * @param {Error} error - Объект ошибки
 * @param {string} command - Имя команды
 * @returns {{message: string, hints: string[]}}
 */
function formatCLIError(error, command) {
  const message = error.message || 'Неизвестная ошибка';
  const hints = [];

  // Специфичные ошибки по командам
  switch (command) {
    case 'proxy:add':
      if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        hints.push('Проверьте правильность формата прокси (host:port)');
        hints.push('Убедитесь, что прокси сервер доступен');
      }
      break;

    case 'proxy:check':
    case 'proxy-db:check':
      if (message.includes('timeout')) {
        hints.push('Увеличьте таймаут проверки через флаг --timeout');
        hints.push('Проверьте подключение к интернету');
      }
      break;

    case 'vpn:quick':
    case 'vpn:configs':
      if (message.includes('WireGuard') || message.includes('OpenVPN')) {
        hints.push('Установите WireGuard или OpenVPN');
        hints.push('Проверьте наличие конфигураций в data/vpn-configs/');
      }
      break;

    case 'cursor:register':
    case 'cursor:auto-register':
      if (message.includes('email') || message.includes('SMTP')) {
        hints.push('Проверьте доступность email сервиса');
        hints.push('Попробуйте другой сервис: --email-service tempmail');
      }
      break;

    case 'dns:set':
      if (message.includes('permission') || message.includes('access')) {
        hints.push('Запустите CLI от имени администратора (sudo/root)');
        if (process.platform === 'win32') {
          hints.push('Windows: Запустите CMD от имени администратора');
        } else {
          hints.push('macOS/Linux: Используйте sudo node cli.js');
        }
      }
      break;

    case 'server:start':
      if (message.includes('EADDRINUSE')) {
        hints.push('Порт занят. Используйте другой порт: --port 3002');
        hints.push('Или остановите существующий сервер: server:stop');
      }
      break;

    case 'updater:download':
    case 'updater:install':
      if (message.includes('network') || message.includes('fetch')) {
        hints.push('Проверьте подключение к интернету');
        hints.push('Попробуйте позже - сервер может быть недоступен');
      }
      break;

    case 'backup:import':
      if (message.includes('not found') || message.includes('ENOENT')) {
        hints.push('Проверьте путь к файлу бэкапа');
        hints.push('Используйте backup:list для просмотра доступных бэкапов');
      }
      break;
  }

  // Общие рекомендации
  if (hints.length === 0) {
    if (message.includes('permission') || message.includes('access') || message.includes('EPERM')) {
      hints.push('Запустите CLI от имени администратора');
    } else if (message.includes('network') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      hints.push('Проверьте подключение к интернету');
    } else if (message.includes('timeout')) {
      hints.push('Превышено время ожидания. Повторите попытку');
    }
  }

  return {
    message: `${message}${error.code ? ` (код: ${error.code})` : ''}`,
    hints
  };
}

export default { runCLI, CLI_COMMANDS, parseArgs };
