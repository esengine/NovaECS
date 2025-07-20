import type { Component } from './Component';
import type { ComponentConstructor, ComponentType, EntityId } from '../utils/Types';

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
   * Add component to entity
   * 向实体添加组件
   */
  addComponent<T extends Component>(component: T): this {
    const constructor = component.constructor as ComponentConstructor<T>;
    this._components.set(constructor, component);
    return this;
  }

  /**
   * Remove component from entity
   * 从实体移除组件
   */
  removeComponent<T extends Component>(componentType: ComponentType<T>): this {
    this._components.delete(componentType);
    return this;
  }

  /**
   * Get component from entity
   * 从实体获取组件
   */
  getComponent<T extends Component>(componentType: ComponentType<T>): T | undefined {
    return this._components.get(componentType) as T | undefined;
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  hasComponent<T extends Component>(componentType: ComponentType<T>): boolean {
    return this._components.has(componentType);
  }

  /**
   * Check if entity has all specified components
   * 检查实体是否拥有所有指定组件
   */
  hasComponents(...componentTypes: ComponentType[]): boolean {
    return componentTypes.every(type => this._components.has(type));
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
   * Destroy entity and clean up resources
   * 销毁实体并清理资源
   */
  destroy(): void {
    this._components.clear();
    this._active = false;
  }
}