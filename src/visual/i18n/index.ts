/**
 * Internationalization module for visual node framework
 * 可视化节点框架的国际化模块
 */

// Export types
export type { Locale, I18nKey, I18nConfig, LanguageResource, TranslationParams, TranslationFunction } from './types';

// Export i18n manager and utilities
export { I18nManager, t, getCurrentLocale, setLocale, hasTranslation } from './I18nManager';

// Export i18n keys
export { I18N_KEYS, getI18nKey, validateI18nKey } from './keys';

// Export language resources
export { enLocale } from './locales/en';
export { zhCNLocale } from './locales/zh-CN';