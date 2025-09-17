/**
 * Configuration for physics sleep/wake system
 *
 * Controls thresholds and timing for automatic sleeping and waking of physics bodies.
 * Conservative default values ensure stable behavior while providing performance benefits.
 *
 * 物理睡眠/唤醒系统配置
 *
 * 控制物理刚体自动睡眠和唤醒的阈值和时间。
 * 保守的默认值确保稳定行为，同时提供性能优势。
 */

import type { FX } from '../math/fixed';
import { f } from '../math/fixed';

export class PhysicsSleepConfig {
  /**
   * Linear velocity threshold for sleep consideration (m/s)
   * Bodies below this velocity can potentially sleep
   * 线速度睡眠阈值（米/秒）
   * 低于此速度的刚体可能进入睡眠
   */
  linThresh: FX = f(0.02);

  /**
   * Angular velocity threshold for sleep consideration (rad/s)
   * Bodies below this angular velocity can potentially sleep
   * 角速度睡眠阈值（弧度/秒）
   * 低于此角速度的刚体可能进入睡眠
   */
  angThresh: FX = f(0.05);

  /**
   * Time required below thresholds before sleeping (seconds)
   * Body must remain below velocity thresholds for this duration
   * 进入睡眠前需要低于阈值的时间（秒）
   * 刚体必须在此持续时间内保持低于速度阈值
   */
  timeToSleep: FX = f(0.5);

  /**
   * Wake bias multiplier for threshold comparison
   * When velocity exceeds threshold * wakeBias, body wakes immediately
   * 唤醒偏差乘数，用于阈值比较
   * 当速度超过阈值 * wakeBias时，刚体立即唤醒
   */
  wakeBias: FX = f(1.5);

  /**
   * Impulse threshold for forced awakening
   * When accumulated normal/tangential impulse exceeds this, body wakes
   * 强制唤醒的冲量阈值
   * 当累积的法向/切向冲量超过此值时，刚体唤醒
   */
  impulseWake: FX = f(0.01);
}