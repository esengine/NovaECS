/**
 * System with SystemBuilder pattern
 * 使用SystemBuilder模式的系统
 *
 * Key points:
 * - stage: 'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup'
 * - Dependency resolution via before/after
 * - SystemContext provides world/commandBuffer/frame access
 * - Fluent API for system configuration
 *
 * 要点：
 * - 阶段：'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup'
 * - 通过before/after进行依赖解析
 * - SystemContext提供world/commandBuffer/frame访问
 * - 流畅的API进行系统配置
 */

import { World } from './World';
import { CommandBuffer } from './CommandBuffer';

export type SystemStage = 'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup';

/**
 * System execution context
 * 系统执行上下文
 */
export interface SystemContext {
  world: World;
  commandBuffer: CommandBuffer;
  frame: number;
  deltaTime: number;
}

/**
 * System configuration
 * 系统配置
 */
export interface SystemConfig {
  name: string;
  stage: SystemStage;
  before: string[];
  after: string[];
  sets?: string[];
  runIf?: (world: World) => boolean;
  flushPolicy?: 'afterEach' | 'afterStage';
  fn: (ctx: SystemContext) => void;
}

/**
 * System builder with fluent API
 * 具有流畅API的系统构建器
 */
export class SystemBuilder {
  private config: SystemConfig;

  constructor(name: string, fn: (ctx: SystemContext) => void) {
    this.config = {
      name,
      stage: 'update',
      before: [],
      after: [],
      fn
    };
  }

  /**
   * Set execution stage
   * 设置执行阶段
   */
  stage(stage: SystemStage): SystemBuilder {
    this.config.stage = stage;
    return this;
  }

  /**
   * Add dependency (this system runs before specified systems)
   * 添加依赖（此系统在指定系统之前运行）
   */
  before(name: string): SystemBuilder {
    this.config.before.push(name);
    return this;
  }

  /**
   * Add dependency (this system runs after specified systems)
   * 添加依赖（此系统在指定系统之后运行）
   */
  after(name: string): SystemBuilder {
    this.config.after.push(name);
    return this;
  }

  /**
   * Add system to a set/group
   * 将系统添加到集合/组中
   */
  inSet(setName: string): SystemBuilder {
    this.config.sets ??= [];
    this.config.sets.push(setName);
    return this;
  }

  /**
   * Set conditional execution predicate
   * 设置条件执行谓词
   */
  runIf(predicate: (world: World) => boolean): SystemBuilder {
    this.config.runIf = predicate;
    return this;
  }

  /**
   * Set command buffer flush policy
   * 设置命令缓冲刷新策略
   */
  flushPolicy(policy: 'afterEach' | 'afterStage'): SystemBuilder {
    this.config.flushPolicy = policy;
    return this;
  }

  /**
   * Build and return the system config
   * 构建并返回系统配置
   */
  build(): SystemConfig {
    return { ...this.config };
  }
}

/**
 * Convenience function to create system builder
 * 创建系统构建器的便利函数
 */
export function system(name: string, fn: (ctx: SystemContext) => void): SystemBuilder {
  return new SystemBuilder(name, fn);
}