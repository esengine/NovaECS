/**
 * Simple event channel for batching and consuming events
 * 用于批处理和消费事件的简单事件通道
 */
export class EventChannel<T> {
  private q: T[] = [];

  /**
   * Emit an event to the channel
   * 向通道发出事件
   */
  emit(event: T): void {
    this.q.push(event);
  }

  /**
   * Consume all events and clear the queue
   * 逐条消费所有事件并清空队列
   */
  drain(fn: (event: T) => void): void {
    for (const event of this.q) {
      fn(event);
    }
    this.q.length = 0;
  }

  /**
   * Take all events and clear the queue (for batch processing)
   * 取出所有事件并清空队列（用于批处理）
   */
  takeAll(): T[] {
    const out = this.q.slice();
    this.q.length = 0;
    return out;
  }

  /**
   * Get current queue size
   * 获取当前队列大小
   */
  get size(): number {
    return this.q.length;
  }

  /**
   * Check if channel has events
   * 检查通道是否有事件
   */
  get hasEvents(): boolean {
    return this.q.length > 0;
  }

  /**
   * Clear all events without processing
   * 清空所有事件而不处理
   */
  clear(): void {
    this.q.length = 0;
  }
}