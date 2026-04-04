/**
 * Enhanced Smart Bypass Manager - Улучшенная система обхода с ML
 * Добавлено: Machine Learning предсказания, исторический анализ, адаптивные веса
 */

import { logger } from './logger.js';
import { globalIPManager } from './ipManager.js';
import { globalMonitorManager } from './monitorManager.js';
import { globalProxyManager } from './proxyManager.js';
import { globalDNSManager } from './dnsManager.js';
import { globalDoHManager } from './dohManager.js';
import { globalVPNManager } from './vpnManager.js';
import { globalStatsCache } from './statsCache.js';

class SmartBypassManager {
  constructor() {
    // Методы обхода с расширенными параметрами
    this.methods = {
      direct: {
        name: 'Прямое подключение',
        weight: 0,
        available: true,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      },
      proxy: {
        name: 'Через прокси',
        weight: 0,
        available: false,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      },
      doh: {
        name: 'DNS over HTTPS',
        weight: 0,
        available: true,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      },
      dns: {
        name: 'Смена DNS',
        weight: 0,
        available: true,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      },
      vpn: {
        name: 'VPN режим',
        weight: 0,
        available: false,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      },
      amnezia: {
        name: 'AmneziaVPN',
        weight: 0,
        available: false,
        avgResponseTime: 0,
        successRate: 0,
        lastSuccess: null,
        lastFail: null,
        consecutiveFails: 0
      }
    };

    // История тестов для ML с ограничениями
    this.testHistory = [];
    this.maxHistorySize = 100; // Уменьшено с 1000 для экономии памяти

    // Временные паттерны для предсказаний с лимитами
    this.hourlyPatterns = new Map();
    this.dailyPatterns = new Map();
    this.countryStats = new Map();

    // Лимиты для предотвращения утечек памяти
    this.MAX_PATTERN_SIZE = 48; // 24 часа × 6 методов = 144 max
    this.MAX_COUNTRY_STATS = 50; // Максимум 50 стран

    // Последний тест и рекомендации
    this.lastTest = null;
    this.recommendations = [];

    // ML модель (простая реализация на основе весов)
    this.mlModel = {
      weights: {
        timeOfDay: 0.15,
        dayOfWeek: 0.10,
        country: 0.20,
        historicalSuccess: 0.25,
        responseTime: 0.15,
        consecutiveFails: 0.15
      },
      learningRate: 0.1,
      decayFactor: 0.95
    };

    // Автоматическое тестирование
    this.autoTestInterval = null;
  }

  /**
   * Очистка старых паттернов
   */
  _cleanupPatterns() {
    for (const map of [this.hourlyPatterns, this.dailyPatterns, this.countryStats]) {
      if (map.size > this.MAX_PATTERN_SIZE) {
        const entries = Array.from(map.entries());
        const oldest = entries.slice(0, entries.length - this.MAX_PATTERN_SIZE);
        for (const [key] of oldest) {
          map.delete(key);
        }
      }
    }
  }

  /**
   * Очистка старой истории
   */
  _cleanupHistory() {
    if (this.testHistory.length > this.maxHistorySize) {
      this.testHistory = this.testHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Тестирование всех методов обхода (с кэшированием)
   */
  async testAllMethods() {
    // Кэширование результатов на 5 минут
    return globalStatsCache.getOrCompute(
      'bypass:test:all',
      async () => {
        logger.info('Testing all bypass methods with ML analysis...', 'smart-bypass');

        const startTime = Date.now();
        const results = {};
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();

        // Параллельное тестирование всех методов
        const testPromises = [
          this.testDirect(),
          this.testProxy(),
          this.testDoH(),
          this.testDNS(),
          this.testVPN(),
          this.testAmnezia()
        ];

        const [direct, proxy, doh, dns, vpn, amnezia] = await Promise.allSettled(testPromises);

        results.direct = direct.status === 'fulfilled' ? direct.value : { success: false, error: direct.reason?.message };
        results.proxy = proxy.status === 'fulfilled' ? proxy.value : { success: false, error: proxy.reason?.message };
        results.doh = doh.status === 'fulfilled' ? doh.value : { success: false, error: doh.reason?.message };
        results.dns = dns.status === 'fulfilled' ? dns.value : { success: false, error: dns.reason?.message };
        results.vpn = vpn.status === 'fulfilled' ? vpn.value : { success: false, error: vpn.reason?.message };
        results.amnezia = amnezia.status === 'fulfilled' ? amnezia.value : { success: false, error: amnezia.reason?.message };

        // Обновляем статистику методов
        this.updateMethodStats('direct', results.direct);
        this.updateMethodStats('proxy', results.proxy);
        this.updateMethodStats('doh', results.doh);
        this.updateMethodStats('dns', results.dns);
        this.updateMethodStats('vpn', results.vpn);
        this.updateMethodStats('amnezia', results.amnezia);

        // Обновляем веса с учётом ML
        this.updateWeightsWithML(results, currentHour, currentDay);

        // Сохраняем в историю
        const historyEntry = {
          timestamp: startTime,
          duration: Date.now() - startTime,
          hour: currentHour,
          day: currentDay,
          results: { ...results },
          bestMethod: this.getBestMethod()
        };

        this.testHistory.push(historyEntry);
        if (this.testHistory.length > this.maxHistorySize) {
          this.testHistory.shift();
        }

        // Обновляем паттерны
        this.updatePatterns(historyEntry);

        this.lastTest = {
          timestamp: startTime,
          duration: Date.now() - startTime,
          results
        };

        // Генерируем рекомендации
        this.generateRecommendations(results);

        const bestMethod = this.getBestMethod();
        logger.info(`Bypass test complete in ${Date.now() - startTime}ms: ${bestMethod} is best`, 'smart-bypass');

        return results;
      },
      300000 // 5 минут TTL
    );
  }

  /**
   * Тест прямого подключения (оптимизированный)
   */
  async testDirect() {
    const start = Date.now();
    try {
      // Быстрая проверка доступности Cursor
      const cursorStatus = await globalMonitorManager.checkCursor();
      const responseTime = Date.now() - start;

      // Проверка утечек выполняется отдельно, не блокирует тест
      // leakStatus можно получить из последнего known state
      return {
        success: cursorStatus.available,
        responseTime,
        latency: responseTime,
        available: cursorStatus.available
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест прокси
   */
  async testProxy() {
    const start = Date.now();
    try {
      // Получаем лучший прокси
      const bestProxy = globalProxyManager.getBestProxy();
      if (!bestProxy) {
        return { success: false, available: false, error: 'No proxies configured' };
      }

      // Проверяем прокси
      const checkResult = await globalProxyManager.checkProxy(bestProxy.url);
      const responseTime = Date.now() - start;

      return {
        success: checkResult.success,
        responseTime,
        available: checkResult.success,
        currentProxy: bestProxy.url,
        isResidential: bestProxy.isResidential,
        dpiCompliant: bestProxy.dpiCompliant,
        country: bestProxy.country
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест DoH
   */
  async testDoH() {
    const start = Date.now();
    try {
      const providers = await globalDoHManager.getAvailableProviders();
      const available = providers.filter(p => p.available).length;

      // Тест резолвинга Cursor доменов
      const domains = ['cursor.sh', 'api2.cursor.sh'];
      let resolved = 0;

      for (const domain of domains) {
        try {
          const result = await globalDoHManager.resolveAuto(domain);
          if (result?.answers?.length > 0) {resolved++;}
        } catch {
          // Игнорируем ошибки отдельных доменов
        }
      }

      const responseTime = Date.now() - start;

      return {
        success: resolved === domains.length,
        responseTime,
        available: available > 0,
        providers: available,
        resolvedDomains: resolved,
        totalDomains: domains.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест DNS
   */
  async testDNS() {
    const start = Date.now();
    try {
      const dnsStatus = await globalMonitorManager.checkDNS();

      // Тестируем резолвинг через разные DNS
      const testResults = await Promise.allSettled([
        this.testDNSResolve('cloudflare'),
        this.testDNSResolve('google'),
        this.testDNSResolve('quad9')
      ]);

      const workingDNS = testResults.filter(r => r.status === 'fulfilled' && r.value).length;

      return {
        success: dnsStatus.available && workingDNS > 0,
        responseTime: Date.now() - start,
        available: dnsStatus.availableCount > 0,
        dnsCount: dnsStatus.availableCount,
        workingDNS
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест резолвинга через конкретный DNS
   */
  async testDNSResolve(provider) {
    try {
      const dns = await globalDNSManager.resolveWithProvider('cursor.sh', provider);
      return dns && dns.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Тест VPN
   */
  async testVPN() {
    const start = Date.now();
    try {
      const vpnStatus = await globalVPNManager.detectActiveVPN();

      let cursorAvailable = false;
      if (vpnStatus.detected) {
        const cursorStatus = await globalMonitorManager.checkCursor();
        cursorAvailable = cursorStatus.available;
      }

      return {
        success: vpnStatus.detected && cursorAvailable,
        responseTime: Date.now() - start,
        available: vpnStatus.detected,
        vpnActive: vpnStatus.detected,
        vpnType: vpnStatus.type,
        vpnCountry: vpnStatus.country,
        vpnIP: vpnStatus.ip,
        cursorAvailable
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест AmneziaVPN
   */
  async testAmnezia() {
    const start = Date.now();
    try {
      const amneziaStatus = await globalVPNManager.getAmneziaStatus();

      if (!amneziaStatus.installed) {
        return {
          success: false,
          available: false,
          installed: false,
          message: 'AmneziaVPN not installed'
        };
      }

      let cursorAvailable = false;
      if (amneziaStatus.connected) {
        const cursorStatus = await globalMonitorManager.checkCursor();
        cursorAvailable = cursorStatus.available;
      }

      return {
        success: amneziaStatus.connected && cursorAvailable,
        responseTime: Date.now() - start,
        available: amneziaStatus.connected,
        installed: true,
        connected: amneziaStatus.connected,
        protocol: amneziaStatus.protocol,
        country: amneziaStatus.country,
        cursorAvailable
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false,
        installed: false
      };
    }
  }

  /**
   * Обновление статистики метода
   */
  updateMethodStats(methodName, result) {
    const method = this.methods[methodName];
    if (!method) {return;}

    // Обновляем доступность
    method.available = result.available || false;

    // Обновляем время отклика
    if (result.responseTime) {
      method.avgResponseTime = method.avgResponseTime === 0
        ? result.responseTime
        : Math.round((method.avgResponseTime * 0.8) + (result.responseTime * 0.2));
    }

    // Обновляем success rate
    if (result.success) {
      method.lastSuccess = Date.now();
      method.consecutiveFails = 0;
      method.successRate = Math.min(100, method.successRate + 5);
    } else {
      method.lastFail = Date.now();
      method.consecutiveFails++;
      method.successRate = Math.max(0, method.successRate - 10);
    }
  }

  /**
   * Обновление весов с учётом ML
   */
  updateWeightsWithML(results, currentHour, currentDay) {
    // Получаем текущую страну
    const ipInfo = globalIPManager.getInfo();
    const currentCountry = ipInfo.current?.countryCode || 'UNKNOWN';

    // Базовые веса
    for (const [name, method] of Object.entries(this.methods)) {
      let weight = 0;

      // 1. Прямое подключение - базовый приоритет
      if (name === 'direct') {
        if (results.direct?.success && !results.direct?.hasLeaks) {
          weight = 100;
        } else if (results.direct?.success && results.direct?.hasLeaks) {
          weight = 30; // Работает но с утечками
        }
      }

      // 2. VPN - высокий приоритет если активен и работает
      if (name === 'vpn') {
        if (results.vpn?.available && results.vpn?.cursorAvailable) {
          weight = 95;
        } else if (results.vpn?.available) {
          weight = 50; // VPN есть но Cursor не доступен
        }
      }

      // 3. AmneziaVPN - максимальный приоритет если работает
      if (name === 'amnezia') {
        if (results.amnezia?.success) {
          weight = 98;
        } else if (results.amnezia?.connected) {
          weight = 60;
        }
      }

      // 4. DoH - хороший вариант для DNS блокировок
      if (name === 'doh') {
        if (results.doh?.success) {
          weight = 85;
        } else if (results.doh?.available) {
          weight = 40;
        }
      }

      // 5. Proxy - зависит от типа и качества
      if (name === 'proxy') {
        if (results.proxy?.success) {
          weight = 75;
          // Бонус за residential и DPI compliance
          if (results.proxy?.isResidential) {weight += 10;}
          if (results.proxy?.dpiCompliant) {weight += 15;}
        } else if (results.proxy?.available) {
          weight = 30;
        }
      }

      // 6. DNS - базовый метод
      if (name === 'dns') {
        if (results.dns?.success) {
          weight = 60;
        } else if (results.dns?.available) {
          weight = 25;
        }
      }

      // ML корректировка весов
      weight = this.applyMLAdjustment(name, weight, currentHour, currentDay, currentCountry);

      method.weight = weight;
    }
  }

  /**
   * ML корректировка веса
   */
  applyMLAdjustment(methodName, baseWeight, hour, day, country) {
    let weight = baseWeight;
    const method = this.methods[methodName];

    // 1. Влияние времени суток
    const hourlySuccess = this.getHourlySuccessRate(methodName, hour);
    weight *= (0.5 + hourlySuccess * 0.5);

    // 2. Влияние дня недели
    const dailySuccess = this.getDailySuccessRate(methodName, day);
    weight *= (0.7 + dailySuccess * 0.3);

    // 3. Влияние страны
    const countrySuccess = this.getCountrySuccessRate(methodName, country);
    weight *= (0.6 + countrySuccess * 0.4);

    // 4. Исторический success rate
    weight *= (method.successRate / 100);

    // 5. Штраф за последовательные неудачи
    if (method.consecutiveFails > 0) {
      weight *= Math.pow(0.5, method.consecutiveFails);
    }

    // 6. Бонус за быстрый отклик
    if (method.avgResponseTime > 0 && method.avgResponseTime < 500) {
      weight *= 1.2;
    } else if (method.avgResponseTime > 2000) {
      weight *= 0.8;
    }

    return Math.round(weight);
  }

  /**
   * Получить почасовой success rate
   */
  getHourlySuccessRate(methodName, hour) {
    const key = `${methodName}_${hour}`;
    const pattern = this.hourlyPatterns.get(key);
    return pattern?.successRate || 0.5;
  }

  /**
   * Получить дневной success rate
   */
  getDailySuccessRate(methodName, day) {
    const key = `${methodName}_${day}`;
    const pattern = this.dailyPatterns.get(key);
    return pattern?.successRate || 0.5;
  }

  /**
   * Получить country-based success rate
   */
  getCountrySuccessRate(methodName, country) {
    const key = `${methodName}_${country}`;
    const stats = this.countryStats.get(key);
    return stats?.successRate || 0.5;
  }

  /**
   * Обновление паттернов на основе истории (с ограничением размера)
   */
  updatePatterns(entry) {
    const { hour, day, results } = entry;
    const ipInfo = globalIPManager.getInfo();
    const country = ipInfo.current?.countryCode || 'UNKNOWN';

    for (const [methodName, result] of Object.entries(results)) {
      // Обновляем почасовой паттерн
      const hourKey = `${methodName}_${hour}`;
      const hourPattern = this.hourlyPatterns.get(hourKey) || { total: 0, success: 0, successRate: 0.5 };
      hourPattern.total++;
      if (result.success) {hourPattern.success++;}
      hourPattern.successRate = hourPattern.success / hourPattern.total;
      this.hourlyPatterns.set(hourKey, hourPattern);

      // Обновляем дневной паттерн
      const dayKey = `${methodName}_${day}`;
      const dayPattern = this.dailyPatterns.get(dayKey) || { total: 0, success: 0, successRate: 0.5 };
      dayPattern.total++;
      if (result.success) {dayPattern.success++;}
      dayPattern.successRate = dayPattern.success / dayPattern.total;
      this.dailyPatterns.set(dayKey, dayPattern);

      // Обновляем country-based статистику
      const countryKey = `${methodName}_${country}`;
      const countryStat = this.countryStats.get(countryKey) || { total: 0, success: 0, successRate: 0.5 };
      countryStat.total++;
      if (result.success) {countryStat.success++;}
      countryStat.successRate = countryStat.success / countryStat.total;
      this.countryStats.set(countryKey, countryStat);
    }

    // Очистка старых записей
    this._cleanupPatterns();
    this._cleanupHistory();
  }

  /**
   * Получить лучший метод
   */
  getBestMethod() {
    let best = 'direct';
    let bestWeight = this.methods.direct.weight;

    for (const [key, method] of Object.entries(this.methods)) {
      if (method.weight > bestWeight) {
        best = key;
        bestWeight = method.weight;
      }
    }

    return bestWeight > 0 ? best : 'direct';
  }

  /**
   * Получить все методы с весами
   */
  getMethods() {
    const result = {};
    for (const [key, method] of Object.entries(this.methods)) {
      result[key] = {
        name: method.name,
        weight: method.weight,
        available: method.available,
        avgResponseTime: method.avgResponseTime,
        successRate: method.successRate,
        consecutiveFails: method.consecutiveFails,
        lastSuccess: method.lastSuccess,
        lastFail: method.lastFail
      };
    }
    return result;
  }

  /**
   * Предсказать лучший метод (ML prediction)
   */
  predictBestMethod(hoursAhead = 0) {
    const targetHour = (new Date().getHours() + hoursAhead) % 24;
    const day = new Date().getDay();
    const ipInfo = globalIPManager.getInfo();
    const country = ipInfo.current?.countryCode || 'UNKNOWN';

    const predictions = {};

    for (const methodName of Object.keys(this.methods)) {
      const hourlySuccess = this.getHourlySuccessRate(methodName, targetHour);
      const dailySuccess = this.getDailySuccessRate(methodName, day);
      const countrySuccess = this.getCountrySuccessRate(methodName, country);

      predictions[methodName] = {
        predictedSuccess: (hourlySuccess + dailySuccess + countrySuccess) / 3,
        confidence: Math.min(hourlySuccess, dailySuccess, countrySuccess)
      };
    }

    // Сортируем по предсказанному success rate
    const sorted = Object.entries(predictions)
      .sort((a, b) => b[1].predictedSuccess - a[1].predictedSuccess);

    return {
      bestMethod: sorted[0][0],
      prediction: sorted[0][1],
      allPredictions: predictions
    };
  }

  /**
   * Генерация рекомендаций
   */
  generateRecommendations(results) {
    this.recommendations = [];

    // Если прямое подключение не работает
    if (!results.direct?.success) {
      // Проверяем причину
      if (results.direct?.hasLeaks) {
        this.recommendations.push({
          type: 'leak',
          priority: 'critical',
          title: 'Обнаружены утечки данных',
          description: 'Прямое подключение раскрывает ваш реальный IP',
          action: 'fix_leaks'
        });
      }

      if (results.proxy?.success) {
        this.recommendations.push({
          type: 'proxy',
          priority: 'high',
          title: 'Рекомендуется использовать прокси',
          description: 'Прямое подключение заблокировано',
          action: 'enable_proxy'
        });
      }

      if (results.doh?.success) {
        this.recommendations.push({
          type: 'doh',
          priority: 'medium',
          title: 'Включите DNS over HTTPS',
          description: 'DoH поможет обойти DNS блокировки',
          action: 'enable_doh'
        });
      }

      if (results.amnezia?.installed && !results.amnezia?.connected) {
        this.recommendations.push({
          type: 'amnezia',
          priority: 'high',
          title: 'Подключите AmneziaVPN',
          description: 'AmneziaVPN установлена, но не активна',
          action: 'connect_amnezia'
        });
      }
    }

    // Проверка страны
    const ipInfo = globalIPManager.getInfo();
    if (ipInfo.current?.countryCode) {
      const restricted = ['RU', 'BY', 'CN', 'IR', 'KP'];
      if (restricted.includes(ipInfo.current.countryCode)) {
        this.recommendations.push({
          type: 'geo',
          priority: 'high',
          title: `Ваша страна (${ipInfo.current.country}) в списке ограничений`,
          description: 'Рекомендуется использовать прокси другой страны',
          action: 'change_geo'
        });
      }
    }

    // Рекомендации по VPN
    if (!results.vpn?.available && !results.amnezia?.available) {
      this.recommendations.push({
        type: 'vpn',
        priority: 'medium',
        title: 'Рекомендуется использовать VPN',
        description: 'VPN обеспечит стабильный доступ к Cursor',
        action: 'setup_vpn'
      });
    }
  }

  /**
   * Получить рекомендации
   */
  getRecommendations() {
    return this.recommendations;
  }

  /**
   * Применить лучший метод автоматически
   */
  async applyBestMethod() {
    const best = this.getBestMethod();
    logger.info(`Applying best method: ${best}`, 'smart-bypass');

    switch (best) {
      case 'proxy':
        return this.applyProxy();
      case 'doh':
        return this.applyDoH();
      case 'dns':
        return this.applyDNS();
      case 'vpn':
        return this.applyVPN();
      case 'amnezia':
        return this.applyAmnezia();
      default:
        return { success: true, method: 'direct' };
    }
  }

  /**
   * Применить прокси
   */
  async applyProxy() {
    try {
      const proxy = globalProxyManager.getBestProxy();
      if (proxy) {
        globalProxyManager.rotateProxy();
        logger.info(`Proxy applied: ${proxy.url}`, 'smart-bypass');
        return { success: true, method: 'proxy', proxy: proxy.url };
      }
      return { success: false, error: 'No working proxies' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить DoH
   */
  async applyDoH() {
    try {
      const providers = await globalDoHManager.getAvailableProviders();
      const available = providers.find(p => p.available);

      if (available) {
        globalDoHManager.setProvider(available.key);
        logger.info(`DoH applied: ${available.name}`, 'smart-bypass');
        return { success: true, method: 'doh', provider: available.key };
      }
      return { success: false, error: 'No available DoH providers' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить DNS
   */
  async applyDNS() {
    try {
      const success = await globalDNSManager.setDNS('cloudflare');
      if (success) {
        await globalDNSManager.flushDNSCache();
        logger.info('DNS applied: Cloudflare', 'smart-bypass');
        return { success: true, method: 'dns', provider: 'cloudflare' };
      }
      return { success: false, error: 'Failed to set DNS' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить VPN рекомендации
   */
  async applyVPN() {
    try {
      const status = await globalVPNManager.detectActiveVPN();
      if (status.detected) {
        return { success: true, method: 'vpn', type: status.type };
      }
      return {
        success: false,
        error: 'VPN not connected',
        recommendations: globalVPNManager.getAmneziaRecommendations()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить AmneziaVPN
   */
  async applyAmnezia() {
    try {
      const status = await globalVPNManager.getAmneziaStatus();
      if (status.connected) {
        return { success: true, method: 'amnezia', protocol: status.protocol };
      }
      return {
        success: false,
        error: 'AmneziaVPN not connected',
        recommendations: globalVPNManager.getAmneziaRecommendations()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      lastTest: this.lastTest,
      bestMethod: this.getBestMethod(),
      methods: this.getMethods(),
      recommendations: this.getRecommendations(),
      mlPrediction: this.predictBestMethod(),
      historySize: this.testHistory.length
    };
  }

  /**
   * Запустить автоматическое тестирование
   */
  startAutoTest(intervalMs = 60000) {
    this.stopAutoTest();

    this.autoTestInterval = setInterval(async () => {
      try {
        await this.testAllMethods();
      } catch (error) {
        logger.error(`Auto-test failed: ${error.message}`, 'smart-bypass');
      }
    }, intervalMs);

    // Разрешаем процессу завершиться даже с активным интервалом
    if (this.autoTestInterval && typeof this.autoTestInterval.unref === 'function') {
      this.autoTestInterval.unref();
    }

    logger.info(`Auto-test started with interval ${intervalMs}ms`, 'smart-bypass');
  }

  /**
   * Остановить автоматическое тестирование
   */
  stopAutoTest() {
    if (this.autoTestInterval) {
      clearInterval(this.autoTestInterval);
      this.autoTestInterval = null;
      logger.info('Auto-test stopped', 'smart-bypass');
    }
  }

  /**
   * Экспорт ML модели для анализа
   */
  exportMLModel() {
    return {
      weights: this.mlModel.weights,
      hourlyPatterns: Object.fromEntries(this.hourlyPatterns),
      dailyPatterns: Object.fromEntries(this.dailyPatterns),
      countryStats: Object.fromEntries(this.countryStats),
      historySize: this.testHistory.length
    };
  }

  /**
   * Импорт ML модели
   */
  importMLModel(data) {
    if (data.weights) {
      this.mlModel.weights = { ...this.mlModel.weights, ...data.weights };
    }
    if (data.hourlyPatterns) {
      this.hourlyPatterns = new Map(Object.entries(data.hourlyPatterns));
    }
    if (data.dailyPatterns) {
      this.dailyPatterns = new Map(Object.entries(data.dailyPatterns));
    }
    if (data.countryStats) {
      this.countryStats = new Map(Object.entries(data.countryStats));
    }
    logger.info('ML model imported', 'smart-bypass');
  }
}

// Singleton
export const globalSmartBypassManager = new SmartBypassManager();
export default SmartBypassManager;
