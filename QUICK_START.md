# 🚀 Быстрый старт

## 1. Установка

### Вариант A: Локальная установка

```bash
# Клонирование
git clone https://github.com/QuadDarv1ne/cursor-reset-tools.git
cd cursor-reset-tools

# Установка зависимостей
npm install

# Запуск
npm start
```

### Вариант B: Docker

```bash
# Запуск с Docker Compose
docker-compose up --build
```

---

## 2. Настройка

### Создание .env файла

```bash
# Linux/macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env

# Windows (cmd)
copy .env.example .env
```

### Основные настройки

Откройте `.env` и настройте:

```bash
# Порт приложения
PORT=3000

# Уровень логирования
LOG_LEVEL=info

# Окружение
NODE_ENV=development
```

---

## 3. Запуск

### Разработка (с auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

### Docker

```bash
docker-compose up
```

---

## 4. Проверка

Откройте браузер:

```
http://localhost:3000
```

Health check:

```
http://localhost:3000/health
```

---

## 5. Команды

### Основные

```bash
make help           # Все команды
make install        # Установка зависимостей
make dev            # Разработка
make start          # Production
make test           # Тесты
make clean          # Очистка
```

### Логирование

```bash
make logs           # Просмотр логов
make logs-error     # Только ошибки
```

### Docker

```bash
make docker-build   # Сборка образа
make docker-run     # Запуск контейнера
make docker-dev     # Docker Compose
```

---

## 6. Тестирование

```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage

# Конкретный файл
npm test -- test/helpers.test.js
```

---

## 7. Внесение изменений

### Создание ветки

```bash
git checkout -b feature/my-feature
```

### Коммит

```bash
git add .
git commit -m "feat: добавить новую функцию"
```

### Отправка

```bash
git push origin feature/my-feature
```

---

## 8. Создание PR

1. Зайдите на GitHub
2. Нажмите "New Pull Request"
3. Выберите вашу ветку
4. Заполните PR template
5. Отправьте на review

---

## ❓ Проблемы

### Порт занят

```bash
# Измените порт в .env
PORT=3001
```

### Ошибки зависимостей

```bash
# Очистка и переустановка
rm -rf node_modules package-lock.json
npm install
```

### Ошибки Docker

```bash
# Пересборка
docker-compose down
docker-compose up --build
```

---

## 📞 Помощь

- [README_RU.md](README_RU.md) - основная документация
- [CONTRIBUTING.md](CONTRIBUTING.md) - гайд по вкладу
- [CHANGELOG.md](CHANGELOG.md) - история изменений
- [Issues](https://github.com/QuadDarv1ne/cursor-reset-tools/issues) - сообщить о проблеме

---

**Версия:** 2.8.0-dev  
**Последнее обновление:** 26 марта 2026 г.
