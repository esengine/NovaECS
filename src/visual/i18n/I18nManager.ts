/**
 * Internationalization manager for visual node framework
 * 可视化节点框架的国际化管理器
 */

import type {
  Locale,
  I18nKey,
  I18nConfig,
  LanguageResource,
  TranslationParams
} from './types';
import { enLocale } from './locales/en';
import { zhCNLocale } from './locales/zh-CN';

/**
 * Singleton internationalization manager
 * 单例国际化管理器
 */
export class I18nManager {
  private static instance: I18nManager;
  private currentLocale: Locale = 'en';
  private config: I18nConfig = {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    warnMissing: true
  };

  private locales: Record<Locale, LanguageResource> = {
    'en': enLocale,
    'zh-CN': zhCNLocale
  };

  private constructor() {}

  /**
   * Get singleton instance
   * 获取单例实例
   */
  static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  /**
   * Initialize with configuration
   * 使用配置初始化
   */
  init(config: Partial<I18nConfig>): void {
    this.config = { ...this.config, ...config };
    this.currentLocale = this.config.defaultLocale;
  }

  /**
   * Set current locale
   * 设置当前语言
   */
  setLocale(locale: Locale): void {
    if (!this.locales[locale]) {
      if (this.config.warnMissing) {
        console.warn(`[I18n] Unsupported locale: ${locale}, falling back to ${this.config.fallbackLocale}`);
      }
      this.currentLocale = this.config.fallbackLocale;
      return;
    }
    this.currentLocale = locale;
  }

  /**
   * Get current locale
   * 获取当前语言
   */
  getCurrentLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Get available locales
   * 获取可用语言列表
   */
  getAvailableLocales(): Locale[] {
    return Object.keys(this.locales) as Locale[];
  }

  /**
   * Check if a translation key exists
   * 检查翻译键是否存在
   */
  hasKey(key: I18nKey, locale?: Locale): boolean {
    const targetLocale = locale || this.currentLocale;
    return key in this.locales[targetLocale];
  }

  /**
   * Get translation for a key
   * 获取键的翻译
   */
  t(key: I18nKey, params?: TranslationParams): string {
    let translation = this.getTranslation(key, this.currentLocale);

    // Fallback to fallback locale if translation not found
    // 如果未找到翻译则回退到回退语言
    if (!translation && this.currentLocale !== this.config.fallbackLocale) {
      translation = this.getTranslation(key, this.config.fallbackLocale);
    }

    // Final fallback to key itself
    // 最终回退到键本身
    if (!translation) {
      if (this.config.warnMissing) {
        console.warn(`[I18n] Translation missing for key: ${key}`);
      }
      translation = key;
    }

    // Interpolate parameters
    // 插值参数
    if (params && typeof translation === 'string') {
      translation = this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Add or update language resource
   * 添加或更新语言资源
   */
  addLanguageResource(locale: Locale, resource: LanguageResource): void {
    if (!this.locales[locale]) {
      this.locales[locale] = {};
    }
    this.locales[locale] = { ...this.locales[locale], ...resource };
  }

  /**
   * Remove language resource
   * 移除语言资源
   */
  removeLanguageResource(locale: Locale): void {
    delete this.locales[locale];
  }

  /**
   * Get raw translation without interpolation
   * 获取原始翻译（不进行插值）
   */
  getRawTranslation(key: I18nKey, locale?: Locale): string | undefined {
    const targetLocale = locale || this.currentLocale;
    return this.getTranslation(key, targetLocale);
  }

  /**
   * Get all translations for a locale
   * 获取某语言的所有翻译
   */
  getAllTranslations(locale?: Locale): LanguageResource {
    const targetLocale = locale || this.currentLocale;
    return { ...this.locales[targetLocale] };
  }

  /**
   * Private method to get translation from specific locale
   * 从特定语言获取翻译的私有方法
   */
  private getTranslation(key: I18nKey, locale: Locale): string | undefined {
    return this.locales[locale]?.[key];
  }

  /**
   * Private method to interpolate parameters into translation
   * 将参数插值到翻译中的私有方法
   */
  private interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = params[key];
      return value !== undefined ? String(value) : match;
    });
  }
}

/**
 * Global translation function
 * 全局翻译函数
 */
export const t = (key: I18nKey, params?: TranslationParams): string => {
  return I18nManager.getInstance().t(key, params);
};

/**
 * Get current locale
 * 获取当前语言
 */
export const getCurrentLocale = (): Locale => {
  return I18nManager.getInstance().getCurrentLocale();
};

/**
 * Set current locale
 * 设置当前语言
 */
export const setLocale = (locale: Locale): void => {
  I18nManager.getInstance().setLocale(locale);
};

/**
 * Check if key exists
 * 检查键是否存在
 */
export const hasTranslation = (key: I18nKey): boolean => {
  return I18nManager.getInstance().hasKey(key);
};