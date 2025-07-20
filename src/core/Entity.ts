import type { Component } from './Component';
import type { ComponentConstructor, ComponentType, EntityId } from '../utils/Types';

/**
 * Callback for notifying when entity components change
 * 实体组件变化时的通知回调
 */
export type EntityComponentChangeCallback = (
  entityId: EntityId,
  componentType: ComponentType,
  component: Component | null,
  isAddition: boolean
) => void;

/**
 * Entity represents a game object in the ECS architecture
 * 实体代表ECS架构中的游戏对象
 * 
 * @example
 * ```typescript
 * const entity = new Entity(1);
 * entity.addComponent(new PositionComponent(10, 20));
 * entity.addComponent(new VelocityComponent(1, 0));
 * 
 * const position = entity.getComponent(PositionComponent);
 * if (position) {
 *   console.log(`Position: ${position.x}, ${position.y}`);
 * }
 * ```
 */
export class Entity {
  private readonly _id: EntityId;
  private readonly _components = new Map<ComponentConstructor, Component>();
  private _active = true;
  private _changeCallback?: EntityComponentChangeCallback;
  private _useArchetypeStorage = false;
  private _externalComponentProvider?: (entityId: EntityId, componentType: ComponentType) => Component | undefined;

  /**
   * Create a new entity with unique identifier
   * 创建具有唯一标识符的新实体
   */
  constructor(id: EntityId, changeCallback?: EntityComponentChangeCallback) {
    this._id = id;
    if (changeCallback) {
      this._changeCallback = changeCallback;
    }
  }

  /**
   * Get entity unique identifier
   * 获取实体唯一标识符
   */
  get id(): EntityId {
    return this._id;
  }

  /**
   * Get entity active state
   * 获取实体激活状态
   */
  get active(): boolean {
    return this._active;
  }

  /**
   * Set entity active state
   * 设置实体激活状态
   */
  set active(value: boolean) {
    this._active = value;
  }

  /**
   * Enable or disable archetype storage mode
   * 启用或禁用原型存储模式
   */
  setArchetypeStorageMode(enabled: boolean): void {
    this._useArchetypeStorage = enabled;
  }

  /**
   * Check if entity uses archetype storage
   * 检查实体是否使用原型存储
   */
  get usesArchetypeStorage(): boolean {
    return this._useArchetypeStorage;
  }

  /**
   * Set component change callback
   * 设置组件变化回调
   */
  setChangeCallback(callback: EntityComponentChangeCallback): void {
    this._changeCallback = callback;
  }

  /**
   * Set external component provider for archetype storage
   * 为原型存储设置外部组件提供者
   */
  setExternalComponentProvider(
    provider: (entityId: EntityId, componentType: ComponentType) => Component | undefined
  ): void {
    this._externalComponentProvider = provider;
  }

  /**
   * Add component to entity
   * 向实体添加组件
   */
  addComponent<T extends Component>(component: T): this {
    const constructor = component.constructor as ComponentConstructor<T>;
    
    // For archetype storage, notify the world about the change
    if (this._useArchetypeStorage && this._changeCallback) {
      this._changeCallback(this._id, constructor, component, true);
    } else {
      // Traditional storage
      this._components.set(constructor, component);
      
      // Call component lifecycle method
      component.onAdded?.();
    }
    
    return this;
  }

  /**
   * Remove component from entity
   * 从实体移除组件
   */
  removeComponent<T extends Component>(componentType: ComponentType<T>): this {
    // For archetype storage, notify the world about the change
    if (this._useArchetypeStorage && this._changeCallback) {
      this._changeCallback(this._id, componentType, null, false);
    } else {
      // Traditional storage
      const component = this._components.get(componentType);
      if (component) {
        // Call component lifecycle method
        component.onRemoved?.();
        this._components.delete(componentType);
      }
    }
    
    return this;
  }

  /**
   * Get component from entity
   * 从实体获取组件
   */
  getComponent<T extends Component>(componentType: ComponentType<T>): T | undefined {
    // For archetype storage, use external provider
    if (this._useArchetypeStorage && this._externalComponentProvider) {
      return this._externalComponentProvider(this._id, componentType) as T | undefined;
    }
    
    // Traditional storage
    return this._components.get(componentType) as T | undefined;
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  hasComponent<T extends Component>(componentType: ComponentType<T>): boolean {
    // For archetype storage, check via external provider
    if (this._useArchetypeStorage && this._externalComponentProvider) {
      return this._externalComponentProvider(this._id, componentType) !== undefined;
    }
    
    // Traditional storage
    return this._components.has(componentType);
  }

  /**
   * Check if entity has all specified components
   * 检查实体是否拥有所有指定组件
   */
  hasComponents(...componentTypes: ComponentType[]): boolean {
    return componentTypes.every(type => this.hasComponent(type));
  }

  /**
   * Get all components on entity
   * 获取实体上的所有组件
   */
  getComponents(): Component[] {
    return Array.from(this._components.values());
  }

  /**
   * Get all component types on entity
   * 获取实体上的所有组件类型
   */
  getComponentTypes(): ComponentConstructor[] {
    return Array.from(this._components.keys());
  }

  /**
   * Remove all components from entity
   * 移除实体的所有组件
   */
  clear(): this {
    this._components.clear();
    return this;
  }

  /**
   * Get internal component storage (for World access)
   * 获取内部组件存储（供World访问）
   * @internal
   */
  getInternalComponentStorage(): Map<ComponentConstructor, Component> {
    return this._components;
  }

  /**
   * Destroy entity and clean up resources
   * 销毁实体并清理资源
   */
  destroy(): void {
    this._components.clear();
    this._active = false;
  }
}