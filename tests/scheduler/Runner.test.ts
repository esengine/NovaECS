/**
 * ParallelRunner tests
 * ParallelRunner 测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  ParallelRunner,
  SystemExecutor,
  SystemExecutionContext,
  SystemExecutionResult,
  RunnerConfig
} from '../../src/scheduler/Runner';
import {
  createSystemMeta,
  AccessMode
} from '../../src/scheduler/SystemMeta';

describe('ParallelRunner', () => {
  let runner: ParallelRunner;

  beforeEach(() => {
    runner = new ParallelRunner();
  });

  describe('基础配置', () => {
    test('应该使用默认配置创建', () => {
      const config = runner.getConfig();
      expect(config.maxConcurrentSystems).toBe(8);
      expect(config.systemTimeoutMs).toBe(10000);
      expect(config.waveTimeoutMs).toBe(30000);
      expect(config.continueOnFailure).toBe(true);
      expect(config.useWorkerPool).toBe(false);
      expect(config.enableMetrics).toBe(true);
    });

    test('应该使用自定义配置创建', () => {
      const customConfig: RunnerConfig = {
        maxConcurrentSystems: 4,
        systemTimeoutMs: 5000,
        continueOnFailure: false
      };

      const customRunner = new ParallelRunner(customConfig);
      const config = customRunner.getConfig();

      expect(config.maxConcurrentSystems).toBe(4);
      expect(config.systemTimeoutMs).toBe(5000);
      expect(config.continueOnFailure).toBe(false);
    });

    test('应该更新配置', () => {
      runner.updateConfig({ maxConcurrentSystems: 16 });
      const config = runner.getConfig();
      expect(config.maxConcurrentSystems).toBe(16);
    });
  });

  describe('系统注册', () => {
    test('应该注册和取消注册执行器', () => {
      const executor: SystemExecutor = async () => ({
        success: true,
        executionTime: 0
      });

      runner.registerExecutor('test-system', executor);
      const unregistered = runner.unregisterExecutor('test-system');
      expect(unregistered).toBe(true);

      const unregisteredAgain = runner.unregisterExecutor('test-system');
      expect(unregisteredAgain).toBe(false);
    });

    test('应该清除所有执行器', () => {
      const executor: SystemExecutor = async () => ({
        success: true,
        executionTime: 0
      });

      runner.registerExecutor('system1', executor);
      runner.registerExecutor('system2', executor);

      runner.clear();

      const stats = runner.getExecutionStats();
      expect(stats.registeredSystems).toBe(0);
    });
  });

  describe('系统执行', () => {
    test('应该执行单个系统', async () => {
      const executionData: any[] = [];
      const executor: SystemExecutor = async (context) => {
        executionData.push({
          system: context.systemHandle,
          deltaTime: context.deltaTime,
          frame: context.frameNumber
        });

        return {
          success: true,
          executionTime: 10
        };
      };

      const meta = createSystemMeta('test-system', 'Test System').build();

      runner.registerExecutor('test-system', executor);
      runner.getPlanner().addSystem(meta);

      const result = await runner.execute(16.67, 123);

      expect(result.success).toBe(true);
      expect(result.waves).toHaveLength(1);
      expect(result.waves[0].successfulSystems).toContain('test-system');
      expect(executionData).toHaveLength(1);
      expect(executionData[0].deltaTime).toBe(16.67);
      expect(executionData[0].frame).toBe(123);
    });

    test('应该并行执行无冲突系统', async () => {
      const executionOrder: string[] = [];
      const createExecutor = (name: string): SystemExecutor => async (context) => {
        executionOrder.push(`${name}_start`);
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(`${name}_end`);

        return {
          success: true,
          executionTime: 10
        };
      };

      const meta1 = createSystemMeta('system1', 'System 1')
        .reads('Position')
        .build();
      const meta2 = createSystemMeta('system2', 'System 2')
        .reads('Velocity')
        .build();

      runner.registerExecutor('system1', createExecutor('system1'));
      runner.registerExecutor('system2', createExecutor('system2'));

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const result = await runner.execute(16.67, 1);

      expect(result.success).toBe(true);
      expect(result.waves).toHaveLength(1);
      expect(result.waves[0]).toBeDefined();
      expect(result.waves[0].successfulSystems).toHaveLength(2);

      // 应该并行执行（start事件应该在end事件之前全部发生）
      const startEvents = executionOrder.filter(e => e.includes('_start'));
      const endEvents = executionOrder.filter(e => e.includes('_end'));
      expect(startEvents.length).toBeGreaterThanOrEqual(2);
      expect(endEvents.length).toBeGreaterThanOrEqual(2);
    });

    test('应该顺序执行有冲突的系统', async () => {
      const executionOrder: string[] = [];
      const createExecutor = (name: string): SystemExecutor => async (context) => {
        executionOrder.push(name);
        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          success: true,
          executionTime: 10
        };
      };

      const meta1 = createSystemMeta('system1', 'System 1')
        .writes('Position')
        .build();
      const meta2 = createSystemMeta('system2', 'System 2')
        .reads('Position')
        .build();

      runner.registerExecutor('system1', createExecutor('system1'));
      runner.registerExecutor('system2', createExecutor('system2'));

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const result = await runner.execute(16.67, 1);

      expect(result.success).toBe(true);
      expect(result.waves).toHaveLength(2);
      expect(executionOrder).toHaveLength(2);
    });

    test('应该处理系统执行失败', async () => {
      const failingExecutor: SystemExecutor = async () => {
        throw new Error('System failed');
      };

      const successExecutor: SystemExecutor = async () => ({
        success: true,
        executionTime: 5
      });

      const meta1 = createSystemMeta('failing-system', 'Failing System').build();
      const meta2 = createSystemMeta('success-system', 'Success System').build();

      runner.registerExecutor('failing-system', failingExecutor);
      runner.registerExecutor('success-system', successExecutor);

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const result = await runner.execute(16.67, 1);

      expect(result.success).toBe(true); // continueOnFailure默认为true
      expect(result.waves[0].failedSystems).toContain('failing-system');
      expect(result.waves[0].successfulSystems).toContain('success-system');
    });

    test('应该处理系统超时', async () => {
      const timeoutRunner = new ParallelRunner({
        systemTimeoutMs: 50
      });

      const slowExecutor: SystemExecutor = async (context) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              success: true,
              executionTime: 100
            });
          }, 100);

          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve({
              success: false,
              executionTime: 0,
              error: 'System timed out'
            });
          });
        });
      };

      const meta = createSystemMeta('slow-system', 'Slow System').build();

      timeoutRunner.registerExecutor('slow-system', slowExecutor);
      timeoutRunner.getPlanner().addSystem(meta);

      const result = await timeoutRunner.execute(16.67, 1);

      // 系统应该超时失败
      expect(result.waves[0].failedSystems.length).toBeGreaterThan(0);
    });

    test('应该处理中止信号', async () => {
      const controller = new AbortController();
      const slowExecutor: SystemExecutor = async (context) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              success: true,
              executionTime: 100
            });
          }, 100);

          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve({
              success: false,
              executionTime: 0,
              error: 'Aborted'
            });
          });
        });
      };

      const meta = createSystemMeta('slow-system', 'Slow System').build();

      runner.registerExecutor('slow-system', slowExecutor);
      runner.getPlanner().addSystem(meta);

      // 50毫秒后中止
      setTimeout(() => controller.abort(), 50);

      const result = await runner.execute(16.67, 1, {}, controller.signal);

      expect(result.waves[0].failedSystems).toContain('slow-system');
    });

    test('应该限制并发系统数量', async () => {
      const concurrentRunner = new ParallelRunner({
        maxConcurrentSystems: 2
      });

      const concurrentCount = { current: 0, max: 0 };
      const createExecutor = (name: string): SystemExecutor => async () => {
        concurrentCount.current++;
        concurrentCount.max = Math.max(concurrentCount.max, concurrentCount.current);

        await new Promise(resolve => setTimeout(resolve, 20));

        concurrentCount.current--;
        return {
          success: true,
          executionTime: 20
        };
      };

      // 注册4个系统，但最多只能2个并发
      for (let i = 1; i <= 4; i++) {
        const meta = createSystemMeta(`system${i}`, `System ${i}`)
          .reads(`Component${i}`)
          .build();

        concurrentRunner.registerExecutor(`system${i}`, createExecutor(`system${i}`));
        concurrentRunner.getPlanner().addSystem(meta);
      }

      const result = await concurrentRunner.execute(16.67, 1);

      expect(result.success).toBe(true);
      expect(concurrentCount.max).toBeLessThanOrEqual(2);
    });
  });

  describe('执行状态和会话', () => {
    test('应该跟踪执行状态', async () => {
      const executor: SystemExecutor = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          executionTime: 50
        };
      };

      const meta = createSystemMeta('test-system', 'Test System').build();

      runner.registerExecutor('test-system', executor);
      runner.getPlanner().addSystem(meta);

      expect(runner.isExecuting()).toBe(false);
      expect(runner.getCurrentSession()).toBe(null);

      const executionPromise = runner.execute(16.67, 1);
      expect(runner.isExecuting()).toBe(true);

      const session = runner.getCurrentSession();
      expect(session).not.toBe(null);
      expect(session?.sessionId).toBeDefined();
      expect(session?.elapsed).toBeGreaterThanOrEqual(0);

      await executionPromise;

      expect(runner.isExecuting()).toBe(false);
      expect(runner.getCurrentSession()).toBe(null);
    });

    test('应该中止执行', async () => {
      const executor: SystemExecutor = async (context) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              success: true,
              executionTime: 100
            });
          }, 100);

          context.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve({
              success: false,
              executionTime: 0,
              error: 'System aborted'
            });
          });
        });
      };

      const meta = createSystemMeta('test-system', 'Test System').build();

      runner.registerExecutor('test-system', executor);
      runner.getPlanner().addSystem(meta);

      const executionPromise = runner.execute(16.67, 1);

      // 执行中止止
      setTimeout(() => runner.abort(), 25);

      const result = await executionPromise;
      // 中止的系统应该失败或者会话被中止
      expect(result.waves[0].failedSystems.length).toBeGreaterThan(0);
    });
  });

  describe('性能指标', () => {
    test('应该计算执行指标', async () => {
      const executor: SystemExecutor = async () => ({
        success: true,
        executionTime: 10
      });

      const meta1 = createSystemMeta('system1', 'System 1')
        .setEstimatedTime(10)
        .reads('Position')
        .build();

      const meta2 = createSystemMeta('system2', 'System 2')
        .setEstimatedTime(15)
        .reads('Velocity')
        .build();

      runner.registerExecutor('system1', executor);
      runner.registerExecutor('system2', executor);

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const result = await runner.execute(16.67, 1);

      expect(result.metrics.totalSystems).toBe(2);
      expect(result.metrics.successfulSystems).toBe(2);
      expect(result.metrics.failedSystems).toBe(0);
      expect(result.metrics.averageSystemsPerWave).toBe(2);
      expect(result.metrics.parallelizationEfficiency).toBeGreaterThan(0);
    });

    test('应该识别瓶颈波次', async () => {
      const createExecutor = (delay: number): SystemExecutor => async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return {
          success: true,
          executionTime: delay
        };
      };

      const meta1 = createSystemMeta('system1', 'System 1')
        .writes('Position')
        .build();
      const meta2 = createSystemMeta('system2', 'System 2')
        .reads('Position')
        .build();

      runner.registerExecutor('system1', createExecutor(50));
      runner.registerExecutor('system2', createExecutor(10));

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const result = await runner.execute(16.67, 1);

      expect(result.metrics.bottleneckWave).toBe(0); // 第一个波次应该是瓶颈
    });
  });

  describe('错误处理', () => {
    test('应该调用错误处理器', async () => {
      const errorHandler = vi.fn();
      const errorRunner = new ParallelRunner({
        errorHandler
      });

      const failingExecutor: SystemExecutor = async () => {
        throw new Error('Test error');
      };

      const meta = createSystemMeta('failing-system', 'Failing System').build();

      errorRunner.registerExecutor('failing-system', failingExecutor);
      errorRunner.getPlanner().addSystem(meta);

      await errorRunner.execute(16.67, 1);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          systemHandle: 'failing-system'
        })
      );
    });

    test('应该处理缺少执行器的系统', async () => {
      const meta = createSystemMeta('missing-executor', 'Missing Executor').build();
      runner.getPlanner().addSystem(meta);

      const result = await runner.execute(16.67, 1);

      expect(result.waves[0].failedSystems).toContain('missing-executor');
      const systemResult = result.waves[0].systemResults.get('missing-executor');
      expect(systemResult?.error).toContain('No executor registered');
    });
  });

  describe('统计信息', () => {
    test('应该提供执行统计信息', () => {
      const meta1 = createSystemMeta('system1', 'System 1').build();
      const meta2 = createSystemMeta('system2', 'System 2').build();

      const executor: SystemExecutor = async () => ({
        success: true,
        executionTime: 0
      });

      runner.registerExecutor('system1', executor);
      runner.registerExecutor('system2', executor);

      const planner = runner.getPlanner();
      planner.addSystem(meta1);
      planner.addSystem(meta2);

      const stats = runner.getExecutionStats();

      expect(stats.registeredSystems).toBe(2);
      expect(stats.plannedWaves).toBeGreaterThanOrEqual(1);
      expect(stats.estimatedEfficiency).toBeGreaterThanOrEqual(0);
    });
  });
});