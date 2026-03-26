@echo off
REM ============================================
REM Cursor Reset Tools - Windows Batch Commands
REM ============================================
REM Использование: make.bat <command>
REM Пример: make.bat install

setlocal enabledelayedexpansion

set COMMAND=%1

if "%COMMAND%"=="" goto help
if "%COMMAND%"=="help" goto help
if "%COMMAND%"=="install" goto install
if "%COMMAND%"=="dev" goto dev
if "%COMMAND%"=="start" goto start
if "%COMMAND%"=="test" goto test
if "%COMMAND%"=="test-coverage" goto test-coverage
if "%COMMAND%"=="lint" goto lint
if "%COMMAND%"=="lint-fix" goto lint-fix
if "%COMMAND%"=="clean" goto clean
if "%COMMAND%"=="docker-build" goto docker-build
if "%COMMAND%"=="docker-run" goto docker-run
if "%COMMAND%"=="backup" goto backup
if "%COMMAND%"=="update" goto update

echo Unknown command: %COMMAND%
echo.
goto help

:help
echo ================================
echo   Cursor Reset Tools - Commands
echo ================================
echo.
echo Basic:
echo   make.bat install       - Install dependencies
echo   make.bat dev           - Development mode
echo   make.bat start         - Production server
echo   make.bat test          - Run tests
echo   make.bat test-coverage - Tests with coverage
echo.
echo Code Quality:
echo   make.bat lint          - ESLint check
echo   make.bat lint-fix      - Fix ESLint errors
echo   make.bat clean         - Clean temporary files
echo.
echo Docker:
echo   make.bat docker-build  - Build Docker image
echo   make.bat docker-run    - Run Docker container
echo.
echo Utilities:
echo   make.bat backup        - Create config backup
echo   make.bat update        - Check for updates
echo.
goto end

:install
echo Installing dependencies...
call npm install
goto end

:dev
echo Starting development mode...
call npm run dev
goto end

:start
echo Starting production server...
set PORT=%PORT:~0,4%
set WS_PORT=%WS_PORT:~0,4%
set NODE_ENV=production
call npm start
goto end

:test
echo Running tests...
call npm test
goto end

:test-coverage
echo Running tests with coverage...
call npm run test:coverage
goto end

:lint
echo Running ESLint...
call npm run lint
goto end

:lint-fix
echo Fixing ESLint errors...
call npm run lint:fix
goto end

:clean
echo Cleaning temporary files...
if exist node_modules rmdir /s /q node_modules
if exist logs del /q /s logs\*.log
if exist data\*.json del /q /s data\*.json
if exist backups del /q /s backups\*
if exist updates del /q /s updates\*
if exist coverage rmdir /s /q coverage
echo Clean complete!
goto end

:docker-build
echo Building Docker image...
call npm run docker:build
goto end

:docker-run
echo Running Docker container...
call npm run docker:run
goto end

:backup
echo Creating configuration backup...
call npm run cli -- backup:export
goto end

:update
echo Checking for updates...
call npm run update
goto end

:end
endlocal
