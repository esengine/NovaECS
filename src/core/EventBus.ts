import type { Event } from './Event';
import type { EventListener, EventListenerInfo, EventType } from '../utils/Types';
import type { EventListenerOptions, EventDispatchOptions, EventStatistics } from '../utils/EventTypes';
import { EventPriority, EventProcessingMode } from '../utils/EventTypes';

/**
 * Global event bus for decoupled communication between systems
 * 用于系统间解耦通信的全局事件总线
 * 
 * @example
 * ```typescript
 * const eventBus = new EventBus();
 * 
 * // Subscribe to events
 * eventBus.on(PlayerDeathEvent, (event) => {
 *   console.log(`Player ${event.playerId} died: ${event.cause}`);
 * });
 * 
 * // Dispatch events
 * eventBus.dispatch(new PlayerDeathEvent(1, 'fell into lava'));
 * 
 * // One-time subscription
 * eventBus.once(GameStartEvent, (event) => {
 *   console.log('Game started!');
 * });
 * ```
 */
export class EventBus {
  private readonly _listeners = new Map<string, EventListenerInfo[]>();
  private readonly _typeListeners = new Map<EventType, EventListenerInfo[]>();
  private _listenerIdCounter = 0;
  private _statistics: EventStatistics = {
    totalDispatched: 0,
    averageProcessingTime: 0,
    eventsPerSecond: 0
  };
  private _lastSecondTimestamp = Date.now();
  private _eventsThisSecond = 0;

  /**
   * Subscribe to events by event type string
   * 通过事件类型字符串订阅事件
   * 
   * @param eventType Event type string 事件类型字符串
   * @param listener Event listener function 事件监听器函数
   * @param options Listener options 监听器选项
   * @returns Listener ID for unsubscription 用于取消订阅的监听器ID
   */
  on<T extends Event>(
    eventType: string,
    listener: EventListener<T>,
    options: EventListenerOptions = {}
  ): string {
    const listenerId = `listener_${++this._listenerIdCounter}`;
    const listenerInfo: EventListenerInfo<T> = {
      listener,
      priority: options.priority ?? EventPriority.Normal,
      once: options.once ?? false,
      id: listenerId
    };

    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, []);
    }

    const listeners = this._listeners.get(eventType);
    if (!listeners) return listenerId;
    listeners.push(listenerInfo as EventListenerInfo);
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);

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
  onType<T extends Event>(
    eventClass: EventType<T>,
    listener: EventListener<T>,
    options: EventListenerOptions = {}
  ): string {
    const listenerId = `type_listener_${++this._listenerIdCounter}`;
    const listenerInfo: EventListenerInfo<T> = {
      listener,
      priority: options.priority ?? EventPriority.Normal,
      once: options.once ?? false,
      id: listenerId
    };

    if (!this._typeListeners.has(eventClass)) {
      this._typeListeners.set(eventClass, []);
    }

    const listeners = this._typeListeners.get(eventClass);
    if (!listeners) return listenerId;
    listeners.push(listenerInfo as EventListenerInfo);
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);

    return listenerId;
  }

  /**
   * Subscribe to event once (automatically unsubscribes after first call)
   * 订阅事件一次（第一次调用后自动取消订阅）
   * 
   * @param eventType Event type string 事件类型字符串
   * @param listener Event listener function 事件监听器函数
   * @param options Listener options 监听器选项
   * @returns Listener ID for unsubscription 用于取消订阅的监听器ID
   */
  once<T extends Event>(
    eventType: string,
    listener: EventListener<T>,
    options: EventListenerOptions = {}
  ): string {
    return this.on(eventType, listener, { ...options, once: true });
  }

  /**
   * Subscribe to event class once (automatically unsubscribes after first call)
   * 订阅事件类一次（第一次调用后自动取消订阅）
   * 
   * @param eventClass Event class constructor 事件类构造函数
   * @param listener Event listener function 事件监听器函数
   * @param options Listener options 监听器选项
   * @returns Listener ID for unsubscription 用于取消订阅的监听器ID
   */
  onceType<T extends Event>(
    eventClass: EventType<T>,
    listener: EventListener<T>,
    options: EventListenerOptions = {}
  ): string {
    return this.onType(eventClass, listener, { ...options, once: true });
  }

  /**
   * Unsubscribe from events by listener ID
   * 通过监听器ID取消订阅事件
   * 
   * @param listenerId Listener ID returned by on/once methods 由on/once方法返回的监听器ID
   * @returns Whether listener was found and removed 是否找到并移除了监听器
   */
  off(listenerId: string): boolean {
    // Check string-based listeners
    for (const [eventType, listeners] of this._listeners.entries()) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this._listeners.delete(eventType);
        }
        return true;
      }
    }

    // Check type-based listeners
    for (const [eventClass, listeners] of this._typeListeners.entries()) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this._typeListeners.delete(eventClass);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Remove all listeners for a specific event type
   * 移除特定事件类型的所有监听器
   * 
   * @param eventType Event type string 事件类型字符串
   * @returns Number of listeners removed 移除的监听器数量
   */
  offAll(eventType: string): number {
    const listeners = this._listeners.get(eventType);
    if (listeners) {
      const count = listeners.length;
      this._listeners.delete(eventType);
      return count;
    }
    return 0;
  }

  /**
   * Remove all listeners for a specific event class
   * 移除特定事件类的所有监听器
   * 
   * @param eventClass Event class constructor 事件类构造函数
   * @returns Number of listeners removed 移除的监听器数量
   */
  offAllType<T extends Event>(eventClass: EventType<T>): number {
    const listeners = this._typeListeners.get(eventClass);
    if (listeners) {
      const count = listeners.length;
      this._typeListeners.delete(eventClass);
      return count;
    }
    return 0;
  }

  /**
   * Dispatch an event to all registered listeners
   * 向所有注册的监听器分发事件
   * 
   * @param event Event to dispatch 要分发的事件
   * @param options Dispatch options 分发选项
   * @returns Promise that resolves when all listeners have been called 当所有监听器都被调用时解析的Promise
   */
  async dispatch<T extends Event>(
    event: T,
    options: EventDispatchOptions = {}
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Update statistics
      this._statistics.totalDispatched++;
      this._updateEventsPerSecond();

      // Handle immediate processing
      if (options.processingMode === EventProcessingMode.Immediate || 
          event.processingMode === EventProcessingMode.Immediate) {
        await this._dispatchImmediate(event, options);
      } else {
        // For other processing modes, we would queue the event
        // This is a simplified implementation - full implementation would use EventScheduler
        await this._dispatchImmediate(event, options);
      }

      // Update processing time statistics
      const processingTime = performance.now() - startTime;
      this._updateAverageProcessingTime(processingTime);

    } catch (error) {
      console.error(`Error dispatching event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Get event bus statistics
   * 获取事件总线统计信息
   */
  getStatistics(): EventStatistics {
    return { ...this._statistics };
  }

  /**
   * Clear all listeners and reset statistics
   * 清除所有监听器并重置统计信息
   */
  clear(): void {
    this._listeners.clear();
    this._typeListeners.clear();
    this._statistics = {
      totalDispatched: 0,
      averageProcessingTime: 0,
      eventsPerSecond: 0
    };
  }

  /**
   * Get number of listeners for an event type
   * 获取事件类型的监听器数量
   */
  getListenerCount(eventType: string): number {
    return this._listeners.get(eventType)?.length ?? 0;
  }

  /**
   * Get number of listeners for an event class
   * 获取事件类的监听器数量
   */
  getTypeListenerCount<T extends Event>(eventClass: EventType<T>): number {
    return this._typeListeners.get(eventClass)?.length ?? 0;
  }

  /**
   * Check if there are any listeners for an event type
   * 检查是否有事件类型的监听器
   */
  hasListeners(eventType: string): boolean {
    return this.getListenerCount(eventType) > 0;
  }

  /**
   * Check if there are any listeners for an event class
   * 检查是否有事件类的监听器
   */
  hasTypeListeners<T extends Event>(eventClass: EventType<T>): boolean {
    return this.getTypeListenerCount(eventClass) > 0;
  }

  /**
   * Dispatch event immediately to all listeners
   * 立即向所有监听器分发事件
   */
  private async _dispatchImmediate<T extends Event>(
    event: T,
    options: EventDispatchOptions
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Dispatch to string-based listeners
    const stringListeners = this._listeners.get(event.type);
    if (stringListeners) {
      for (const listenerInfo of stringListeners) {
        if (event.propagationStopped && options.stopPropagation) {
          break;
        }

        promises.push(this._callListener(listenerInfo as EventListenerInfo<T>, event));

        // Remove one-time listeners
        if (listenerInfo.once) {
          this.off(listenerInfo.id);
        }
      }
    }

    // Dispatch to type-based listeners
    const eventClass = event.constructor as EventType<T>;
    const typeListeners = this._typeListeners.get(eventClass);
    if (typeListeners) {
      for (const listenerInfo of typeListeners) {
        if (event.propagationStopped && options.stopPropagation) {
          break;
        }

        promises.push(this._callListener(listenerInfo as EventListenerInfo<T>, event));

        // Remove one-time listeners
        if (listenerInfo.once) {
          this.off(listenerInfo.id);
        }
      }
    }

    // Wait for all listeners to complete
    await Promise.all(promises);
  }

  /**
   * Call a single listener with error handling
   * 调用单个监听器并处理错误
   */
  private async _callListener<T extends Event>(
    listenerInfo: EventListenerInfo<T>,
    event: T
  ): Promise<void> {
    try {
      const result = listenerInfo.listener(event);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error(`Error in event listener for ${event.type}:`, error);
      // Don't rethrow - we don't want one bad listener to break others
    }
  }

  /**
   * Update events per second statistic
   * 更新每秒事件数统计
   */
  private _updateEventsPerSecond(): void {
    const now = Date.now();
    if (now - this._lastSecondTimestamp >= 1000) {
      this._statistics.eventsPerSecond = this._eventsThisSecond;
      this._eventsThisSecond = 0;
      this._lastSecondTimestamp = now;
    }
    this._eventsThisSecond++;
  }

  /**
   * Update average processing time statistic
   * 更新平均处理时间统计
   */
  private _updateAverageProcessingTime(processingTime: number): void {
    const totalEvents = this._statistics.totalDispatched;
    const currentAverage = this._statistics.averageProcessingTime;
    
    // Calculate running average
    this._statistics.averageProcessingTime = 
      (currentAverage * (totalEvents - 1) + processingTime) / totalEvents;
  }
}
