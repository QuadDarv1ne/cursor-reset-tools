/**
 * Скрипт для проверки полноты i18n переводов
 * Сравнивает все языки с английским (эталонным)
 *
 * Использование:
 *   node scripts/check-i18n.js
 *   node scripts/check-i18n.js --verbose
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу переводов
const I18N_FILE = path.join(__dirname, '..', 'utils', 'i18n.js');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Логирование с цветом
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Загрузка модуля i18n
 */
async function loadTranslations() {
  try {
    const i18nModule = await import(`${I18N_FILE}?t=${Date.now()}`);
    return i18nModule.translations;
  } catch (error) {
    log(`❌ Error loading translations: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Получить все ключи из объекта (рекурсивно для плоской структуры)
 */
function getKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Получить вложенные ключи для объекта
 */
function getNestedKeys(obj, prefix = '') {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedKeys = getNestedKeys(value, key);
      for (const nk of nestedKeys) {
        keys.add(nk);
      }
    } else {
      keys.add(key);
    }
  }

  return keys;
}

/**
 * Проверка переводов
 */
async function checkTranslations(verbose = false) {
  log('🔍 Проверка полноты i18n переводов...\n', 'cyan');

  const translations = await loadTranslations();
  const languages = Object.keys(translations);

  if (languages.length === 0) {
    log('❌ Нет доступных переводов', 'red');
    return;
  }

  // Английский - эталонный язык
  const referenceLang = 'en';
  const referenceKeys = getNestedKeys(translations[referenceLang]);

  log(`📊 Эталонный язык: ${referenceLang.toUpperCase()} (${referenceKeys.size} ключей)\n`, 'blue');

  const report = {
    total: languages.length,
    languages: [],
    missingKeys: {},
    extraKeys: {},
    summary: {
      total: 0,
      missing: 0,
      complete: 0
    }
  };

  // Проверка каждого языка
  for (const lang of languages) {
    const langKeys = getNestedKeys(translations[lang]);
    const missing = new Set();
    const extra = new Set();

    // Поиск отсутствующих ключей
    for (const key of referenceKeys) {
      if (!langKeys.has(key)) {
        missing.add(key);
      }
    }

    // Поиск лишних ключей (только для не-эталонных языков)
    if (lang !== referenceLang) {
      for (const key of langKeys) {
        if (!referenceKeys.has(key)) {
          extra.add(key);
        }
      }
    }

    const completeness = referenceKeys.size > 0
      ? ((referenceKeys.size - missing.size) / referenceKeys.size * 100).toFixed(2)
      : 100;

    const langReport = {
      code: lang,
      totalKeys: langKeys.size,
      missing: missing.size,
      extra: extra.size,
      completeness: parseFloat(completeness),
      status: missing.size === 0 ? '✅' : '⚠️'
    };

    report.languages.push(langReport);
    report.summary.total += langKeys.size;
    report.summary.missing += missing.size;
    report.summary.complete += missing.size === 0 ? 1 : 0;

    if (missing.size > 0) {
      report.missingKeys[lang] = Array.from(missing);
    }

    if (extra.size > 0) {
      report.extraKeys[lang] = Array.from(extra);
    }

    // Вывод отчёта по языку
    log(`${langReport.status} ${lang.toUpperCase()}:`,
      missing.size === 0 ? 'green' : 'yellow');
    log(`   Ключей: ${langReport.totalKeys}`, 'reset');
    log(`   Полнота: ${completeness}%`, 'reset');

    if (missing.size > 0) {
      log(`   Отсутствует: ${missing.size}`, 'red');
      if (verbose) {
        log(`   Недостающие ключи:`, 'red');
        Array.from(missing).slice(0, 10).forEach(key => {
          log(`     - ${key}`, 'red');
        });
        if (missing.size > 10) {
          log(`     ... и ещё ${missing.size - 10}`, 'red');
        }
      }
    }

    if (extra.size > 0 && verbose) {
      log(`   Лишние ключи: ${extra.size}`, 'yellow');
      Array.from(extra).slice(0, 5).forEach(key => {
        log(`     + ${key}`, 'yellow');
      });
      if (extra.size > 5) {
        log(`     ... и ещё ${extra.size - 5}`, 'yellow');
      }
    }

    log('');
  }

  // Итоговый отчёт
  log('═'.repeat(50), 'cyan');
  log('📈 ИТОГОВЫЙ ОТЧЁТ', 'cyan');
  log('═'.repeat(50), 'cyan');

  const fullyComplete = report.summary.complete === report.total;
  log(`Языков: ${report.total}`, fullyComplete ? 'green' : 'reset');
  log(`Полностью завершены: ${report.summary.complete}/${report.total}`,
    fullyComplete ? 'green' : 'yellow');
  log(`Всего ключей: ${report.summary.total}`, 'reset');
  log(`Всего недостающих: ${report.summary.missing}`,
    report.summary.missing === 0 ? 'green' : 'red');

  if (!fullyComplete) {
    log('\n⚠️  Требуется внимание!', 'yellow');
    log('Следующие языки имеют недостающие ключи:', 'yellow');

    for (const [lang, keys] of Object.entries(report.missingKeys)) {
      log(`  - ${lang.toUpperCase()}: ${keys.length} недостающих ключей`, 'yellow');
    }

    log('\n💡 Запустите с флагом --verbose для подробного списка ключей', 'blue');
    process.exit(1);
  } else {
    log('\n✅ Все переводы полные!', 'green');
    process.exit(0);
  }
}

// Запуск
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
checkTranslations(verbose);
