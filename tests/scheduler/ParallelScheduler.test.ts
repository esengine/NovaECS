/**
 * ParallelScheduler tests
 * ParallelScheduler 测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../../src/core/World';
import { registerComponent } from '../../src/core/ComponentRegistry';
import { system } from '../../src/core/System';
import {
  ParallelScheduler,
  ParallelSchedulerConfig
} from '../../src/scheduler/ParallelScheduler';

// 测试组件
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Transform {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public rotation: number = 0
  ) {}
}

describe('ParallelScheduler', () => {
  let scheduler: ParallelScheduler;
  let world: World;

  beforeEach(() => {
    scheduler = new ParallelScheduler();
    world = new World();

    // 注册测试组件
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Transform);
  });

  describe('基础配置', () => {
    test('应该使用默认配置创建', () => {
      const defaultScheduler = new ParallelScheduler();
      const stats = defaultScheduler.getStats();
      expect(stats.totalSystems).toBe(0);
    });

    test('应该使用自定义配置创建', () => {
      const config: ParallelSchedulerConfig = {
        enableParallel: false,
        fallbackToSequential: false
      };

      const customScheduler = new ParallelScheduler(config);
      expect(customScheduler).toBeDefined();
    });

    test('应该启用和禁用并行执行', () => {
      scheduler.setParallelEnabled(false);
      scheduler.setParallelEnabled(true);
      expect(scheduler).toBeDefined();
    });
  });

  describe('系统添加', () => {
    test('应该添加简单系统', () => {
      const movementSystem = system('MovementSystem', ctx => {
        const query = ctx.world.query(Position, Velocity);
        for (const [entity, pos, vel] of query) {
          pos.x += vel.dx * ctx.deltaTime;
          pos.y += vel.dy * ctx.deltaTime;
        }
      }).stage('update');

      scheduler.add(movementSystem);

      const stats = scheduler.getStats();
      expect(stats.totalSystems).toBe(1);
    });

    test('应该添加多个系统', () => {
      const inputSystem = system('InputSystem', () => {
        // 输入处理逻辑
      }).stage('preUpdate');

      const movementSystem = system('MovementSystem', () => {
        // 移动逻辑
      }).stage('update').after('InputSystem');

      const renderSystem = system('RenderSystem', () => {
        // 渲染逻辑
      }).stage('postUpdate').after('MovementSystem');

      scheduler.add(inputSystem);
      scheduler.add(movementSystem);
      scheduler.add(renderSystem);

      const stats = scheduler.getStats();
      expect(stats.totalSystems).toBe(3);
    });
  });

  describe('系统执行', () => {
    test('应该顺序执行系统', async () => {
      const executionOrder: string[] = [];

      const system1 = system('System1', () => {
        executionOrder.push('System1');
      }).stage('update');

      const system2 = system('System2', () => {
        executionOrder.push('System2');
      }).stage('update');

      scheduler.add(system1);
      scheduler.add(system2);

      await scheduler.tick(world, 16.67);

      expect(executionOrder).toContain('System1');
      expect(executionOrder).toContain('System2');
    });

    test('应该处理系统阶段', async () => {
      const executionOrder: string[] = [];

      const startupSystem = system('StartupSystem', () => {
        executionOrder.push('Startup');
      }).stage('startup');

      const updateSystem = system('UpdateSystem', () => {
        executionOrder.push('Update');
      }).stage('update');

      const cleanupSystem = system('CleanupSystem', () => {
        executionOrder.push('Cleanup');
      }).stage('cleanup');

      scheduler.add(startupSystem);
      scheduler.add(updateSystem);
      scheduler.add(cleanupSystem);

      // 第一次tick - startup应该运行
      await scheduler.tick(world, 16.67);
      expect(executionOrder).toContain('Startup');
      expect(executionOrder).toContain('Update');
      expect(executionOrder).toContain('Cleanup');

      executionOrder.length = 0;

      // 第二次tick - startup不应该再次运行
      await scheduler.tick(world, 16.67);
      expect(executionOrder).not.toContain('Startup');
      expect(executionOrder).toContain('Update');
      expect(executionOrder).toContain('Cleanup');
    });

    test('应该处理系统条件', async () => {
      let shouldRun = false;
      const executionOrder: string[] = [];

      const conditionalSystem = system('ConditionalSystem', () => {
        executionOrder.push('Conditional');
      }).stage('update').runIf(() => shouldRun);

      scheduler.add(conditionalSystem);

      // 第一次tick - 条件为false，不应该运行
      await scheduler.tick(world, 16.67);
      expect(executionOrder).not.toContain('Conditional');

      // 设置条件为true
      shouldRun = true;

      // 第二次tick - 条件为true，应该运行
      await scheduler.tick(world, 16.67);
      expect(executionOrder).toContain('Conditional');
    });

    test('应该处理系统错误并回退', async () => {
      const failingSystem = system('FailingSystem', () => {
        throw new Error('System failed');
      }).stage('update');

      scheduler.add(failingSystem);

      // 应该回退到顺序执行而不抛出错误
      await expect(scheduler.tick(world, 16.67)).resolves.not.toThrow();
    });

    test('应该处理禁用回退时的错误', async () => {
      const noFallbackScheduler = new ParallelScheduler({
        fallbackToSequential: false,
        runnerConfig: {
          continueOnFailure: false
        }
      });

      const failingSystem = system('FailingSystem', () => {
        throw new Error('System failed');
      }).stage('update');

      noFallbackScheduler.add(failingSystem);

      // 禁用回退时应该抛出错误
      await expect(noFallbackScheduler.tick(world, 16.67)).rejects.toThrow();
    });
  });

  describe('并行执行', () => {
    test('应该启用并行执行', async () => {
      const parallelScheduler = new ParallelScheduler({
        enableParallel: true
      });

      const system1 = system('ParallelSystem1', () => {
        // 模拟一些工作
      }).stage('update');

      const system2 = system('ParallelSystem2', () => {
        // 模拟一些工作
      }).stage('update');

      parallelScheduler.add(system1);
      parallelScheduler.add(system2);

      await parallelScheduler.tick(world, 16.67);

      const stats = parallelScheduler.getStats();
      expect(stats.totalSystems).toBe(2);
    });

    test('应该禁用并行执行', async () => {
      const sequentialScheduler = new ParallelScheduler({
        enableParallel: false
      });

      const system1 = system('SequentialSystem1', () => {
        // 模拟一些工作
      }).stage('update');

      sequentialScheduler.add(system1);

      await sequentialScheduler.tick(world, 16.67);

      const stats = sequentialScheduler.getStats();
      expect(stats.totalSystems).toBe(1);
      expect(stats.parallelSystems).toBe(0); // 并行执行被禁用
    });
  });

  describe('实际系统执行', () => {
    test('应该执行移动系统', async () => {
      // 使用禁用并行的调度器进行测试
      const sequentialScheduler = new ParallelScheduler({
        enableParallel: false
      });

      // 创建实体
      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 0, y: 0 });
      world.addComponent(entity, Velocity, { dx: 10, dy: 5 });

      const movementSystem = system('MovementSystem', ctx => {
        const query = ctx.world.query(Position, Velocity);
        query.forEach((entity, pos, vel) => {
          pos.x += vel.dx * ctx.deltaTime;
          pos.y += vel.dy * ctx.deltaTime;
        });
      }).stage('update');

      sequentialScheduler.add(movementSystem);

      await sequentialScheduler.tick(world, 1.0);

      const pos = world.getComponent(entity, Position);
      expect(pos?.x).toBe(10);
      expect(pos?.y).toBe(5);
    });

    test('应该使用命令缓冲区', async () => {
      // 使用禁用并行的调度器进行测试
      const sequentialScheduler = new ParallelScheduler({
        enableParallel: false
      });

      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 0, y: 0 });

      const addVelocitySystem = system('AddVelocitySystem', ctx => {
        const query = ctx.world.query(Position);
        query.forEach((ent, pos) => {
          // 使用命令缓冲区添加组件
          ctx.commandBuffer.add(ent, Velocity, { dx: 5, dy: 3 });
        });
      }).stage('update');

      sequentialScheduler.add(addVelocitySystem);

      await sequentialScheduler.tick(world, 16.67);

      const vel = world.getComponent(entity, Velocity);
      expect(vel?.dx).toBe(5);
      expect(vel?.dy).toBe(3);
    });
  });

  describe('访问器方法', () => {
    test('应该获取底层运行器', () => {
      const runner = scheduler.getRunner();
      expect(runner).toBeDefined();
    });

    test('应该获取基础调度器', () => {
      const baseScheduler = scheduler.getBaseScheduler();
      expect(baseScheduler).toBeDefined();
    });

    test('应该获取元数据注册表', () => {
      const registry = scheduler.getMetaRegistry();
      expect(registry).toBeDefined();
    });

    test('应该更新运行器配置', () => {
      scheduler.updateRunnerConfig({
        maxConcurrentSystems: 16
      });

      const runner = scheduler.getRunner();
      const config = runner.getConfig();
      expect(config.maxConcurrentSystems).toBe(16);
    });
  });

  describe('统计信息', () => {
    test('应该提供执行统计信息', () => {
      const system1 = system('StatSystem1', () => {});
      const system2 = system('StatSystem2', () => {});

      scheduler.add(system1);
      scheduler.add(system2);

      const stats = scheduler.getStats();
      expect(stats.totalSystems).toBe(2);
      expect(stats.estimatedEfficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('性能监控', () => {
    test('应该启用性能监控', async () => {
      const profilingScheduler = new ParallelScheduler({
        enableProfiling: true
      });

      const timedSystem = system('TimedSystem', () => {
        // 模拟一些耗时工作
        const start = performance.now();
        while (performance.now() - start < 1) {
          // 忙等待1毫秒
        }
      }).stage('update');

      profilingScheduler.add(timedSystem);

      await profilingScheduler.tick(world, 16.67);

      // 性能监控应该正常工作（无异常）
      expect(profilingScheduler).toBeDefined();
    });

    test('应该禁用性能监控', async () => {
      const nonProfilingScheduler = new ParallelScheduler({
        enableProfiling: false
      });

      const system1 = system('NonProfiledSystem', () => {});

      nonProfilingScheduler.add(system1);

      await nonProfilingScheduler.tick(world, 16.67);

      expect(nonProfilingScheduler).toBeDefined();
    });
  });
});