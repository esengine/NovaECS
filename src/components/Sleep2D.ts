/**
 * Sleep component for 2D physics bodies
 *
 * Tracks sleeping state and accumulated idle time for performance optimization.
 * Sleeping bodies are excluded from physics calculations until awakened.
 *
 * 2D物理刚体的睡眠组件
 *
 * 跟踪睡眠状态和累积静止时间，用于性能优化。
 * 睡眠的刚体会被排除在物理计算之外，直到被唤醒。
 */

import type { FX } from '../math/fixed';

export class Sleep2D {
  /**
   * Sleep state: 0 = awake, 1 = sleeping
   * 睡眠状态：0 = 清醒，1 = 睡眠
   */
  sleeping: 0 | 1 = 0;

  /**
   * Accumulated idle time in fixed-point seconds
   * When this exceeds threshold, body can enter sleep
   * 累积静止时间（定点秒）
   * 当超过阈值时，刚体可以进入睡眠
   */
  timer = 0 as FX;

  /**
   * External force to keep awake (e.g., player interaction)
   * When set to 1, prevents automatic sleeping
   * 外部强制保持清醒（例如玩家交互）
   * 设置为1时，防止自动睡眠
   */
  keepAwake: 0 | 1 = 0;
}