/**
 * Система локализации (i18n)
 * Поддерживаемые языки: ru, en, zh
 */

export const translations = {
  ru: {
    // Заголовки
    title: 'Sazumi Cloud - Инструмент сброса Cursor',
    description: 'Sazumi Cloud — мощный инструмент для обхода ограничений Cursor IDE. Сброс Machine ID, конвертация пробной версии в Pro, обход лимитов токенов и предотвращение автообновлений.',
    
    // Модальное окно
    disclaimerTitle: 'Важное предупреждение',
    disclaimerWarning: 'Внимание: Чрезмерное использование этого инструмента может нарушать условия использования Cursor.',
    disclaimerAcknowledge: 'Используя этот инструмент, вы признаёте, что:',
    disclaimerRisk: 'Все действия выполняются на ваш собственный риск',
    disclaimerNoResponsibility: 'Разработчики Sazumi Cloud не несут ответственности за последствия',
    disclaimerNotAbuse: 'Этот инструмент не следует использовать слишком часто',
    disclaimerEducational: 'Предоставлено только для образовательных и исследовательских целей',
    disclaimerAccept: 'Я понимаю и принимаю',
    
    // Header
    headerTitle: 'Sazumi Cloud',
    headerSubtitle: 'Инструмент сброса Machine ID Cursor',
    
    // О инструменте
    aboutTitle: 'Об этом инструменте',
    aboutRecommended: 'Рекомендуется: Для лучшей совместимости используйте Cursor версии 0.49.x',
    aboutDescription: 'Sazumi Cloud — мощный инструмент для сброса Machine ID Cursor IDE. Это помогает обойти ограничения пробной версии, конвертировать пробную версию в Pro, обойти лимиты токенов и предотвратить автоматические обновления для полного раскрытия возможностей AI Cursor.',
    
    // Функции
    featureTokenBypass: 'Обход лимита токенов',
    featureTokenBypassDesc: 'Удаление ограничений на использование токенов для AI completions',
    featureProConversion: 'Pro конвертация',
    featureProConversionDesc: 'Доступ к Pro функциям без подписки и кастомизация UI',
    featureMachineIdReset: 'Сброс Machine ID',
    featureMachineIdResetDesc: 'Обход ограничения "Слишком много пробных аккаунтов"',
    featureAutoUpdateBlock: 'Блокировка обновлений',
    featureAutoUpdateBlockDesc: 'Предотвращение автоматических обновлений Cursor, которые могут удалить обходы',
    
    // Система
    systemInfoTitle: 'Информация о системе',
    systemInfoLoading: 'Загрузка информации о системе...',
    cursorStatusTitle: 'Статус Cursor',
    cursorStatusLoading: 'Загрузка информации о Cursor...',
    
    // Таблица системы
    platform: 'Платформа',
    os: 'ОС',
    architecture: 'Архитектура',
    homeDir: 'Домашняя директория',
    
    // Таблица Cursor
    cursorStatus: 'Статус Cursor',
    cursorRunning: 'Запущен',
    cursorNotRunning: 'Не запущен',
    machineIdPath: 'Путь Machine ID',
    storagePath: 'Путь хранилища',
    dbPath: 'Путь базы данных',
    appPath: 'Путь приложения',
    updatePath: 'Путь обновлений',
    exists: 'существует',
    yes: 'Да',
    no: 'Нет',
    
    // Сброс Machine ID
    resetTitle: 'Сброс Machine ID',
    resetImportant: 'Важно: Убедитесь, что Cursor закрыт перед сбросом Machine ID.',
    resetBtn: 'Сбросить Machine ID',
    bypassBtn: 'Обойти лимит токенов',
    disableUpdateBtn: 'Отключить автообновление',
    proConvertBtn: 'Pro версия + Кастомный UI',
    
    // Генератор Email
    emailTitle: 'Генератор Email',
    emailNote: 'Примечание: При ошибке "too many requests" необходимо сменить IP адрес, включив и выключив мобильные данные.',
    emailRemoved: 'Функция генератора email была удалена в этой версии.',
    emailExternal: 'Пожалуйста, используйте внешний сервис email для проверки.',
    
    // Требования
    requirementsTitle: 'Требования',
    reqAdmin: 'Требуются права администратора для операций с файлами',
    reqClosed: 'Cursor должен быть полностью закрыт при сбросе',
    reqInternet: 'Подключение к интернету для API вызовов',
    reqCompatible: 'Совместимость с Windows, macOS и Linux',
    
    // Документация
    docsTitle: 'Документация',
    docsHowItWorks: 'Как это работает',
    docsPrerequisites: 'Предварительные требования',
    docsTroubleshooting: 'Устранение неполадок',
    docsTips: 'Рекомендуемые советы',
    
    // Установка
    installationTitle: 'Руководство по установке',
    installationWarning: 'Важно: Не запускайте и не редактируйте этот код в Cursor IDE. Используйте VS Code или другой редактор кода.',
    step1Title: 'Клонировать репозиторий',
    step2Title: 'Установить зависимости',
    step3Title: 'Запустить приложение',
    serverStart: 'Сервер запустится на',
    adminTitle: 'Запуск от имени администратора',
    devModeTitle: 'Режим разработки',
    
    // История изменений
    changelogTitle: 'История изменений',
    
    // Footer
    footer: 'Cursor Reset Tool от Sazumi Cloud. Все права защищены.',
    footerProduct: 'Продукт PT Sazumi Cloud Inc.',
    github: 'GitHub',
    donate: 'Пожертвовать',
    
    // Сообщения
    success: 'Успешно!',
    error: 'Ошибка',
    processing: 'Обработка...',
    resetProcessing: 'Сброс Machine ID... Пожалуйста, подождите',
    bypassProcessing: 'Обход лимита токенов... Пожалуйста, подождите',
    disableProcessing: 'Отключение автообновления... Пожалуйста, подождите',
    proProcessing: 'Конвертация в Pro + Кастомный UI... Пожалуйста, подождите',
    closeCursorWarning: 'Пожалуйста, закройте Cursor перед выполнением операции',
    
    // Toast
    toastCloseCursor: 'Пожалуйста, закройте Cursor перед сбросом Machine ID',
    toastCloseCursorBypass: 'Пожалуйста, закройте Cursor перед обходом лимита токенов',
    toastCloseCursorUpdate: 'Пожалуйста, закройте Cursor перед отключением автообновления',
    toastCloseCursorPro: 'Пожалуйста, закройте Cursor перед включением Pro функций',
    
    // Modal
    modalDisclaimer: 'Важное предупреждение',
    modalWarning: 'Внимание: Чрезмерное использование этого инструмента может нарушать условия использования Cursor.',
    modalAcknowledge: 'Используя этот инструмент, вы признаёте, что:',
    modalRisk: 'Все действия выполняются на ваш собственный риск',
    modalNoResponsibility: 'Разработчики Sazumi Cloud не несут ответственности за последствия',
    modalNotAbuse: 'Этот инструмент не следует использовать слишком часто',
    modalEducational: 'Предоставлено только для образовательных и исследовательских целей',
    modalAccept: 'Я понимаю и принимаю',
    
    // Header
    versionLabel: 'v2.0.0',
    
    // Features
    featureRecommended: 'Рекомендуется: Для лучшей совместимости используйте Cursor версии 0.49.x',
    
    // System table
    machineIdExists: 'Machine ID существует',
    storageExists: 'Storage существует',
    databaseExists: 'Database существует',
    appExists: 'App существует',
    cursorExists: 'Cursor существует',
    updateExists: 'Update существует',
    
    // Warning
    cursorWarning: 'Внимание: Cursor сейчас запущен. Пожалуйста, закройте его перед использованием функций.',
    cursorNote: 'Примечание: Убедитесь, что Cursor закрыт перед использованием любых функций.',
    
    // Changelog months
    monthJuly: 'Июль',
    monthJune: 'Июнь',
    monthMay: 'Май',
    monthApril: 'Апрель',
    
    // Change types
    changeImproved: 'Исправлено',
    changeAdded: 'Добавлено',
    changeRemoved: 'Удалено',
    changeNew: 'Новое',
    changeFixed: 'Исправлено',
    changeEnhanced: 'Улучшено'
  },
  
  en: {
    // Headers
    title: 'Sazumi Cloud - Cursor Reset Tool',
    description: 'Sazumi Cloud is a powerful tool designed to bypass Cursor IDE limitations. Reset Machine ID, convert free trials to Pro, bypass token limits, and prevent auto updates.',
    
    // Modal
    disclaimerTitle: 'Important Disclaimer',
    disclaimerWarning: 'Warning: Excessive use of this tool may violate Cursor\'s terms of service.',
    disclaimerAcknowledge: 'By using this tool, you acknowledge that:',
    disclaimerRisk: 'All actions performed are at your own risk',
    disclaimerNoResponsibility: 'Sazumi Cloud developers are not responsible for any consequences',
    disclaimerNotAbuse: 'This tool should not be abused frequently',
    disclaimerEducational: 'This is provided for educational and research purposes only',
    disclaimerAccept: 'I Understand and Accept',
    
    // Header
    headerTitle: 'Sazumi Cloud',
    headerSubtitle: 'Cursor Machine ID Reset Tool',
    
    // About
    aboutTitle: 'About This Tool',
    aboutRecommended: 'Recommended: For best compatibility, use Cursor version 0.49.x',
    aboutDescription: 'Sazumi Cloud is a powerful tool designed to reset the Machine ID of Cursor IDE. This helps to bypass trial limits, convert free trials to Pro, bypass token limitations, and prevent automatic updates to unleash the full potential of Cursor AI capabilities.',
    
    // Features
    featureTokenBypass: 'Token Limit Bypass',
    featureTokenBypassDesc: 'Remove restrictions on token usage for AI completions',
    featureProConversion: 'Pro Conversion',
    featureProConversionDesc: 'Access Pro features without purchasing a subscription and customize the UI',
    featureMachineIdReset: 'Machine ID Reset',
    featureMachineIdResetDesc: 'Bypass the "Too many free trial accounts" limitation',
    featureAutoUpdateBlock: 'Auto Update Prevention',
    featureAutoUpdateBlockDesc: 'Stop Cursor from automatically updating to versions that could patch these bypasses',
    
    // System
    systemInfoTitle: 'System Information',
    systemInfoLoading: 'Loading system information...',
    cursorStatusTitle: 'Cursor Status',
    cursorStatusLoading: 'Loading cursor information...',
    
    // Table
    platform: 'Platform',
    os: 'OS',
    architecture: 'Architecture',
    homeDir: 'Home Directory',
    
    // Cursor Table
    cursorStatus: 'Cursor Status',
    cursorRunning: 'Running',
    cursorNotRunning: 'Not Running',
    machineIdPath: 'Machine ID Path',
    storagePath: 'Storage Path',
    dbPath: 'Database Path',
    appPath: 'App Path',
    updatePath: 'Update Path',
    exists: 'Exists',
    yes: 'Yes',
    no: 'No',
    
    // Reset
    resetTitle: 'Reset Machine ID',
    resetImportant: 'Important: Make sure Cursor is closed before resetting the machine ID.',
    resetBtn: 'Reset Machine ID',
    bypassBtn: 'Bypass Token Limit',
    disableUpdateBtn: 'Disable Auto-Update',
    proConvertBtn: 'Pro Conversion + Custom UI',
    
    // Email
    emailTitle: 'Email Generator',
    emailNote: 'Note: When you encounter "too many requests" errors, you MUST change your IP address by toggling your mobile data OFF and ON.',
    emailRemoved: 'Email generator feature has been removed in this version.',
    emailExternal: 'Please use an external email service for verification needs.',
    
    // Requirements
    requirementsTitle: 'Requirements',
    reqAdmin: 'Admin privileges are required for file operations',
    reqClosed: 'Cursor must be completely closed when resetting',
    reqInternet: 'Internet connection for API calls',
    reqCompatible: 'Compatible with Windows, macOS, and Linux',
    
    // Documentation
    docsTitle: 'Documentation',
    docsHowItWorks: 'How It Works',
    docsPrerequisites: 'Prerequisites',
    docsTroubleshooting: 'Troubleshooting',
    docsTips: 'Recommended Tips',
    
    // Installation
    installationTitle: 'Installation Guide',
    installationWarning: 'Important: Do not run or edit this code using Cursor IDE. Use VS Code or another code editor instead.',
    step1Title: 'Clone Repository',
    step2Title: 'Install Dependencies',
    step3Title: 'Start the Application',
    serverStart: 'The server will start on',
    adminTitle: 'Running as Administrator',
    devModeTitle: 'Development Mode',
    
    // Changelog
    changelogTitle: 'Changelog',
    
    // Footer
    footer: 'Cursor Reset Tool by Sazumi Cloud. All rights reserved.',
    footerProduct: 'A product by PT Sazumi Cloud Inc.',
    github: 'GitHub',
    donate: 'Donate',
    
    // Messages
    success: 'Success!',
    error: 'Error',
    processing: 'Processing...',
    resetProcessing: 'Resetting machine ID... Please wait',
    bypassProcessing: 'Bypassing token limit... Please wait',
    disableProcessing: 'Disabling auto-update... Please wait',
    proProcessing: 'Converting to Pro + Custom UI... Please wait',
    closeCursorWarning: 'Please close Cursor before performing this operation',
    
    // Toast
    toastCloseCursor: 'Please close Cursor before resetting machine ID',
    toastCloseCursorBypass: 'Please close Cursor before bypassing token limit',
    toastCloseCursorUpdate: 'Please close Cursor before disabling auto-update',
    toastCloseCursorPro: 'Please close Cursor before enabling Pro features',
    
    // Modal
    modalDisclaimer: 'Important Disclaimer',
    modalWarning: 'Warning: Excessive use of this tool may violate Cursor\'s terms of service.',
    modalAcknowledge: 'By using this tool, you acknowledge that:',
    modalRisk: 'All actions performed are at your own risk',
    modalNoResponsibility: 'Sazumi Cloud developers are not responsible for any consequences',
    modalNotAbuse: 'This tool should not be abused frequently',
    modalEducational: 'This is provided for educational and research purposes only',
    modalAccept: 'I Understand and Accept',
    
    // Header
    versionLabel: 'v2.0.0',
    
    // Features
    featureRecommended: 'Recommended: For best compatibility, use Cursor version 0.49.x',
    
    // System table
    machineIdExists: 'Machine ID Exists',
    storageExists: 'Storage Exists',
    databaseExists: 'Database Exists',
    appExists: 'App Exists',
    cursorExists: 'Cursor Exists',
    updateExists: 'Update Exists',
    
    // Warning
    cursorWarning: 'Warning: Cursor is currently running. Please close it before using any features.',
    cursorNote: 'Note: Make sure Cursor is closed before using any features.',
    
    // Changelog months
    monthJuly: 'July',
    monthJune: 'June',
    monthMay: 'May',
    monthApril: 'April',
    
    // Change types
    changeImproved: 'Fixed',
    changeAdded: 'Added',
    changeRemoved: 'Removed',
    changeNew: 'New',
    changeFixed: 'Fixed',
    changeEnhanced: 'Enhanced'
  },
  
  zh: {
    // Headers
    title: 'Sazumi Cloud - Cursor 重置工具',
    description: 'Sazumi Cloud 是一个强大的工具，旨在绕过 Cursor IDE 的限制。重置 Machine ID，将免费试用转换为 Pro，绕过令牌限制，并防止自动更新。',
    
    // Modal
    disclaimerTitle: '重要免责声明',
    disclaimerWarning: '警告：过度使用此工具可能会违反 Cursor 的服务条款。',
    disclaimerAcknowledge: '使用此工具，即表示您承认：',
    disclaimerRisk: '所有操作均由您自行承担风险',
    disclaimerNoResponsibility: 'Sazumi Cloud 开发者不对任何后果负责',
    disclaimerNotAbuse: '不应频繁滥用此工具',
    disclaimerEducational: '本工具仅提供给教育和研究用途',
    disclaimerAccept: '我理解并接受',
    
    // Header
    headerTitle: 'Sazumi Cloud',
    headerSubtitle: 'Cursor Machine ID 重置工具',
    
    // About
    aboutTitle: '关于本工具',
    aboutRecommended: '建议：为了最佳兼容性，请使用 Cursor 版本 0.49.x',
    aboutDescription: 'Sazumi Cloud 是一个强大的工具，旨在重置 Cursor IDE 的 Machine ID。这有助于绕过试用限制，将免费试用转换为 Pro，绕过令牌限制，并防止自动更新以充分发挥 Cursor AI 功能的全部潜力。',
    
    // Features
    featureTokenBypass: '令牌限制绕过',
    featureTokenBypassDesc: '移除 AI 补全的令牌使用限制',
    featureProConversion: 'Pro 转换',
    featureProConversionDesc: '无需购买订阅即可访问 Pro 功能并自定义 UI',
    featureMachineIdReset: 'Machine ID 重置',
    featureMachineIdResetDesc: '绕过"此机器上使用了太多免费试用帐户"的限制',
    featureAutoUpdateBlock: '自动更新阻止',
    featureAutoUpdateBlockDesc: '阻止 Cursor 自动更新到可能修补这些绕过功能的版本',
    
    // System
    systemInfoTitle: '系统信息',
    systemInfoLoading: '正在加载系统信息...',
    cursorStatusTitle: 'Cursor 状态',
    cursorStatusLoading: '正在加载 Cursor 信息...',
    
    // Table
    platform: '平台',
    os: '操作系统',
    architecture: '架构',
    homeDir: '主目录',
    
    // Cursor Table
    cursorStatus: 'Cursor 状态',
    cursorRunning: '运行中',
    cursorNotRunning: '未运行',
    machineIdPath: 'Machine ID 路径',
    storagePath: '存储路径',
    dbPath: '数据库路径',
    appPath: '应用路径',
    updatePath: '更新路径',
    exists: '存在',
    yes: '是',
    no: '否',
    
    // Reset
    resetTitle: '重置 Machine ID',
    resetImportant: '重要：在重置 machine ID 之前，请确保 Cursor 已关闭。',
    resetBtn: '重置 Machine ID',
    bypassBtn: '绕过令牌限制',
    disableUpdateBtn: '禁用自动更新',
    proConvertBtn: 'Pro 转换 + 自定义 UI',
    
    // Email
    emailTitle: '电子邮件生成器',
    emailNote: '注意：当您遇到"too many requests"错误时，您必须通过关闭并打开移动数据来更改您的 IP 地址。',
    emailRemoved: '此版本中已删除电子邮件生成器功能。',
    emailExternal: '请使用外部电子邮件服务进行验证。',
    
    // Requirements
    requirementsTitle: '要求',
    reqAdmin: '文件操作需要管理员权限',
    reqClosed: '重置时 Cursor 必须完全关闭',
    reqInternet: 'API 调用需要互联网连接',
    reqCompatible: '兼容 Windows、macOS 和 Linux',
    
    // Documentation
    docsTitle: '文档',
    docsHowItWorks: '工作原理',
    docsPrerequisites: '前提条件',
    docsTroubleshooting: '故障排除',
    docsTips: '建议提示',
    
    // Installation
    installationTitle: '安装指南',
    installationWarning: '重要：不要使用 Cursor IDE 运行或编辑此代码。请使用 VS Code 或其他代码编辑器。',
    step1Title: '克隆仓库',
    step2Title: '安装依赖',
    step3Title: '启动应用',
    serverStart: '服务器将启动于',
    adminTitle: '以管理员身份运行',
    devModeTitle: '开发模式',
    
    // Changelog
    changelogTitle: '更新日志',
    
    // Footer
    footer: 'Cursor Reset Tool 由 Sazumi Cloud 提供。版权所有。',
    footerProduct: 'PT Sazumi Cloud Inc. 的产品。',
    github: 'GitHub',
    donate: '捐赠',
    
    // Messages
    success: '成功！',
    error: '错误',
    processing: '处理中...',
    resetProcessing: '正在重置 machine ID... 请稍候',
    bypassProcessing: '正在绕过令牌限制... 请稍候',
    disableProcessing: '正在禁用自动更新... 请稍候',
    proProcessing: '正在转换为 Pro + 自定义 UI... 请稍候',
    closeCursorWarning: '请在执行此操作之前关闭 Cursor',
    
    // Toast
    toastCloseCursor: '请在重置 machine ID 之前关闭 Cursor',
    toastCloseCursorBypass: '请在绕过令牌限制之前关闭 Cursor',
    toastCloseCursorUpdate: '请在禁用自动更新之前关闭 Cursor',
    toastCloseCursorPro: '请在启用 Pro 功能之前关闭 Cursor',
    
    // Modal
    modalDisclaimer: '重要免责声明',
    modalWarning: '警告：过度使用此工具可能会违反 Cursor 的服务条款。',
    modalAcknowledge: '使用此工具，即表示您承认：',
    modalRisk: '所有操作均由您自行承担风险',
    modalNoResponsibility: 'Sazumi Cloud 开发者不对任何后果负责',
    modalNotAbuse: '不应频繁滥用此工具',
    modalEducational: '本工具仅提供给教育和研究用途',
    modalAccept: '我理解并接受',
    
    // Header
    versionLabel: 'v2.0.0',
    
    // Features
    featureRecommended: '建议：为了最佳兼容性，请使用 Cursor 版本 0.49.x',
    
    // System table
    machineIdExists: 'Machine ID 存在',
    storageExists: 'Storage 存在',
    databaseExists: 'Database 存在',
    appExists: 'App 存在',
    cursorExists: 'Cursor 存在',
    updateExists: 'Update 存在',
    
    // Warning
    cursorWarning: '警告：Cursor 当前正在运行。请在使用任何功能之前关闭它。',
    cursorNote: '注意：在使用任何功能之前，请确保 Cursor 已关闭。',
    
    // Changelog months
    monthJuly: '七月',
    monthJune: '六月',
    monthMay: '五月',
    monthApril: '四月',
    
    // Change types
    changeImproved: '已修复',
    changeAdded: '已添加',
    changeRemoved: '已移除',
    changeNew: '新的',
    changeFixed: '已修复',
    changeEnhanced: '已增强'
  }
};

/**
 * Получить перевод для ключа
 * @param {string} key - Ключ перевода
 * @param {string} lang - Язык (ru, en, zh)
 * @returns {string}
 */
export function t(key, lang = 'ru') {
  const language = translations[lang] || translations.ru;
  return language[key] || translations.en[key] || key;
}

/**
 * Получить все переводы для языка
 * @param {string} lang - Язык
 * @returns {Object}
 */
export function getTranslations(lang = 'ru') {
  return translations[lang] || translations.ru;
}

/**
 * Получить список поддерживаемых языков
 * @returns {string[]}
 */
export function getSupportedLanguages() {
  return Object.keys(translations);
}

/**
 * Определить язык пользователя
 * @returns {string}
 */
export function detectLanguage() {
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('ru')) return 'ru';
  }
  return 'ru'; // Язык по умолчанию
}
