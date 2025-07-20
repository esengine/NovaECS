import type { Component } from './Component';
import type { ComponentConstructor, ComponentType, EntityId } from '../utils/Types';
// No imports needed for basic serialization support

/**
 * Interface for World methods that Entity needs
 * Entity 需要的 World 方法接口
 */
export interface IWorldForEntity {
  addComponentToEntity(entityId: EntityId, componentType: ComponentType, component: Component): void;
  removeComponentFromEntity(entityId: EntityId, componentType: ComponentType): void;
  getEntityComponent<T extends Component>(entityId: EntityId, componentType: ComponentType<T>): T | undefined;
  entityHasComponent(entityId: EntityId, componentType: ComponentType): boolean;
  getEntityComponents(entityId: EntityId): Component[];
}

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
  private _world?: IWorldForEntity;

  /**
   * Create a new entity with unique identifier
   * 创建具有唯一标识符的新实体
   */
  constructor(id: EntityId) {
    this._id = id;
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
   * Set the world this entity belongs to (internal use only)
   * 设置此实体所属的世界（仅供内部使用）
   * @internal
   */
  setWorld(world: IWorldForEntity): void {
    this._world = world;
  }

  /**
   * Add component to entity
   * 向实体添加组件
   */
  addComponent<T extends Component>(component: T): this {
    const constructor = component.constructor as ComponentConstructor<T>;

    // If entity belongs to a world, use archetype storage
    if (this._world) {
      // Let the world handle archetype storage
      this._world.addComponentToEntity(this._id, constructor, component);
    } else {
      // Fallback to traditional storage if not in a world
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
    // If entity belongs to a world, use archetype storage
    if (this._world) {
      // Let the world handle archetype storage
      this._world.removeComponentFromEntity(this._id, componentType);
    } else {
      // Fallback to traditional storage if not in a world
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
    // If entity belongs to a world, use archetype storage
    if (this._world) {
      return this._world.getEntityComponent(this._id, componentType);
    }

    // Fallback to traditional storage if not in a world
    return this._components.get(componentType) as T | undefined;
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  hasComponent<T extends Component>(componentType: ComponentType<T>): boolean {
    // If entity belongs to a world, use archetype storage
    if (this._world) {
      return this._world.entityHasComponent(this._id, componentType);
    }

    // Fallback to traditional storage if not in a world
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
    // If entity belongs to a world, use archetype storage
    if (this._world) {
      return this._world.getEntityComponents(this._id);
    }

    // Fallback to traditional storage if not in a world
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