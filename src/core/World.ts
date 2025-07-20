import { Entity, type EntityComponentChangeCallback } from './Entity';
import type { System } from './System';
import type { Component } from './Component';
import type { ComponentType, EntityId, QueryFilter } from '../utils/Types';
import { ArchetypeManager } from './ArchetypeManager';
import { ParallelScheduler, type ExecutionGroup } from './ParallelScheduler';

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
export class World {
  private readonly _entities = new Map<EntityId, Entity>();
  private readonly _systems: System[] = [];
  private _entityIdCounter = 0;
  private _paused = false;
  private readonly _archetypeManager = new ArchetypeManager();
  private readonly _scheduler = new ParallelScheduler();

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
   * Set world paused state
   * 设置世界暂停状态
   */
  set paused(value: boolean) {
    this._paused = value;
  }



  /**
   * Create new entity in world
   * 在世界中创建新实体
   */
  createEntity(): Entity {
    const entityId = ++this._entityIdCounter;
    const entity = new Entity(entityId, this.createEntityChangeCallback(entityId));

    // Configure entity for archetype storage (always enabled)
    entity.setArchetypeStorageMode(true);
    entity.setExternalComponentProvider((id, componentType) =>
      this._archetypeManager.getEntityComponent(id, componentType)
    );

    this._entities.set(entity.id, entity);
    return entity;
  }

  /**
   * Add existing entity to world
   * 将现有实体添加到世界
   */
  addEntity(entity: Entity): this {
    // Configure entity for archetype storage (always enabled)
    entity.setArchetypeStorageMode(true);
    entity.setChangeCallback(this.createEntityChangeCallback(entity.id));
    entity.setExternalComponentProvider((id, componentType) =>
      this._archetypeManager.getEntityComponent(id, componentType)
    );

    // Move existing components to archetype storage
    const components = entity.getComponents();
    if (components.length > 0) {
      const componentMap = new Map<ComponentType, Component>();
      for (const component of components) {
        componentMap.set(component.constructor as ComponentType, component);
      }
      this._archetypeManager.addEntity(entity.id, componentMap);
      entity.clear(); // Clear traditional storage
    }

    this._entities.set(entity.id, entity);
    return this;
  }

  /**
   * Remove entity from world
   * 从世界移除实体
   */
  removeEntity(entityOrId: Entity | EntityId): this {
    const id = typeof entityOrId === 'number' ? entityOrId : entityOrId.id;
    const entity = this._entities.get(id);
    if (entity) {
      entity.destroy();
      this._entities.delete(id);
    }
    return this;
  }

  /**
   * Get entity by ID
   * 通过ID获取实体
   */
  getEntity(id: EntityId): Entity | undefined {
    return this._entities.get(id);
  }

  /**
   * Query entities with specific component types
   * 查询具有特定组件类型的实体
   */
  queryEntities(...componentTypes: ComponentType[]): Entity[] {
    // Use archetype-optimized query (always enabled)
    const entityIds = this._archetypeManager.queryEntities(componentTypes);
    return entityIds
      .map(id => this._entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined && entity.active);
  }

  /**
   * Query entities with custom filter
   * 使用自定义过滤器查询实体
   */
  queryEntitiesWithFilter(filter: QueryFilter): Entity[] {
    return this.entities.filter(filter);
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
    return this;
  }

  /**
   * Remove system from world
   * 从世界移除系统
   */
  removeSystem(system: System): this {
    const index = this._systems.indexOf(system);
    if (index !== -1) {
      this._systems.splice(index, 1);
      this._scheduler.removeSystem(system);
      system.onRemovedFromWorld();
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
    void this.updateParallel(deltaTime).then(() => {
      this._cleanupDestroyedEntities();
    });
  }



  /**
   * Update systems in parallel based on dependency analysis
   * 基于依赖分析并行更新系统
   */
  private async updateParallel(deltaTime: number): Promise<void> {
    const executionGroups = this._scheduler.getExecutionGroups();

    // Execute groups sequentially, but systems within each group in parallel
    for (const group of executionGroups) {
      // Skip empty groups
      if (group.systems.length === 0) continue;

      // Execute systems in the same group in parallel
      const promises = group.systems
        .filter((system: System) => system.enabled)
        .map((system: System) => this.executeSystemAsync(system, deltaTime));

      // Wait for all systems in this group to complete before moving to next group
      await Promise.all(promises);
    }
  }

  /**
   * Execute a single system asynchronously
   * 异步执行单个系统
   */
  private async executeSystemAsync(system: System, deltaTime: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // Use setTimeout to make it async and allow other systems to run
      setTimeout(() => {
        try {
          system.preUpdate?.(deltaTime);

          // Use archetype-optimized query for better performance
          const matchingEntities = this.queryEntities(...system.requiredComponents);

          system.update(matchingEntities, deltaTime);
          system.postUpdate?.(deltaTime);
        } catch (error) {
          console.error(`Error in system ${system.constructor.name}:`, error);
        } finally {
          resolve();
        }
      }, 0);
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

    this._entityIdCounter = 0;
    return this;
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
   * Create entity component change callback
   * 创建实体组件变化回调
   */
  private createEntityChangeCallback(_entityId: EntityId): EntityComponentChangeCallback {
    return (id, componentType, component, isAddition) => {
      if (isAddition && component) {
        // Handle component addition
        this.handleComponentAddition(id, componentType, component);
      } else {
        // Handle component removal
        this.handleComponentRemoval(id, componentType);
      }
    };
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
      removedComponent.onRemoved?.();
      currentComponents.delete(componentType);
    }

    // Add to new archetype (if any components remain)
    if (currentComponents.size > 0) {
      this._archetypeManager.addEntity(entityId, currentComponents);
    }
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

  private _cleanupDestroyedEntities(): void {
    for (const [id, entity] of this._entities) {
      if (!entity.active) {
        this._entities.delete(id);
      }
    }
  }
}