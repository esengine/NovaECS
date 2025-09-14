/**
 * Fixed timestep scheduler with accumulator pattern
 * 具有累加器模式的固定时间步调度器
 *
 * Key features:
 * - Stable/Reproducible: Fixed timestep simulation for physics, AI, network lockstep
 * - Anti-jitter: Uses accumulator to smooth frame time variations
 * - Spiral prevention: Limits max substeps to prevent death spiral on frame drops
 * - Smooth input: Optional dt smoothing with EMA filtering
 *
 * 核心特性：
 * - 稳定/可复现：固定时间步模拟，用于物理、AI、网络锁步
 * - 抗抖动：使用累加器平滑帧时间变化
 * - 防螺旋：限制最大子步数，防止掉帧后的死亡螺旋
 * - 平滑输入：可选的EMA滤波dt平滑
 */

import type { World } from './World';
import { Scheduler } from './Scheduler';

export interface FixedStepOpts {
  /** Fixed timestep in seconds, default 1/60 固定时间步长（秒），默认1/60 */
  fixedDt?: number;
  /** Maximum substeps per frame, default 5 单帧最大子步数，默认5 */
  maxSubSteps?: number;
  /** Maximum frame dt clamp in seconds, default 0.25 单帧最大dt夹紧值（秒），默认0.25 */
  clampDt?: number;
  /** EMA smoothing factor [0..1], default 0.1 EMA平滑因子[0..1]，默认0.1 */
  smoothFactor?: number;
  /** Time scale multiplier: 1=normal, 0=paused, 0.5=slow motion 时间倍率：1=正常，0=暂停，0.5=慢放 */
  timescale?: number;
}

export class FixedTimestepScheduler {
  /** Time accumulator for fixed timestep simulation 固定时间步模拟的时间累加器 */
  private accumulator = 0;
  /** Smoothed delta time using EMA filter 使用EMA滤波的平滑delta时间 */
  private smoothedDt = 1 / 60;
  /** Scheduler configuration options 调度器配置选项 */
  private opts: Required<FixedStepOpts>;

  constructor(
    private world: World,
    private scheduler: Scheduler,
    opts: FixedStepOpts = {}
  ) {
    this.opts = {
      fixedDt: 1 / 60,
      maxSubSteps: 5,
      clampDt: 0.25,
      smoothFactor: 0.1,
      timescale: 1,
      ...opts
    };
  }

  /**
   * Set time scale multiplier
   * 设置时间倍率
   */
  setTimescale(t: number): void {
    this.opts.timescale = Math.max(0, t);
  }

  /**
   * Set fixed timestep
   * 设置固定时间步长
   */
  setFixedDt(dt: number): void {
    this.opts.fixedDt = Math.max(1e-6, dt);
  }

  /**
   * Get current accumulator ratio for interpolation
   * 获取当前累加器比率用于插值
   */
  getAlpha(): number {
    return Math.max(0, Math.min(1, this.accumulator / this.opts.fixedDt));
  }

  /**
   * Execute one tick with fixed timestep simulation
   * 执行一次固定时间步模拟tick
   *
   * @param frameDt Real frame time elapsed in seconds 实际帧时间（秒）
   * @param render Optional render callback with interpolation alpha 可选渲染回调，提供插值alpha
   */
  tick(frameDt: number, render?: (alpha: number) => void): void {
    // 1) Sample and smooth frame delta time
    // 采样并平滑帧delta时间
    const clamped = Math.min(frameDt, this.opts.clampDt);
    this.smoothedDt += (clamped - this.smoothedDt) * this.opts.smoothFactor;

    // 2) Accumulate time with time scale applied
    // 累加时间（应用时间倍率）
    this.accumulator += this.smoothedDt * this.opts.timescale;

    // 3) Run fixed timestep simulation (spiral prevention)
    // 运行固定时间步模拟（防螺旋）
    let steps = 0;
    while (this.accumulator >= this.opts.fixedDt && steps < this.opts.maxSubSteps) {
      this.scheduler.tick(this.world, this.opts.fixedDt);
      this.accumulator -= this.opts.fixedDt;
      steps++;
    }

    // 4) Calculate interpolation alpha for rendering
    // 计算渲染插值alpha
    const alpha = this.getAlpha();
    if (render) {
      render(alpha);
    }
  }

  /**
   * Reset accumulator (useful for scene transitions or fast-forward)
   * 重置累加器（用于场景切换或快进）
   */
  reset(): void {
    this.accumulator = 0;
  }

  /**
   * Get current configuration
   * 获取当前配置
   */
  getConfig(): Required<FixedStepOpts> {
    return { ...this.opts };
  }

  /**
   * Update configuration
   * 更新配置
   */
  updateConfig(opts: Partial<FixedStepOpts>): void {
    Object.assign(this.opts, opts);
  }

  /**
   * Get debug information
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      accumulator: this.accumulator,
      smoothedDt: this.smoothedDt,
      alpha: this.getAlpha(),
      config: this.opts
    };
  }
}