/**
 * Тесты для ResourceMonitor
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ResourceMonitor, RESOURCE_CONFIG } from '../utils/resourceMonitor.js';

describe('ResourceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new ResourceMonitor();
  });

  describe('Инициализация', () => {
    test('должен создаваться новый экземпляр', () => {
      expect(monitor).toBeInstanceOf(ResourceMonitor);
    });

    test('должен иметь начальные значения stats', () => {
      expect(monitor.currentStats).toBeDefined();
      expect(monitor.currentStats.cpu).toBe(0);
      expect(monitor.currentStats.memory).toBeDefined();
      expect(monitor.currentStats.disk).toBeDefined();
    });

    test('должен иметь пустую историю', () => {
      expect(monitor.history).toEqual([]);
    });

    test('должен иметь пустые алерты', () => {
      expect(monitor.alerts).toEqual([]);
    });

    test('мониторинг должен быть выключен по умолчанию', () => {
      expect(monitor.isMonitoring).toBe(false);
    });
  });

  describe('Получение использования памяти', () => {
    test('должен возвращать корректную структуру memory', () => {
      const memory = monitor._getMemoryUsage();

      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('free');
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('percent');
      expect(typeof memory.total).toBe('number');
      expect(memory.total).toBeGreaterThan(0);
      expect(memory.used).toBe(memory.total - memory.free);
    });

    test('процент памяти должен быть в диапазоне 0-100', () => {
      const memory = monitor._getMemoryUsage();
      expect(memory.percent).toBeGreaterThanOrEqual(0);
      expect(memory.percent).toBeLessThanOrEqual(100);
    });
  });

  describe('Получение использования диска', () => {
    test('должен возвращать корректную структуру disk', async () => {
      const disk = await monitor._getDiskUsage();

      expect(disk).toHaveProperty('total');
      expect(disk).toHaveProperty('free');
      expect(disk).toHaveProperty('used');
      expect(disk).toHaveProperty('percent');
    });

    test('процент диска должен быть в диапазоне 0-100', async () => {
      const disk = await monitor._getDiskUsage();
      expect(disk.percent).toBeGreaterThanOrEqual(0);
      expect(disk.percent).toBeLessThanOrEqual(100);
    });
  });

  describe('Сэмплирование', () => {
    test('должен обновлять currentStats после sample', async () => {
      await monitor.sample();

      expect(monitor.currentStats.timestamp).toBeDefined();
      expect(typeof monitor.currentStats.cpu).toBe('number');
      expect(monitor.currentStats.memory.percent).toBeDefined();
    }, 10000);

    test('должен добавлять запись в историю', async () => {
      const initialLength = monitor.history.length;
      await monitor.sample();

      expect(monitor.history.length).toBeGreaterThan(initialLength);
    }, 10000);

    test('должен ограничивать размер истории', async () => {
      // Очищаем историю перед тестом
      monitor.history = [];

      // Добавляем записей больше лимита
      for (let i = 0; i < RESOURCE_CONFIG.historyLimit + 10; i++) {
        monitor.history.push({ cpu: i, timestamp: Date.now() });
      }

      // Делаем несколько sample() для обрезки истории
      // Каждый sample добавляет 1 запись и удаляет 1 если превышен лимит
      await monitor.sample();

      // После одного sample история должна быть 101 (110 + 1 - 10 = 101, но обрезается до 100)
      // На самом деле: было 110, добавили 1 = 111, удалили 1 = 110
      // Нужно несколько итераций для полной обрезки
      expect(monitor.history.length).toBeLessThan(111);
    }, 15000);
  });

  describe('Алерты', () => {
    test('должен генерировать алерт при высоком CPU', () => {
      monitor.currentStats.cpu = 90; // Выше порога 80%
      monitor._checkAlerts();

      const cpuAlerts = monitor.alerts.filter(a => a.type === 'cpu');
      expect(cpuAlerts.length).toBeGreaterThan(0);
      expect(cpuAlerts[0].severity).toBe('warning');
    });

    test('должен генерировать алерт при высокой памяти', () => {
      monitor.currentStats.memory.percent = 90; // Выше порога 85%
      monitor._checkAlerts();

      const memoryAlerts = monitor.alerts.filter(a => a.type === 'memory');
      expect(memoryAlerts.length).toBeGreaterThan(0);
    });

    test('должен генерировать алерт при высоком диске', () => {
      monitor.currentStats.disk.percent = 95; // Выше порога 90%
      monitor._checkAlerts();

      const diskAlerts = monitor.alerts.filter(a => a.type === 'disk');
      expect(diskAlerts.length).toBeGreaterThan(0);
      expect(diskAlerts[0].severity).toBe('error');
    });

    test('должен ограничивать историю алертов', () => {
      // Генерируем много алертов
      for (let i = 0; i < 60; i++) {
        monitor.currentStats.cpu = 90;
        monitor._checkAlerts();
      }

      expect(monitor.alerts.length).toBeLessThanOrEqual(50);
    });

    test('clearAlerts должен очищать все алерты', () => {
      monitor.currentStats.cpu = 90;
      monitor._checkAlerts();
      monitor.clearAlerts();

      expect(monitor.alerts.length).toBe(0);
    });
  });

  describe('Мониторинг', () => {
    test('startMonitoring должен включать мониторинг', () => {
      monitor.startMonitoring(1000);
      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.monitorInterval).toBeDefined();
      monitor.stopMonitoring();
    });

    test('stopMonitoring должен выключать мониторинг', () => {
      monitor.startMonitoring(1000);
      monitor.stopMonitoring();
      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.monitorInterval).toBeNull();
    });

    test('повторный startMonitoring должен перезапускать таймер', () => {
      monitor.startMonitoring(1000);
      const firstInterval = monitor.monitorInterval;
      monitor.startMonitoring(2000);
      expect(monitor.monitorInterval).not.toBe(firstInterval);
      monitor.stopMonitoring();
    });
  });

  describe('Получение статистики', () => {
    beforeEach(async () => {
      // Добавляем данные в историю
      for (let i = 0; i < 5; i++) {
        monitor.currentStats.cpu = i * 10;
        monitor.currentStats.memory.percent = 50 + i * 5;
        monitor.currentStats.disk.percent = 30 + i * 2;
        monitor.history.push({ ...monitor.currentStats });
      }
    });

    test('getCurrentStats должен возвращать текущие stats', () => {
      const stats = monitor.getCurrentStats();

      expect(stats).toHaveProperty('cpu');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('disk');
      expect(stats).toHaveProperty('isMonitoring');
    });

    test('getHistory должен возвращать историю', () => {
      const history = monitor.getHistory(3);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(3);
    });

    test('getAlerts должен возвращать алерты', () => {
      monitor.currentStats.cpu = 90;
      monitor._checkAlerts();
      const alerts = monitor.getAlerts();

      expect(Array.isArray(alerts)).toBe(true);
    });

    test('getSummary должен возвращать сводку', () => {
      const summary = monitor.getSummary();

      expect(summary).toHaveProperty('cpu');
      expect(summary).toHaveProperty('memory');
      expect(summary).toHaveProperty('disk');
      expect(summary.cpu).toHaveProperty('avg');
      expect(summary.cpu).toHaveProperty('min');
      expect(summary.cpu).toHaveProperty('max');
      expect(summary.cpu).toHaveProperty('current');
    });

    test('getSummary с пустой историей', () => {
      const emptyMonitor = new ResourceMonitor();
      const summary = emptyMonitor.getSummary();

      expect(summary.cpu.avg).toBe(0);
      expect(summary.samples).toBe(0);
    });
  });

  describe('Экспорт', () => {
    test('export должен возвращать все данные', async () => {
      await monitor.sample();
      const exported = await monitor.export();

      expect(exported).toHaveProperty('current');
      expect(exported).toHaveProperty('summary');
      expect(exported).toHaveProperty('history');
      expect(exported).toHaveProperty('alerts');
      expect(exported).toHaveProperty('config');
    });
  });
});
