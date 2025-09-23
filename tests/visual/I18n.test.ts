/**
 * Internationalization tests for visual node framework
 * 可视化节点框架的国际化测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { I18nManager, t, setLocale, getCurrentLocale } from '../../src/visual/i18n/I18nManager';
import { I18N_KEYS } from '../../src/visual/i18n/keys';
import { NodeGenerator } from '../../src/visual/core/NodeGenerator';
import { World } from '../../src/core/World';

describe('Visual Framework Internationalization', () => {
  beforeEach(() => {
    // Reset to default language for each test
    setLocale('en');
  });

  test('should manage locale correctly', () => {
    expect(getCurrentLocale()).toBe('en');

    setLocale('zh-CN');
    expect(getCurrentLocale()).toBe('zh-CN');

    setLocale('en');
    expect(getCurrentLocale()).toBe('en');
  });

  test('should translate basic keys correctly', () => {
    // Test English translations
    setLocale('en');
    expect(t(I18N_KEYS.COMMON.EXECUTE)).toBe('Execute');
    expect(t(I18N_KEYS.COMMON.ENTITY)).toBe('Entity');
    expect(t(I18N_KEYS.ECS.ENTITY.CREATE.TITLE)).toBe('Create Entity');

    // Test Chinese translations
    setLocale('zh-CN');
    expect(t(I18N_KEYS.COMMON.EXECUTE)).toBe('执行');
    expect(t(I18N_KEYS.COMMON.ENTITY)).toBe('实体');
    expect(t(I18N_KEYS.ECS.ENTITY.CREATE.TITLE)).toBe('创建实体');
  });

  test('should handle parameter interpolation', () => {
    setLocale('en');
    const result = t(I18N_KEYS.ERROR.TRANSLATION_MISSING, { key: 'test.key' });
    expect(result).toBe('Translation missing for key: test.key');

    setLocale('zh-CN');
    const zhResult = t(I18N_KEYS.ERROR.TRANSLATION_MISSING, { key: 'test.key' });
    expect(zhResult).toBe('缺少翻译键: test.key');
  });

  test('should fallback to key when translation is missing', () => {
    const missingKey = 'nonexistent.key';
    expect(t(missingKey)).toBe(missingKey);
  });

  test('should resolve category translations', () => {
    // Test English categories
    setLocale('en');
    expect(t(I18N_KEYS.CATEGORY.ECS.ENTITY)).toBe('ECS/Entity');
    expect(t(I18N_KEYS.CATEGORY.ECS.COMPONENT)).toBe('ECS/Component');

    // Test Chinese categories
    setLocale('zh-CN');
    expect(t(I18N_KEYS.CATEGORY.ECS.ENTITY)).toBe('ECS/实体');
    expect(t(I18N_KEYS.CATEGORY.ECS.COMPONENT)).toBe('ECS/组件');
  });

  test('should resolve pin descriptions correctly', () => {
    // Test English pin descriptions
    setLocale('en');
    expect(t(I18N_KEYS.PIN.EXECUTE.DESCRIPTION)).toBe('Trigger execution');
    expect(t(I18N_KEYS.PIN.ENTITY.DESCRIPTION)).toBe('Entity handle');

    // Test Chinese pin descriptions
    setLocale('zh-CN');
    expect(t(I18N_KEYS.PIN.EXECUTE.DESCRIPTION)).toBe('触发执行');
    expect(t(I18N_KEYS.PIN.ENTITY.DESCRIPTION)).toBe('实体句柄');
  });

  test('should support dynamic language switching for metadata resolution', () => {
    const mockMetadata = {
      name: 'testMethod',
      titleKey: I18N_KEYS.ECS.ENTITY.CREATE.TITLE,
      categoryKey: I18N_KEYS.CATEGORY.ECS.ENTITY,
      inputs: [],
      outputs: [],
      originalMethod: () => {},
      stateful: true,
      executionOrder: 0
    };

    // Test English resolution
    setLocale('en');
    const enResolved = NodeGenerator['resolveI18nMetadata'](mockMetadata);
    expect(enResolved.title).toBe('Create Entity');
    expect(enResolved.category).toBe('ECS/Entity');

    // Test Chinese resolution
    setLocale('zh-CN');
    const zhResolved = NodeGenerator['resolveI18nMetadata'](mockMetadata);
    expect(zhResolved.title).toBe('创建实体');
    expect(zhResolved.category).toBe('ECS/实体');
  });

  test('should handle i18n manager singleton correctly', () => {
    const manager1 = I18nManager.getInstance();
    const manager2 = I18nManager.getInstance();

    expect(manager1).toBe(manager2);

    manager1.setLocale('zh-CN');
    expect(manager2.getCurrentLocale()).toBe('zh-CN');
  });

  test('should validate i18n keys exist in resources', () => {
    const manager = I18nManager.getInstance();

    // Test existing keys
    expect(manager.hasKey(I18N_KEYS.COMMON.EXECUTE, 'en')).toBe(true);
    expect(manager.hasKey(I18N_KEYS.COMMON.EXECUTE, 'zh-CN')).toBe(true);

    // Test non-existing key
    expect(manager.hasKey('non.existent.key', 'en')).toBe(false);
  });
});