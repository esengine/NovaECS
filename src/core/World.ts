/**
 * World class - minimal skeleton using numeric Entity handles
 * World类 - 使用数字Entity句柄的最小骨架
 */

import { EntityManager } from './EntityManager';
import { Entity } from '../utils/Types';
import { getComponentType, ComponentType, ComponentCtor, getCtorByTypeId } from './ComponentRegistry';
import { SparseSetStore, IComponentStore } from './SparseSetStore';
import { Query } from './Query';
import { CommandBuffer } from './CommandBuffer';
import { EventChannel } from '../events/EventChannel';
import { AddedEvent, RemovedEvent, Added, Removed } from '../events/Types';
import { TagStore } from '../tag/TagStore';
import { tagId, getAllTags } from '../tag/TagRegistry';
import { Bitset } from '../signature/Bitset';
import { ArchetypeIndex, Archetype } from '../archetype';
import { Recorder } from '../replay/Recorder';
import { TagBitSet, TagMaskManager } from './TagBitSet';
import { PRNG } from '../determinism/PRNG';
import type { Prefab, SpawnOptions } from '../prefab/Prefab';

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
  private resources = new Map<new() => unknown, unknown>();
  private tags = new TagStore();
  private signatures = new Map<Entity, Bitset>();
  private arch = new ArchetypeIndex();
  private entityArchetype = new Map<Entity, Archetype>();
  private tagMaskManager = new TagMaskManager();
  private entityTagBits = new Map<Entity, TagBitSet>();

  // Query delta subscription management
  // 查询增量订阅管理
  private deltaSubscribedQueries = new Set<Query<unknown[]>>();

  /**
   * Current frame number (starts from 1); incremented by beginFrame()
   * 当前帧号（从1开始）；调用beginFrame()自增
   */
  frame = 1;

  constructor() {}

  /**
   * Get archetype index for query optimization
   * 获取原型索引用于查询优化
   */
  getArchetypeIndex(): ArchetypeIndex {
    return this.arch;
  }

  /**
   * Spawn multiple entities from prefab with batch optimizations
   * 从预制体批量生成实体并优化
   */
  spawn(prefab: Prefab, options: SpawnOptions = {}): Entity[] {
    const count = options.count ?? 1;
    const epoch = options.epoch ?? this.frame;
    const entities: Entity[] = [];

    for (let i = 0; i < count; i++) {
      entities.push(this.createEntity());
    }

    for (const comp of prefab.comps) {
      for (let i = 0; i < count; i++) {
        const entity = entities[i];

        const baseValue = typeof comp.defaults === 'function'
          ? (comp.defaults as () => any)()
          : { ...comp.defaults };

        let finalValue = baseValue;
        const compName = comp.ctor.name;

        if (options.overrides?.shared?.[compName]) {
          finalValue = { ...finalValue, ...options.overrides.shared[compName] };
        }

        const perEntity = options.overrides?.perEntity;
        if (perEntity) {
          const entityOverride = typeof perEntity === 'function'
            ? perEntity(i)
            : perEntity[i];
          if (entityOverride?.[compName]) {
            finalValue = { ...finalValue, ...entityOverride[compName] };
          }
        }

        this.addComponent(entity, comp.ctor, finalValue);

        const archetype = this.entityArchetype.get(entity);
        if (archetype) {
          archetype.setComponent(entity, getComponentType(comp.ctor).id, finalValue, epoch);
        }
      }
    }

    const allTags = [...(prefab.tags ?? []), ...(options.tags ?? [])];
    for (const tag of allTags) {
      for (const entity of entities) {
        this.addTag(entity, tag);
      }
    }

    if (prefab.init) {
      const rng = new PRNG();
      for (let i = 0; i < count; i++) {
        prefab.init(this, entities[i], i, rng);
      }
    }

    return entities;
  }

  /**
   * Get total entity count
   * 获取实体总数
   */
  get entityCount(): number {
    return this.arch.totalEntities();
  }

  /**
   * Begin new frame (call at start of main loop)
   * 开始新帧（在主循环开始时调用）
   */
  beginFrame(): void {
    this.frame++;

    // Clear change tracking for all archetype columns
    // 清理所有原型列的变更追踪
    for (const archetype of this.arch.getAll()) {
      for (const col of archetype.cols.values()) {
        col.clearChangeTracking();
      }
    }

    this.getResource(Recorder)?.beginFrame();
  }

  /**
   * Get current epoch/frame number for change tracking
   * 获取当前时代/帧号用于变更追踪
   */
  epoch(): number {
    return this.frame;
  }

  /**
   * Create new entity
   * 创建新实体
   */
  createEntity(enabled = true): Entity {
    const entity = this.em.create(enabled);
    this.migrate(entity); // Migrate to empty archetype
    this.getResource(Recorder)?.onCreate(entity, enabled);
    return entity;
  }

  /**
   * Destroy entity and remove all its components
   * 销毁实体并移除其所有组件
   */
  destroyEntity(e: Entity): void {
    this.assertNotIterating();

    // Remove from archetype
    const archetype = this.entityArchetype.get(e);
    if (archetype) {
      const row = archetype.getRow(e);
      if (row !== undefined) {
        archetype.swapRemove(row);
      }
      this.entityArchetype.delete(e);
    }

    // Remove all components first (triggers Removed events)
    this.removeAllComponents(e);
    // Clean up signature
    this.signatures.delete(e);
    this.em.destroy(e);
    this.getResource(Recorder)?.onDestroy(e);
  }

  /**
   * Check if entity is alive
   * 检查实体是否存活
   */
  isAlive(entity: Entity): boolean {
    return this.em.isAlive(entity);
  }

  /**
   * Get entity signature (component bitset)
   * 获取实体签名（组件位集）
   */
  getSignature(e: Entity): Bitset {
    let s = this.signatures.get(e);
    if (!s) {
      s = new Bitset(64); // Initial capacity for 64*32=2048 component types
      this.signatures.set(e, s);
    }
    return s;
  }


  /**
   * Migrate entity to appropriate archetype based on signature
   * 根据签名将实体迁移到适当的原型
   */
  private migrate(e: Entity): void {
    const sig = this.getSignature(e);
    const target = this.arch.getOrCreate(sig);
    const current = this.entityArchetype.get(e);

    if (current === target) return;

    // Factory function for creating default component instances
    const makeDefault = (typeId: number): unknown => {
      const ctor = getCtorByTypeId(typeId);
      if (ctor) {
        return new ctor();
      }
      // Fallback to empty object for unknown types
      return {};
    };

    // Remove from current archetype if exists
    if (current) {
      const row = current.getRow(e);
      if (row !== undefined) {
        // Copy component data before removing
        const componentData = new Map<number, unknown>();
        for (const typeId of current.types) {
          componentData.set(typeId, current.getComponent(e, typeId));
        }

        current.swapRemove(row);

        // Add to target archetype and restore component data
        target.push(e, makeDefault);

        // Restore actual component data (without marking as changed - this is migration)
        for (const [typeId, data] of componentData) {
          if (target.types.includes(typeId)) {
            target.setComponent(e, typeId, data); // No epoch - migration shouldn't count as change
          }
        }
      }
    } else {
      // First time adding entity to archetype
      target.push(e, makeDefault);
    }

    this.entityArchetype.set(e, target);
  }

  /**
   * Check if entity is enabled
   * 检查实体是否启用
   */
  isEnabled(entity: Entity): boolean {
    return this.em.isEnabled(entity);
  }

  /**
   * Get all alive entities
   * 获取所有存活的实体
   */
  getAllAliveEntities(): Entity[] {
    return this.em.getAllAliveEntities();
  }

  /**
   * Set entity enabled state
   * 设置实体启用状态
   */
  setEnabled(entity: Entity, enabled: boolean): void {
    this.assertNotIterating();
    this.em.setEnabled(entity, enabled);
    this.getResource(Recorder)?.onSetEnabled(entity, enabled);
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
  addComponentToEntity<T>(e: Entity, type: ComponentType<T>, c: T): void {
    this.assertNotIterating();
    const store = this.storeOf(type);
    const existed = store.has(e);

    // Check which queries matched before addition (for new components only)
    const queryMatchesBefore = new Map<Query<unknown[]>, boolean>();
    if (!existed) {
      for (const query of this.deltaSubscribedQueries) {
        queryMatchesBefore.set(query, query._matchesEntity(e));
      }
    }

    store.add(e, c);
    // Don't mark as changed during initial addition - only mark when explicitly modified
    // store.markChanged(e, this.frame);

    // Update entity signature
    if (!existed) {
      const sig = this.getSignature(e);
      sig.set(type.id);
    }

    // Only emit Added event when component goes from non-existent to existent
    if (!existed) {
      const chan = this.getOrCreate(AddedEvent, () => new EventChannel<Added>()) as EventChannel<Added>;
      chan.emit({ e, typeId: type.id, value: c });
    }

    // Migrate to new archetype if signature changed
    if (!existed) {
      this.migrate(e);

      // Copy the actual component data to archetype
      const archetype = this.entityArchetype.get(e);
      if (archetype) {
        archetype.setComponent(e, type.id, c);
      }
    }

    // Record component addition
    if (!existed) {
      this.getResource(Recorder)?.onAdd(e, type.id, c);

      // Notify delta subscribed queries about potential state changes
      for (const query of this.deltaSubscribedQueries) {
        const matchedBefore = queryMatchesBefore.get(query) ?? false;
        const matchesAfter = query._matchesEntity(e);

        if (!matchedBefore && matchesAfter) {
          query._notifyEntityAdded(e);
        } else if (matchedBefore && !matchesAfter) {
          query._notifyEntityRemoved(e);
        } else if (matchedBefore && matchesAfter) {
          query._notifyEntityChanged(e);
        }
      }
    } else {
      // Component existed but was updated - notify about change
      this.notifyQueryEntityChanged(e);
    }
  }

  /**
   * Remove component from entity
   * 从实体移除组件
   */
  removeComponentFromEntity<T>(e: Entity, type: ComponentType<T>): void {
    this.assertNotIterating();
    const store = this.storeOf(type);
    const had = store.has(e);
    const old = had ? store.get(e) : undefined;

    // Check which queries matched before removal
    const queryMatchesBefore = new Map<Query<unknown[]>, boolean>();
    for (const query of this.deltaSubscribedQueries) {
      queryMatchesBefore.set(query, query._matchesEntity(e));
    }

    store.remove(e);

    // Update entity signature
    if (had) {
      const sig = this.getSignature(e);
      sig.clear(type.id);
    }

    if (had) {
      const chan = this.getOrCreate(RemovedEvent, () => new EventChannel<Removed>()) as EventChannel<Removed>;
      chan.emit({ e, typeId: type.id, old });
    }

    // Migrate to new archetype if signature changed
    if (had) {
      this.migrate(e);
    }

    // Record component removal
    if (had) {
      this.getResource(Recorder)?.onRemove(e, type.id);

      // Notify delta subscribed queries about potential entity removal
      for (const query of this.deltaSubscribedQueries) {
        const matchedBefore = queryMatchesBefore.get(query) ?? false;
        const matchesAfter = query._matchesEntity(e);

        if (matchedBefore && !matchesAfter) {
          query._notifyEntityRemoved(e);
        } else if (matchedBefore && matchesAfter) {
          query._notifyEntityChanged(e);
        }
      }
    }
  }

  /**
   * Add component to entity (convenience method)
   * 向实体添加组件（便捷方法）
   */
  addComponent<T>(e: Entity, ctor: ComponentCtor<T>, data?: Partial<T>): void {
    const type = getComponentType(ctor);
    const component = new ctor();
    if (data) {
      Object.assign(component as object, data);
    }
    this.addComponentToEntity(e, type, component);
  }

  /**
   * Remove component from entity (convenience method)
   * 从实体移除组件（便捷方法）
   */
  removeComponent<T>(e: Entity, ctor: ComponentCtor<T>): void {
    const type = getComponentType(ctor);
    this.removeComponentFromEntity(e, type);
  }

  /**
   * Get component from entity (convenience method)
   * 从实体获取组件（便捷方法）
   */
  getComponent<T>(e: Entity, ctor: ComponentCtor<T>): T | undefined {
    const type = getComponentType(ctor);
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return undefined;
    return archetype.getComponent<T>(e, type.id);
  }

  /**
   * Set component data for entity (convenience method)
   * 为实体设置组件数据（便捷方法）
   */
  setComponent<T>(e: Entity, ctor: ComponentCtor<T>, data: T): void {
    const type = getComponentType(ctor);
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return;
    archetype.setComponent(e, type.id, data, this.frame);
  }

  /**
   * Set component data with custom epoch for change tracking
   * 使用自定义epoch设置组件数据用于变更追踪
   */
  setComponentWithEpoch<T>(e: Entity, ctor: ComponentCtor<T>, data: T, epoch: number): void {
    const type = getComponentType(ctor);
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return;
    archetype.setComponent(e, type.id, data, epoch);
  }

  /**
   * Check if entity has component (convenience method)
   * 检查实体是否有组件（便捷方法）
   */
  hasComponent<T>(e: Entity, ctor: ComponentCtor<T>): boolean {
    const type = getComponentType(ctor);
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return false;
    return archetype.types.includes(type.id);
  }

  /**
   * Get component from entity
   * 从实体获取组件
   */
  getEntityComponent<T>(e: Entity, type: ComponentType<T>): T | undefined {
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return undefined;
    return archetype.getComponent<T>(e, type.id);
  }

  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  entityHasComponent<T>(e: Entity, type: ComponentType<T>): boolean {
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return false;
    return archetype.types.includes(type.id);
  }

  /**
   * Get all components of entity
   * 获取实体的所有组件
   */
  getEntityComponents(e: Entity): Component[] {
    const components: Component[] = [];
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return components;

    for (const typeId of archetype.types) {
      const component = archetype.getComponent(e, typeId);
      if (component) {
        components.push(component as Component);
      }
    }
    return components;
  }

  /**
   * Get all components with their type IDs for an entity
   * 获取实体的所有组件及其类型ID
   */
  getEntityComponentsWithTypeIds(e: Entity): Array<{ typeId: number; component: unknown }> {
    const components: Array<{ typeId: number; component: unknown }> = [];
    const archetype = this.entityArchetype.get(e);
    if (!archetype) return components;

    for (const typeId of archetype.types) {
      const component = archetype.getComponent(e, typeId);
      if (component) {
        components.push({ typeId, component });
      }
    }
    return components;
  }

  /**
   * Remove all components from entity
   * 从实体移除所有组件
   */
  private removeAllComponents(e: Entity): void {
    // Call removeComponentFromEntity for each existing component to trigger events
    for (const [typeId, store] of this.stores) {
      if (store.has(e)) {
        // Construct a fake ComponentType with the typeId
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const fakeType: ComponentType<any> = { id: typeId, ctor: class {} as any };
        this.removeComponentFromEntity(e, fakeType);
      }
    }
  }

  /**
   * Manually mark component as changed - call after modifying component fields in systems
   * 手动标记某组件"已被修改"——在系统里改了字段后调用
   */
  markChanged<T>(e: Entity, ctor: ComponentCtor<T>): void {
    const type = getComponentType(ctor);
    this.getStore(type)?.markChanged(e, this.frame);

    // Notify delta subscribed queries about component change
    this.notifyQueryEntityChanged(e);
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
   * Set a resource by key
   * 通过键设置资源
   */
  setResource<T>(key: new(...args: any[])=>T, val: T): void {
    this.resources.set(key, val);
  }

  /**
   * Get a resource by key
   * 通过键获取资源
   */
  getResource<T>(key: new(...args: any[])=>T): T | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.resources.get(key) as T | undefined;
  }

  /**
   * Get resource or create with factory if not exists
   * 获取资源，不存在则用工厂函数创建
   */
  private getOrCreate<T>(key: new(...args: any[])=>T, fac: ()=>T): T {
    let v = this.getResource<T>(key);
    if (!v) {
      v = fac();
      this.setResource(key, v);
    }
    return v;
  }

  /**
   * Get event channel for Added events
   * 获取Added事件通道
   */
  getAddedChannel(): EventChannel<Added> {
    return this.getOrCreate(AddedEvent, () => new EventChannel<Added>()) as EventChannel<Added>;
  }

  /**
   * Get event channel for Removed events
   * 获取Removed事件通道
   */
  getRemovedChannel(): EventChannel<Removed> {
    return this.getOrCreate(RemovedEvent, () => new EventChannel<Removed>()) as EventChannel<Removed>;
  }

  /**
   * Convenience method: add component by constructor
   * 便捷方法：通过构造函数添加组件
   */
  add<T extends Component>(
    e: Entity,
    ctor: ComponentCtor<T>,
    data?: Partial<T>
  ): void {
    this.assertNotIterating();
    const type = getComponentType(ctor);
    const component = new ctor();
    if (data) {
      Object.assign(component as object, data);
    }
    this.addComponentToEntity(e, type, component);
  }

  /**
   * Get number of alive entities
   * 获取存活实体数量
   */
  aliveCount(): number {
    return this.em.aliveCount();
  }

  /**
   * Debug method: list all component stores with their sizes
   * 调试方法：列出所有组件存储及其大小
   */
  debugListStores(): Array<{ typeId: number; size: number }> {
    const out: Array<{ typeId: number; size: number }> = [];
    for (const [typeId, store] of this.stores) {
      out.push({ typeId, size: store.size() });
    }
    return out;
  }

  /**
   * Get all component type IDs that have active stores
   * 获取所有有活动存储的组件类型ID
   */
  getActiveComponentTypes(): number[] {
    const typeIds: number[] = [];
    for (const [typeId, store] of this.stores) {
      if (store.size() > 0) {
        typeIds.push(typeId);
      }
    }
    return typeIds.sort((a, b) => a - b);
  }

  // ================== Tag System ==================
  // 标签系统

  /**
   * Add tag to entity
   * 为实体添加标签
   */
  addTag(e: Entity, name: string): void {
    // Check which queries matched before tag addition
    const queryMatchesBefore = new Map<Query<unknown[]>, boolean>();
    for (const query of this.deltaSubscribedQueries) {
      queryMatchesBefore.set(query, query._matchesEntity(e));
    }

    this.tags.add(e, tagId(name));

    // 更新位集
    const bitIndex = this.tagMaskManager.getBitIndex(name);
    let entityBits = this.entityTagBits.get(e);
    if (!entityBits) {
      entityBits = new TagBitSet();
      this.entityTagBits.set(e, entityBits);
    }
    entityBits.setBit(bitIndex);

    // Notify delta subscribed queries about tag change
    for (const query of this.deltaSubscribedQueries) {
      const matchedBefore = queryMatchesBefore.get(query) ?? false;
      const matchesAfter = query._matchesEntity(e);

      if (!matchedBefore && matchesAfter) {
        query._notifyEntityAdded(e);
      } else if (matchedBefore && !matchesAfter) {
        query._notifyEntityRemoved(e);
      } else if (matchedBefore && matchesAfter) {
        query._notifyEntityChanged(e);
      }
    }
  }

  /**
   * Add multiple tags to entity at once
   * 一次性为实体添加多个标签
   */
  addTags(e: Entity, tagNames: string[]): void {
    for (const tagName of tagNames) {
      this.addTag(e, tagName);
    }
  }

  /**
   * Remove tag from entity
   * 从实体移除标签
   */
  removeTag(e: Entity, name: string): void {
    // Check which queries matched before tag removal
    const queryMatchesBefore = new Map<Query<unknown[]>, boolean>();
    for (const query of this.deltaSubscribedQueries) {
      queryMatchesBefore.set(query, query._matchesEntity(e));
    }

    this.tags.remove(e, tagId(name));

    // 更新位集
    const bitIndex = this.tagMaskManager.getBitIndex(name);
    const entityBits = this.entityTagBits.get(e);
    if (entityBits) {
      entityBits.clearBit(bitIndex);
    }

    // Notify delta subscribed queries about tag change
    for (const query of this.deltaSubscribedQueries) {
      const matchedBefore = queryMatchesBefore.get(query) ?? false;
      const matchesAfter = query._matchesEntity(e);

      if (matchedBefore && !matchesAfter) {
        query._notifyEntityRemoved(e);
      } else if (!matchedBefore && matchesAfter) {
        query._notifyEntityAdded(e);
      } else if (matchedBefore && matchesAfter) {
        query._notifyEntityChanged(e);
      }
    }
  }

  /**
   * Check if entity has tag
   * 检查实体是否具有标签
   */
  hasTag(e: Entity, name: string): boolean {
    return this.tags.has(e, tagId(name));
  }

  /**
   * Get all tag names for an entity
   * 获取实体的所有标签名称
   */
  getEntityTags(e: Entity): string[] {
    const tagIds = this.tags.getEntityTags(e);
    const allTags = getAllTags();
    const tagIdToName = new Map(allTags.map(({ name, id }) => [id, name]));

    return tagIds.map(id => tagIdToName.get(id)).filter(name => name !== undefined);
  }

  /**
   * Remove all tags from entity
   * 移除实体的所有标签
   */
  clearEntityTags(e: Entity): void {
    this.tags.clearEntity(e);

    // 清除位集
    const entityBits = this.entityTagBits.get(e);
    if (entityBits) {
      entityBits.clear();
    }
  }

  /**
   * Get entities that have specific tag
   * 获取具有特定标签的实体
   */
  getEntitiesWithTag(name: string): Entity[] {
    return this.tags.getEntitiesWithTag(tagId(name));
  }

  // ================== Tag BitSet API ==================
  // 标签位集API

  /**
   * Get tag mask manager for bit operations
   * 获取标签掩码管理器用于位操作
   */
  getTagMaskManager(): TagMaskManager {
    return this.tagMaskManager;
  }

  /**
   * Get entity's tag bit set
   * 获取实体的标签位集
   */
  getEntityTagBits(e: Entity): TagBitSet | undefined {
    return this.entityTagBits.get(e);
  }

  /**
   * Create tag mask for multiple tag names
   * 为多个标签名称创建掩码
   */
  createTagMask(tagNames: string[]): TagBitSet {
    return this.tagMaskManager.createMask(tagNames);
  }

  // ================== Query Delta Subscription ==================
  // 查询增量订阅

  /**
   * Register query for delta notifications
   * 注册查询以接收增量通知
   */
  registerQueryForDelta(query: Query<unknown[]>): void {
    this.deltaSubscribedQueries.add(query);
  }

  /**
   * Unregister query from delta notifications
   * 取消注册查询的增量通知
   */
  unregisterQueryForDelta(query: Query<unknown[]>): void {
    this.deltaSubscribedQueries.delete(query);
  }

  /**
   * Notify subscribed queries about component changes on matching entities
   * 通知订阅的查询匹配实体的组件变更
   */
  private notifyQueryEntityChanged(entity: Entity): void {
    for (const query of this.deltaSubscribedQueries) {
      if (query._matchesEntity(entity)) {
        query._notifyEntityChanged(entity);
      }
    }
  }
}