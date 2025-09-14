import type { Component } from './Component';
import type { ComponentConstructor, ComponentType, EntityId } from '../utils/Types';

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
 * Entity represents a game object in the ECS architecture
 * 实体代表ECS架构中的游戏对象
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const entity = world.createEntity();
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
  private _active = true;
  private readonly _world: IWorldForEntity;

  /**
   * Create a new entity with unique identifier and world reference
   * 创建具有唯一标识符和世界引用的新实体
   */
  constructor(id: EntityId, world: IWorldForEntity) {
    this._id = id;
    this._world = world;
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
    this._world.addComponentToEntity(this._id, constructor, component);
    return this;
  }

  /**
   * Remove component from entity
   * 从实体移除组件
   * @param componentType The component type to remove 要移除的组件类型
   * @returns This entity instance for method chaining 实体实例，用于方法链式调用
   */
  removeComponent<T extends Component>(componentType: ComponentType<T>): this {
    this._world.removeComponentFromEntity(this._id, componentType);
    return this;
  }

  /**
   * Get component from entity
   * 从实体获取组件
   * @param componentType The component type to retrieve 要获取的组件类型
   * @returns The component instance if found, undefined otherwise 如果找到则返回组件实例，否则返回undefined
   */
  getComponent<T extends Component>(componentType: ComponentType<T>): T | undefined {
    return this._world.getEntityComponent(this._id, componentType);
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   * @param componentType The component type to check for 要检查的组件类型
   * @returns True if entity has the component 如果实体拥有该组件则返回true
   */
  hasComponent<T extends Component>(componentType: ComponentType<T>): boolean {
    return this._world.entityHasComponent(this._id, componentType);
  }

  /**
   * Check if entity has all specified components
   * 检查实体是否拥有所有指定组件
   * @param componentTypes Component types to check for 要检查的组件类型
   * @returns True if entity has all specified components 如果实体拥有所有指定组件则返回true
   */
  hasComponents(...componentTypes: ComponentType[]): boolean {
    return componentTypes.every(type => this.hasComponent(type));
  }

  /**
   * Get all components on entity
   * 获取实体上的所有组件
   */
  getComponents(): Component[] {
    return this._world.getEntityComponents(this._id);
  }

  /**
   * Get all component types on entity
   * 获取实体上的所有组件类型
   */
  getComponentTypes(): ComponentConstructor[] {
    return this.getComponents().map(component => component.constructor as ComponentConstructor);
  }

  /**
   * Destroy entity and clean up resources
   * 销毁实体并清理资源
   */
  destroy(): void {
    this._active = false;
  }
}