# Вклад в проект

Спасибо за интерес к улучшению Cursor Reset Tools! Этот документ поможет вам начать работу с проектом.

## 📋 Содержание

- [Начало работы](#начало-работы)
- [Структура проекта](#структура-проекта)
- [Разработка](#разработка)
- [Тестирование](#тестирование)
- [Правила кода](#правила-кода)
- [Commit сообщения](#commit-сообщения)
- [Pull Request](#pull-request)

## 🚀 Начало работы

### Требования

- Node.js >= 18.x
- npm >= 9.x
- Git

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/QuadDarv1ne/cursor-reset-tools.git
cd cursor-reset-tools

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
```

### Быстрый старт с Make

```bash
# Установка зависимостей
make install

# Запуск разработки
make dev

# Запуск тестов
make test
```

## 📁 Структура проекта

```
cursor-reset-tools/
├── app.js                 # Главный файл приложения
├── cli.js                 # CLI интерфейс
├── routes/                # API роуты
│   └── reset.js
├── utils/                 # Утилиты и менеджеры
│   ├── logger.js         # Логирование
│   ├── helpers.js        # Вспомогательные функции
│   ├── vpnManager.js     # VPN управление
│   └── ...
├── views/                 # EJS шаблоны
├── public/                # Статические файлы
├── test/                  # Тесты
├── scripts/               # Скрипты
├── logs/                  # Логи (игнорируются git)
├── data/                  # Данные (игнорируются git)
└── backups/              # Бэкапы (игнорируются git)
```

## 💻 Разработка

### Ветвление

- `main` - production версия
- `dev` - разработка
- `feature/*` - новые функции
- `bugfix/*` - исправления ошибок
- `hotfix/*` - срочные исправления

### Создание новой функции

```bash
# Создать ветку от dev
git checkout dev
git checkout -b feature/my-feature

# Внести изменения
# ...

# Закоммитить
git add .
git commit -m "feat: добавить новую функцию"

# Отправить
git push origin feature/my-feature
```

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage

# Конкретный тест
npm test -- test/helpers.test.js
```

### Написание тестов

```javascript
import { describe, it, expect } from '@jest/globals';

describe('MyModule', () => {
  it('должен делать что-то', async () => {
    const result = await myFunction();
    expect(result).toBe('expected');
  });
});
```

## 📝 Правила кода

### ESLint

```bash
# Проверка
npm run lint

# Исправление
npm run lint:fix
```

### Стиль кода

- Использовать single quotes для строк
- 2 пробела для индентации
- Максимальная длина строки: 150 символов
- Всегда использовать `;` в конце statements
- Arrow функции для callback'ов

### Именование

```javascript
// Переменные и функции - camelCase
const myVariable = 'value';
function myFunction() {}

// Классы - PascalCase
class MyClass {}

// Константы - UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Приватные поля - _prefix
this._privateField = null;

// Файлы - lowercase с дефисами
// my-module.js
```

## 📝 Commit сообщения

### Формат

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Типы

- `feat` - новая функция
- `fix` - исправление ошибки
- `docs` - документация
- `style` - форматирование
- `refactor` - рефакторинг
- `perf` - производительность
- `test` - тесты
- `chore` - обслуживание

### Примеры

```
feat(vpn): добавить поддержку WireGuard

fix(logger): исправить утечку памяти в rotate file

docs(readme): обновить инструкции по установке

refactor(helpers): упростить функцию withRetry

test(api): добавить тесты для /api/vpn/status
```

## 🔀 Pull Request

### Перед отправкой

- [ ] Код следует правилам проекта
- [ ] Все тесты проходят
- [ ] ESLint не выдаёт ошибок
- [ ] Документация обновлена
- [ ] CHANGELOG.md обновлён (если применимо)

### Процесс

1. Создать PR из вашей ветки в `dev`
2. Заполнить PR template
3. Дождаться code review
4. Исправить замечания
5. После approval - merge

### Шаблон PR

Используйте [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)

## 🐛 Сообщить об ошибке

1. Проверить существующие issues
2. Создать новый issue с template
3. Приложить логи и скриншоты

## 💡 Предложить функцию

1. Создать issue с меткой "enhancement"
2. Описать проблему и решение
3. Обсудить с maintainers

## 📞 Контакты

- **Автор:** QuadDarv1ne
- **Email:** [указать email]
- **Telegram:** [указать telegram]

## 🙏 Благодарности

Спасибо всем контрибьюторам за вклад в развитие проекта!

---

**Версия:** 2.7.0  
**Последнее обновление:** 26 марта 2026 г.
