/**
 * Конфигурация приложения
 */
export const config = {
  // Версии Cursor которые поддерживаются
  supportedCursorVersions: ['0.49.x', '0.50.x', '0.51.x', '0.52.x', '1.0.x', '2.0.x'],
  
  // Минимальная версия
  minCursorVersion: '0.49.0',
  
  // Таймауты (мс)
  timeouts: {
    fileOperation: 10000,
    processCheck: 5000,
    apiRequest: 30000,
    cacheTTL: 5000
  },
  
  // Паттерны для патчинга workbench
  workbenchPatterns: {
    proTrial: {
      pattern: '<div>Pro Trial',
      replacement: '<div>Pro'
    },
    bypassVersionPin: {
      pattern: 'py-1">Auto-select',
      replacement: 'py-1">Bypass-Version-Pin'
    },
    tokenLimit: {
      pattern: 'async getEffectiveTokenLimit\\(e\\)\\{const n=e\\.modelName;if\\(!n\\)return 2e5;',
      replacement: 'async getEffectiveTokenLimit(e){return 9000000;const n=e.modelName;if(!n)return 9e5;'
    },
    proUser: {
      pattern: 'isProUser\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
      replacement: 'isProUser(){return true}'
    },
    isPro: {
      pattern: 'isPro\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
      replacement: 'isPro(){return true}'
    },
    tokenLimitFunc: {
      pattern: 'getTokenLimit\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
      replacement: 'getTokenLimit(){return 999999}'
    },
    tokensRemaining: {
      pattern: 'getTokensRemaining\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
      replacement: 'getTokensRemaining(){return 999999}'
    },
    tokensUsed: {
      pattern: 'getTokensUsed\\(\\w*\\)\\s*\\{\\s*[^}]+\\}',
      replacement: 'getTokensUsed(){return 0}'
    },
    hasReachedTokenLimit: {
      pattern: 'hasReachedTokenLimit\\(\\w+\\)\\s*\\{[^}]+\\}',
      replacement: 'hasReachedTokenLimit(e){return false}'
    },
    notificationsToasts: {
      pattern: 'notifications-toasts',
      replacement: 'notifications-toasts hidden'
    },
    proUI: {
      pattern: 'var DWr=ne\\("<div class=settings__item_description>You are currently signed in with <strong></strong>\\.\\)"\\;',
      replacement: 'var DWr=ne("<div class=settings__item_description>You are currently signed in with <strong></strong>. <h1>Pro</h1>");'
    }
  },
  
  // Паттерны для Pro конвертации
  proConversionPatterns: {
    upgradeToPro: {
      pattern: 'Upgrade to Pro',
      replacement: 'Sazumi Github'
    },
    paywallLink: {
      pattern: 'return t\\.pay',
      replacement: 'return function(){window.open("https://github.com/QuadDarv1ne","_blank")}'
    },
    rocketIcon: {
      pattern: 'rocket',
      replacement: 'github'
    }
  },
  
  // Пути для разных платформ
  platformPaths: {
    win32: {
      machineId: (homedir) => `${homedir}\\AppData\\Roaming\\Cursor\\machineId`,
      storage: (homedir) => `${homedir}\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json`,
      database: (homedir) => `${homedir}\\AppData\\Roaming\\Cursor\\User\\globalStorage\\state.vscdb`,
      app: (homedir) => `${homedir}\\AppData\\Local\\Programs\\Cursor\\resources\\app`,
      cursor: (homedir) => `${homedir}\\AppData\\Roaming\\Cursor\\User\\globalStorage\\cursor.json`,
      update: (homedir) => `${homedir}\\AppData\\Local\\Programs\\Cursor\\resources\\app-update.yml`,
      updater: (homedir) => `${homedir}\\AppData\\Local\\cursor-updater`
    },
    darwin: {
      machineId: (homedir) => `${homedir}/Library/Application Support/Cursor/machineId`,
      storage: (homedir) => `${homedir}/Library/Application Support/Cursor/User/globalStorage/storage.json`,
      database: (homedir) => `${homedir}/Library/Application Support/Cursor/User/globalStorage/state.vscdb`,
      app: () => '/Applications/Cursor.app/Contents/Resources/app',
      cursor: (homedir) => `${homedir}/Library/Application Support/Cursor/User/globalStorage/cursor.json`,
      update: () => '/Applications/Cursor.app/Contents/Resources/app-update.yml',
      updater: (homedir) => `${homedir}/Library/Application Support/cursor-updater`
    },
    linux: {
      machineId: (homedir) => `${homedir}/.config/cursor/machineId`,
      storage: (homedir) => `${homedir}/.config/cursor/User/globalStorage/storage.json`,
      database: (homedir) => `${homedir}/.config/cursor/User/globalStorage/state.vscdb`,
      app: () => '/usr/share/cursor/resources/app',
      cursor: (homedir) => `${homedir}/.config/cursor/User/globalStorage/cursor.json`,
      update: () => '/usr/share/cursor/resources/app-update.yml',
      updater: (homedir) => `${homedir}/.config/cursor-updater`
    }
  },
  
  // Ключи телеметрии для сброса
  telemetryKeys: [
    'telemetry.machineId',
    'telemetry.devDeviceId',
    'telemetry.macMachineId',
    'telemetry.sqmId',
    'serviceMachineId',
    'cursor.lastUpdateCheck',
    'cursor.trialStartTime',
    'cursor.trialEndTime',
    'cursor.tier',
    'cursor.usage'
  ]
};
