/**
 * Validator - Валидация и санитизация входных данных
 * Защита от XSS, инъекций и некорректных данных
 *
 * @module utils/validator
 * @example
 * import { validateRequest, validateUrl } from './utils/validator.js';
 *
 * // Простая валидация
 * const result = validateUrl('https://example.com');
 * if (result.valid) {
 *   console.log('Valid URL:', result.value);
 * }
 *
 * // Валидация объекта
 * const validation = validateRequest(req.body, {
 *   email: { type: 'email', required: true }
 * });
 */

/**
 * Базовые паттерны для валидации
 * @typedef {Object} Patterns
 * @property {RegExp} url - URL pattern
 * @property {RegExp} ip - IP address pattern
 * @property {RegExp} domain - Domain name pattern
 * @property {RegExp} email - Email pattern
 * @property {RegExp} uuid - UUID pattern
 * @property {RegExp} hex - Hexadecimal pattern
 * @property {RegExp} base64 - Base64 pattern
 * @property {RegExp} path - File path pattern
 * @property {RegExp} alphanumeric - Alphanumeric pattern
 * @property {RegExp} alphanumericDash - Alphanumeric with dash pattern
 * @property {RegExp} safeString - Safe string pattern
 */

/**
 * Базовые паттерны для валидации
 * @type {Patterns}
 */
export const PATTERNS = {
  url: /^(https?|socks5?):\/\/[^\s/$.?#].[^\s]*$/i,
  ip: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-fA-F0-9:]+)$/,
  domain: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  hex: /^[0-9a-fA-F]+$/,
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  path: /^[a-zA-Z0-9\/\\._\-:]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericDash: /^[a-zA-Z0-9-]+$/,
  safeString: /^[a-zA-Z0-9\s._\-@]+$/
};

/**
 * Санитизация строки - удаление опасных символов
 * @param {string} str - Входная строка
 * @returns {string} Очищенная строка
 * @example
 * sanitizeString('<script>alert("xss")</script>'); // returns ""
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }

  // Удаляем HTML теги
  let sanitized = str.replace(/<[^>]*>/g, '');

  // Удаляем JavaScript протоколы
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');

  // Экранируем специальные символы
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized.trim();
}

/**
 * Санитизация для использования в путях
 * @param {string} path - Путь
 * @returns {string}
 */
export function sanitizePath(path) {
  if (typeof path !== 'string') {
    return '';
  }

  // Удаляем опасные символы
  let sanitized = path.replace(/[<>:"|?*]/g, '');

  // Предотвращаем traversal атаки
  sanitized = sanitized.replace(/\.\./g, '');

  // Нормализуем слеши
  sanitized = sanitized.replace(/\\/g, '/');

  return sanitized.trim();
}

/**
 * Валидация URL (прокси, HTTP)
 * @param {string} url - URL для проверки
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const sanitized = url.trim();

  if (sanitized.length > 2048) {
    return { valid: false, error: 'URL too long (max 2048 characters)' };
  }

  if (!PATTERNS.url.test(sanitized)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Проверка на localhost в production
  if (process.env.NODE_ENV === 'production') {
    const localhostPattern = /(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)/i;
    if (localhostPattern.test(sanitized)) {
      return { valid: false, error: 'Localhost URLs are not allowed in production' };
    }
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация IP адреса
 * @param {string} ip - IP адрес
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' };
  }

  const sanitized = ip.trim();

  if (!PATTERNS.ip.test(sanitized)) {
    return { valid: false, error: 'Invalid IP address format' };
  }

  // Проверка IPv4
  if (sanitized.includes('.')) {
    const parts = sanitized.split('.');
    if (parts.length !== 4) {
      return { valid: false, error: 'Invalid IPv4 format' };
    }

    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return { valid: false, error: 'IPv4 octet out of range (0-255)' };
      }
    }
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация доменного имени
 * @param {string} domain - Домен
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain is required' };
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length > 253) {
    return { valid: false, error: 'Domain too long (max 253 characters)' };
  }

  if (!PATTERNS.domain.test(sanitized)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация email
 * @param {string} email - Email
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const sanitized = email.trim().toLowerCase();

  if (sanitized.length > 254) {
    return { valid: false, error: 'Email too long (max 254 characters)' };
  }

  if (!PATTERNS.email.test(sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация UUID
 * @param {string} uuid - UUID
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'UUID is required' };
  }

  const sanitized = uuid.trim();

  if (!PATTERNS.uuid.test(sanitized)) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация числа в диапазоне
 * @param {number|string} value - Значение
 * @param {Object} options - Опции
 * @param {number} options.min - Минимум
 * @param {number} options.max - Максимум
 * @param {boolean} options.integer - Только целые числа
 * @returns {{ valid: boolean, error?: string, value?: number }}
 */
export function validateNumber(value, options = {}) {
  const { min = -Infinity, max = Infinity, integer = false } = options;

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: 'Must be an integer' };
  }

  if (num < min || num > max) {
    return { valid: false, error: `Number must be between ${min} and ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Валидация протокола прокси
 * @param {string} protocol - Протокол
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProxyProtocol(protocol) {
  if (!protocol || typeof protocol !== 'string') {
    return { valid: false, error: 'Protocol is required' };
  }

  const sanitized = protocol.trim().toLowerCase();
  const validProtocols = ['http', 'https', 'socks4', 'socks4a', 'socks5', 'socks5h'];

  if (!validProtocols.includes(sanitized)) {
    return {
      valid: false,
      error: `Invalid protocol. Must be one of: ${validProtocols.join(', ')}`
    };
  }

  return { valid: true, value: sanitized };
}

/**
 * Валидация объекта запроса
 * @param {Object} body - Тело запроса
 * @param {Object} schema - Схема валидации
 * @returns {{ valid: boolean, errors: Array<{field: string, error: string}>, data: Object }}
 */
export function validateRequest(body, schema) {
  const errors = [];
  const validatedData = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];

    // Проверка обязательности
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, error: rules.requiredMessage || `${field} is required` });
      continue;
    }

    // Пропускаем необязательные пустые поля
    if (!rules.required && (value === undefined || value === null || value === '')) {
      if (rules.default !== undefined) {
        validatedData[field] = rules.default;
      }
      continue;
    }

    // Валидация типа
    let validatedValue = value;

    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.sanitize) {
        validatedValue = rules.sanitize === 'path' ? sanitizePath(value) : sanitizeString(value);
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field, error: `${field} must be at least ${rules.minLength} characters` });
        continue;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field, error: `${field} must be at most ${rules.maxLength} characters` });
        continue;
      }
    } else if (rules.type === 'number') {
      const numResult = validateNumber(value, {
        min: rules.min,
        max: rules.max,
        integer: rules.integer
      });
      if (!numResult.valid) {
        errors.push({ field, error: numResult.error });
        continue;
      }
      validatedValue = numResult.value;
    } else if (rules.type === 'boolean') {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        errors.push({ field, error: `${field} must be a boolean` });
        continue;
      }
      validatedValue = value === true || value === 'true';
    } else if (rules.type === 'url') {
      const urlResult = validateUrl(value);
      if (!urlResult.valid) {
        errors.push({ field, error: urlResult.error });
        continue;
      }
      validatedValue = urlResult.value;
    } else if (rules.type === 'email') {
      const emailResult = validateEmail(value);
      if (!emailResult.valid) {
        errors.push({ field, error: emailResult.error });
        continue;
      }
      validatedValue = emailResult.value;
    } else if (rules.type === 'domain') {
      const domainResult = validateDomain(value);
      if (!domainResult.valid) {
        errors.push({ field, error: domainResult.error });
        continue;
      }
      validatedValue = domainResult.value;
    } else if (rules.type === 'uuid') {
      const uuidResult = validateUuid(value);
      if (!uuidResult.valid) {
        errors.push({ field, error: uuidResult.error });
        continue;
      }
      validatedValue = uuidResult.value;
    } else if (rules.type === 'proxyProtocol') {
      const protocolResult = validateProxyProtocol(value);
      if (!protocolResult.valid) {
        errors.push({ field, error: protocolResult.error });
        continue;
      }
      validatedValue = protocolResult.value;
    } else if (rules.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push({ field, error: `${field} must be an array` });
        continue;
      }
      if (rules.items) {
        validatedValue = value.map((item, index) => {
          const itemValidation = validateRequest({ item }, { item: rules.items });
          if (!itemValidation.valid) {
            errors.push({ field, error: `${field}[${index}]: ${itemValidation.errors[0].error}` });
            return item;
          }
          return itemValidation.data.item;
        });
      }
    }

    // Кастомная валидация
    if (rules.validate && typeof rules.validate === 'function') {
      const customResult = rules.validate(validatedValue);
      if (!customResult.valid) {
        errors.push({ field, error: customResult.error });
        continue;
      }
    }

    validatedData[field] = validatedValue;
  }

  return {
    valid: errors.length === 0,
    errors,
    data: validatedData
  };
}

/**
 * Middleware для Express для валидации запросов
 * @param {Object} schema - Схема валидации
 * @returns {Function}
 */
export function validateMiddleware(schema) {
  return (req, res, next) => {
    const result = validateRequest(req.body, schema);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        errors: result.errors
      });
    }

    // Добавляем валидированные данные в запрос
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Экспорт для использования в Express
 */
export const validator = {
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
  validateMiddleware,
  PATTERNS
};

export default validator;
