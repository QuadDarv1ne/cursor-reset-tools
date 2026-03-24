/**
 * Unit тесты для utils/validator.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  sanitizeString,
  sanitizePath,
  validateUrl,
  validateIp,
  validateDomain,
  validateEmail,
  validateUuid,
  validateNumber,
  validateProxyProtocol,
  validateRequest,
  PATTERNS
} from '../utils/validator.js';

describe('validator.js', () => {
  describe('PATTERNS', () => {
    it('должен содержать все необходимые паттерны', () => {
      expect(PATTERNS).toHaveProperty('url');
      expect(PATTERNS).toHaveProperty('ip');
      expect(PATTERNS).toHaveProperty('domain');
      expect(PATTERNS).toHaveProperty('email');
      expect(PATTERNS).toHaveProperty('uuid');
    });
  });

  describe('sanitizeString', () => {
    it('должен удалять HTML теги', () => {
      // Теги удаляются, содержимое остаётся
      expect(sanitizeString('<script>alert("xss")</script>')).toContain('alert');
      expect(sanitizeString('<div>Hello</div>')).toBe('Hello');
    });

    it('должен удалять JavaScript протоколы', () => {
      // Протокол удаляется, содержимое остаётся
      expect(sanitizeString('javascript:alert(1)')).not.toContain('javascript:');
      expect(sanitizeString('JAVASCRIPT:code')).not.toContain('javascript:');
    });

    it('должен экранировать специальные символы', () => {
      // < и > удаляются как теги, остальные экранируются
      expect(sanitizeString('>&"\'')).toBe('&gt;&amp;&quot;&#x27;');
    });

    it('должен обрезать пробелы', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    it('должен возвращать пустую строку для не-string', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('sanitizePath', () => {
    it('должен удалять опасные символы', () => {
      expect(sanitizePath('test<>.txt')).toBe('test.txt');
      expect(sanitizePath('file:name')).toBe('filename');
    });

    it('должен предотвращать traversal атаки', () => {
      expect(sanitizePath('../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('..\\..\\windows')).toBe('windows');
    });

    it('должен нормализовать слеши', () => {
      expect(sanitizePath('path\\to\\file')).toBe('path/to/file');
    });
  });

  describe('validateUrl', () => {
    it('должен принимать валидные HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('http://example.com');
    });

    it('должен принимать валидные HTTPS URL', () => {
      const result = validateUrl('https://example.com/path?query=1');
      expect(result.valid).toBe(true);
    });

    it('должен принимать валидные SOCKS URL', () => {
      const result = validateUrl('socks5://127.0.0.1:1080');
      expect(result.valid).toBe(true);
    });

    it('должен отклонять невалидные URL', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('ftp://example.com').valid).toBe(false);
    });

    it('должен отклонять пустые URL', () => {
      expect(validateUrl('').valid).toBe(false);
      expect(validateUrl(null).valid).toBe(false);
    });

    it('должен отклонять слишком длинные URL', () => {
      const longUrl = 'http://example.com/' + 'a'.repeat(2050);
      expect(validateUrl(longUrl).valid).toBe(false);
    });
  });

  describe('validateIp', () => {
    it('должен принимать валидные IPv4', () => {
      expect(validateIp('192.168.1.1').valid).toBe(true);
      expect(validateIp('0.0.0.0').valid).toBe(true);
      expect(validateIp('255.255.255.255').valid).toBe(true);
    });

    it('должен принимать валидные IPv6', () => {
      expect(validateIp('::1').valid).toBe(true);
      expect(validateIp('2001:db8::1').valid).toBe(true);
    });

    it('должен отклонять невалидные IPv4', () => {
      expect(validateIp('256.1.1.1').valid).toBe(false);
      expect(validateIp('1.1.1').valid).toBe(false);
      expect(validateIp('1.1.1.1.1').valid).toBe(false);
    });

    it('должен отклонять пустые IP', () => {
      expect(validateIp('').valid).toBe(false);
    });
  });

  describe('validateDomain', () => {
    it('должен принимать валидные домены', () => {
      expect(validateDomain('example.com').valid).toBe(true);
      expect(validateDomain('sub.example.co.uk').valid).toBe(true);
      expect(validateDomain('example-domain.org').valid).toBe(true);
    });

    it('должен приводить к нижнему регистру', () => {
      const result = validateDomain('EXAMPLE.COM');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('example.com');
    });

    it('должен отклонять невалидные домены', () => {
      expect(validateDomain('not_a_domain').valid).toBe(false);
      expect(validateDomain('.com').valid).toBe(false);
      expect(validateDomain('example.').valid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('должен принимать валидные email', () => {
      expect(validateEmail('test@example.com').valid).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk').valid).toBe(true);
    });

    it('должен приводить к нижнему регистру', () => {
      const result = validateEmail('TEST@EXAMPLE.COM');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('test@example.com');
    });

    it('должен отклонять невалидные email', () => {
      expect(validateEmail('not-an-email').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
      expect(validateEmail('test@').valid).toBe(false);
    });
  });

  describe('validateUuid', () => {
    it('должен принимать валидные UUID', () => {
      expect(validateUuid('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true);
      expect(validateUuid('123e4567-e89b-12d3-a456-426614174000').valid).toBe(true);
    });

    it('должен отклонять невалидные UUID', () => {
      expect(validateUuid('not-a-uuid').valid).toBe(false);
      expect(validateUuid('12345678').valid).toBe(false);
    });
  });

  describe('validateNumber', () => {
    it('должен принимать валидные числа', () => {
      const result = validateNumber(42);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('должен принимать строковые числа', () => {
      const result = validateNumber('42');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('должен проверять диапазон', () => {
      expect(validateNumber(5, { min: 0, max: 10 }).valid).toBe(true);
      expect(validateNumber(11, { min: 0, max: 10 }).valid).toBe(false);
      expect(validateNumber(-1, { min: 0, max: 10 }).valid).toBe(false);
    });

    it('должен проверять целые числа', () => {
      expect(validateNumber(5, { integer: true }).valid).toBe(true);
      expect(validateNumber(5.5, { integer: true }).valid).toBe(false);
    });
  });

  describe('validateProxyProtocol', () => {
    it('должен принимать валидные протоколы', () => {
      expect(validateProxyProtocol('http').valid).toBe(true);
      expect(validateProxyProtocol('https').valid).toBe(true);
      expect(validateProxyProtocol('socks5').valid).toBe(true);
      expect(validateProxyProtocol('socks4').valid).toBe(true);
    });

    it('должен приводить к нижнему регистру', () => {
      const result = validateProxyProtocol('SOCKS5');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('socks5');
    });

    it('должен отклонять невалидные протоколы', () => {
      expect(validateProxyProtocol('ftp').valid).toBe(false);
      expect(validateProxyProtocol('tcp').valid).toBe(false);
    });
  });

  describe('validateRequest', () => {
    it('должен валидировать простые поля', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0, max: 150 }
      };

      const result = validateRequest({ name: 'John', age: 30 }, schema);
      expect(result.valid).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.age).toBe(30);
    });

    it('должен отклонять отсутствующие обязательные поля', () => {
      const schema = {
        email: { type: 'email', required: true }
      };

      const result = validateRequest({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('email');
    });

    it('должен использовать значения по умолчанию', () => {
      const schema = {
        protocol: { type: 'proxyProtocol', default: 'socks5' }
      };

      const result = validateRequest({}, schema);
      expect(result.valid).toBe(true);
      expect(result.data.protocol).toBe('socks5');
    });

    it('должен валидировать URL', () => {
      const schema = {
        url: { type: 'url', required: true }
      };

      const result = validateRequest({ url: 'https://example.com' }, schema);
      expect(result.valid).toBe(true);

      const invalidResult = validateRequest({ url: 'not-a-url' }, schema);
      expect(invalidResult.valid).toBe(false);
    });

    it('должен валидировать boolean', () => {
      const schema = {
        enabled: { type: 'boolean' }
      };

      expect(validateRequest({ enabled: true }, schema).valid).toBe(true);
      expect(validateRequest({ enabled: 'true' }, schema).valid).toBe(true);
      expect(validateRequest({ enabled: 'false' }, schema).valid).toBe(true);
      expect(validateRequest({ enabled: 'invalid' }, schema).valid).toBe(false);
    });

    it('должен возвращать подробные ошибки', () => {
      const schema = {
        email: { type: 'email', required: true },
        age: { type: 'number', min: 18 }
      };

      const result = validateRequest({ email: 'invalid', age: 10 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('field');
      expect(result.errors[0]).toHaveProperty('error');
    });
  });
});
