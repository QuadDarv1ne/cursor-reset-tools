/**
 * Email Manager - Временные email для регистрации аккаунтов
 * Поддержка различных временных email сервисов
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { globalProxyManager } from './proxyManager.js';

/**
 * Конфигурация email сервисов
 */
export const EMAIL_SERVICES = {
  sazumi: {
    name: 'Sazumi Cloud Mail',
    baseUrl: 'https://mail.sazumi.com',
    api: {
      create: '/api/v1/mailbox',
      messages: '/api/v1/mailbox/{address}/messages',
      message: '/api/v1/mailbox/{address}/messages/{id}'
    },
    timeout: 30000,
    refreshInterval: 3000
  },
  guerrillamail: {
    name: 'Guerrilla Mail',
    baseUrl: 'https://api.guerrillamail.com/ajax.php',
    api: {
      create: '?f=get_email_address',
      messages: '?f=check_email',
      message: '?f=fetch_email&id={id}'
    },
    timeout: 30000,
    refreshInterval: 5000
  },
  tempmail: {
    name: 'Temp Mail',
    baseUrl: 'https://api.tempmail.lol',
    api: {
      create: '/generate',
      messages: '/messages?email={address}',
      message: '/message?id={id}'
    },
    timeout: 30000,
    refreshInterval: 3000
  },
  mailinator: {
    name: 'Mailinator',
    baseUrl: 'https://api.mailinator.com/api',
    api: {
      messages: '/v2/domains/public/inboxes/{address}',
      message: '/v2/domains/public/inboxes/{address}/emails/{id}'
    },
    timeout: 30000,
    refreshInterval: 5000,
    requiresToken: true
  }
};

/**
 * Класс для управления временными email
 */
export class EmailManager {
  constructor() {
    this.currentEmail = null;
    this.currentService = null;
    this.messages = [];
    this.messageListeners = new Map();
    this.pollingInterval = null;
    this.isPolling = false;
  }

  /**
   * Создание нового временного email
   * @param {string} serviceName - Название сервиса
   * @returns {Promise<Object>}
   */
  async createEmail(serviceName = 'guerrillamail') {
    const service = EMAIL_SERVICES[serviceName];
    
    if (!service) {
      logger.error(`Unknown email service: ${serviceName}`, 'email');
      return { success: false, error: 'Unknown service' };
    }

    const fetchFn = globalProxyManager.getFetch();

    try {
      let emailData;

      switch (serviceName) {
        case 'guerrillamail':
          emailData = await this._createGuerrillaMail(fetchFn, service);
          break;
        case 'tempmail':
          emailData = await this._createTempMail(fetchFn, service);
          break;
        case 'sazumi':
          emailData = await this._createSazumiMail(fetchFn, service);
          break;
        case 'mailinator':
          emailData = await this._createMailinator(fetchFn, service);
          break;
        default:
          emailData = await this._createGuerrillaMail(fetchFn, service);
      }

      if (emailData && emailData.email) {
        this.currentEmail = emailData.email;
        this.currentService = serviceName;
        
        logger.info(`Created temporary email: ${emailData.email}`, 'email');
        
        return {
          success: true,
          email: emailData.email,
          service: service.name,
          expires: emailData.expires || null,
          createdAt: Date.now()
        };
      }

      return { success: false, error: 'Failed to create email' };

    } catch (error) {
      logger.error(`Failed to create email: ${error.message}`, 'email');
      return { success: false, error: error.message };
    }
  }

  /**
   * Создание Guerrilla Mail
   * @private
   */
  async _createGuerrillaMail(fetchFn, service) {
    const response = await fetchFn(`${service.baseUrl}${service.api.create}`);
    const data = await response.json();
    
    return {
      email: data.email,
      sid: data.sid
    };
  }

  /**
   * Создание Temp Mail
   * @private
   */
  async _createTempMail(fetchFn, service) {
    const response = await fetchFn(`${service.baseUrl}${service.api.create}`);
    const data = await response.json();
    
    return {
      email: data.email,
      expires: data.expires_at
    };
  }

  /**
   * Создание Sazumi Mail
   * @private
   */
  async _createSazumiMail(fetchFn, service) {
    const response = await fetchFn(`${service.baseUrl}${service.api.create}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    return {
      email: data.address || data.email,
      expires: data.expires_at
    };
  }

  /**
   * Создание Mailinator (публичный инбокс)
   * @private
   */
  async _createMailinator(fetchFn, service) {
    // Mailinator использует публичные инбоксы, просто генерируем имя
    const randomName = Math.random().toString(36).substring(2, 12);
    const email = `${randomName}@mailinator.com`;
    
    return { email };
  }

  /**
   * Получение списка сообщений
   * @returns {Promise<Array>}
   */
  async getMessages() {
    if (!this.currentEmail || !this.currentService) {
      logger.warn('No active email session', 'email');
      return [];
    }

    const service = EMAIL_SERVICES[this.currentService];
    const fetchFn = globalProxyManager.getFetch();

    try {
      let messages = [];

      switch (this.currentService) {
        case 'guerrillamail':
          messages = await this._getGuerrillaMessages(fetchFn, service);
          break;
        case 'tempmail':
          messages = await this._getTempMailMessages(fetchFn, service);
          break;
        case 'sazumi':
          messages = await this._getSazumiMessages(fetchFn, service);
          break;
        case 'mailinator':
          messages = await this._getMailinatorMessages(fetchFn, service);
          break;
      }

      this.messages = messages;
      return messages;

    } catch (error) {
      logger.error(`Failed to get messages: ${error.message}`, 'email');
      return [];
    }
  }

  /**
   * Получение сообщений Guerrilla Mail
   * @private
   */
  async _getGuerrillaMessages(fetchFn, service) {
    const response = await fetchFn(`${service.baseUrl}${service.api.messages}`);
    const data = await response.json();
    
    return (data.list || []).map(msg => ({
      id: msg.mail_id,
      from: msg.mail_from,
      subject: msg.mail_subject,
      date: msg.mail_timestamp,
      preview: msg.mail_excerpt,
      isRead: msg.mail_read === 1
    }));
  }

  /**
   * Получение сообщений Temp Mail
   * @private
   */
  async _getTempMailMessages(fetchFn, service) {
    const url = service.api.messages.replace('{address}', encodeURIComponent(this.currentEmail));
    const response = await fetchFn(`${service.baseUrl}${url}`);
    const data = await response.json();
    
    return (data.messages || []).map(msg => ({
      id: msg.id,
      from: msg.from,
      subject: msg.subject,
      date: msg.created_at,
      isRead: msg.seen
    }));
  }

  /**
   * Получение сообщений Sazumi Mail
   * @private
   */
  async _getSazumiMessages(fetchFn, service) {
    const url = service.api.messages.replace('{address}', encodeURIComponent(this.currentEmail));
    const response = await fetchFn(`${service.baseUrl}${url}`);
    const data = await response.json();
    
    return (data.messages || []).map(msg => ({
      id: msg.id,
      from: msg.from,
      subject: msg.subject,
      date: msg.date,
      isRead: msg.read
    }));
  }

  /**
   * Получение сообщений Mailinator
   * @private
   */
  async _getMailinatorMessages(fetchFn, service) {
    const url = service.api.messages.replace('{address}', this.currentEmail);
    const response = await fetchFn(`${service.baseUrl}${url}`);
    const data = await response.json();
    
    return (data.emails || []).map(msg => ({
      id: msg.id,
      from: msg.from,
      subject: msg.subject,
      date: msg.time,
      isRead: false
    }));
  }

  /**
   * Получение полного сообщения
   * @param {string} messageId - ID сообщения
   * @returns {Promise<Object>}
   */
  async getMessage(messageId) {
    if (!this.currentEmail || !this.currentService) {
      logger.warn('No active email session', 'email');
      return null;
    }

    const service = EMAIL_SERVICES[this.currentService];
    const fetchFn = globalProxyManager.getFetch();

    try {
      let url;

      switch (this.currentService) {
        case 'guerrillamail':
          url = `${service.baseUrl}${service.api.message.replace('{id}', messageId)}`;
          break;
        case 'tempmail':
          url = `${service.baseUrl}${service.api.message.replace('{id}', messageId)}`;
          break;
        case 'sazumi':
          url = `${service.baseUrl}${service.api.message.replace('{address}', encodeURIComponent(this.currentEmail)).replace('{id}', messageId)}`;
          break;
        case 'mailinator':
          url = `${service.baseUrl}${service.api.message.replace('{address}', this.currentEmail).replace('{id}', messageId)}`;
          break;
      }

      const response = await fetchFn(url);
      const data = await response.json();

      return {
        id: data.id || messageId,
        from: data.from || data.sender,
        to: data.to || this.currentEmail,
        subject: data.subject,
        body: data.body || data.content || data.message,
        html: data.html || data.body_html,
        date: data.date || data.created_at || data.time,
        attachments: data.attachments || []
      };

    } catch (error) {
      logger.error(`Failed to get message: ${error.message}`, 'email');
      return null;
    }
  }

  /**
   * Ожидание сообщения с фильтром
   * @param {Object} options - Опции
   * @returns {Promise<Object|null>}
   */
  async waitForMessage(options = {}) {
    const {
      subjectContains,
      fromContains,
      timeout = 60000,
      pollInterval = 3000
    } = options;

    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkMessages = async () => {
        if (Date.now() - startTime > timeout) {
          logger.warn('Message wait timeout', 'email');
          resolve(null);
          return;
        }

        const messages = await this.getMessages();
        
        for (const msg of messages) {
          const matchesSubject = !subjectContains || msg.subject?.toLowerCase().includes(subjectContains.toLowerCase());
          const matchesFrom = !fromContains || msg.from?.toLowerCase().includes(fromContains.toLowerCase());

          if (matchesSubject && matchesFrom) {
            const fullMessage = await this.getMessage(msg.id);
            logger.info(`Message received: ${msg.subject}`, 'email');
            resolve(fullMessage);
            return;
          }
        }

        setTimeout(checkMessages, pollInterval);
      };

      checkMessages();
    });
  }

  /**
   * Извлечение кода подтверждения из письма
   * @param {string} body - Тело письма
   * @returns {string|null}
   */
  extractVerificationCode(body) {
    if (!body) return null;

    // Паттерны для кодов подтверждения
    const patterns = [
      /\b\d{6}\b/, // 6 цифр
      /\b[A-Z0-9]{6}\b/, // 6 символов
      /code[:\s]+([A-Z0-9]{4,8})/i, // "code: XXXXXX"
      /verification code[:\s]+([A-Z0-9]{4,8})/i,
      /Your code is ([A-Z0-9]{4,8})/i,
      /([A-Z0-9]{4,8}) is your verification/i
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Извлечение ссылки подтверждения из письма
   * @param {string} body - Тело письма
   * @returns {string|null}
   */
  extractVerificationLink(body) {
    if (!body) return null;

    const linkPattern = /(https?:\/\/[^\s"'<>]+(?:verify|confirm|activate|token)[^\s"'<>]*)/i;
    const match = body.match(linkPattern);
    
    if (match) {
      return match[1];
    }

    // Альтернативный паттерн для кнопок
    const buttonPattern = /href=["'](https?:\/\/[^"']+)["']/gi;
    let m;
    const links = [];
    
    while ((m = buttonPattern.exec(body)) !== null) {
      links.push(m[1]);
    }

    // Возвращаем первую ссылку содержащую ключевые слова
    for (const link of links) {
      if (/verify|confirm|activate|token/i.test(link)) {
        return link;
      }
    }

    return null;
  }

  /**
   * Автоматическая регистрация для Cursor
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async registerForCursor(options = {}) {
    const {
      serviceName = 'guerrillamail',
      waitForEmail = true,
      timeout = 120000
    } = options;

    const result = {
      email: null,
      verificationCode: null,
      verificationLink: null,
      message: null,
      success: false
    };

    // Создание email
    const createResult = await this.createEmail(serviceName);
    if (!createResult.success) {
      return result;
    }

    result.email = createResult.email;

    if (waitForEmail) {
      // Ожидание письма от Cursor
      const message = await this.waitForMessage({
        subjectContains: 'cursor',
        timeout,
        pollInterval: 3000
      });

      if (message) {
        result.message = message;
        result.verificationCode = this.extractVerificationCode(message.body);
        result.verificationLink = this.extractVerificationLink(message.body);
        result.success = !!(result.verificationCode || result.verificationLink);
      }
    }

    return result;
  }

  /**
   * Старт автоматического polling сообщений
   * @param {Function} callback - Callback при новом сообщении
   */
  startPolling(callback) {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    let lastMessageCount = 0;

    const poll = async () => {
      if (!this.isPolling) return;

      const messages = await this.getMessages();
      
      if (messages.length > lastMessageCount && callback) {
        const newMessages = messages.slice(lastMessageCount);
        for (const msg of newMessages) {
          callback(msg);
        }
      }
      
      lastMessageCount = messages.length;
    };

    poll(); // Первый запуск
    this.pollingInterval = setInterval(poll, 5000);
    
    logger.info('Email polling started', 'email');
  }

  /**
   * Остановка polling
   */
  stopPolling() {
    this.isPolling = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    logger.info('Email polling stopped', 'email');
  }

  /**
   * Сброс текущей сессии
   */
  reset() {
    this.stopPolling();
    this.currentEmail = null;
    this.currentService = null;
    this.messages = [];
    this.messageListeners.clear();
    logger.info('Email session reset', 'email');
  }

  /**
   * Получение информации о текущей сессии
   * @returns {Object}
   */
  getSessionInfo() {
    return {
      email: this.currentEmail,
      service: this.currentService,
      serviceName: this.currentService ? EMAIL_SERVICES[this.currentService]?.name : null,
      messageCount: this.messages.length,
      isPolling: this.isPolling
    };
  }

  /**
   * Получение списка доступных сервисов
   * @returns {Object}
   */
  getAvailableServices() {
    return Object.entries(EMAIL_SERVICES).reduce((acc, [key, value]) => {
      acc[key] = {
        name: value.name,
        baseUrl: value.baseUrl,
        requiresToken: value.requiresToken || false
      };
      return acc;
    }, {});
  }
}

// Глобальный экземпляр
export const globalEmailManager = new EmailManager();

export default EmailManager;
