import type { FX } from '../math/fixed';

/**
 * Time of Impact (TOI) event data
 * 碰撞时间事件数据
 */
export type TOIEvent2D = {
  a: number;    // Entity A / 实体A
  b: number;    // Entity B / 实体B
  t: FX;        // TOI ∈ [0,1] / 碰撞时间比例
  nx: FX;       // Impact normal X (Hull→Circle) / 撞击法线X（凸包→圆形）
  ny: FX;       // Impact normal Y (Hull→Circle) / 撞击法线Y（凸包→圆形）
  px: FX;       // Contact point X (world) / 接触点X（世界坐标）
  py: FX;       // Contact point Y (world) / 接触点Y（世界坐标）
};

/**
 * TOI Queue Resource for managing time-ordered collision events
 * TOI 队列资源，管理按时间排序的碰撞事件
 */
export class TOIQueue2D {
  items: TOIEvent2D[] = [];

  /**
   * Clear all TOI events
   * 清空所有TOI事件
   */
  clear(): void {
    this.items.length = 0;
  }

  /**
   * Add a TOI event to the queue
   * 添加TOI事件到队列
   */
  add(event: TOIEvent2D): void {
    this.items.push(event);
  }

  /**
   * Sort events by time (deterministic)
   * 按时间排序事件（确定性）
   */
  sort(): void {
    this.items.sort((a, b) => {
      // Primary: sort by time
      if (a.t !== b.t) return a.t - b.t;

      // Secondary: stable sort by entity IDs for determinism
      if (a.a !== b.a) return a.a - b.a;
      return a.b - b.b;
    });
  }

  /**
   * Get the earliest TOI event
   * 获取最早的TOI事件
   */
  getEarliest(): TOIEvent2D | null {
    if (this.items.length === 0) return null;
    return this.items[0];
  }

  /**
   * Remove and return the earliest TOI event
   * 移除并返回最早的TOI事件
   */
  popEarliest(): TOIEvent2D | null {
    if (this.items.length === 0) return null;
    return this.items.shift()!;
  }

  /**
   * Check if queue is empty
   * 检查队列是否为空
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get number of events in queue
   * 获取队列中事件数量
   */
  count(): number {
    return this.items.length;
  }
}