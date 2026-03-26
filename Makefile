# Cursor Reset Tools - Makefile
# ============================================
# Использование: make <command>
# Пример: make install

.PHONY: help install dev test lint clean docker-build docker-run docker-dev backup restore

# Переменные
NODE_ENV ?= development
PORT ?= 3000
WS_PORT ?= 3001

# Цвета для вывода
COLOR_RESET := \033[0m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m
COLOR_BLUE := \033[34m

help:
	@echo "$(COLOR_BLUE)================================$(COLOR_RESET)"
	@echo "$(COLOR_GREEN)  Cursor Reset Tools - Commands$(COLOR_RESET)"
	@echo "$(COLOR_BLUE)================================$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_YELLOW)Основные:$(COLOR_RESET)"
	@echo "  make install       - Установка зависимостей"
	@echo "  make dev           - Запуск в режиме разработки"
	@echo "  make start         - Запуск production версии"
	@echo "  make test          - Запуск тестов"
	@echo "  make test:coverage - Запуск тестов с покрытием"
	@echo ""
	@echo "$(COLOR_YELLOW)Код качество:$(COLOR_RESET)"
	@echo "  make lint          - Проверка ESLint"
	@echo "  make lint:fix      - Исправление ESLint ошибок"
	@echo "  make check:i18n    - Проверка локализации"
	@echo ""
	@echo "$(COLOR_YELLOW)Docker:$(COLOR_RESET)"
	@echo "  make docker:build  - Сборка Docker образа"
	@echo "  make docker:run    - Запуск контейнера"
	@echo "  make docker:dev    - Docker Compose для разработки"
	@echo ""
	@echo "$(COLOR_YELLOW)Утилиты:$(COLOR_RESET)"
	@echo "  make clean         - Очистка временных файлов"
	@echo "  make backup        - Создание бэкапа конфигурации"
	@echo "  make restore       - Восстановление из бэкапа"
	@echo "  make update        - Проверка обновлений"
	@echo ""

install:
	@echo "$(COLOR_GREEN)Installing dependencies...$(COLOR_RESET)"
	npm install

dev:
	@echo "$(COLOR_GREEN)Starting development mode...$(COLOR_RESET)"
	npm run dev

start:
	@echo "$(COLOR_GREEN)Starting production server...$(COLOR_RESET)"
	PORT=$(PORT) WS_PORT=$(WS_PORT) NODE_ENV=$(NODE_ENV) npm start

test:
	@echo "$(COLOR_GREEN)Running tests...$(COLOR_RESET)"
	npm test

test-coverage:
	@echo "$(COLOR_GREEN)Running tests with coverage...$(COLOR_RESET)"
	npm run test:coverage

lint:
	@echo "$(COLOR_GREEN)Running ESLint...$(COLOR_RESET)"
	npm run lint

lint-fix:
	@echo "$(COLOR_GREEN)Fixing ESLint errors...$(COLOR_RESET)"
	npm run lint:fix

check-i18n:
	@echo "$(COLOR_GREEN)Checking i18n...$(COLOR_RESET)"
	npm run check:i18n

check-i18n-verbose:
	@echo "$(COLOR_GREEN)Checking i18n (verbose)...$(COLOR_RESET)"
	npm run check:i18n:verbose

docker-build:
	@echo "$(COLOR_GREEN)Building Docker image...$(COLOR_RESET)"
	npm run docker:build

docker-run:
	@echo "$(COLOR_GREEN)Running Docker container...$(COLOR_RESET)"
	npm run docker:run

docker-dev:
	@echo "$(COLOR_GREEN)Starting Docker Compose...$(COLOR_RESET)"
	npm run docker:dev

clean:
	@echo "$(COLOR_YELLOW)Cleaning temporary files...$(COLOR_RESET)"
	rm -rf node_modules
	rm -rf logs/*.log
	rm -rf data/*.json
	rm -rf backups/*
	rm -rf updates/*
	rm -rf coverage
	rm -rf .eslintcache
	@echo "$(COLOR_GREEN)Clean complete!$(COLOR_RESET)"

backup:
	@echo "$(COLOR_GREEN)Creating configuration backup...$(COLOR_RESET)"
	npm run cli -- backup:export

restore:
	@echo "$(COLOR_GREEN)Restoring from backup...$(COLOR_RESET)"
	npm run cli -- backup:import

update:
	@echo "$(COLOR_GREEN)Checking for updates...$(COLOR_RESET)"
	npm run update

# Быстрые команды для разработки
reinstall: clean install
	@echo "$(COLOR_GREEN)Reinstall complete!$(COLOR_RESET)"

reset:
	@echo "$(COLOR_YELLOW)Resetting to clean state...$(COLOR_RESET)"
	rm -rf node_modules package-lock.json
	npm cache clean --force
	@echo "$(COLOR_GREEN)Reset complete! Run 'make install' to reinstall.$(COLOR_RESET)"
