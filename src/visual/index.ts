/**
 * Visual Node Editor Framework for NovaECS
 * NovaECS可视化节点编辑器框架
 *
 * Provides visual programming capabilities by extending existing ECS methods
 * with metadata for automatic node generation. Methods marked with @VisualMethod
 * decorator are automatically available in the visual editor.
 * 通过为现有ECS方法添加元数据来提供可视化编程功能，实现自动节点生成。
 * 使用@VisualMethod装饰器标记的方法将自动在可视化编辑器中可用。
 */

export * from './types';
export * from './decorators';
export * from './core';
export * from './i18n';