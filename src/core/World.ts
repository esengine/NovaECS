/**
 * World class - minimal skeleton using numeric Entity handles
 * World类 - 使用数字Entity句柄的最小骨架
 */

import { EntityManager } from './EntityManager';
import { Entity } from '../utils/Types';
import { getComponentType, ComponentType, ComponentCtor } from './ComponentRegistry';
import { SparseSetStore, IComponentStore } from './SparseSetStore';
import { Query } from './Query';
import { CommandBuffer } from './CommandBuffer';

/**
 * Component base interface (placeholder)
 * 组件基础接口（占位符）
 */
export interface Component {}

/**
 * World manages all entities and components
 * World管理所有实体和组件
 */
export class World {
  private em = new EntityManager();
  private stores = new Map<number, IComponentStore<unknown>>();
  private _iterating = 0;

  /**
   * Current frame number (starts from 1); incremented by beginFrame()
   * 当前帧号（从1开始）；调用beginFrame()自增
   */
  frame = 1;

  /**
   * Begin new frame (call at start of main loop)
   * 开始新帧（在主循环开始时调用）
   */
  beginFrame(): void {
    this.frame++;
  }

  /**
   * Create new entity
   * 创建新实体
   */
  createEntity(enabled = true): Entity {
    return this.em.create(enabled);
  }

  /**
   * Destroy entity and remove all its components
   * 销毁实体并移除其所有组件
   */
  destroyEntity(entity: Entity): void {
    this.assertNotIterating();
    this.em.destroy(entity);
    this.removeAllComponents(entity);
  }

  /**
   * Check if entity is alive
   * 检查实体是否存活
   */
  isAlive(entity: Entity): boolean {
    return this.em.isAlive(entity);
  }

  /**
   * Check if entity is enabled
   * 检查实体是否启用
   */
  isEnabled(entity: Entity): boolean {
    return this.em.isEnabled(entity);
  }

  /**
   * Set entity enabled state
   * 设置实体启用状态
   */
  setEnabled(entity: Entity, enabled: boolean): void {
    this.assertNotIterating();
    this.em.setEnabled(entity, enabled);
  }

  /**
   * Get or create component store for type
   * 获取或创建类型的组件存储
   */
  private storeOf<T>(type: ComponentType<T>): IComponentStore<T> {
    let store = this.stores.get(type.id);
    if (!store) {
      store = new SparseSetStore<T>();
      this.stores.set(type.id, store);
    }
    return store as IComponentStore<T>;
  }

  /**
   * Add component to entity
   * 向实体添加组件
   */
  addComponentToEntity<T>(entity: Entity, type: ComponentType<T>, component: T): void {
    this.assertNotIterating();
    const store = this.storeOf(type);
    store.add(entity, component);
    store.markChanged(entity, this.frame); // Addition counts as change 新增也算变更
  }

  /**
   * Remove component from entity
   * 从实体移除组件
   */
  removeComponentFromEntity<T>(entity: Entity, type: ComponentType<T>): void {
    this.assertNotIterating();
    this.storeOf(type).remove(entity);
  }

  /**
   * Add component to entity (convenience method)
   * 向实体添加组件（便捷方法）
   */
  addComponent<T>(entity: Entity, ctor: ComponentCtor<T>, data?: Partial<T>): void {
    const type = getComponentType(ctor);
    const component = new ctor();
    if (data) {
      Object.assign(component as object, data);
    }
    this.addComponentToEntity(entity, type, component);
  }

  /**
   * Remove component from entity (convenience method)
   * 从实体移除组件（便捷方法）
   */
  removeComponent<T>(entity: Entity, ctor: ComponentCtor<T>): void {
    const type = getComponentType(ctor);
    this.removeComponentFromEntity(entity, type);
  }

  /**
   * Get component from entity (convenience method)
   * 从实体获取组件（便捷方法）
   */
  getComponent<T>(entity: Entity, ctor: ComponentCtor<T>): T | undefined {
    const type = getComponentType(ctor);
    return this.storeOf(type).get(entity);
  }

  /**
   * Check if entity has component (convenience method)
   * 检查实体是否有组件（便捷方法）
   */
  hasComponent<T>(entity: Entity, ctor: ComponentCtor<T>): boolean {
    const type = getComponentType(ctor);
    return this.storeOf(type).has(entity);
  }

  /**
   * Get component from entity
   * 从实体获取组件
   */
  getEntityComponent<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    return this.storeOf(type).get(entity);
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  entityHasComponent<T>(entity: Entity, type: ComponentType<T>): boolean {
    return !!this.getStore(type)?.has(entity);
  }

  /**
   * Get all components of entity
   * 获取实体的所有组件
   */
  getEntityComponents(entity: Entity): Component[] {
    const components: Component[] = [];
    for (const [, store] of this.stores) {
      const component = store.get(entity);
      if (component) {
        components.push(component as Component);
      }
    }
    return components;
  }

  /**
   * Remove all components from entity
   * 从实体移除所有组件
   */
  private removeAllComponents(entity: Entity): void {
    for (const [, store] of this.stores) {
      store.remove(entity);
    }
  }

  /**
   * Manually mark component as changed - call after modifying component fields in systems
   * 手动标记某组件"已被修改"——在系统里改了字段后调用
   */
  markChanged<T>(entity: Entity, ctor: ComponentCtor<T>): void {
    const type = getComponentType(ctor);
    this.getStore(type)?.markChanged(entity, this.frame);
  }

  /**
   * Get component store for type (used by Query)
   * 获取类型的组件存储（供Query使用）
   */
  getStore<T>(type: ComponentType<T>): IComponentStore<T> | undefined {
    return this.stores.get(type.id) as IComponentStore<T> | undefined;
  }

  /**
   * Create query for required components
   * 为必需组件创建查询
   */
  query<T1>(c1: ComponentCtor<T1>): Query<[T1]>;
  query<T1, T2>(c1: ComponentCtor<T1>, c2: ComponentCtor<T2>): Query<[T1, T2]>;
  query<T1, T2, T3>(c1: ComponentCtor<T1>, c2: ComponentCtor<T2>, c3: ComponentCtor<T3>): Query<[T1, T2, T3]>;
  query(...ctors: ComponentCtor<unknown>[]): Query<unknown[]> {
    const types = ctors.map(getComponentType);
    return new Query(this, types);
  }

  /**
   * Enter iteration period (called by Query.forEach internally)
   * 进入遍历期（Query.forEach内部调用）
   */
  _enterIteration(): void {
    this._iterating++;
  }

  /**
   * Leave iteration period (called by Query.forEach internally)
   * 离开遍历期（Query.forEach内部调用）
   */
  _leaveIteration(): void {
    this._iterating--;
  }

  /**
   * Assert not currently iterating
   * 断言当前不在遍历中
   */
  private assertNotIterating(): void {
    if (this._iterating > 0) {
      throw new Error('Structural changes must go through CommandBuffer during iteration.');
    }
  }

  /**
   * Create command buffer for deferred operations
   * 创建命令缓冲区用于延迟操作
   */
  cmd(): CommandBuffer {
    return new CommandBuffer(this);
  }

  /**
   * Apply command buffer immediately
   * 立即应用命令缓冲
   */
  flush(cmd: CommandBuffer): void {
    cmd.flush();
  }

  /**
   * Convenience method: add component by constructor
   * 便捷方法：通过构造函数添加组件
   */
  add<T extends Component>(
    entity: Entity,
    ctor: ComponentCtor<T>,
    data?: Partial<T>
  ): void {
    this.assertNotIterating();
    const type = getComponentType(ctor);
    const component = new ctor();
    if (data) {
      Object.assign(component as object, data);
    }
    this.addComponentToEntity(entity, type, component);
  }
}