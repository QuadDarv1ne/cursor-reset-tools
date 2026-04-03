/**
 * Network Router - API endpoints для сети
 * VPN, DNS, System Proxy, DoH-VPN
 */

import express from 'express';
import { globalVPNManager } from '../utils/vpnManager.js';
import { globalDNSManager } from '../utils/dnsManager.js';
import { globalDoHManager } from '../utils/dohManager.js';
import { globalSystemProxyManager } from '../utils/systemProxyManager.js';
import { globalMonitorManager } from '../utils/monitorManager.js';
import { globalVPNLeakFix } from '../utils/vpnLeakFix.js';
import { globalVPNTrafficManager } from '../utils/vpnTrafficManager.js';
import { validateRequest, validateIp, validateDomain } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================
// VPN endpoints
// ============================================

/**
 * GET /api/vpn/status
 * Статус VPN
 */
router.get('/status', async (req, res) => {
  try {
    const vpnStatus = await globalVPNManager.detectActiveVPN();
    return res.json({
      success: true,
      ...vpnStatus
    });
  } catch (error) {
    logger.error(`VPN status error: ${error.message}`, 'vpn');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vpn/check
 * Проверка VPN
 */
router.post('/check', async (req, res) => {
  try {
    const vpnStatus = await globalVPNManager.detectActiveVPN();
    const recommendations = [];

    if (!vpnStatus.detected) {
      recommendations.push({
        type: 'vpn',
        priority: 'high',
        title: 'VPN не обнаружен',
        description: 'Для обхода блокировок рекомендуется включить VPN'
      });
    } else if (vpnStatus.countryCode === 'KZ') {
      recommendations.push({
        type: 'geo',
        priority: 'medium',
        title: 'Казахстан может иметь ограничения',
        description: 'Cursor может блокировать некоторые функции в вашем регионе'
      });
    }

    const dnsStatus = await globalMonitorManager.checkDNS();
    if (dnsStatus.availableCount < 2) {
      recommendations.push({
        type: 'dns',
        priority: 'high',
        title: 'Публичные DNS недоступны',
        description: 'Рекомендуется сменить DNS на Cloudflare (1.1.1.1)'
      });
    }

    return res.json({
      success: true,
      vpn: vpnStatus,
      dns: dnsStatus,
      recommendations
    });
  } catch (error) {
    logger.error(`VPN check error: ${error.message}`, 'vpn');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/amnezia/status
 * Статус Amnezia VPN
 */
router.get('/amnezia/status', async (req, res) => {
  try {
    const status = await globalVPNManager.getAmneziaStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`Amnezia status error: ${error.message}`, 'vpn');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/amnezia/recommendations
 * Рекомендации Amnezia
 */
router.get('/amnezia/recommendations', async (req, res) => {
  try {
    const recommendations = globalVPNManager.getAmneziaRecommendations();
    return res.json({ success: true, recommendations });
  } catch (error) {
    logger.error(`Amnezia recommendations error: ${error.message}`, 'vpn');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DoH-VPN Integration endpoints
// ============================================

/**
 * POST /api/doh-vpn/integrate
 * Интеграция DoH с VPN
 */
router.post('/doh-vpn/integrate', async (req, res) => {
  try {
    const result = await globalDoHManager.integrateWithVPN();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`DoH-VPN integrate error: ${error.message}`, 'doh');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/doh-vpn/recommendations
 * Рекомендации DoH-VPN
 */
router.get('/doh-vpn/recommendations', async (req, res) => {
  try {
    const recommendations = globalDoHManager.getVPNRecommendations();
    return res.json({ success: true, ...recommendations });
  } catch (error) {
    logger.error(`DoH-VPN recommendations error: ${error.message}`, 'doh');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DNS endpoints
// ============================================

/**
 * GET /api/dns/status
 * Статус DNS
 */
router.get('/dns/status', async (req, res) => {
  try {
    const currentDNS = await globalDNSManager.getCurrentDNS();
    const providers = globalDNSManager.getAvailableProviders();
    const dnsStatus = await globalMonitorManager.checkDNS();

    return res.json({
      success: true,
      current: currentDNS,
      providers,
      status: dnsStatus
    });
  } catch (error) {
    logger.error(`DNS status error: ${error.message}`, 'dns');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dns/set
 * Установить DNS
 */
router.post('/dns/set', async (req, res) => {
  try {
    const validation = validateRequest(req.body, {
      provider: {
        type: 'string',
        required: true,
        sanitize: true
      }
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const { provider } = validation.data;

    const success = await globalDNSManager.setDNS(provider);
    if (success) {
      await globalDNSManager.flushDNSCache();
      return res.json({ success: true, message: `DNS set to ${provider}` });
    }
    return res.status(500).json({ success: false, error: 'Failed to set DNS' });
  } catch (error) {
    logger.error(`DNS set error: ${error.message}`, 'dns');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dns/restore
 * Восстановить DNS
 */
router.post('/dns/restore', async (req, res) => {
  try {
    const success = await globalDNSManager.restoreDNS();
    if (success) {
      await globalDNSManager.flushDNSCache();
      return res.json({ success: true, message: 'DNS restored to automatic (DHCP)' });
    }
    return res.status(500).json({ success: false, error: 'Failed to restore DNS' });
  } catch (error) {
    logger.error(`DNS restore error: ${error.message}`, 'dns');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dns/flush
 * Очистить DNS кэш
 */
router.post('/dns/flush', async (req, res) => {
  try {
    await globalDNSManager.flushDNSCache();
    return res.json({ success: true, message: 'DNS cache flushed' });
  } catch (error) {
    logger.error(`DNS flush error: ${error.message}`, 'dns');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// System Proxy endpoints
// ============================================

/**
 * POST /api/system-proxy/configure
 * Настроить системный прокси
 */
router.post('/system-proxy/configure', async (req, res) => {
  try {
    const { host, port, protocol = 'http', auth } = req.body;
    if (!host || !port) {
      return res.status(400).json({ success: false, error: 'host and port required' });
    }

    // Валидация host (домен или IP) для предотвращения SSRF
    const isValidHost = validateDomain(host) || validateIp(host);
    if (!isValidHost) {
      return res.status(400).json({ success: false, error: 'Invalid host format (domain or IP required)' });
    }

    // Валидация port
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, error: 'Port must be between 1 and 65535' });
    }

    const result = await globalSystemProxyManager.configureProxy({ host, port: portNum, protocol, auth });
    return res.json({ success: result.success, ...result });
  } catch (error) {
    logger.error(`System proxy configure error: ${error.message}`, 'system-proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/system-proxy/disable
 * Отключить системный прокси
 */
router.post('/system-proxy/disable', async (req, res) => {
  try {
    const result = await globalSystemProxyManager.disableProxy();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    logger.error(`System proxy disable error: ${error.message}`, 'system-proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/system-proxy/status
 * Статус системного прокси
 */
router.get('/system-proxy/status', async (req, res) => {
  try {
    const status = await globalSystemProxyManager.getProxyStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`System proxy status error: ${error.message}`, 'system-proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/system-proxy/restore
 * Восстановить настройки прокси
 */
router.post('/system-proxy/restore', async (req, res) => {
  try {
    const success = await globalSystemProxyManager.restoreOriginalSettings();
    return res.json({ success, message: success ? 'Settings restored' : 'Restore failed' });
  } catch (error) {
    logger.error(`System proxy restore error: ${error.message}`, 'system-proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// VPN Leak Fix endpoints
// ============================================

/**
 * POST /api/vpn-leak/fix
 * Исправление утечек VPN
 */
router.post('/vpn-leak/fix', async (req, res) => {
  try {
    const result = await globalVPNLeakFix.fixAll();
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`VPN leak fix error: ${error.message}`, 'vpn-leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vpn-leak/restore
 * Восстановление настроек VPN
 */
router.post('/vpn-leak/restore', async (req, res) => {
  try {
    const success = await globalVPNLeakFix.restoreSettings();
    return res.json({ success, message: success ? 'Settings restored' : 'Restore failed' });
  } catch (error) {
    logger.error(`VPN leak restore error: ${error.message}`, 'vpn-leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/vpn-leak/status
 * Статус утечек VPN
 */
router.get('/vpn-leak/status', async (req, res) => {
  try {
    const status = await globalVPNLeakFix.getLeakStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`VPN leak status error: ${error.message}`, 'vpn-leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// VPN Traffic endpoints
// ============================================

/**
 * POST /api/vpn-traffic/configure
 * Настройка туннелирования
 */
router.post('/vpn-traffic/configure', async (req, res) => {
  try {
    const result = await globalVPNTrafficManager.configureFullTunnel();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    logger.error(`VPN traffic configure error: ${error.message}`, 'vpn-traffic');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vpn-traffic/killswitch/enable
 * Включить Kill Switch
 */
router.post('/vpn-traffic/killswitch/enable', async (req, res) => {
  try {
    const success = await globalVPNTrafficManager.enableKillSwitch();
    return res.json({ success, message: success ? 'Kill Switch enabled' : 'Failed to enable' });
  } catch (error) {
    logger.error(`VPN killswitch enable error: ${error.message}`, 'vpn-traffic');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vpn-traffic/killswitch/disable
 * Отключить Kill Switch
 */
router.post('/vpn-traffic/killswitch/disable', async (req, res) => {
  try {
    const success = await globalVPNTrafficManager.disableKillSwitch();
    return res.json({ success, message: success ? 'Kill Switch disabled' : 'Failed to disable' });
  } catch (error) {
    logger.error(`VPN killswitch disable error: ${error.message}`, 'vpn-traffic');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/vpn-traffic/status
 * Статус туннеля
 */
router.get('/vpn-traffic/status', async (req, res) => {
  try {
    const status = await globalVPNTrafficManager.getTunnelStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error(`VPN traffic status error: ${error.message}`, 'vpn-traffic');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/vpn-traffic/quick-setup
 * Быстрая настройка для Cursor
 */
router.post('/vpn-traffic/quick-setup', async (req, res) => {
  try {
    const result = await globalVPNTrafficManager.quickSetupForCursor();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    logger.error(`VPN traffic quick setup error: ${error.message}`, 'vpn-traffic');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
