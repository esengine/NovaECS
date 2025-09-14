import type { Entity } from './Entity';
import type { World } from './World';
import type { ComponentType, EventListener } from '../utils/Types';
import type { ComponentAccess } from '../utils/AccessType';
import type { Event } from './Event';
import type { EventListenerOptions } from '../utils/EventTypes';



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
  private readonly _eventListenerIds: string[] = [];

  /**
   * Component types required by this system
   * 系统所需的组件类型
   */
  public readonly requiredComponents: ComponentType[];

  /**
   * Component access patterns for dependency analysis
   * 组件访问模式，用于依赖分析
   */
  public readonly componentAccess: ComponentAccess[];

  /**
   * Create a new system with required component types
   * 创建具有所需组件类型的新系统
   * @param requiredComponents Component types that entities must have for this system 实体必须拥有的组件类型才能被此系统处理
   * @param componentAccess Component access patterns for dependency analysis 组件访问模式，用于依赖分析
   */
  constructor(
    requiredComponents: ComponentType[] = [],
    componentAccess: ComponentAccess[] = []
  ) {
    this.requiredComponents = requiredComponents;
    this.componentAccess = componentAccess;
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
   * @param world The world instance this system is being added to 系统被添加到的世界实例
   */
  onAddedToWorld(world: World): void {
    this.world = world;
  }

  /**
   * Called when system is removed from world
   * 系统从世界移除时调用
   */
  onRemovedFromWorld(): void {
    // Unsubscribe from all events
    this._unsubscribeFromAllEvents();
    this.world = undefined;
  }

  /**
   * Check if entity matches system requirements
   * 检查实体是否符合系统要求
   * @param entity The entity to check against system requirements 要检查是否符合系统要求的实体
   * @returns True if entity matches system requirements 如果实体符合系统要求则返回true
   */
  matchesEntity(entity: Entity): boolean {
    return entity.enabled && entity.hasComponents(...this.requiredComponents);
  }

  /**
   * Update system with matching entities
   * 使用匹配的实体更新系统
   * @param entities Array of entities that match this system's requirements 匹配此系统要求的实体数组
   * @param deltaTime Time elapsed since last update in milliseconds 自上次更新以来经过的时间（毫秒）
   */
  abstract update(entities: Entity[], deltaTime: number): void;

  /**
   * Called before update
   * 更新前调用
   * @param deltaTime Time elapsed since last update in milliseconds 自上次更新以来经过的时间（毫秒）
   */
  preUpdate?(deltaTime: number): void;

  /**
   * Called after update
   * 更新后调用
   */
  postUpdate?(deltaTime: number): void;

  /**
   * Subscribe to events by event type string
   * 通过事件类型字符串订阅事件
   *
   * @param eventType Event type string 事件类型字符串
   * @param listener Event listener function 事件监听器函数
   * @param options Listener options 监听器选项
   * @returns Listener ID for unsubscription 用于取消订阅的监听器ID
   */
  protected subscribeToEvent<T extends Event>(
    eventType: string,
    listener: EventListener<T>,
    options?: EventListenerOptions
  ): string {
    if (!this.world) {
      throw new Error('System must be added to world before subscribing to events');
    }

    const listenerId = this.world.eventBus.on(eventType, listener, options);
    this._eventListenerIds.push(listenerId);
    return listenerId;
  }

  /**
   * Subscribe to events by event class constructor
   * 通过事件类构造函数订阅事件
   *
   * @param eventClass Event class constructor 事件类构造函数
   * @param listener Event listener function 事件监听器函数
   * @param options Listener options 监听器选项
   * @returns Listener ID for unsubscription 用于取消订阅的监听器ID
   */
  protected subscribeToEventType<T extends Event>(
    eventClass: new (...args: unknown[]) => T,
    listener: EventListener<T>,
    options?: EventListenerOptions
  ): string {
    if (!this.world) {
      throw new Error('System must be added to world before subscribing to events');
    }

    const listenerId = this.world.eventBus.onType(eventClass, listener, options);
    this._eventListenerIds.push(listenerId);
    return listenerId;
  }

  /**
   * Dispatch an event
   * 分发事件
   *
   * @param event Event to dispatch 要分发的事件
   */
  protected dispatchEvent(event: Event): void {
    if (!this.world) {
      throw new Error('System must be added to world before dispatching events');
    }

    void this.world.eventBus.dispatch(event);
  }

  /**
   * Unsubscribe from a specific event
   * 取消订阅特定事件
   *
   * @param listenerId Listener ID returned by subscribe methods 订阅方法返回的监听器ID
   * @returns Whether listener was found and removed 是否找到并移除了监听器
   */
  protected unsubscribeFromEvent(listenerId: string): boolean {
    if (!this.world) {
      return false;
    }

    const index = this._eventListenerIds.indexOf(listenerId);
    if (index !== -1) {
      this._eventListenerIds.splice(index, 1);
      return this.world.eventBus.off(listenerId);
    }

    return false;
  }

  /**
   * Unsubscribe from all events
   * 取消订阅所有事件
   */
  private _unsubscribeFromAllEvents(): void {
    if (!this.world) {
      return;
    }

    for (const listenerId of this._eventListenerIds) {
      this.world.eventBus.off(listenerId);
    }
    this._eventListenerIds.length = 0;
  }
}