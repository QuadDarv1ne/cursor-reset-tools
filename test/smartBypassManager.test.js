/**
 * Tests for SmartBypassManager
 * @jest-environment node
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SmartBypassManager, { globalSmartBypassManager } from '../utils/smartBypassManager.js';

describe('SmartBypassManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SmartBypassManager();
  });

  describe('Инициализация', () => {
    it('должен создаваться новый экземпляр', () => {
      expect(manager).toBeInstanceOf(SmartBypassManager);
    });

    it('должен иметь начальные методы обхода', () => {
      expect(manager.methods).toBeDefined();
      expect(manager.methods.direct).toBeDefined();
      expect(manager.methods.proxy).toBeDefined();
      expect(manager.methods.doh).toBeDefined();
      expect(manager.methods.dns).toBeDefined();
      expect(manager.methods.vpn).toBeDefined();
    });

    it('должен иметь начальные значения weight = 0', () => {
      Object.values(manager.methods).forEach(method => {
        expect(method.weight).toBe(0);
      });
    });

    it('должен иметь пустой lastTest', () => {
      expect(manager.lastTest).toBeNull();
    });

    it('должен иметь пустые recommendations', () => {
      expect(manager.recommendations).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('должен возвращать статус с методами', () => {
      const status = manager.getStatus();
      expect(status).toHaveProperty('lastTest');
      expect(status).toHaveProperty('bestMethod');
      expect(status).toHaveProperty('methods');
      expect(status).toHaveProperty('recommendations');
    });

    it('должен возвращать методы с полями name, weight, available', () => {
      const status = manager.getStatus();
      Object.values(status.methods).forEach(method => {
        expect(method).toHaveProperty('name');
        expect(method).toHaveProperty('weight');
        expect(method).toHaveProperty('available');
      });
    });
  });

  describe('getBestMethod', () => {
    it('должен возвращать лучший метод по весу', () => {
      manager.methods.direct.weight = 50;
      manager.methods.proxy.weight = 80;
      manager.methods.doh.weight = 60;

      const best = manager.getBestMethod();
      expect(best).toBe('proxy');
    });
  });

  describe('getMethods', () => {
    it('должен возвращать все методы', () => {
      const methods = manager.getMethods();
      expect(Object.keys(methods).length).toBe(6);
      expect(methods).toEqual(manager.methods);
    });
  });

  describe('getRecommendations', () => {
    it('должен возвращать пустой массив при отсутствии рекомендаций', () => {
      const recommendations = manager.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
    });
  });
});

describe('globalSmartBypassManager', () => {
  it('должен экспортировать глобальный экземпляр', () => {
    expect(globalSmartBypassManager).toBeDefined();
    expect(globalSmartBypassManager).toBeInstanceOf(SmartBypassManager);
  });
});
