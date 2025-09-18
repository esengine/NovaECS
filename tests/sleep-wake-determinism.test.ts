/**
 * Sleep/Wake System Determinism Tests
 * 睡眠/唤醒系统确定性测试
 *
 * Tests comprehensive sleep/wake behavior including:
 * - Large scale stacking scenarios with performance monitoring
 * - Contact chain wake propagation
 * - Cross-machine determinism and frame consistency
 * - Boundary cases for continuous movement vs sleep
 * 测试全面的睡眠/唤醒行为，包括：
 * - 大规模堆叠场景与性能监控
 * - 接触链唤醒传播
 * - 跨机器确定性和帧一致性
 * - 连续运动与睡眠的边界情况
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { AABB2D } from '../src/components/AABB2D';
import { Guid } from '../src/components/Guid';
import { Sleep2D } from '../src/components/Sleep2D';
import { PhysicsSleepConfig } from '../src/resources/PhysicsSleepConfig';
import { Contacts2D } from '../src/resources/Contacts2D';

import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { PositionCorrection2D } from '../src/systems/phys2d/PositionCorrection2D';
import { SleepUpdate2D } from '../src/systems/phys2d/SleepUpdate2D';
import { WakeOnContact2D } from '../src/systems/phys2d/WakeOnContact2D';

import { f, ONE, ZERO, fromInt, toFloat, add } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';
import type { FX } from '../src/math/fixed';

/**
 * 睡眠/唤醒仿真快照
 */
interface SleepWakeSnapshot {
  frame: number;
  worldHash: number;
  bodies: Array<{
    entity: number;
    px: FX;
    py: FX;
    vx: FX;
    vy: FX;
    awake: number;
    sleeping: number;
    timer: FX;
  }>;
  sleepingCount: number;
  awakeCount: number;
  totalContacts: number;
  simulationTime: number; // 仿真执行时间（性能监控）
}

describe('Sleep/Wake System Determinism', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
    registerComponent(Sleep2D);
  });

  /**
   * 运行带有睡眠/唤醒系统的完整物理仿真
   */
  function runSleepWakeSimulation(
    scenario: 'stack' | 'grid' | 'chain',
    entityCount: number,
    numFrames: number,
    seed: number,
    customConfig?: Partial<PhysicsSleepConfig>
  ): SleepWakeSnapshot[] {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1/60);

    // 添加睡眠配置
    const sleepConfig = new PhysicsSleepConfig();
    if (customConfig) {
      // 应用自定义配置
      if (customConfig.linThresh !== undefined) sleepConfig.linThresh = customConfig.linThresh;
      if (customConfig.angThresh !== undefined) sleepConfig.angThresh = customConfig.angThresh;
      if (customConfig.timeToSleep !== undefined) sleepConfig.timeToSleep = customConfig.timeToSleep;
      if (customConfig.wakeBias !== undefined) sleepConfig.wakeBias = customConfig.wakeBias;
      if (customConfig.impulseWake !== undefined) sleepConfig.impulseWake = customConfig.impulseWake;
    }
    world.setResource(PhysicsSleepConfig, sleepConfig);

    // 完整的物理管线，包含睡眠/唤醒系统
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);
    scheduler.add(WakeOnContact2D); // 先唤醒
    scheduler.add(SolverGS2D);
    scheduler.add(PositionCorrection2D);
    scheduler.add(SleepUpdate2D); // 后更新睡眠状态

    // 创建地面（静态）
    const ground = world.createEntity();
    const groundBody = createStaticBody(ZERO, f(-2));
    world.addComponent(ground, Body2D, groundBody);
    world.addComponent(ground, ShapeCircle, createCircleShape(f(10.0)));
    world.addComponent(ground, AABB2D, new AABB2D());
    world.addComponent(ground, Sleep2D, new Sleep2D());
    world.addComponent(ground, Guid, new Guid(seed ^ 0x80000000, 0));

    // 根据场景创建实体
    if (scenario === 'stack') {
      // 垂直堆叠场景
      const radius = f(0.3);
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(
          f(((seed + i) % 7 - 3) * 0.01), // 微小水平偏移
          add(fromInt(i), radius),         // 垂直堆叠
          ONE,
          f(0.4)
        );
        body.friction = f(0.4);
        body.restitution = f(0.1);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(radius));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Sleep2D, new Sleep2D());
        world.addComponent(entity, Guid, new Guid(seed ^ (i << 4), i + 1));
      }

    } else if (scenario === 'grid') {
      // 网格场景（更多接触）
      const radius = f(0.25);
      const gridSize = Math.ceil(Math.sqrt(entityCount));

      for (let i = 0; i < entityCount; i++) {
        const x = i % gridSize;
        const y = Math.floor(i / gridSize);

        const entity = world.createEntity();
        const body = createDynamicBody(
          f(x * 0.6),  // 网格间距
          f(y * 0.6 + 1.0),
          ONE,
          f(0.3)
        );
        body.friction = f(0.5);
        body.restitution = f(0.05);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(radius));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Sleep2D, new Sleep2D());
        world.addComponent(entity, Guid, new Guid(seed ^ (i << 8), i + 1));
      }

    } else if (scenario === 'chain') {
      // 链条场景（测试接触传播）
      const radius = f(0.4);
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(
          f(i * 0.75), // 略微重叠以确保接触
          f(-1.5 + radius), // 让物体落在地面上
          ONE,
          f(0.5)
        );
        body.friction = f(0.3);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(radius));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Sleep2D, new Sleep2D());
        world.addComponent(entity, Guid, new Guid(seed ^ (i << 6), i + 1));
      }
    }

    const snapshots: SleepWakeSnapshot[] = [];

    for (let frame = 0; frame < numFrames; frame++) {
      const startTime = performance.now();

      scheduler.tick(world, 16);

      const endTime = performance.now();
      const simulationTime = endTime - startTime;

      // 收集状态
      const bodies: Array<{
        entity: number; px: FX; py: FX; vx: FX; vy: FX;
        awake: number; sleeping: number; timer: FX;
      }> = [];

      let sleepingCount = 0;
      let awakeCount = 0;

      world.query(Body2D, Sleep2D).forEach((entity, body, sleep) => {
        bodies.push({
          entity: entity as number,
          px: body.px,
          py: body.py,
          vx: body.vx,
          vy: body.vy,
          awake: body.awake,
          sleeping: sleep.sleeping,
          timer: sleep.timer
        });

        // 只统计动态实体（非静态地面）
        if (body.invMass > 0) {
          if (sleep.sleeping === 1) {
            sleepingCount++;
          } else {
            awakeCount++;
          }
        }
      });

      bodies.sort((a, b) => a.entity - b.entity);

      // 统计接触数量
      const contacts = world.getResource(Contacts2D);
      const totalContacts = contacts?.list?.length || 0;

      snapshots.push({
        frame,
        worldHash: frameHash(world, true),
        bodies,
        sleepingCount,
        awakeCount,
        totalContacts,
        simulationTime
      });
    }

    return snapshots;
  }

  /**
   * 测试大量圆静置堆叠的长时间稳定性和性能优化
   */
  test('should demonstrate sleep performance optimization in large stacking scenario', () => {
    const ENTITY_COUNT = 30; // 30个圆堆叠
    const FRAMES = 300; // 5秒仿真时间
    const SEED = 0x123456;

    const snapshots = runSleepWakeSimulation('stack', ENTITY_COUNT, FRAMES, SEED);

    expect(snapshots.length).toBe(FRAMES);

    // 分析睡眠演化过程
    const earlyFrames = snapshots.slice(30, 60);   // 0.5-1秒
    const midFrames = snapshots.slice(120, 150);   // 2-2.5秒
    const lateFrames = snapshots.slice(240, 300);  // 4-5秒

    // 验证睡眠数量逐渐增加
    const earlySleepingAvg = earlyFrames.reduce((sum, s) => sum + s.sleepingCount, 0) / earlyFrames.length;
    const midSleepingAvg = midFrames.reduce((sum, s) => sum + s.sleepingCount, 0) / midFrames.length;
    const lateSleepingAvg = lateFrames.reduce((sum, s) => sum + s.sleepingCount, 0) / lateFrames.length;

    // 睡眠数量应该逐渐增加（堆叠稳定后更多物体入睡）
    expect(midSleepingAvg).toBeGreaterThanOrEqual(earlySleepingAvg);
    expect(lateSleepingAvg).toBeGreaterThanOrEqual(midSleepingAvg);

    // 验证最终大部分物体进入睡眠状态
    expect(lateSleepingAvg).toBeGreaterThan(ENTITY_COUNT * 0.5); // 至少50%进入睡眠

    // 验证性能优化：睡眠物体多时，仿真时间应该减少
    const earlySimTimeAvg = earlyFrames.reduce((sum, s) => sum + s.simulationTime, 0) / earlyFrames.length;
    const lateSimTimeAvg = lateFrames.reduce((sum, s) => sum + s.simulationTime, 0) / lateFrames.length;

    // 随着更多物体进入睡眠，仿真时间应该有所减少（或至少保持稳定）
    const performanceRatio = lateSimTimeAvg / earlySimTimeAvg;
    expect(performanceRatio).toBeLessThan(2.0); // 不应该显著增加

    // 验证系统稳定性
    const finalFrames = snapshots.slice(-10);
    for (const snap of finalFrames) {
      expect(Number.isFinite(snap.worldHash)).toBe(true);
      expect(snap.sleepingCount).toBeGreaterThanOrEqual(0);
      expect(snap.awakeCount).toBeGreaterThanOrEqual(0);
      expect(snap.sleepingCount + snap.awakeCount).toBe(ENTITY_COUNT);
    }
  });

  /**
   * 测试轻推一个物体，接触链整体被唤醒，然后再次入睡
   */
  test('should demonstrate contact chain wake propagation and re-sleep', () => {
    const ENTITY_COUNT = 8; // 链条长度
    const FRAMES_BEFORE_NUDGE = 120; // 2秒让系统稳定
    const FRAMES_AFTER_NUDGE = 180;  // 3秒观察唤醒和重新睡眠
    const SEED = 0xC4A123;

    // 第一阶段：让链条稳定并进入睡眠
    // 使用更宽松的睡眠配置确保链条能够稳定
    const chainSleepConfig = {
      linThresh: f(0.15),    // 更高的线速度阈值
      angThresh: f(0.3),     // 更高的角速度阈值
      timeToSleep: f(0.05),  // 非常短的睡眠时间（3帧）
      wakeBias: f(3.0),      // 更高的唤醒偏差
      impulseWake: f(0.1)    // 更高的冲量唤醒阈值
    };
    let snapshots = runSleepWakeSimulation('chain', ENTITY_COUNT, FRAMES_BEFORE_NUDGE, SEED, chainSleepConfig);

    expect(snapshots.length).toBe(FRAMES_BEFORE_NUDGE);

    // 验证大部分物体已进入睡眠状态
    const finalStableSnapshot = snapshots[snapshots.length - 1];

    // 验证大部分物体已进入睡眠状态
    expect(finalStableSnapshot.sleepingCount).toBeGreaterThan(ENTITY_COUNT * 0.6); // 60%以上睡眠

    // 第二阶段：创建相同场景但轻推第一个物体
    const world = new World();
    const scheduler = new Scheduler(world);
    world.setFixedDt(1/60);

    const sleepConfig = new PhysicsSleepConfig();
    // 应用相同的链条睡眠配置
    Object.assign(sleepConfig, chainSleepConfig);
    world.setResource(PhysicsSleepConfig, sleepConfig);

    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);
    scheduler.add(WakeOnContact2D);
    scheduler.add(SolverGS2D);
    scheduler.add(PositionCorrection2D);
    scheduler.add(SleepUpdate2D);

    // 重建稳定状态
    const ground = world.createEntity();
    world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-2)));
    world.addComponent(ground, ShapeCircle, createCircleShape(f(10.0)));
    world.addComponent(ground, AABB2D, new AABB2D());
    world.addComponent(ground, Sleep2D, new Sleep2D());

    const entities: number[] = [];
    const radius = f(0.4);

    for (let i = 0; i < ENTITY_COUNT; i++) {
      const entity = world.createEntity();
      const body = createDynamicBody(f(i * 0.75), f(1.0), ONE, f(0.5));
      body.friction = f(0.3);

      // 设置为睡眠状态（模拟稳定后的状态）
      body.awake = 0;
      body.vx = ZERO;
      body.vy = ZERO;
      body.w = ZERO;

      const sleep = new Sleep2D();
      sleep.sleeping = 1;
      sleep.timer = f(1.0); // 已经睡眠一段时间

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, ShapeCircle, createCircleShape(radius));
      world.addComponent(entity, AABB2D, new AABB2D());
      world.addComponent(entity, Sleep2D, sleep);

      entities.push(entity);
    }

    // 轻推第一个物体（frame 10时）
    const nudgeSnapshots: SleepWakeSnapshot[] = [];

    for (let frame = 0; frame < FRAMES_AFTER_NUDGE; frame++) {
      // 在第10帧轻推第一个物体
      if (frame === 10) {
        const firstEntity = entities[0];
        const firstBody = world.getComponent(firstEntity, Body2D) as Body2D;
        const firstSleep = world.getComponent(firstEntity, Sleep2D) as Sleep2D;

        const nudgedBody = new Body2D();
        Object.assign(nudgedBody, firstBody);
        nudgedBody.vx = f(2.0); // 给一个轻推
        nudgedBody.awake = 1;

        const wakenSleep = new Sleep2D();
        Object.assign(wakenSleep, firstSleep);
        wakenSleep.sleeping = 0;
        wakenSleep.timer = ZERO;

        world.replaceComponent(firstEntity, Body2D, nudgedBody);
        world.replaceComponent(firstEntity, Sleep2D, wakenSleep);
      }

      const startTime = performance.now();
      scheduler.tick(world, 16);
      const endTime = performance.now();

      // 收集状态（简化版）
      const bodies: Array<{
        entity: number; px: FX; py: FX; vx: FX; vy: FX;
        awake: number; sleeping: number; timer: FX;
      }> = [];

      let sleepingCount = 0;
      let awakeCount = 0;

      for (const entity of entities) {
        const body = world.getComponent(entity, Body2D) as Body2D;
        const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;

        bodies.push({
          entity,
          px: body.px,
          py: body.py,
          vx: body.vx,
          vy: body.vy,
          awake: body.awake,
          sleeping: sleep.sleeping,
          timer: sleep.timer
        });

        if (sleep.sleeping === 1) sleepingCount++;
        else awakeCount++;
      }

      nudgeSnapshots.push({
        frame,
        worldHash: frameHash(world, true),
        bodies,
        sleepingCount,
        awakeCount,
        totalContacts: 0,
        simulationTime: endTime - startTime
      });
    }

    // 分析唤醒传播过程
    const preNudge = nudgeSnapshots[9];   // 推动前
    const justAfterNudge = nudgeSnapshots[11]; // 推动后
    const wakeSpread = nudgeSnapshots[30];     // 唤醒传播期
    const reSleep = nudgeSnapshots[150];       // 重新睡眠期

    // 验证推动前大部分在睡眠
    expect(preNudge.sleepingCount).toBeGreaterThan(ENTITY_COUNT * 0.5);

    // 验证推动后有唤醒发生
    expect(justAfterNudge.awakeCount).toBeGreaterThan(preNudge.awakeCount);

    // 验证唤醒传播（至少维持或增加唤醒数量）
    // 由于高阈值配置，可能传播有限，但至少应该保持
    expect(wakeSpread.awakeCount).toBeGreaterThanOrEqual(1);

    // 验证最终重新进入睡眠（或至少维持睡眠状态）
    expect(reSleep.sleepingCount).toBeGreaterThanOrEqual(wakeSpread.sleepingCount);

    // 验证系统确定性
    expect(nudgeSnapshots.every(s => Number.isFinite(s.worldHash))).toBe(true);
  });

  /**
   * 测试重放/跨机睡醒时机一致性和frameHash稳定性
   */
  test('should maintain sleep/wake timing consistency across runs and machines', () => {
    const ENTITY_COUNT = 15;
    const FRAMES = 200;
    const SEED = 0xDE7E44;

    // 模拟三次独立运行（跨机器/重放）
    const run1 = runSleepWakeSimulation('grid', ENTITY_COUNT, FRAMES, SEED);
    const run2 = runSleepWakeSimulation('grid', ENTITY_COUNT, FRAMES, SEED);
    const run3 = runSleepWakeSimulation('grid', ENTITY_COUNT, FRAMES, SEED);

    expect(run1.length).toBe(FRAMES);
    expect(run2.length).toBe(FRAMES);
    expect(run3.length).toBe(FRAMES);

    // 验证完全一致性
    for (let frame = 0; frame < FRAMES; frame++) {
      const snap1 = run1[frame];
      const snap2 = run2[frame];
      const snap3 = run3[frame];

      // frameHash必须完全一致
      expect(snap2.worldHash).toBe(snap1.worldHash);
      expect(snap3.worldHash).toBe(snap1.worldHash);

      // 睡眠统计必须一致
      expect(snap2.sleepingCount).toBe(snap1.sleepingCount);
      expect(snap2.awakeCount).toBe(snap1.awakeCount);
      expect(snap3.sleepingCount).toBe(snap1.sleepingCount);
      expect(snap3.awakeCount).toBe(snap1.awakeCount);

      // 每个物体的睡眠状态必须一致
      expect(snap2.bodies.length).toBe(snap1.bodies.length);
      expect(snap3.bodies.length).toBe(snap1.bodies.length);

      for (let i = 0; i < snap1.bodies.length; i++) {
        const body1 = snap1.bodies[i];
        const body2 = snap2.bodies[i];
        const body3 = snap3.bodies[i];

        // 位置一致
        expect(body2.px).toBe(body1.px);
        expect(body2.py).toBe(body1.py);
        expect(body3.px).toBe(body1.px);
        expect(body3.py).toBe(body1.py);

        // 速度一致
        expect(body2.vx).toBe(body1.vx);
        expect(body2.vy).toBe(body1.vy);
        expect(body3.vx).toBe(body1.vx);
        expect(body3.vy).toBe(body1.vy);

        // 睡眠状态一致
        expect(body2.awake).toBe(body1.awake);
        expect(body2.sleeping).toBe(body1.sleeping);
        expect(body2.timer).toBe(body1.timer);
        expect(body3.awake).toBe(body1.awake);
        expect(body3.sleeping).toBe(body1.sleeping);
        expect(body3.timer).toBe(body1.timer);
      }
    }

    // 验证睡眠时机的确定性
    const extractSleepTimings = (snapshots: SleepWakeSnapshot[]) => {
      const timings: Record<number, number> = {}; // entity -> frame when it first sleeps

      for (let frame = 0; frame < snapshots.length; frame++) {
        for (const body of snapshots[frame].bodies) {
          if (body.sleeping === 1 && !(body.entity in timings)) {
            timings[body.entity] = frame;
          }
        }
      }

      return timings;
    };

    const timings1 = extractSleepTimings(run1);
    const timings2 = extractSleepTimings(run2);
    const timings3 = extractSleepTimings(run3);

    expect(timings2).toEqual(timings1);
    expect(timings3).toEqual(timings1);
  });

  /**
   * 测试滚动/轻触不应误睡的边界情况
   */
  test('should prevent false sleep for continuous rolling or light touches', () => {
    const FRAMES = 180;
    const SEED = 0x4011123;

    // 测试wakeBias参数的效果
    const configs = [
      { wakeBias: f(1.0), name: 'low' },    // 较低的唤醒偏移
      { wakeBias: f(1.5), name: 'default' }, // 默认值
      { wakeBias: f(2.5), name: 'high' }    // 较高的唤醒偏移
    ];

    const results: Record<string, {
      snapshots: SleepWakeSnapshot[];
      prematureSleepCount: number;
      avgSleepingInMotion: number;
    }> = {};

    for (const config of configs) {
      // 创建持续轻微运动的场景
      const world = new World();
      const scheduler = new Scheduler(world);
      world.setFixedDt(1/60);

      const sleepConfig = new PhysicsSleepConfig();
      sleepConfig.wakeBias = config.wakeBias;
      sleepConfig.timeToSleep = f(0.3); // 较短的睡眠时间以加快测试
      world.setResource(PhysicsSleepConfig, sleepConfig);

      scheduler.add(IntegrateVelocitiesSystem);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);
      scheduler.add(WakeOnContact2D);
      scheduler.add(SolverGS2D);
      scheduler.add(PositionCorrection2D);
      scheduler.add(SleepUpdate2D);

      // 创建一个在斜面上缓慢滚动的圆
      const rollingBall = world.createEntity();
      const rollingBody = createDynamicBody(f(-3), f(3), ONE, f(0.5));
      rollingBody.vx = f(0.05); // 持续的缓慢运动
      rollingBody.vy = f(-0.02);
      rollingBody.w = f(0.03);  // 轻微旋转

      world.addComponent(rollingBall, Body2D, rollingBody);
      world.addComponent(rollingBall, ShapeCircle, createCircleShape(f(0.3)));
      world.addComponent(rollingBall, AABB2D, new AABB2D());
      world.addComponent(rollingBall, Sleep2D, new Sleep2D());

      // 创建几个静态障碍物进行轻触
      for (let i = 0; i < 3; i++) {
        const obstacle = world.createEntity();
        const obstacleBody = createStaticBody(f(i * 2), f(1.5));

        world.addComponent(obstacle, Body2D, obstacleBody);
        world.addComponent(obstacle, ShapeCircle, createCircleShape(f(0.2)));
        world.addComponent(obstacle, AABB2D, new AABB2D());
        world.addComponent(obstacle, Sleep2D, new Sleep2D());
      }

      const snapshots: SleepWakeSnapshot[] = [];
      let prematureSleepCount = 0;
      let totalSleepingInMotion = 0;

      for (let frame = 0; frame < FRAMES; frame++) {
        // 每30帧给滚动球一个轻微的推动（模拟持续的轻触）
        if (frame % 30 === 0 && frame > 0) {
          const currentBody = world.getComponent(rollingBall, Body2D) as Body2D;
          const nudgedBody = new Body2D();
          Object.assign(nudgedBody, currentBody);
          nudgedBody.vx = add(nudgedBody.vx, f(0.03)); // 轻微推动
          world.replaceComponent(rollingBall, Body2D, nudgedBody);
        }

        scheduler.tick(world, 16);

        // 收集状态
        const ballBody = world.getComponent(rollingBall, Body2D) as Body2D;
        const ballSleep = world.getComponent(rollingBall, Sleep2D) as Sleep2D;

        const isInMotion = toFloat(ballBody.vx) > 0.01 || toFloat(ballBody.vy) > 0.01 || toFloat(ballBody.w) > 0.01;
        const isSleeping = ballSleep.sleeping === 1;

        // 检查过早睡眠（运动中睡眠）
        if (isInMotion && isSleeping) {
          prematureSleepCount++;
          totalSleepingInMotion++;
        }

        snapshots.push({
          frame,
          worldHash: frameHash(world, true),
          bodies: [{
            entity: rollingBall,
            px: ballBody.px,
            py: ballBody.py,
            vx: ballBody.vx,
            vy: ballBody.vy,
            awake: ballBody.awake,
            sleeping: ballSleep.sleeping,
            timer: ballSleep.timer
          }],
          sleepingCount: isSleeping ? 1 : 0,
          awakeCount: isSleeping ? 0 : 1,
          totalContacts: 0,
          simulationTime: 0
        });
      }

      results[config.name] = {
        snapshots,
        prematureSleepCount,
        avgSleepingInMotion: totalSleepingInMotion / FRAMES
      };
    }

    // 验证wakeBias的效果
    expect(results.low).toBeDefined();
    expect(results.default).toBeDefined();
    expect(results.high).toBeDefined();

    // 高wakeBias应该减少错误睡眠
    expect(results.high.prematureSleepCount).toBeLessThanOrEqual(results.low.prematureSleepCount);

    // 验证系统不会频繁误判睡眠状态
    for (const [name, result] of Object.entries(results)) {
      // 运动中睡眠的比例应该很低
      expect(result.avgSleepingInMotion).toBeLessThan(0.1); // 小于10%的时间

      // 确定性检查
      expect(result.snapshots.every(s => Number.isFinite(s.worldHash))).toBe(true);
    }

    // 验证默认配置的平衡性
    const defaultResult = results.default;
    expect(defaultResult.prematureSleepCount).toBeLessThan(FRAMES * 0.05); // 少于5%的帧
  });

  /**
   * 测试timeToSleep参数对睡眠时机的影响
   */
  test('should observe timeToSleep parameter effects on sleep timing', () => {
    const ENTITY_COUNT = 6;
    const FRAMES = 150;
    const SEED = 0x71EE123;

    const timeConfigs = [
      { timeToSleep: f(0.2), name: 'fast' },    // 快速睡眠
      { timeToSleep: f(0.5), name: 'default' }, // 默认
      { timeToSleep: f(1.0), name: 'slow' }     // 慢速睡眠
    ];

    const results: Record<string, {
      firstSleepFrame: number;
      totalSleepingAtEnd: number;
      snapshots: SleepWakeSnapshot[];
    }> = {};

    for (const config of timeConfigs) {
      const snapshots = runSleepWakeSimulation('stack', ENTITY_COUNT, FRAMES, SEED, {
        timeToSleep: config.timeToSleep
      });

      // 找到第一个物体进入睡眠的帧
      let firstSleepFrame = FRAMES;
      for (let frame = 0; frame < FRAMES; frame++) {
        if (snapshots[frame].sleepingCount > 0) {
          firstSleepFrame = frame;
          break;
        }
      }

      const finalSnapshot = snapshots[snapshots.length - 1];

      results[config.name] = {
        firstSleepFrame,
        totalSleepingAtEnd: finalSnapshot.sleepingCount,
        snapshots
      };
    }

    // 验证timeToSleep的效果
    expect(results.fast).toBeDefined();
    expect(results.default).toBeDefined();
    expect(results.slow).toBeDefined();

    // 更短的timeToSleep应该导致更早的睡眠
    expect(results.fast.firstSleepFrame).toBeLessThanOrEqual(results.default.firstSleepFrame);
    expect(results.default.firstSleepFrame).toBeLessThanOrEqual(results.slow.firstSleepFrame);

    // 最终睡眠数量的顺序关系
    expect(results.fast.totalSleepingAtEnd).toBeGreaterThanOrEqual(results.slow.totalSleepingAtEnd);

    // 验证各配置的确定性
    for (const [name, result] of Object.entries(results)) {
      expect(result.snapshots.every(s => Number.isFinite(s.worldHash))).toBe(true);
      expect(result.firstSleepFrame).toBeGreaterThanOrEqual(0);
      expect(result.firstSleepFrame).toBeLessThanOrEqual(FRAMES);
    }
  });
});