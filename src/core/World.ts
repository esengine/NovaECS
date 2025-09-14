import { Entity, type IWorldForEntity } from './Entity';
import type { System } from './System';
import type { Component } from './Component';
import type { ComponentType, EntityId, QueryFilter } from '../utils/Types';
import { ArchetypeManager } from './ArchetypeManager';
import { ParallelScheduler, type ExecutionGroup } from './ParallelScheduler';
import { EventBus } from './EventBus';
import { EventScheduler } from './EventScheduler';
import { QueryManager } from './QueryManager';
import { PluginManager } from './PluginManager';
import type {
  IQueryBuilder,
  QueryCriteria,
  QueryOptions,
  QueryResult,
  QueryStatistics,
  QueryCacheConfig
} from '../utils/QueryTypes';
import {
  EntityCreatedEvent,
  EntityDestroyedEvent,
  ComponentAddedEvent,
  ComponentRemovedEvent,
  SystemAddedEvent,
  SystemRemovedEvent,
  WorldPausedEvent,
  WorldResumedEvent,
  WorldUpdateStartEvent,
  WorldUpdateEndEvent
} from './Event';
import type { EventStatistics } from '../utils/EventTypes';



/**
 * World manages all entities and systems in the ECS architecture
 * 世界管理ECS架构中的所有实体和系统
 * 
 * @example
 * ```typescript
 * const world = new World();
 * 
 * // Add systems
 * world.addSystem(new MovementSystem());
 * world.addSystem(new RenderSystem());
 * 
 * // Create entities
 * const player = world.createEntity()
 *   .addComponent(new PositionComponent(100, 100))
 *   .addComponent(new VelocityComponent(5, 0))
 *   .addComponent(new SpriteComponent('player.png'));
 * 
 * // Game loop
 * function gameLoop(deltaTime: number) {
 *   world.update(deltaTime);
 * }
 * ```
 */
export class World implements IWorldForEntity {
  private readonly _entities = new Map<EntityId, Entity>();
  private readonly _systems: System[] = [];
  private _entityIdCounter = 0;
  private _paused = false;
  private readonly _entityEnabledStates = new Map<EntityId, boolean>();
  private readonly _archetypeManager = new ArchetypeManager();
  private readonly _scheduler = new ParallelScheduler();
  private readonly _eventBus = new EventBus();
  private readonly _eventScheduler = new EventScheduler(this._eventBus);
  private readonly _queryManager = new QueryManager(
    this._archetypeManager,
    () => Array.from(this._entities.values())
  );
  private readonly _pluginManager = new PluginManager(this);


  /**
   * Get all entities in world
   * 获取世界中的所有实体
   */
  get entities(): Entity[] {
    return Array.from(this._entities.values());
  }

  /**
   * Get all systems in world
   * 获取世界中的所有系统
   */
  get systems(): System[] {
    return [...this._systems];
  }

  /**
   * Get world paused state
   * 获取世界暂停状态
   */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Get plugin manager
   * 获取插件管理器
   */
  get plugins(): PluginManager {
    return this._pluginManager;
  }

  /**
   * Set world paused state
   * 设置世界暂停状态
   */
  set paused(value: boolean) {
    const waspaused = this._paused;
    this._paused = value;

    // Dispatch pause/resume events
    if (!waspaused && value) {
      void this._eventBus.dispatch(new WorldPausedEvent());
    } else if (waspaused && !value) {
      void this._eventBus.dispatch(new WorldResumedEvent());
    }
  }

  /**
   * Get event bus for subscribing to and dispatching events
   * 获取事件总线用于订阅和分发事件
   */
  get eventBus(): EventBus {
    return this._eventBus;
  }

  /**
   * Create new entity in world
   * 在世界中创建新实体
   */
  createEntity(): Entity {
    const entityId = ++this._entityIdCounter;
    const entity = new Entity(entityId, this);

    this._entities.set(entity.id, entity);
    this._entityEnabledStates.set(entity.id, true);

    // Notify plugins of entity creation
    void this._notifyPluginsEntityCreate(entity);

    // Dispatch entity created event
    void this._eventBus.dispatch(new EntityCreatedEvent(entity.id));

    return entity;
  }


  /**
   * Remove entity from world
   * 从世界移除实体
   * @param entityOrId Entity instance or entity ID to remove 要移除的实体实例或实体ID
   * @returns This world instance for method chaining 世界实例，用于方法链式调用
   */
  removeEntity(entityOrId: Entity | EntityId): this {
    const id = typeof entityOrId === 'number' ? entityOrId : entityOrId.id;
    const entity = this._entities.get(id);
    if (entity) {
      // Notify plugins of entity destruction
      void this._notifyPluginsEntityDestroy(entity);

      // Clear entity state
      this._entities.delete(id);
      this._entityEnabledStates.delete(id);

      // Remove from archetype storage
      this._archetypeManager.removeEntity(id);

      // Dispatch entity destroyed event
      void this._eventBus.dispatch(new EntityDestroyedEvent(id));

      // Clear query cache when entity is destroyed to be safe
      // This is conservative but ensures correctness
      this._queryManager.clearCache();
    }
    return this;
  }

  /**
   * Check if entity exists in world
   * 检查实体是否存在于世界中
   * @param entityId The entity ID to check 要检查的实体ID
   * @returns True if entity exists in world 如果实体存在于世界中则返回true
   */
  hasEntity(entityId: EntityId): boolean {
    return this._entities.has(entityId);
  }

  /**
   * Get entity by ID
   * 通过ID获取实体
   * @param id The entity ID to retrieve 要获取的实体ID
   * @returns The entity if found, undefined otherwise 如果找到则返回实体，否则返回undefined
   */
  getEntity(id: EntityId): Entity | undefined {
    return this._entities.get(id);
  }

  /**
   * Query entities with specific component types
   * 查询具有特定组件类型的实体
   * @param componentTypes Component types that entities must have 实体必须拥有的组件类型
   * @returns Array of entities matching the criteria 匹配条件的实体数组
   */
  queryEntities(...componentTypes: ComponentType[]): Entity[] {
    // Use archetype-optimized query (always enabled)
    const entityIds = this._archetypeManager.queryEntities(componentTypes);
    return entityIds
      .map(id => this._entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined && this.isEnabled(entity.id));
  }

  /**
   * Query entities with custom filter
   * 使用自定义过滤器查询实体
   * @param filter Custom filter function to apply to entities 应用于实体的自定义过滤函数
   * @returns Array of entities matching the filter 匹配过滤器的实体数组
   */
  queryEntitiesWithFilter(filter: QueryFilter): Entity[] {
    return this.entities.filter(filter);
  }

  /**
   * Create a new query builder for fluent query API
   * 创建新的查询构建器用于流畅查询API
   *
   * @example
   * ```typescript
   * const entities = world.query()
   *   .with(PositionComponent, VelocityComponent)
   *   .without(DeadComponent)
   *   .limit(10)
   *   .execute();
   * ```
   */
  query(): IQueryBuilder {
    return this._queryManager.createBuilder();
  }

  /**
   * Execute query with criteria and options
   * 使用条件和选项执行查询
   */
  queryWithCriteria(criteria: QueryCriteria, options?: QueryOptions): QueryResult {
    return this._queryManager.query(criteria, options);
  }

  /**
   * Get query statistics
   * 获取查询统计信息
   */
  getQueryStatistics(): QueryStatistics {
    return this._queryManager.getStatistics();
  }

  /**
   * Clear query cache
   * 清除查询缓存
   */
  clearQueryCache(): void {
    this._queryManager.clearCache();
  }

  /**
   * Configure query cache
   * 配置查询缓存
   */
  configureQueryCache(config: Partial<QueryCacheConfig>): void {
    this._queryManager.configureCache(config);
  }

  /**
   * Enable/disable query performance monitoring
   * 启用/禁用查询性能监控
   */
  setQueryPerformanceMonitoring(enabled: boolean): void {
    this._queryManager.setPerformanceMonitoring(enabled);
  }

  /**
   * Add system to world
   * 向世界添加系统
   */
  addSystem(system: System): this {
    this._systems.push(system);
    this._systems.sort((a, b) => b.priority - a.priority);
    this._scheduler.addSystem(system);
    system.onAddedToWorld(this);

    // Notify plugins of system addition
    void this._notifyPluginsSystemAdd(system);

    // Dispatch system added event
    void this._eventBus.dispatch(new SystemAddedEvent(system.constructor.name));

    return this;
  }

  /**
   * Remove system from world
   * 从世界移除系统
   */
  removeSystem(system: System): this {
    const index = this._systems.indexOf(system);
    if (index !== -1) {
      // Notify plugins of system removal
      void this._notifyPluginsSystemRemove(system);

      this._systems.splice(index, 1);
      this._scheduler.removeSystem(system);
      system.onRemovedFromWorld();

      // Dispatch system removed event
      void this._eventBus.dispatch(new SystemRemovedEvent(system.constructor.name));
    }
    return this;
  }

  /**
   * Get system by type
   * 通过类型获取系统
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSystem<T extends System>(systemType: new (...args: any[]) => T): T | undefined {
    return this._systems.find(system => system instanceof systemType) as T | undefined;
  }

  /**
   * Update all systems with matching entities
   * 使用匹配的实体更新所有系统
   */
  update(deltaTime: number): void {
    if (this._paused) return;

    // Dispatch world update start event
    void this._eventBus.dispatch(new WorldUpdateStartEvent(deltaTime));

    // Notify plugins of update start
    void this._notifyPluginsUpdateStart(deltaTime);

    // Process immediate events first
    void this._eventScheduler.update(deltaTime);

    // Update plugins
    void this._pluginManager.update(deltaTime);

    // Use simplified parallel execution
    void this.updateWithParallelExecution(deltaTime).then(() => {
      this._cleanupDestroyedEntities();

      // Process end-of-frame events
      void this._eventScheduler.processEndOfFrame();

      // Notify plugins of update end
      void this._notifyPluginsUpdateEnd(deltaTime);

      // Dispatch world update end event
      void this._eventBus.dispatch(new WorldUpdateEndEvent(deltaTime));
    });
  }

  /**
   * Update all systems with matching entities (async version)
   * 使用匹配的实体更新所有系统（异步版本）
   */
  async updateAsync(deltaTime: number): Promise<void> {
    if (this._paused) return;

    // Dispatch world update start event
    await this._eventBus.dispatch(new WorldUpdateStartEvent(deltaTime));

    // Notify plugins of update start
    await this._notifyPluginsUpdateStart(deltaTime);

    // Process immediate events first
    await this._eventScheduler.update(deltaTime);

    // Update plugins
    await this._pluginManager.update(deltaTime);

    // Use simplified parallel execution
    await this.updateWithParallelExecution(deltaTime);
    this._cleanupDestroyedEntities();

    // Process end-of-frame events
    await this._eventScheduler.processEndOfFrame();

    // Notify plugins of update end
    await this._notifyPluginsUpdateEnd(deltaTime);

    // Dispatch world update end event
    await this._eventBus.dispatch(new WorldUpdateEndEvent(deltaTime));
  }

  /**
   * parallel execution engine with intelligent scheduling
   * 并行执行引擎，具有智能调度
   */
  private async updateWithParallelExecution(deltaTime: number): Promise<void> {
    const executionGroups = this._scheduler.getExecutionGroups();

    // Execute groups sequentially, but systems within each group in parallel
    for (const group of executionGroups) {
      // Skip empty groups
      if (group.systems.length === 0) continue;

      const enabledSystems = group.systems.filter((system: System) => system.enabled);

      if (enabledSystems.length === 0) continue;

      // For single system, execute based on its execution mode
      if (enabledSystems.length === 1) {
        const system = enabledSystems[0];
        await this.executeSystemWithMode(system, deltaTime);
      } else {
        // Execute multiple systems in parallel based on their execution modes
        const promises = enabledSystems.map((system: System) =>
          this.executeSystemWithMode(system, deltaTime)
        );

        // Wait for all systems in this group to complete before moving to next group
        await Promise.all(promises);
      }
    }
  }

  /**
   * Execute system based on its execution mode
   * 根据系统的执行模式执行系统
   */
  private async executeSystemWithMode(system: System, deltaTime: number): Promise<void> {
    return this.executeSystemDirectAsync(system, deltaTime);
  }

  /**
   * Execute a single system directly (synchronously) for optimal performance
   * 直接（同步）执行单个系统以获得最佳性能
   */
  private executeSystemDirect(system: System, deltaTime: number): void {
    try {
      system.preUpdate?.(deltaTime);

      // Use archetype-optimized query for better performance
      const matchingEntities = this.queryEntities(...system.requiredComponents);

      system.update(matchingEntities, deltaTime);
      system.postUpdate?.(deltaTime);
    } catch (error) {
      console.error(`Error in system ${system.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Execute system directly as async for consistency
   * 直接异步执行系统以保持一致性
   */
  private async executeSystemDirectAsync(system: System, deltaTime: number): Promise<void> {
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        try {
          this.executeSystemDirect(system, deltaTime);
          resolve();
        } catch (error) {
          console.error(`Error in direct async system ${system.constructor.name}:`, error);
          resolve(); // Don't reject to avoid breaking Promise.all
        }
      });
    });
  }











  /**
   * Clear all entities and systems
   * 清理所有实体和系统
   */
  clear(): this {
    for (const entity of this._entities.values()) {
      entity.destroy();
    }
    this._entities.clear();

    for (const system of this._systems) {
      system.onRemovedFromWorld();
    }
    this._systems.length = 0;

    // Clear event system
    this._eventBus.clear();
    this._eventScheduler.clear();

    this._entityIdCounter = 0;
    return this;
  }

  /**
   * Dispose of the world and clean up resources
   * 处理世界并清理资源
   */
  dispose(): void {
    this.clear();
  }

  /**
   * Get entity count
   * 获取实体数量
   */
  getEntityCount(): number {
    return this._entities.size;
  }

  /**
   * Get system count
   * 获取系统数量
   */
  getSystemCount(): number {
    return this._systems.length;
  }



  /**
   * Handle component addition in archetype storage
   * 处理原型存储中的组件添加
   */
  private handleComponentAddition(entityId: EntityId, componentType: ComponentType, component: Component): void {
    // Get current components
    const currentArchetype = this._archetypeManager.getEntityArchetype(entityId);
    const currentComponents: Map<ComponentType, Component> = currentArchetype
      ? this._archetypeManager.removeEntity(entityId) || new Map<ComponentType, Component>()
      : new Map<ComponentType, Component>();

    // Add new component
    currentComponents.set(componentType, component);

    // Call component lifecycle method
    component.onAdded?.();

    // Add to new archetype
    this._archetypeManager.addEntity(entityId, currentComponents);

    // Notify plugins of component addition
    const entity = this._entities.get(entityId);
    if (entity) {
      void this._notifyPluginsComponentAdd(entity, component);
    }

    // Dispatch component added event
    void this._eventBus.dispatch(new ComponentAddedEvent(entityId, componentType.name));

    // Invalidate query cache (optimized)
    this._queryManager.onComponentChanged(componentType);
  }

  /**
   * Handle component removal in archetype storage
   * 处理原型存储中的组件移除
   */
  private handleComponentRemoval(entityId: EntityId, componentType: ComponentType): void {
    // Get current components
    const currentComponents = this._archetypeManager.removeEntity(entityId);
    if (!currentComponents) return;

    // Call component lifecycle method
    const removedComponent = currentComponents.get(componentType);
    if (removedComponent) {
      // Notify plugins of component removal
      const entity = this._entities.get(entityId);
      if (entity) {
        void this._notifyPluginsComponentRemove(entity, removedComponent);
      }

      removedComponent.onRemoved?.();
      currentComponents.delete(componentType);
    }

    // Add to new archetype (if any components remain)
    if (currentComponents.size > 0) {
      this._archetypeManager.addEntity(entityId, currentComponents);
    }

    // Dispatch component removed event
    void this._eventBus.dispatch(new ComponentRemovedEvent(entityId, componentType.name));

    // Invalidate query cache (optimized)
    this._queryManager.onComponentChanged(componentType);
  }



  /**
   * Get archetype manager statistics
   * 获取原型管理器统计信息
   */
  getArchetypeStatistics(): ReturnType<typeof this._archetypeManager.getStatistics> {
    return this._archetypeManager.getStatistics();
  }

  /**
   * Get parallel scheduler statistics
   * 获取并行调度器统计信息
   */
  getSchedulerStatistics(): {
    totalGroups: number;
    totalSystems: number;
    groupDetails: Array<{
      level: number;
      systemCount: number;
      systems: string[];
    }>;
  } {
    const groups = this._scheduler.getExecutionGroups();
    return {
      totalGroups: groups.length,
      totalSystems: groups.reduce((sum, group) => sum + group.systems.length, 0),
      groupDetails: groups.map(group => ({
        level: group.level,
        systemCount: group.systems.length,
        systems: group.systems.map(s => s.constructor.name)
      }))
    };
  }

  /**
   * Get execution groups for debugging
   * 获取执行组用于调试
   */
  getExecutionGroups(): ExecutionGroup[] {
    return this._scheduler.getExecutionGroups();
  }



  /**
   * Get comprehensive performance statistics
   * 获取全面的性能统计信息
   */
  getPerformanceStatistics(): Record<string, unknown> {
    return {
      archetype: this.getArchetypeStatistics(),
      scheduler: this.getSchedulerStatistics(),
      events: this.getEventStatistics()
    };
  }

  /**
   * Get event system statistics
   * 获取事件系统统计信息
   */
  getEventStatistics(): EventStatistics {
    return this._eventBus.getStatistics();
  }

  /**
   * Get event scheduler queue sizes
   * 获取事件调度器队列大小
   */
  getEventQueueSizes(): {
    immediate: number;
    endOfFrame: number;
    nextFrame: number;
    delayed: number;
  } {
    return this._eventScheduler.getQueueSizes();
  }

  private _cleanupDestroyedEntities(): void {
    for (const id of this._entities.keys()) {
      if (!this.isEnabled(id)) {
        this.removeEntity(id);
      }
    }
  }

  /**
   * Destroy world and cleanup all resources
   * 销毁世界并清理所有资源
   */
  destroy(): void {
    // Cleanup all entities and their components
    for (const entity of this._entities.values()) {
      entity.destroy();
    }
    this._entities.clear();

    // Cleanup systems
    for (const system of this._systems) {
      system.onRemovedFromWorld();
    }
    this._systems.length = 0;

    // Mark as paused
    this._paused = true;
  }

  /**
   * Add component to entity (called by Entity)
   * 向实体添加组件（由 Entity 调用）
   * @internal
   */
  addComponentToEntity(entityId: EntityId, componentType: ComponentType, component: Component): void {
    this.handleComponentAddition(entityId, componentType, component);
  }

  /**
   * Notify plugins of update start
   * 通知插件更新开始
   * @private
   */
  private async _notifyPluginsUpdateStart(deltaTime: number): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onWorldUpdateStart) {
        try {
          await plugin.onWorldUpdateStart(this, deltaTime);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onWorldUpdateStart:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of update end
   * 通知插件更新结束
   * @private
   */
  private async _notifyPluginsUpdateEnd(deltaTime: number): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onWorldUpdateEnd) {
        try {
          await plugin.onWorldUpdateEnd(this, deltaTime);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onWorldUpdateEnd:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of entity creation
   * 通知插件实体创建
   * @private
   */
  private async _notifyPluginsEntityCreate(entity: Entity): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onEntityCreate) {
        try {
          await plugin.onEntityCreate(entity);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onEntityCreate:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of entity destruction
   * 通知插件实体销毁
   * @private
   */
  private async _notifyPluginsEntityDestroy(entity: Entity): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onEntityDestroy) {
        try {
          await plugin.onEntityDestroy(entity);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onEntityDestroy:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of system addition
   * 通知插件系统添加
   * @private
   */
  private async _notifyPluginsSystemAdd(system: System): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onSystemAdd) {
        try {
          await plugin.onSystemAdd(system);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onSystemAdd:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of system removal
   * 通知插件系统移除
   * @private
   */
  private async _notifyPluginsSystemRemove(system: System): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onSystemRemove) {
        try {
          await plugin.onSystemRemove(system);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onSystemRemove:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of component addition
   * 通知插件组件添加
   * @private
   */
  private async _notifyPluginsComponentAdd(entity: Entity, component: Component): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onComponentAdd) {
        try {
          await plugin.onComponentAdd(entity, component);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onComponentAdd:`, error);
        }
      }
    }
  }

  /**
   * Notify plugins of component removal
   * 通知插件组件移除
   * @private
   */
  private async _notifyPluginsComponentRemove(entity: Entity, component: Component): Promise<void> {
    for (const pluginName of this._pluginManager.list()) {
      const plugin = this._pluginManager.get(pluginName);
      if (plugin?.onComponentRemove) {
        try {
          await plugin.onComponentRemove(entity, component);
        } catch (error) {
          console.error(`Error in plugin ${pluginName} onComponentRemove:`, error);
        }
      }
    }
  }

  /**
   * Remove component from entity (called by Entity)
   * 从实体移除组件（由 Entity 调用）
   * @internal
   */
  removeComponentFromEntity(entityId: EntityId, componentType: ComponentType): void {
    this.handleComponentRemoval(entityId, componentType);
  }

  /**
   * Get component from entity (called by Entity)
   * 从实体获取组件（由 Entity 调用）
   * @internal
   */
  getEntityComponent<T extends Component>(entityId: EntityId, componentType: ComponentType<T>): T | undefined {
    return this._archetypeManager.getEntityComponent(entityId, componentType);
  }

  /**
   * Check if entity has component (called by Entity)
   * 检查实体是否有组件（由 Entity 调用）
   * @internal
   */
  entityHasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    return this._archetypeManager.entityHasComponent(entityId, componentType);
  }

  /**
   * Get all components from entity (called by Entity)
   * 获取实体的所有组件（由 Entity 调用）
   * @internal
   */
  getEntityComponents(entityId: EntityId): Component[] {
    return this._archetypeManager.getEntityComponents(entityId);
  }

  /**
   * Check if entity is alive (exists in world)
   * 检查实体是否存活（存在于世界中）
   * @internal
   */
  isAlive(entityId: EntityId): boolean {
    return this._entities.has(entityId);
  }

  /**
   * Check if entity is enabled (participates in systems)
   * 检查实体是否启用（参与系统）
   * @internal
   */
  isEnabled(entityId: EntityId): boolean {
    return this._entityEnabledStates.get(entityId) ?? false;
  }

  /**
   * Set entity enabled state (participates in systems)
   * 设置实体启用状态（参与系统）
   * @internal
   */
  setEnabled(entityId: EntityId, enabled: boolean): void {
    this._entityEnabledStates.set(entityId, enabled);

    // Clear query cache when entity state changes
    this._queryManager.clearCache();
  }

  /**
   * Destroy entity completely (called by Entity)
   * 完全销毁实体（由 Entity 调用）
   * @internal
   */
  destroyEntity(entityId: EntityId): void {
    this.removeEntity(entityId);
  }
}