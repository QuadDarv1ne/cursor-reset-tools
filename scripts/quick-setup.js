#!/usr/bin/env node

/**
 * Quick Setup Script - Быстрая проверка и настройка VPN/DNS
 * Использование: node scripts/quick-setup.js
 */

import { globalVPNManager } from '../utils/vpnManager.js';
import { globalDNSManager } from '../utils/dnsManager.js';
import { globalLeakDetector } from '../utils/leakDetector.js';
import { globalSmartBypassManager } from '../utils/smartBypassManager.js';
import { _logger } from '../utils/logger.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function section(title) {
  console.log(`\n${'='.repeat(50)}`);
  log(COLORS.cyan, title);
  console.log('='.repeat(50));
}

async function checkVPN() {
  section('🔍 Проверка VPN');

  const vpnStatus = await globalVPNManager.detectActiveVPN();

  if (vpnStatus.detected) {
    log(COLORS.green, '✓ VPN обнаружен');
    log(COLORS.blue, `  Страна: ${vpnStatus.country} (${vpnStatus.countryCode})`);
    log(COLORS.blue, `  IP: ${vpnStatus.ip}`);
    log(COLORS.blue, `  ISP: ${vpnStatus.isp}`);
    log(COLORS.blue, `  Тип: ${vpnStatus.type}`);
    return { success: true, status: vpnStatus };
  }
  log(COLORS.red, '✗ VPN не обнаружен');
  log(COLORS.yellow, '  Рекомендуется включить Amnezia VPN или другой VPN');
  return { success: false, status: vpnStatus };

}

async function checkDNS() {
  section('🌐 Проверка DNS');

  const currentDNS = await globalDNSManager.getCurrentDNS();

  log(COLORS.blue, `  Primary DNS: ${currentDNS.primary}`);
  log(COLORS.blue, `  Secondary DNS: ${currentDNS.secondary}`);

  const isPublicDNS = ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9', '149.112.112.112'].includes(currentDNS.primary);

  if (isPublicDNS) {
    log(COLORS.green, '✓ Используется публичный DNS');
    return { success: true, dns: currentDNS };
  }
  log(COLORS.yellow, '⚠ Используется DNS провайдера');
  log(COLORS.yellow, '  Рекомендуется сменить на Cloudflare (1.1.1.1)');
  return { success: false, dns: currentDNS };

}

async function checkLeaks() {
  section('🛡️ Проверка утечек');

  const leakStatus = await globalLeakDetector.checkAll();

  // DNS leak
  if (!leakStatus.overall.dnsLeak) {
    log(COLORS.green, '✓ DNS утечка: НЕТ');
  } else {
    log(COLORS.red, '✗ DNS утечка: ОБНАРУЖЕНА');
  }

  // IPv6 leak
  if (!leakStatus.overall.ipv6Leak) {
    log(COLORS.green, '✓ IPv6 утечка: НЕТ');
  } else {
    log(COLORS.red, '✗ IPv6 утечка: ОБНАРУЖЕНА');
  }

  // WebRTC
  if (leakStatus.overall.webrtcRisk) {
    log(COLORS.yellow, '⚠ WebRTC: Требует проверки в браузере');
    log(COLORS.blue, '  Проверьте: https://browserleaks.com/webrtc');
  } else {
    log(COLORS.green, '✓ WebRTC: Нет утечки');
  }

  return leakStatus;
}

async function testBypass() {
  section('🚀 Тест обхода блокировок');

  log(COLORS.blue, 'Тестирование всех методов...');

  const results = await globalSmartBypassManager.testAllMethods();
  const status = globalSmartBypassManager.getStatus();

  log(COLORS.cyan, '\nВеса методов:');
  for (const [_key, method] of Object.entries(status.methods)) {
    const icon = method.weight > 50 ? '✓' : method.weight > 0 ? '⚠' : '✗';
    const color = method.weight > 50 ? COLORS.green : method.weight > 0 ? COLORS.yellow : COLORS.red;
    log(color, `  ${icon} ${method.name}: ${method.weight}`);
  }

  log(COLORS.cyan, `\nЛучший метод: ${status.bestMethod}`);

  return { results, status };
}

async function applyFixes(dnsFailed) {
  section('🔧 Применение исправлений');

  if (dnsFailed) {
    log(COLORS.blue, 'Смена DNS на Cloudflare...');
    const dnsSuccess = await globalDNSManager.setDNS('cloudflare');
    if (dnsSuccess) {
      log(COLORS.green, '✓ DNS успешно изменён');
      await globalDNSManager.flushDNSCache();
      log(COLORS.green, '✓ DNS кэш очищен');
    } else {
      log(COLORS.red, '✗ Не удалось сменить DNS');
    }
  }

  log(COLORS.blue, 'Применение лучшего метода обхода...');
  const applyResult = await globalSmartBypassManager.applyBestMethod();

  if (applyResult.success) {
    log(COLORS.green, `✓ Применён метод: ${applyResult.method}`);
    if (applyResult.proxy) {
      log(COLORS.blue, `  Прокси: ${applyResult.proxy}`);
    }
    if (applyResult.provider) {
      log(COLORS.blue, `  Провайдер: ${applyResult.provider}`);
    }
  } else {
    log(COLORS.yellow, '⚠ Не удалось применить метод автоматически');
  }
}

function printRecommendations(vpnFailed, dnsFailed, leakStatus) {
  section('📋 Рекомендации');

  const recommendations = [];

  if (!vpnFailed) {
    recommendations.push({
      icon: '✓',
      color: COLORS.green,
      text: 'VPN подключён и работает'
    });
  } else {
    recommendations.push({
      icon: '✗',
      color: COLORS.red,
      text: 'Включите Amnezia VPN или другой VPN'
    });
  }

  if (!dnsFailed) {
    recommendations.push({
      icon: '✓',
      color: COLORS.green,
      text: 'DNS настроен правильно'
    });
  } else {
    recommendations.push({
      icon: '⚠',
      color: COLORS.yellow,
      text: 'Смените DNS на Cloudflare (1.1.1.1)'
    });
  }

  if (!leakStatus.overall.dnsLeak) {
    recommendations.push({
      icon: '✓',
      color: COLORS.green,
      text: 'DNS утечка отсутствует'
    });
  }

  if (leakStatus.overall.webrtcRisk) {
    recommendations.push({
      icon: '⚠',
      color: COLORS.yellow,
      text: 'Проверьте WebRTC в браузере: https://browserleaks.com/webrtc'
    });
  }

  recommendations.push({
    icon: '🔄',
    color: COLORS.cyan,
    text: 'Сбросьте Machine ID перед запуском Cursor'
  });

  recommendations.push({
    icon: '🚀',
    color: COLORS.cyan,
    text: 'Запустите Cursor после всех проверок'
  });

  console.log('');
  for (const rec of recommendations) {
    log(rec.color, `  ${rec.icon} ${rec.text}`);
  }

  console.log('');
}

async function main() {
  console.log('\n');
  log(COLORS.cyan, '╔═══════════════════════════════════════════════╗');
  log(COLORS.cyan, '║     Cursor Reset Tools - Quick Setup          ║');
  log(COLORS.cyan, '║     Быстрая проверка и настройка VPN/DNS      ║');
  log(COLORS.cyan, '╚═══════════════════════════════════════════════╝');
  console.log('');

  // Проверка VPN
  const vpnResult = await checkVPN();

  // Проверка DNS
  const dnsResult = await checkDNS();

  // Проверка утечек
  const leakResult = await checkLeaks();

  // Тест обхода
  await testBypass();

  // Применение исправлений если нужно
  if (!dnsResult.success) {
    await applyFixes(true);
  }

  // Рекомендации
  printRecommendations(!vpnResult.success, !dnsResult.success, leakResult);

  // Финальный статус
  section('✅ Готово!');

  const allGood = vpnResult.success && dnsResult.success && !leakResult.overall.dnsLeak;

  if (allGood) {
    log(COLORS.green, 'Все системы в порядке!');
    log(COLORS.cyan, 'Теперь сбросьте Machine ID и запустите Cursor');
  } else {
    log(COLORS.yellow, 'Обнаружены проблемы. Выполните рекомендации выше.');
  }

  console.log('\n');
  log(COLORS.blue, '📖 Полное руководство: VPN_SETUP_GUIDE_RU.md');
  console.log('');
}

// Запуск
main().catch(error => {
  log(COLORS.red, `Ошибка: ${error.message}`);
  console.error(error);
  process.exit(1);
});
