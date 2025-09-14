import type { Component } from './Component';
import type { ComponentType, ComponentConstructor, ComponentTypeId } from '../utils/Types';

/**
 * Global component type registry
 * 全局组件类型注册表
 */
export class ComponentRegistry {
  private static _instance?: ComponentRegistry;
  private readonly _typeIdCounter = { value: 0 };
  private readonly _typeById = new Map<ComponentTypeId, ComponentType>();
  private readonly _typeByConstructor = new Map<ComponentConstructor, ComponentType>();
  private readonly _typeByName = new Map<string, ComponentType>();

  private constructor() {}

  /**
   * Get singleton instance
   * 获取单例实例
   */
  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry._instance) {
      ComponentRegistry._instance = new ComponentRegistry();
    }
    return ComponentRegistry._instance;
  }

  /**
   * Register a component type
   * 注册组件类型
   */
  register<T extends Component>(
    ctor: ComponentConstructor<T>,
    name?: string
  ): ComponentType<T> {
    // Check if already registered
    const existing = this._typeByConstructor.get(ctor);
    if (existing) {
      return existing as ComponentType<T>;
    }

    // Generate type ID
    const typeId = ++this._typeIdCounter.value;
    const typeName = name || ctor.name || `Component_${typeId}`;

    // Check name conflicts
    if (this._typeByName.has(typeName)) {
      throw new Error(`Component type name '${typeName}' already registered`);
    }

    // Create component type
    const componentType: ComponentType<T> = {
      typeId,
      ctor,
      name: typeName
    };

    // Store mappings
    this._typeById.set(typeId, componentType);
    this._typeByConstructor.set(ctor, componentType);
    this._typeByName.set(typeName, componentType);

    return componentType;
  }

  /**
   * Get component type by type ID
   * 通过类型ID获取组件类型
   */
  getById(typeId: ComponentTypeId): ComponentType | undefined {
    return this._typeById.get(typeId);
  }

  /**
   * Get component type by constructor
   * 通过构造函数获取组件类型
   */
  getByConstructor<T extends Component>(ctor: ComponentConstructor<T>): ComponentType<T> | undefined {
    return this._typeByConstructor.get(ctor) as ComponentType<T> | undefined;
  }

  /**
   * Get component type by name
   * 通过名称获取组件类型
   */
  getByName(name: string): ComponentType | undefined {
    return this._typeByName.get(name);
  }

  /**
   * Get all registered component types
   * 获取所有注册的组件类型
   */
  getAll(): ComponentType[] {
    return Array.from(this._typeById.values());
  }

  /**
   * Clear all registrations (for testing)
   * 清除所有注册（用于测试）
   */
  clear(): void {
    this._typeIdCounter.value = 0;
    this._typeById.clear();
    this._typeByConstructor.clear();
    this._typeByName.clear();
  }
}

/**
 * Decorator to register component type
 * 注册组件类型的装饰器
 */
export function RegisterComponent(name?: string) {
  return function<T extends Component>(ctor: ComponentConstructor<T>) {
    ComponentRegistry.getInstance().register(ctor, name);
    return ctor;
  };
}

/**
 * Helper function to register component type
 * 注册组件类型的辅助函数
 */
export function registerComponent<T extends Component>(
  ctor: ComponentConstructor<T>,
  name?: string
): ComponentType<T> {
  return ComponentRegistry.getInstance().register(ctor, name);
}

/**
 * Helper function to get component type
 * 获取组件类型的辅助函数
 */
export function getComponentType<T extends Component>(
  ctor: ComponentConstructor<T>
): ComponentType<T> {
  const type = ComponentRegistry.getInstance().getByConstructor(ctor);
  if (!type) {
    throw new Error(`Component type not registered: ${ctor.name || 'Anonymous'}`);
  }
  return type;
}