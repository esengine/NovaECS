import type { Event } from './Event';
import type { EventBus } from './EventBus';
import type { EventDispatchOptions } from '../utils/EventTypes';
import { EventProcessingMode, EventPriority } from '../utils/EventTypes';

/**
 * Queued event with scheduling information
 * 带有调度信息的排队事件
 */
interface QueuedEvent {
  /** Event to be processed 要处理的事件 */
  event: Event;
  /** Dispatch options 分发选项 */
  options: EventDispatchOptions;
  /** Scheduled processing time 计划处理时间 */
  scheduledTime: number;
  /** Queue priority (higher = processed first) 队列优先级（越高越先处理） */
  queuePriority: number;
}

/**
 * Event scheduler for managing delayed and batched event processing
 * 用于管理延迟和批量事件处理的事件调度器
 * 
 * @example
 * ```typescript
 * const eventBus = new EventBus();
 * const scheduler = new EventScheduler(eventBus);
 * 
 * // Schedule event for next frame
 * scheduler.schedule(new PlayerMoveEvent(), {
 *   processingMode: EventProcessingMode.NextFrame
 * });
 * 
 * // Schedule event with delay
 * scheduler.schedule(new ExplosionEvent(), {
 *   processingMode: EventProcessingMode.Delayed,
 *   delay: 1000 // 1 second delay
 * });
 * 
 * // Process scheduled events (call this in your game loop)
 * scheduler.update(deltaTime);
 * ```
 */
export class EventScheduler {
  private readonly _immediateQueue: QueuedEvent[] = [];
  private readonly _endOfFrameQueue: QueuedEvent[] = [];
  private readonly _nextFrameQueue: QueuedEvent[] = [];
  private readonly _delayedQueue: QueuedEvent[] = [];
  // private _frameStartTime = 0; // Reserved for future frame timing features
  private _isProcessing = false;
  private _maxEventsPerFrame = 100;
  private _maxProcessingTimePerFrame = 16; // 16ms for 60fps

  /**
   * Create a new event scheduler
   * 创建新的事件调度器
   * 
   * @param eventBus Event bus to dispatch events to 要分发事件的事件总线
   */
  constructor(private readonly _eventBus: EventBus) {}

  /**
   * Schedule an event for processing
   * 调度事件进行处理
   * 
   * @param event Event to schedule 要调度的事件
   * @param options Dispatch options 分发选项
   */
  schedule(event: Event, options: EventDispatchOptions = {}): void {
    const processingMode = options.processingMode ?? event.processingMode;
    const queuedEvent: QueuedEvent = {
      event,
      options,
      scheduledTime: this._calculateScheduledTime(processingMode, options.delay),
      queuePriority: this._calculateQueuePriority(event.priority, processingMode)
    };

    switch (processingMode) {
      case EventProcessingMode.Immediate:
        this._immediateQueue.push(queuedEvent);
        this._sortQueue(this._immediateQueue);
        break;
      
      case EventProcessingMode.EndOfFrame:
        this._endOfFrameQueue.push(queuedEvent);
        this._sortQueue(this._endOfFrameQueue);
        break;
      
      case EventProcessingMode.NextFrame:
        this._nextFrameQueue.push(queuedEvent);
        this._sortQueue(this._nextFrameQueue);
        break;
      
      case EventProcessingMode.Delayed:
        this._delayedQueue.push(queuedEvent);
        this._sortQueue(this._delayedQueue);
        break;
    }
  }

  /**
   * Update scheduler and process queued events
   * 更新调度器并处理排队的事件
   *
   * @param _deltaTime Time since last update in milliseconds 自上次更新以来的时间（毫秒）
   */
  async update(_deltaTime: number): Promise<void> {
    if (this._isProcessing) {
      return; // Prevent recursive processing
    }

    this._isProcessing = true;

    try {
      // Process immediate events first
      await this._processQueue(this._immediateQueue, 'immediate');

      // Process delayed events that are ready
      await this._processDelayedEvents();

      // Move next frame events to end of frame queue
      this._moveNextFrameEvents();

    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Process end-of-frame events (call this at the end of your game loop)
   * 处理帧结束事件（在游戏循环结束时调用）
   */
  async processEndOfFrame(): Promise<void> {
    if (this._isProcessing) {
      return;
    }

    this._isProcessing = true;

    try {
      await this._processQueue(this._endOfFrameQueue, 'endOfFrame');
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Get number of events in each queue
   * 获取每个队列中的事件数量
   */
  getQueueSizes(): {
    immediate: number;
    endOfFrame: number;
    nextFrame: number;
    delayed: number;
  } {
    return {
      immediate: this._immediateQueue.length,
      endOfFrame: this._endOfFrameQueue.length,
      nextFrame: this._nextFrameQueue.length,
      delayed: this._delayedQueue.length
    };
  }

  /**
   * Clear all queued events
   * 清除所有排队的事件
   */
  clear(): void {
    this._immediateQueue.length = 0;
    this._endOfFrameQueue.length = 0;
    this._nextFrameQueue.length = 0;
    this._delayedQueue.length = 0;
  }

  /**
   * Set maximum events to process per frame
   * 设置每帧处理的最大事件数
   */
  setMaxEventsPerFrame(max: number): void {
    this._maxEventsPerFrame = Math.max(1, max);
  }

  /**
   * Set maximum processing time per frame in milliseconds
   * 设置每帧最大处理时间（毫秒）
   */
  setMaxProcessingTimePerFrame(maxTime: number): void {
    this._maxProcessingTimePerFrame = Math.max(1, maxTime);
  }

  /**
   * Calculate scheduled time for an event
   * 计算事件的计划时间
   */
  private _calculateScheduledTime(
    processingMode: EventProcessingMode,
    delay?: number
  ): number {
    const now = Date.now();

    switch (processingMode) {
      case EventProcessingMode.Delayed:
        // If no delay specified, use a small default delay to ensure it's not processed immediately
        return now + (delay ?? 1);
      default:
        return now;
    }
  }

  /**
   * Calculate queue priority for an event
   * 计算事件的队列优先级
   */
  private _calculateQueuePriority(
    eventPriority: EventPriority,
    processingMode: EventProcessingMode
  ): number {
    let basePriority = eventPriority;
    
    // Boost priority for immediate events
    if (processingMode === EventProcessingMode.Immediate) {
      basePriority += 1000;
    }
    
    return basePriority;
  }

  /**
   * Sort a queue by priority (highest first)
   * 按优先级排序队列（最高优先级在前）
   */
  private _sortQueue(queue: QueuedEvent[]): void {
    queue.sort((a, b) => {
      // First sort by queue priority
      if (a.queuePriority !== b.queuePriority) {
        return b.queuePriority - a.queuePriority;
      }
      
      // Then by scheduled time (earlier first)
      return a.scheduledTime - b.scheduledTime;
    });
  }

  /**
   * Process a specific queue
   * 处理特定队列
   */
  private async _processQueue(queue: QueuedEvent[], queueName: string): Promise<void> {
    let processedCount = 0;
    const startTime = performance.now();

    while (queue.length > 0 && processedCount < this._maxEventsPerFrame) {
      // Check if we've exceeded our time budget
      if (performance.now() - startTime > this._maxProcessingTimePerFrame) {
        break;
      }

      const queuedEvent = queue.shift();
      if (!queuedEvent) break;
      
      try {
        await this._eventBus.dispatch(queuedEvent.event, queuedEvent.options);
        processedCount++;
      } catch (error) {
        console.error(`Error processing event from ${queueName} queue:`, error);
      }
    }

    // Log warning if we couldn't process all events
    if (queue.length > 0) {
      console.warn(
        `EventScheduler: Could not process all events in ${queueName} queue. ` +
        `${queue.length} events remaining. Consider increasing maxEventsPerFrame or maxProcessingTimePerFrame.`
      );
    }
  }

  /**
   * Process delayed events that are ready
   * 处理准备就绪的延迟事件
   */
  private async _processDelayedEvents(): Promise<void> {
    const now = Date.now();
    const readyEvents: QueuedEvent[] = [];

    // Find events that are ready to process
    for (let i = this._delayedQueue.length - 1; i >= 0; i--) {
      const queuedEvent = this._delayedQueue[i];
      if (queuedEvent.scheduledTime <= now) {
        readyEvents.push(queuedEvent);
        this._delayedQueue.splice(i, 1);
      }
    }

    // Sort ready events by priority
    readyEvents.sort((a, b) => b.queuePriority - a.queuePriority);

    // Process ready events
    let processedCount = 0;
    const startTime = performance.now();

    for (const queuedEvent of readyEvents) {
      if (processedCount >= this._maxEventsPerFrame ||
          performance.now() - startTime > this._maxProcessingTimePerFrame) {
        // Put remaining events back in delayed queue
        this._delayedQueue.push(...readyEvents.slice(processedCount));
        this._sortQueue(this._delayedQueue);
        break;
      }

      try {
        await this._eventBus.dispatch(queuedEvent.event, queuedEvent.options);
        processedCount++;
      } catch (error) {
        console.error('Error processing delayed event:', error);
      }
    }
  }

  /**
   * Move next frame events to end of frame queue
   * 将下一帧事件移动到帧结束队列
   */
  private _moveNextFrameEvents(): void {
    while (this._nextFrameQueue.length > 0) {
      const queuedEvent = this._nextFrameQueue.shift();
      if (!queuedEvent) break;
      this._endOfFrameQueue.push(queuedEvent);
    }
    
    this._sortQueue(this._endOfFrameQueue);
  }
}
