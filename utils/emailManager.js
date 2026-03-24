/**
 * Email Manager - Временная почта для регистрации
 * Поддержка Guerrilla Mail, Temp Mail, Mailinator
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { logger } from './logger.js';

const EMAIL_SERVICES = {
  guerrillamail: {
    name: 'Guerrilla Mail',
    baseUrl: 'https://api.guerrillamail.com/ajax.php',
    createUrl: (email) => `https://api.guerrillamail.com/ajax.php?f=get_email_address&email_id=${email}`,
    inboxUrl: 'https://api.guerrillamail.com/ajax.php?f=get_messages'
  },
  mailinator: {
    name: 'Mailinator',
    baseUrl: 'https://api.mailinator.com/api/v2',
    inboxUrl: (domain, user) => `https://api.mailinator.com/api/v2/domains/${domain}/inboxes/${user}`
  },
  '1secmail': {
    name: '1SecMail',
    baseUrl: 'https://www.1secmail.com/api/v1',
    generateUrl: 'https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1',
    inboxUrl: (login, domain) => `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`
  }
};

class EmailManager {
  constructor() {
    this.currentEmail = null;
    this.service = null;
    this.createdAt = null;
    this.messages = [];
    this.sessionTimeout = 3600000; // 1 час
  }

  /**
   * Создать временный email
   */
  async createEmail(service = '1secmail') {
    try {
      this.service = service;
      const serviceConfig = EMAIL_SERVICES[service];

      if (!serviceConfig) {
        throw new Error(`Unknown email service: ${service}`);
      }

      let email;

      switch (service) {
        case '1secmail':
          email = await this._create1SecMail();
          break;
        case 'mailinator':
          email = await this._createMailinator();
          break;
        case 'guerrillamail':
          email = await this._createGuerrillaMail();
          break;
        default:
          email = await this._create1SecMail();
      }

      this.currentEmail = email;
      this.createdAt = Date.now();
      this.messages = [];

      logger.info(`Email created: ${email} (${service})`, 'email');
      return { email, service };
    } catch (error) {
      logger.error(`Email creation failed: ${error.message}`, 'email');
      throw error;
    }
  }

  /**
   * Создать email через 1SecMail
   */
  async _create1SecMail() {
    try {
      const response = await fetch(EMAIL_SERVICES['1secmail'].generateUrl);
      const emails = await response.json();
      return emails[0];
    } catch (error) {
      // Fallback: генерация случайного email
      const login = crypto.randomBytes(8).toString('hex');
      const domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      return `${login}@${domain}`;
    }
  }

  /**
   * Создать email через Mailinator
   */
  async _createMailinator() {
    const user = crypto.randomBytes(6).toString('hex');
    const domains = ['mailinator.com', 'mailinator.net', 'mailinator.org'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${user}@${domain}`;
  }

  /**
   * Создать email через Guerrilla Mail
   */
  async _createGuerrillaMail() {
    const randomId = crypto.randomBytes(8).toString('hex');
    const domains = ['sharklasers.com', 'grr.la', 'guerrillamail.biz'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${randomId}@${domain}`;
  }

  /**
   * Проверить входящие сообщения
   */
  async checkMessages() {
    if (!this.currentEmail) {
      logger.warn('No active email session', 'email');
      return [];
    }

    try {
      let messages = [];

      switch (this.service) {
        case '1secmail':
          messages = await this._check1SecMail();
          break;
        case 'mailinator':
          messages = await this._checkMailinator();
          break;
        case 'guerrillamail':
          messages = await this._checkGuerrillaMail();
          break;
      }

      // Фильтрация новых сообщений
      const newMessages = messages.filter(m =>
        !this.messages.find(existing => existing.id === m.id)
      );

      this.messages = messages;

      if (newMessages.length > 0) {
        logger.info(`Received ${newMessages.length} new message(s)`, 'email');
      }

      return newMessages;
    } catch (error) {
      logger.error(`Message check failed: ${error.message}`, 'email');
      return [];
    }
  }

  /**
   * Проверить 1SecMail
   */
  async _check1SecMail() {
    const [login, domain] = this.currentEmail.split('@');
    const url = EMAIL_SERVICES['1secmail'].inboxUrl(login, domain);

    const response = await fetch(url);
    const messages = await response.json();

    return messages.map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      date: m.date,
      preview: m.subject
    }));
  }

  /**
   * Проверить Mailinator
   */
  async _checkMailinator() {
    const [user, domain] = this.currentEmail.split('@');
    const url = EMAIL_SERVICES.mailinator.inboxUrl(domain, user);

    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.messages?.map(m => ({
        id: m.id,
        from: m.from || 'Unknown',
        subject: m.subject,
        date: new Date(m.time * 1000).toISOString(),
        preview: m.subject
      })) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Проверить Guerrilla Mail
   */
  async _checkGuerrillaMail() {
    try {
      const url = `${EMAIL_SERVICES.guerrillamail.inboxUrl}&seq=1`;
      const response = await fetch(url);
      const data = await response.json();
      return data.list?.map(m => ({
        id: m.mail_id,
        from: m.mail_from,
        subject: m.mail_subject,
        date: new Date(m.mail_timestamp * 1000).toISOString(),
        preview: m.mail_excerpt
      })) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Получить содержимое сообщения
   */
  async getMessageContent(messageId) {
    if (!this.currentEmail || !this.service) {
      return null;
    }

    try {
      if (this.service === '1secmail') {
        const [login, domain] = this.currentEmail.split('@');
        const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`;
        const response = await fetch(url);
        return await response.json();
      }
    } catch (error) {
      logger.error(`Failed to get message content: ${error.message}`, 'email');
    }

    return null;
  }

  /**
   * Ждать письмо от Cursor
   */
  async waitForCursorEmail(timeout = 120000) {
    const startTime = Date.now();
    const checkInterval = 3000;

    logger.info('Waiting for Cursor email...', 'email');

    while (Date.now() - startTime < timeout) {
      const newMessages = await this.checkMessages();

      for (const msg of newMessages) {
        const from = (msg.from || '').toLowerCase();
        const subject = (msg.subject || '').toLowerCase();

        if (from.includes('cursor') || subject.includes('cursor') || subject.includes('verification')) {
          logger.info(`Cursor email received: ${msg.subject}`, 'email');

          // Попытка извлечь код подтверждения
          const content = await this.getMessageContent(msg.id);
          const code = this._extractVerificationCode(content?.body || msg.preview || msg.subject);

          return {
            success: true,
            message: msg,
            code,
            content
          };
        }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn('Timeout waiting for Cursor email', 'email');
    return { success: false, error: 'Timeout' };
  }

  /**
   * Извлечь код подтверждения из текста
   */
  _extractVerificationCode(text) {
    // Паттерны для кодов подтверждения
    const patterns = [
      /\b\d{6}\b/, // 6 цифр
      /[A-Z0-9]{6,8}/, // 6-8 символов
      /code[:\s]+([A-Z0-9]+)/i,
      /verification[:\s]+([A-Z0-9]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Получить текущую сессию
   */
  getSession() {
    return {
      email: this.currentEmail,
      service: this.service,
      createdAt: this.createdAt,
      expiresAt: this.createdAt ? this.createdAt + this.sessionTimeout : null,
      messageCount: this.messages.length,
      isActive: this.currentEmail && (Date.now() - this.createdAt) < this.sessionTimeout
    };
  }

  /**
   * Очистить сессию
   */
  clear() {
    this.currentEmail = null;
    this.service = null;
    this.createdAt = null;
    this.messages = [];
    logger.info('Email session cleared', 'email');
  }
}

export const globalEmailManager = new EmailManager();
export default EmailManager;
