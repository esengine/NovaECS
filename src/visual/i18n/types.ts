/**
 * Internationalization types for visual node framework
 * 可视化节点框架的国际化类型定义
 */

/**
 * Supported locale types
 * 支持的语言类型
 */
export type Locale = 'en' | 'zh-CN';

/**
 * Internationalization key type
 * 国际化键类型 - 使用字符串字面量确保类型安全
 */
export type I18nKey = string;

/**
 * Internationalization configuration
 * 国际化配置
 */
export interface I18nConfig {
  /** Default locale 默认语言 */
  defaultLocale: Locale;
  /** Fallback locale when translation is missing 翻译缺失时的回退语言 */
  fallbackLocale: Locale;
  /** Whether to warn about missing translations 是否警告缺失的翻译 */
  warnMissing?: boolean;
}

/**
 * Language resource structure
 * 语言资源结构
 */
export type LanguageResource = Record<string, string>;

/**
 * Translation parameters for interpolation
 * 用于插值的翻译参数
 */
export type TranslationParams = Record<string, string | number>;

/**
 * Translation function type
 * 翻译函数类型
 */
export type TranslationFunction = (key: I18nKey, params?: TranslationParams) => string;