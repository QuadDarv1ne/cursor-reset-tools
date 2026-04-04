/**
 * Cursor Registrar - Автоматическая регистрация аккаунтов Cursor
 * Полная автоматизация: email → регистрация → подтверждение → вход
 */

import { logger } from './logger.js';
import { globalEmailManager } from './emailManager.js';
import { globalProxyManager } from './proxyManager.js';

/**
 * Конфигурация Cursor API
 */
export const CURSOR_CONFIG = {
  baseUrl: 'https://api2.cursor.sh',
  authUrl: 'https://auth.cursor.com',
  wwwUrl: 'https://www.cursor.com',

  endpoints: {
    signup: '/aiserver.v1.AuthService/SignUp',
    signin: '/aiserver.v1.AuthService/SignIn',
    verify: '/aiserver.v1.AuthService/VerifyEmail',
    logout: '/aiserver.v1.AuthService/SignOut',
    user: '/aiserver.v1.UserService/GetUserProfile',
    subscription: '/aiserver.v1.SubscriptionService/GetSubscription'
  },

  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Cursor/0.49.0 (Windows NT 10.0; Win64; x64)',
    'Accept': '*/*'
  }
};

/**
 * Класс для регистрации Cursor
 */
export class CursorRegistrar {
  constructor() {
    this.currentSession = null;
    this.authToken = null;
    this.refreshToken = null;
  }

  /**
   * Регистрация нового аккаунта
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async register(options = {}) {
    const {
      emailService = 'guerrillamail',
      autoVerify = true,
      timeout = 120000
    } = options;

    const result = {
      success: false,
      email: null,
      verified: false,
      token: null,
      error: null
    };

    try {
      logger.info('Starting Cursor registration...', 'cursor');

      // Шаг 1: Создание временного email
      logger.info('Creating temporary email...', 'cursor');
      const emailResult = await globalEmailManager.createEmail(emailService);

      if (!emailResult.success) {
        throw new Error('Failed to create email');
      }

      result.email = emailResult.email;
      logger.info(`Email created: ${result.email}`, 'cursor');

      // Шаг 2: Отправка запроса на регистрацию
      logger.info('Sending signup request...', 'cursor');
      const signupResult = await this.sendSignup(result.email);

      if (!signupResult.success) {
        throw new Error(signupResult.error || 'Signup failed');
      }

      // Шаг 3: Ожидание письма с подтверждением
      if (autoVerify) {
        logger.info('Waiting for verification email...', 'cursor');
        const message = await globalEmailManager.waitForMessage({
          subjectContains: 'cursor',
          timeout
        });

        if (!message) {
          throw new Error('Verification email not received');
        }

        // Шаг 4: Извлечение кода/ссылки
        const code = globalEmailManager.extractVerificationCode(message.body);
        const link = globalEmailManager.extractVerificationLink(message.body);

        if (code) {
          logger.info(`Verification code found: ${code}`, 'cursor');
          const verifyResult = await this.verifyEmail(code, result.email);

          if (verifyResult.success) {
            result.verified = true;
            result.token = verifyResult.token;
            this.authToken = verifyResult.token;
          }
        } else if (link) {
          logger.info(`Verification link found: ${link}`, 'cursor');
          const verifyResult = await this.verifyWithLink(link);

          if (verifyResult.success) {
            result.verified = true;
            result.token = verifyResult.token;
            this.authToken = verifyResult.token;
          }
        } else {
          throw new Error('No verification code or link found');
        }
      }

      result.success = result.verified;
      logger.info(`Registration completed: ${result.success}`, 'cursor');

    } catch (error) {
      logger.error(`Registration error: ${error.message}`, 'cursor');
      result.error = error.message;
    }

    this.currentSession = result;
    return result;
  }

  /**
   * Отправка запроса на регистрацию
   * @param {string} email - Email
   * @returns {Promise<Object>}
   */
  async sendSignup(email) {
    try {
      const fetchFn = globalProxyManager.getFetch();

      const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.signup}`, {
        method: 'POST',
        headers: CURSOR_CONFIG.headers,
        body: JSON.stringify({
          email: email,
          signupMethod: 'email',
          clientVersion: '0.49.0'
        })
      });

      if (response.ok) {
        logger.info('Signup request sent successfully', 'cursor');
        return { success: true };
      }
      const error = await response.text();
      logger.warn(`Signup failed: ${error}`, 'cursor');
      return { success: false, error };

    } catch (error) {
      logger.error(`Signup error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Подтверждение email кодом
   * @param {string} code - Код подтверждения
   * @param {string} email - Email
   * @returns {Promise<Object>}
   */
  async verifyEmail(code, email) {
    try {
      const fetchFn = globalProxyManager.getFetch();

      const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.verify}`, {
        method: 'POST',
        headers: {
          ...CURSOR_CONFIG.headers,
          'Authorization': `Bearer ${this.authToken || ''}`
        },
        body: JSON.stringify({
          email: email,
          code: code,
          verificationType: 'signup'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.authToken || data.token || data.accessToken;

        logger.info('Email verified successfully', 'cursor');
        return { success: true, token };
      }
      const error = await response.text();
      logger.warn(`Verification failed: ${error}`, 'cursor');
      return { success: false, error };

    } catch (error) {
      logger.error(`Verification error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Подтверждение по ссылке
   * @param {string} link - Ссылка для подтверждения
   * @returns {Promise<Object>}
   */
  async verifyWithLink(link) {
    try {
      const fetchFn = globalProxyManager.getFetch();

      // Извлечение токена из ссылки
      const tokenMatch = link.match(/[?&]token=([^&]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (token) {
        // Отправка запроса с токеном
        const response = await fetchFn(link, {
          method: 'GET',
          headers: CURSOR_CONFIG.headers
        });

        if (response.ok) {
          logger.info('Link verification successful', 'cursor');
          return { success: true, token };
        }
      }

      return { success: false, error: 'Invalid verification link' };
    } catch (error) {
      logger.error(`Link verification error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Вход в аккаунт
   * @param {string} email - Email
   * @param {string} code - Код (если есть)
   * @returns {Promise<Object>}
   */
  async signIn(email, code = null) {
    try {
      const fetchFn = globalProxyManager.getFetch();

      // Шаг 1: Запрос кода входа
      if (!code) {
        const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.signin}`, {
          method: 'POST',
          headers: CURSOR_CONFIG.headers,
          body: JSON.stringify({
            email: email,
            signinMethod: 'email'
          })
        });

        if (response.ok) {
          logger.info('Signin code requested, check email', 'cursor');
          return { success: true, requiresCode: true };
        }
        return { success: false, error: 'Signin request failed' };

      }

      // Шаг 2: Вход с кодом
      const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.signin}`, {
        method: 'POST',
        headers: CURSOR_CONFIG.headers,
        body: JSON.stringify({
          email: email,
          code: code
        })
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.authToken || data.token;

        this.authToken = token;
        logger.info('Signin successful', 'cursor');
        return { success: true, token };
      }
      return { success: false, error: 'Signin failed' };

    } catch (error) {
      logger.error(`Signin error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение информации о пользователе
   * @returns {Promise<Object>}
   */
  async getUserProfile() {
    try {
      if (!this.authToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const fetchFn = globalProxyManager.getFetch();

      const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.user}`, {
        method: 'POST',
        headers: {
          ...CURSOR_CONFIG.headers,
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('User profile retrieved', 'cursor');
        return { success: true, ...data };
      }
      return { success: false, error: 'Failed to get profile' };

    } catch (error) {
      logger.error(`Profile error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверка статуса подписки
   * @returns {Promise<Object>}
   */
  async getSubscriptionStatus() {
    try {
      if (!this.authToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const fetchFn = globalProxyManager.getFetch();

      const response = await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.subscription}`, {
        method: 'POST',
        headers: {
          ...CURSOR_CONFIG.headers,
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        const tier = data.tier || data.plan || 'free';

        logger.info(`Subscription status: ${tier}`, 'cursor');
        return {
          success: true,
          tier,
          isPro: tier === 'pro',
          isTrial: data.isTrial || false
        };
      }
      return { success: false, error: 'Failed to get subscription' };

    } catch (error) {
      logger.error(`Subscription error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Выход из аккаунта
   * @returns {Promise<Object>}
   */
  async signOut() {
    try {
      if (!this.authToken) {
        return { success: true };
      }

      const fetchFn = globalProxyManager.getFetch();

      await fetchFn(`${CURSOR_CONFIG.baseUrl}${CURSOR_CONFIG.endpoints.logout}`, {
        method: 'POST',
        headers: {
          ...CURSOR_CONFIG.headers,
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({})
      });

      this.authToken = null;
      this.currentSession = null;
      logger.info('Signout successful', 'cursor');
      return { success: true };
    } catch (error) {
      logger.error(`Signout error: ${error.message}`, 'cursor');
      return { success: false, error: error.message };
    }
  }

  /**
   * Полная автоматическая регистрация с проверкой
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async autoRegister(options = {}) {
    const {
      emailService = 'guerrillamail',
      checkProStatus = true,
      timeout = 180000
    } = options;

    const result = {
      success: false,
      email: null,
      verified: false,
      isPro: false,
      token: null,
      error: null,
      steps: []
    };

    try {
      // Шаг 1: Регистрация
      result.steps.push('Creating email...');
      const registerResult = await this.register({
        emailService,
        timeout
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Registration failed');
      }

      result.email = registerResult.email;
      result.verified = registerResult.verified;
      result.token = registerResult.token;
      result.steps.push('Email verified ✓');

      // Шаг 2: Проверка статуса Pro
      if (checkProStatus) {
        result.steps.push('Checking Pro status...');
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 3000); // Пауза
          timer.unref();
        });

        const profileResult = await this.getUserProfile();
        if (profileResult.success) {
          result.userData = profileResult;
          result.steps.push('Profile loaded ✓');
        }

        const subscriptionResult = await this.getSubscriptionStatus();
        if (subscriptionResult.success) {
          result.isPro = subscriptionResult.isPro;
          result.isTrial = subscriptionResult.isTrial;
          result.steps.push(`Status: ${subscriptionResult.tier} ✓`);
        }
      }

      result.success = true;
      logger.info('Auto registration completed', 'cursor');

    } catch (error) {
      logger.error(`Auto registration error: ${error.message}`, 'cursor');
      result.error = error.message;
      result.steps.push(`Error: ${error.message}`);
    }

    return result;
  }

  /**
   * Получение текущей сессии
   * @returns {Object}
   */
  getSession() {
    return {
      email: this.currentSession?.email,
      verified: this.currentSession?.verified,
      authenticated: !!this.authToken,
      token: this.authToken
    };
  }

  /**
   * Установка токена
   * @param {string} token - Auth токен
   */
  setToken(token) {
    this.authToken = token;
    logger.info('Auth token set', 'cursor');
  }

  /**
   * Очистка сессии
   */
  clear() {
    this.authToken = null;
    this.refreshToken = null;
    this.currentSession = null;
    logger.info('Session cleared', 'cursor');
  }
}

// Глобальный экземпляр
export const globalCursorRegistrar = new CursorRegistrar();

export default CursorRegistrar;
