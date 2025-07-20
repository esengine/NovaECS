import type { Entity } from './Entity';
import type { World } from './World';
import type { ComponentType } from '../utils/Types';

/**
 * Base class for all systems in the ECS architecture
 * ECS架构中所有系统的基类
 * 
 * @example
 * ```typescript
 * class MovementSystem extends System {
 *   constructor() {
 *     super([PositionComponent, VelocityComponent]);
 *   }
 * 
 *   update(entities: Entity[], deltaTime: number): void {
 *     for (const entity of entities) {
 *       const position = entity.getComponent(PositionComponent)!;
 *       const velocity = entity.getComponent(VelocityComponent)!;
 *       
 *       position.x += velocity.dx * deltaTime;
 *       position.y += velocity.dy * deltaTime;
 *     }
 *   }
 * }
 * ```
 */
export abstract class System {
  private _enabled = true;
  private _priority = 0;
  protected world: World | undefined = undefined;

  /**
   * Component types required by this system
   * 系统所需的组件类型
   */
  public readonly requiredComponents: ComponentType[];

  /**
   * Create a new system with required component types
   * 创建具有所需组件类型的新系统
   */
  constructor(requiredComponents: ComponentType[] = []) {
    this.requiredComponents = requiredComponents;
  }

  /**
   * Get system enabled state
   * 获取系统启用状态
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Set system enabled state
   * 设置系统启用状态
   */
  set enabled(value: boolean) {
    this._enabled = value;
  }

  /**
   * Get system priority (higher values execute first)
   * 获取系统优先级（较高值先执行）
   */
  get priority(): number {
    return this._priority;
  }

  /**
   * Set system priority
   * 设置系统优先级
   */
  set priority(value: number) {
    this._priority = value;
  }

  /**
   * Called when system is added to world
   * 系统添加到世界时调用
   */
  onAddedToWorld(world: World): void {
    this.world = world;
  }

  /**
   * Called when system is removed from world
   * 系统从世界移除时调用
   */
  onRemovedFromWorld(): void {
    this.world = undefined;
  }

  /**
   * Check if entity matches system requirements
   * 检查实体是否符合系统要求
   */
  matchesEntity(entity: Entity): boolean {
    return entity.active && entity.hasComponents(...this.requiredComponents);
  }

  /**
   * Update system with matching entities
   * 使用匹配的实体更新系统
   */
  abstract update(entities: Entity[], deltaTime: number): void;

  /**
   * Called before update
   * 更新前调用
   */
  preUpdate?(deltaTime: number): void;

  /**
   * Called after update
   * 更新后调用
   */
  postUpdate?(deltaTime: number): void;
}