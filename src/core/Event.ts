import { EventPriority, EventProcessingMode } from '../utils/EventTypes';

/**
 * Base class for all events in the ECS architecture
 * ECS架构中所有事件的基类
 * 
 * @example
 * ```typescript
 * class PlayerDeathEvent extends Event {
 *   constructor(
 *     public readonly playerId: number,
 *     public readonly cause: string
 *   ) {
 *     super('PlayerDeath', EventPriority.High);
 *   }
 * }
 * 
 * class EntityCreatedEvent extends Event {
 *   constructor(public readonly entityId: number) {
 *     super('EntityCreated', EventPriority.Normal);
 *   }
 * }
 * ```
 */
export abstract class Event {
  private static _idCounter = 0;
  
  /** Unique event instance identifier 唯一事件实例标识符 */
  public readonly id: string;
  
  /** Event timestamp 事件时间戳 */
  public readonly timestamp: number;
  
  /** Whether event propagation has been stopped 是否已停止事件传播 */
  private _propagationStopped = false;
  
  /** Whether event has been consumed 是否已被消费 */
  private _consumed = false;

  /**
   * Create a new event
   * 创建新事件
   * 
   * @param type Event type identifier 事件类型标识符
   * @param priority Event priority 事件优先级
   * @param processingMode Event processing mode 事件处理模式
   */
  constructor(
    public readonly type: string,
    public readonly priority: EventPriority = EventPriority.Normal,
    public readonly processingMode: EventProcessingMode = EventProcessingMode.Immediate
  ) {
    this.id = `${this.type}_${++Event._idCounter}_${Date.now()}`;
    this.timestamp = Date.now();
  }

  /**
   * Get whether event propagation has been stopped
   * 获取是否已停止事件传播
   */
  get propagationStopped(): boolean {
    return this._propagationStopped;
  }

  /**
   * Get whether event has been consumed
   * 获取是否已被消费
   */
  get consumed(): boolean {
    return this._consumed;
  }

  /**
   * Stop event propagation to other listeners
   * 停止事件传播到其他监听器
   */
  stopPropagation(): void {
    this._propagationStopped = true;
  }

  /**
   * Mark event as consumed
   * 标记事件为已消费
   */
  consume(): void {
    this._consumed = true;
    this._propagationStopped = true;
  }

  /**
   * Reset event state for reuse (object pooling)
   * 重置事件状态以供重用（对象池）
   */
  reset(): void {
    this._propagationStopped = false;
    this._consumed = false;
  }

  /**
   * Initialize event with new parameters (for object pooling)
   * 使用新参数初始化事件（用于对象池）
   */
  initialize(..._args: unknown[]): void {
    // Default implementation does nothing
    // Subclasses should override this method to handle initialization
  }

  /**
   * Get event age in milliseconds
   * 获取事件年龄（毫秒）
   */
  getAge(): number {
    return Date.now() - this.timestamp;
  }

  /**
   * Create a string representation of the event
   * 创建事件的字符串表示
   */
  toString(): string {
    return `${this.type}[${this.id}] (priority: ${this.priority}, age: ${this.getAge()}ms)`;
  }
}

/**
 * Generic typed event for simple use cases
 * 用于简单用例的通用类型化事件
 * 
 * @example
 * ```typescript
 * // Define event data interface
 * interface PlayerMoveData {
 *   playerId: number;
 *   fromX: number;
 *   fromY: number;
 *   toX: number;
 *   toY: number;
 * }
 * 
 * // Create and dispatch event
 * const moveEvent = new TypedEvent('PlayerMove', {
 *   playerId: 1,
 *   fromX: 10,
 *   fromY: 20,
 *   toX: 15,
 *   toY: 25
 * });
 * 
 * eventBus.dispatch(moveEvent);
 * ```
 */
export class TypedEvent<T = unknown> extends Event {
  /**
   * Create a new typed event
   * 创建新的类型化事件
   * 
   * @param type Event type identifier 事件类型标识符
   * @param data Event data 事件数据
   * @param priority Event priority 事件优先级
   * @param processingMode Event processing mode 事件处理模式
   */
  constructor(
    type: string,
    public readonly data: T,
    priority: EventPriority = EventPriority.Normal,
    processingMode: EventProcessingMode = EventProcessingMode.Immediate
  ) {
    super(type, priority, processingMode);
  }
}

// Common system events
// 常见系统事件

/**
 * Entity lifecycle events
 * 实体生命周期事件
 */
export class EntityCreatedEvent extends Event {
  constructor(public readonly entityId: number) {
    super('EntityCreated', EventPriority.Normal);
  }
}

export class EntityDestroyedEvent extends Event {
  constructor(public readonly entityId: number) {
    super('EntityDestroyed', EventPriority.Normal);
  }
}

/**
 * Component lifecycle events
 * 组件生命周期事件
 */
export class ComponentAddedEvent extends Event {
  constructor(
    public readonly entityId: number,
    public readonly componentType: string
  ) {
    super('ComponentAdded', EventPriority.Normal);
  }
}

export class ComponentRemovedEvent extends Event {
  constructor(
    public readonly entityId: number,
    public readonly componentType: string
  ) {
    super('ComponentRemoved', EventPriority.Normal);
  }
}

/**
 * System lifecycle events
 * 系统生命周期事件
 */
export class SystemAddedEvent extends Event {
  constructor(public readonly systemName: string) {
    super('SystemAdded', EventPriority.Low);
  }
}

export class SystemRemovedEvent extends Event {
  constructor(public readonly systemName: string) {
    super('SystemRemoved', EventPriority.Low);
  }
}

/**
 * World lifecycle events
 * 世界生命周期事件
 */
export class WorldPausedEvent extends Event {
  constructor() {
    super('WorldPaused', EventPriority.High);
  }
}

export class WorldResumedEvent extends Event {
  constructor() {
    super('WorldResumed', EventPriority.High);
  }
}

export class WorldUpdateStartEvent extends Event {
  constructor(public readonly deltaTime: number) {
    super('WorldUpdateStart', EventPriority.Critical);
  }
}

export class WorldUpdateEndEvent extends Event {
  constructor(public readonly deltaTime: number) {
    super('WorldUpdateEnd', EventPriority.Critical);
  }
}
