/**
 * Fixed-point physics determinism tests
 * 定点物理引擎确定性测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Scheduler } from '../src/core/Scheduler';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { frameHash } from '../src/replay/StateHash';
import { f, toFloat, ONE, ZERO } from '../src/math/fixed';

// World已经内置了定点物理扩展，无需额外导入

describe('Fixed-Point Physics Determinism', () => {
  beforeEach(() => {
    // Register components before each test
    // 每个测试前注册组件
    registerComponent(Body2D);
  });

  test('should produce identical hashes across multiple runs with same initial conditions', () => {
    // Test configuration
    // 测试配置
    const NUM_BODIES = 10;
    const NUM_FRAMES = 100;
    const PHYSICS_DT = 1 / 60; // 60 FPS

    // Function to create and run a physics simulation
    // 创建并运行物理仿真的函数
    const runSimulation = (): number => {
      const world = new World();
      const scheduler = new Scheduler(world);

      // Set fixed timestep
      // 设置固定时间步长
      world.setFixedDt(PHYSICS_DT);

      // Add the physics integration system
      // 添加物理积分系统
      scheduler.add(IntegrateVelocitiesSystem.build());

      // Create test bodies with deterministic initial conditions
      // 创建具有确定性初始条件的测试物体
      const bodies: Body2D[] = [];
      for (let i = 0; i < NUM_BODIES; i++) {
        const entity = world.createEntity();

        // Create body with predictable initial state
        // 使用可预测的初始状态创建物体
        const body = createDynamicBody(
          f(i * 10),        // px: 0, 10, 20, 30...
          f(i * 5),         // py: 0, 5, 10, 15...
          ONE,              // mass: 1.0
          ONE               // inertia: 1.0
        );

        // Set deterministic velocities
        // 设置确定性速度
        body.vx = f((i % 3) - 1); // -1, 0, 1, -1, 0, 1...
        body.vy = f((i % 5) - 2); // -2, -1, 0, 1, 2, -2...
        body.w = f((i % 7) - 3);  // Angular velocity pattern

        world.addComponent(entity, Body2D, body);
        bodies.push(body);
      }

      // Run simulation for specified number of frames
      // 运行指定帧数的仿真
      for (let frame = 0; frame < NUM_FRAMES; frame++) {
        scheduler.tick(world, 16); // 16ms per frame (60 FPS)
      }

      // Return frame hash for verification
      // 返回帧哈希用于验证
      return frameHash(world, false); // Exclude RNG since we're not using it
    };

    // Run the simulation multiple times
    // 多次运行仿真
    const hash1 = runSimulation();
    const hash2 = runSimulation();
    const hash3 = runSimulation();

    // All runs should produce identical results
    // 所有运行应产生相同的结果
    expect(hash2).toBe(hash1);
    expect(hash3).toBe(hash1);
  });

  test('should maintain numerical stability over extended simulation', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem.build());

    // Create a single body with small velocity
    // 创建单个小速度物体
    const entity = world.createEntity();
    const body = createDynamicBody();
    body.vx = f(0.01); // Very small velocity
    body.vy = f(0.01);
    body.w = f(0.001); // Very small angular velocity

    world.addComponent(entity, Body2D, body);

    // Record initial hash
    // 记录初始哈希
    const initialHash = frameHash(world, false);

    // Run for many frames (10 seconds at 60 FPS)
    // 运行多帧（60 FPS下的10秒）
    for (let frame = 0; frame < 600; frame++) {
      scheduler.tick(world, 16);
    }

    // Hash should be different but deterministic
    // 哈希应该不同但确定性
    const finalHash = frameHash(world, false);
    expect(finalHash).not.toBe(initialHash);

    // Reset and run again - should get same final hash
    // 重置并再次运行 - 应得到相同的最终哈希
    // world.clear(); // 注释掉，使用新的World实例
    const world2 = new World();
    const scheduler2 = new Scheduler(world2);
    world2.setFixedDt(1 / 60);
    scheduler2.add(IntegrateVelocitiesSystem.build());
    const entity2 = world2.createEntity();
    const body2 = createDynamicBody();
    body2.vx = f(0.01);
    body2.vy = f(0.01);
    body2.w = f(0.001);
    world2.addComponent(entity2, Body2D, body2);

    for (let frame = 0; frame < 600; frame++) {
      scheduler2.tick(world2, 16);
    }

    const finalHash2 = frameHash(world2, false);
    expect(finalHash2).toBe(finalHash);
  });

  test('should handle sleeping bodies correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem.build());

    // Create awake and sleeping bodies
    // 创建唤醒和休眠的物体
    const awakeEntity = world.createEntity();
    const awakeBody = createDynamicBody(ZERO, ZERO, ONE, ONE);
    awakeBody.vx = f(1.0);
    awakeBody.awake = 1;
    world.addComponent(awakeEntity, Body2D, awakeBody);

    const sleepingEntity = world.createEntity();
    const sleepingBody = createDynamicBody(f(10), ZERO, ONE, ONE);
    sleepingBody.vx = f(1.0);
    sleepingBody.awake = 0; // Sleeping
    world.addComponent(sleepingEntity, Body2D, sleepingBody);

    // Record initial positions
    // 记录初始位置
    const initialAwakeX = awakeBody.px;
    const initialSleepingX = sleepingBody.px;

    // Run simulation
    // 运行仿真
    for (let frame = 0; frame < 60; frame++) {
      scheduler.tick(world, 16);
    }

    // Get updated bodies from world (components might have been recreated)
    // 从world获取更新后的物体（组件可能已被重新创建）
    const updatedAwakeBody = world.getComponent(awakeEntity, Body2D);
    const updatedSleepingBody = world.getComponent(sleepingEntity, Body2D);

    // 验证位置变化

    // Awake body should have moved, sleeping body should not
    // 唤醒的物体应该移动，休眠的物体不应该
    expect(updatedAwakeBody?.px).not.toBe(initialAwakeX);
    expect(updatedSleepingBody?.px).toBe(initialSleepingX);
  });

  test('should correctly integrate angular velocity', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem.build());

    // Create body with angular velocity
    // 创建有角速度的物体
    const entity = world.createEntity();
    const body = createDynamicBody();
    body.w = f(1.0); // 1 radian per second
    world.addComponent(entity, Body2D, body);

    const initialAngle = body.angle;

    // Run for one second (60 frames)
    // 运行一秒（60帧）
    for (let frame = 0; frame < 60; frame++) {
      scheduler.tick(world, 16);
    }

    // Get updated body from world
    // 从world获取更新后的物体
    const updatedBody = world.getComponent(entity, Body2D);

    // Angle should have changed
    // 角度应该改变了
    expect(updatedBody?.angle).not.toBe(initialAngle);

    // Angle should wrap around (16-bit range)
    // 角度应该环绕（16位范围）
    expect(updatedBody?.angle).toBe((updatedBody?.angle ?? 0) & 0xffff);
  });

  test('fixed point math should be deterministic across platforms', () => {
    // Test basic fixed point operations
    // 测试基本定点运算
    const a = f(1.5);
    const b = f(2.7);

    // These operations should always produce the same results
    // 这些运算应该始终产生相同的结果
    expect(a).toBe(98304); // 1.5 in 16.16 fixed point
    expect(b).toBe(176947); // 2.7 in 16.16 fixed point

    // Test conversion back
    // 测试转换回浮点数
    expect(Math.abs(toFloat(a) - 1.5)).toBeLessThan(0.001);
    expect(Math.abs(toFloat(b) - 2.7)).toBeLessThan(0.001);
  });
});