/**
 * Decorator system for visual node framework
 * 可视化节点框架的装饰器系统
 *
 * Provides decorators to mark existing ECS methods as available in the visual editor.
 * Methods decorated with @VisualMethod are automatically discoverable and can be
 * converted into visual nodes without reimplementing the underlying logic.
 * 提供装饰器来标记现有ECS方法在可视化编辑器中可用。
 * 使用@VisualMethod装饰的方法自动可发现，可以转换为可视化节点而无需重新实现底层逻辑。
 */

import 'reflect-metadata';
import type {
  VisualMethodConfig,
  VisualMethodMetadata,
  ClassMetadata,
  InputPinConfig,
  OutputPinConfig
} from '../types';
import { I18N_KEYS } from '../i18n/keys';

/**
 * Metadata key for storing visual method information
 * 存储可视化方法信息的元数据键
 */
export const VISUAL_METADATA_KEY = Symbol('visual:metadata');

/**
 * Global registry of visual methods by class
 * 按类全局注册可视化方法
 */
const VISUAL_REGISTRY = new Map<Function, ClassMetadata>();

/**
 * Get or create metadata for a class
 * 获取或创建类的元数据
 *
 * @param constructor Class constructor 类构造函数
 * @returns Class metadata 类元数据
 */
export function getOrCreateClassMetadata(constructor: Function): ClassMetadata {
  let metadata = VISUAL_REGISTRY.get(constructor);
  if (!metadata) {
    metadata = {
      constructor,
      methods: new Map()
    };
    VISUAL_REGISTRY.set(constructor, metadata);
  }
  return metadata;
}

/**
 * Get metadata for a specific method
 * 获取特定方法的元数据
 *
 * @param constructor Class constructor 类构造函数
 * @param methodName Method name 方法名
 * @returns Method metadata or undefined 方法元数据或undefined
 */
export function getMethodMetadata(
  constructor: Function,
  methodName: string
): VisualMethodMetadata | undefined {
  const classMetadata = VISUAL_REGISTRY.get(constructor);
  return classMetadata?.methods.get(methodName);
}

/**
 * Get all visual methods for a class
 * 获取类的所有可视化方法
 *
 * @param constructor Class constructor 类构造函数
 * @returns Array of method metadata 方法元数据数组
 */
export function getClassVisualMethods(constructor: Function): VisualMethodMetadata[] {
  const classMetadata = VISUAL_REGISTRY.get(constructor);
  return classMetadata ? Array.from(classMetadata.methods.values()) : [];
}

/**
 * Get all registered visual classes
 * 获取所有注册的可视化类
 *
 * @returns Array of class metadata 类元数据数组
 */
export function getAllVisualClasses(): ClassMetadata[] {
  return Array.from(VISUAL_REGISTRY.values());
}

/**
 * Visual method decorator
 * 可视化方法装饰器
 *
 * Marks a method as available in the visual editor. The decorated method
 * retains its original functionality while gaining visual node metadata.
 * 标记方法在可视化编辑器中可用。装饰的方法保留其原始功能，同时获得可视化节点元数据。
 *
 * @param config Visual method configuration 可视化方法配置
 * @returns Method decorator function 方法装饰器函数
 *
 * @example
 * ```typescript
 * class World {
 *   @VisualMethod({
 *     title: "Create Entity",
 *     category: "ECS/Entity",
 *     inputs: [{ name: "enabled", type: "boolean", defaultValue: true }],
 *     outputs: [{ name: "entity", type: "entity" }]
 *   })
 *   createEntity(enabled = true): Entity {
 *     // Original implementation unchanged
 *   }
 * }
 * ```
 */
export function VisualMethod(config: VisualMethodConfig): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Get or create class metadata
    // 获取或创建类元数据
    const classMetadata = getOrCreateClassMetadata(target.constructor);

    // Create method metadata
    // 创建方法元数据
    const methodMetadata: VisualMethodMetadata = {
      name: propertyKey,
      // Support both legacy string and new i18n key approaches
      // 同时支持传统字符串和新的i18n键方式
      ...(config.title !== undefined && { title: config.title }),
      ...(config.titleKey !== undefined && { titleKey: config.titleKey }),
      ...(config.category !== undefined && { category: config.category }),
      ...(config.categoryKey !== undefined && { categoryKey: config.categoryKey }),
      ...(config.description !== undefined && { description: config.description }),
      ...(config.descriptionKey !== undefined && { descriptionKey: config.descriptionKey }),
      ...(config.color !== undefined && { color: config.color }),
      ...(config.icon !== undefined && { icon: config.icon }),
      inputs: config.inputs || [],
      outputs: config.outputs || [],
      originalMethod: descriptor.value,
      stateful: config.stateful ?? true,
      executionOrder: config.executionOrder ?? 0
    };

    // Register method metadata
    // 注册方法元数据
    classMetadata.methods.set(propertyKey, methodMetadata);

    // Store metadata on the class for runtime access
    // 在类上存储元数据以供运行时访问
    Reflect.defineMetadata(
      VISUAL_METADATA_KEY,
      classMetadata,
      target.constructor
    );

    // Return original descriptor unchanged
    // 返回原始描述符不变
    return descriptor;
  };
}

/**
 * Helper decorator for methods that don't modify state
 * 不修改状态方法的辅助装饰器
 *
 * @param config Visual method configuration (stateful will be set to false)
 */
export function VisualPureMethod(config: Omit<VisualMethodConfig, 'stateful'>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return VisualMethod({ ...config, stateful: false });
}

/**
 * Helper decorator for methods that are execution triggers
 * 执行触发器方法的辅助装饰器
 *
 * @param config Visual method configuration (adds execute input/output automatically)
 */
export function VisualExecuteMethod(config: Omit<VisualMethodConfig, 'inputs' | 'outputs'> & { inputs?: InputPinConfig[]; outputs?: OutputPinConfig[] }): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return VisualMethod({
    ...config,
    inputs: [
      { type: 'execute', label: 'Execute' },
      ...(config.inputs || [])
    ],
    outputs: [
      { type: 'execute', label: 'Then' },
      ...(config.outputs || [])
    ]
  });
}

/**
 * Category constants for organizing visual nodes (using i18n keys)
 * 组织可视化节点的分类常量（使用i18n键）
 */
export const VISUAL_CATEGORIES = {
  ECS: {
    ENTITY: I18N_KEYS.CATEGORY.ECS.ENTITY,
    COMPONENT: I18N_KEYS.CATEGORY.ECS.COMPONENT,
    QUERY: I18N_KEYS.CATEGORY.ECS.QUERY,
    SYSTEM: I18N_KEYS.CATEGORY.ECS.SYSTEM
  },
  MATH: {
    BASIC: I18N_KEYS.CATEGORY.MATH.BASIC,
    VECTOR: I18N_KEYS.CATEGORY.MATH.VECTOR,
    TRIGONOMETRY: I18N_KEYS.CATEGORY.MATH.TRIGONOMETRY
  },
  FLOW: {
    CONTROL: I18N_KEYS.CATEGORY.FLOW.CONTROL,
    LOGIC: I18N_KEYS.CATEGORY.FLOW.LOGIC,
    ITERATION: I18N_KEYS.CATEGORY.FLOW.ITERATION
  },
  EVENTS: {
    TRIGGERS: I18N_KEYS.CATEGORY.EVENTS.TRIGGERS,
    HANDLERS: I18N_KEYS.CATEGORY.EVENTS.HANDLERS
  },
  UTILITY: {
    CONVERSION: I18N_KEYS.CATEGORY.UTILITY.CONVERSION,
    DEBUG: I18N_KEYS.CATEGORY.UTILITY.DEBUG
  }
} as const;

/**
 * Pin type validation functions
 * 引脚类型验证函数
 */
export const PIN_VALIDATORS = {
  entity: (_value: any): boolean => typeof _value === 'number' && _value >= 0,
  boolean: (_value: any): boolean => typeof _value === 'boolean',
  number: (_value: any): boolean => typeof _value === 'number' && !isNaN(_value),
  string: (_value: any): boolean => typeof _value === 'string',
  'component-type': (_value: any): boolean => typeof _value === 'function',
  execute: (_value: any): boolean => true, // Execute pins don't carry data
  any: (_value: any): boolean => true
} as const;