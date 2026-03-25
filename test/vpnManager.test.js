/**
 * Tests for VPNManager
 * @jest-environment node
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { VPNManager, globalVPNManager, VPN_CONFIG } from '../utils/vpnManager.js';

describe('VPNManager', () => {
  let manager;

  beforeEach(() => {
    manager = new VPNManager();
  });

  describe('Инициализация', () => {
    it('должен создаваться новый экземпляр', () => {
      expect(manager).toBeInstanceOf(VPNManager);
    });

    it('должен определять платформу', () => {
      expect(manager.platform).toBeDefined();
      expect(['win32', 'darwin', 'linux', 'freebsd']).toContain(manager.platform);
    });

    it('должен иметь пустой currentConnection', () => {
      expect(manager.currentConnection).toBeNull();
    });

    it('должен иметь connections Map', () => {
      expect(manager.connections).toBeInstanceOf(Map);
    });

    it('должен иметь configPath', () => {
      expect(manager.configPath).toBeDefined();
      expect(manager.configPath).toContain('data');
      expect(manager.configPath).toContain('vpn-configs');
    });
  });

  describe('VPN_CONFIG', () => {
    it('должен иметь конфигурацию для WireGuard', () => {
      expect(VPN_CONFIG.wireguard).toBeDefined();
      expect(VPN_CONFIG.wireguard.binary).toBeDefined();
    });

    it('должен иметь конфигурацию для OpenVPN', () => {
      expect(VPN_CONFIG.openvpn).toBeDefined();
      expect(VPN_CONFIG.openvpn.binary).toBeDefined();
    });

    it('должен иметь binary пути для win32', () => {
      expect(VPN_CONFIG.wireguard.binary.win32).toBeDefined();
      expect(VPN_CONFIG.openvpn.binary.win32).toBeDefined();
    });

    it('должен иметь binary пути для darwin', () => {
      expect(VPN_CONFIG.wireguard.binary.darwin).toBeDefined();
      expect(VPN_CONFIG.openvpn.binary.darwin).toBeDefined();
    });

    it('должен иметь binary пути для linux', () => {
      expect(VPN_CONFIG.wireguard.binary.linux).toBeDefined();
      expect(VPN_CONFIG.openvpn.binary.linux).toBeDefined();
    });
  });

  describe('createWireGuardConfig', () => {
    it('должен создавать WireGuard конфиг строку', () => {
      const config = {
        name: 'test-vpn',
        privateKey: 'testPrivateKey123',
        address: '10.0.0.2/32',
        dns: '1.1.1.1',
        peers: [
          {
            publicKey: 'testPublicKey123',
            endpoint: 'vpn.example.com:51820',
            allowedIPs: ['0.0.0.0/0']
          }
        ]
      };

      const result = manager.createWireGuardConfig(config);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createOpenVPNConfig', () => {
    it('должен создавать OpenVPN конфиг строку', () => {
      const config = {
        name: 'test-openvpn',
        remote: 'vpn.example.com',
        port: 1194,
        proto: 'udp'
      };

      const result = manager.createOpenVPNConfig(config);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('checkWireGuard', () => {
    it('должен возвращать boolean', async () => {
      const result = await manager.checkWireGuard();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkOpenVPN', () => {
    it('должен возвращать boolean', async () => {
      const result = await manager.checkOpenVPN();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkAmneziaVPN', () => {
    it('должен возвращать boolean', async () => {
      const result = await manager.checkAmneziaVPN();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAmneziaStatus', () => {
    it('должен возвращать статус Amnezia VPN', async () => {
      const status = await manager.getAmneziaStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('installed');
      expect(typeof status.installed).toBe('boolean');
    });
  });

  describe('getAmneziaRecommendations', () => {
    it('должен возвращать массив рекомендаций', () => {
      const recommendations = manager.getAmneziaRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('detectActiveVPN', () => {
    it('должен возвращать объект с detected полем', async () => {
      const result = await manager.detectActiveVPN();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('detected');
    });
  });

  describe('getStatus', () => {
    it('должен возвращать статус подключения', async () => {
      const status = await manager.getStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('connected');
      expect(typeof status.connected).toBe('boolean');
    });
  });

  describe('quickConnect', () => {
    it('должен возвращать результат с success полем', async () => {
      const result = await manager.quickConnect();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });
});

describe('globalVPNManager', () => {
  it('должен экспортировать глобальный экземпляр', () => {
    expect(globalVPNManager).toBeDefined();
    expect(globalVPNManager).toBeInstanceOf(VPNManager);
  });
});
