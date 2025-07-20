/**
 * Event system type definitions for NovaECS
 * NovaECS事件系统类型定义
 */

/**
 * Event priority levels for controlling execution order
 * 事件优先级，用于控制执行顺序
 */
export enum EventPriority {
  /** Lowest priority 最低优先级 */
  Lowest = 0,
  /** Low priority 低优先级 */
  Low = 25,
  /** Normal priority 普通优先级 */
  Normal = 50,
  /** High priority 高优先级 */
  High = 75,
  /** Highest priority 最高优先级 */
  Highest = 100,
  /** Critical priority (system events) 关键优先级（系统事件） */
  Critical = 1000
}

/**
 * Event processing mode
 * 事件处理模式
 */
export enum EventProcessingMode {
  /** Process immediately 立即处理 */
  Immediate = 'immediate',
  /** Process at end of frame 帧结束时处理 */
  EndOfFrame = 'endOfFrame',
  /** Process next frame 下一帧处理 */
  NextFrame = 'nextFrame',
  /** Process with custom delay 自定义延迟处理 */
  Delayed = 'delayed'
}

/**
 * Event listener options
 * 事件监听器选项
 */
export interface EventListenerOptions {
  /** Listener priority 监听器优先级 */
  priority?: EventPriority;
  /** Whether listener should be called only once 是否只调用一次 */
  once?: boolean;
  /** Processing mode 处理模式 */
  processingMode?: EventProcessingMode;
  /** Delay in milliseconds (for delayed mode) 延迟时间（毫秒，用于延迟模式） */
  delay?: number;
}

/**
 * Event dispatch options
 * 事件分发选项
 */
export interface EventDispatchOptions {
  /** Processing mode 处理模式 */
  processingMode?: EventProcessingMode;
  /** Delay in milliseconds (for delayed mode) 延迟时间（毫秒，用于延迟模式） */
  delay?: number;
  /** Whether to stop propagation after first handler 是否在第一个处理器后停止传播 */
  stopPropagation?: boolean;
}

/**
 * Event statistics for monitoring
 * 事件统计信息，用于监控
 */
export interface EventStatistics {
  /** Total events dispatched 分发的事件总数 */
  totalDispatched: number;
  /** Average processing time per event 每个事件的平均处理时间 */
  averageProcessingTime: number;
  /** Events processed per second 每秒处理的事件数 */
  eventsPerSecond: number;
}
