/**
 * Internationalization configuration for NovaECS Editor
 * NovaECS编辑器国际化配置
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import language resources
// 导入语言资源
import enTranslation from '../../locales/en/translation.json';
import zhCNTranslation from '../../locales/zh-CN/translation.json';

export const resources = {
  en: {
    translation: enTranslation
  },
  'zh-CN': {
    translation: zhCNTranslation
  }
} as const;

export const availableLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' }
] as const;

// Initialize i18next
// 初始化i18next
i18n
  .use(LanguageDetector) // Auto-detect user language 自动检测用户语言
  .use(initReactI18next) // Initialize React integration 初始化React集成
  .init({
    resources,
    fallbackLng: 'en', // Fallback language 后备语言
    interpolation: {
      escapeValue: false, // React already escapes values React已经转义了值
    },

    detection: {
      // Language detection options 语言检测选项
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nova-editor-language',
      // If no language is detected, default to Chinese for Chinese users
      // 如果检测不到语言，中文用户默认使用中文
      convertDetectedLanguage: (lng: string) => {
        // Map common Chinese variants to zh-CN
        if (lng.startsWith('zh')) {
          return 'zh-CN';
        }
        return lng;
      }
    },

    debug: process.env.NODE_ENV === 'development',

    // Namespace and key separator 命名空间和键分隔符
    ns: ['translation'],
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: ':',

    // React specific options React特定选项
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility 禁用suspense以兼容SSR
    }
  });

export default i18n;

// Type definitions for translation keys
// 翻译键的类型定义
export type TranslationKey = keyof typeof enTranslation;

// Helper function to get available language codes
// 获取可用语言代码的辅助函数
export const getLanguageCodes = () => availableLanguages.map(lang => lang.code);

// Helper function to get language name by code
// 根据代码获取语言名称的辅助函数
export const getLanguageName = (code: string, native = false) => {
  const lang = availableLanguages.find(l => l.code === code);
  return lang ? (native ? lang.nativeName : lang.name) : code;
};