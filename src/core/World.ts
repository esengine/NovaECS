import { Entity } from './Entity';
import type { System } from './System';
import type { ComponentType, EntityId, QueryFilter } from '../utils/Types';

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
    const entity = new Entity(++this._entityIdCounter);
    this._entities.set(entity.id, entity);
    return entity;
  }

  /**
   * Add existing entity to world
   * 将现有实体添加到世界
   */
  addEntity(entity: Entity): this {
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
    return this.entities.filter(entity => 
      entity.active && entity.hasComponents(...componentTypes)
    );
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

    for (const system of this._systems) {
      if (!system.enabled) continue;

      system.preUpdate?.(deltaTime);

      const matchingEntities = this.entities.filter(entity => 
        system.matchesEntity(entity)
      );

      system.update(matchingEntities, deltaTime);
      system.postUpdate?.(deltaTime);
    }

    this._cleanupDestroyedEntities();
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

  private _cleanupDestroyedEntities(): void {
    for (const [id, entity] of this._entities) {
      if (!entity.active) {
        this._entities.delete(id);
      }
    }
  }
}