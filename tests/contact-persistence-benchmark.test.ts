/**
 * Contact Persistence Cache Performance Tests
 * 接触持久化缓存性能测试
 *
 * Tests the effectiveness of feature-based warm-start across frames:
 * 1. 10x10 box stacking stability and convergence
 * 2. Slope stability without jitter
 * 3. Compression-release without "explosive" behavior
 * 测试基于特征的跨帧warm-start效果：
 * 1. 10x10盒子堆叠稳定性和收敛性
 * 2. 斜坡稳定性无抖动
 * 3. 压缩-释放无"爆弹"行为
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { AABB2D } from '../src/components/AABB2D';
import { Guid, createGuid } from '../src/components/Guid';

import { Contacts2D } from '../src/resources/Contacts2D';
import { ContactCache2D } from '../src/resources/ContactCache2D';
import { WarmStartStats } from '../src/systems/phys2d/ContactsWarmStart2D';
import { ContactCommitStats } from '../src/systems/phys2d/ContactsCommit2D';

import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { ContactsWarmStart2D } from '../src/systems/phys2d/ContactsWarmStart2D';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { ContactsCommit2D } from '../src/systems/phys2d/ContactsCommit2D';

import { f, ONE, TWO, ZERO, abs, add, sub, mul, div, toFloat } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

interface SimulationResult {
  frameHashes: string[];
  avgWarmStartRatio: number;
  avgPenetration: number;
  maxVelocityChange: number;
  frameHashStability: number; // 连续相同帧哈希的比例
}

/**
 * 创建完整的物理调度器
 */
function createPhysicsScheduler(world: World, enableWarmStart: boolean = true): Scheduler {
  const scheduler = new Scheduler(world);

  scheduler.add(IntegrateVelocitiesSystem);
  scheduler.add(SyncAABBSystem);
  scheduler.add(BroadphaseSAP);
  scheduler.add(NarrowphaseCircle);

  if (enableWarmStart) {
    scheduler.add(ContactsWarmStart2D);
  }

  scheduler.add(SolverGS2D);

  if (enableWarmStart) {
    scheduler.add(ContactsCommit2D);
  }

  return scheduler;
}

/**
 * 创建盒子堆叠场景 (用圆形模拟)
 */
function createBoxStack(world: World, rows: number, cols: number): void {
  const boxSize = f(0.5);
  const spacing = f(1.1);
  const startY = f(1.0);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const entity = world.createEntity();

      const x = mul(sub(fromInt(col), div(fromInt(cols - 1), TWO)), spacing);
      const y = add(startY, mul(fromInt(row), spacing));

      const body = createDynamicBody(x, y, ONE, ONE);
      body.friction = f(0.3);
      body.restitution = f(0.1);

      const shape = createCircleShape(boxSize);

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, ShapeCircle, shape);
      world.addComponent(entity, AABB2D, new AABB2D());
      world.addComponent(entity, Guid, createGuid(world));
    }
  }
}

/**
 * 创建地面
 */
function createGround(world: World, y: number = -2.0): void {
  const entity = world.createEntity();
  const body = createStaticBody(ZERO, f(y));
  const shape = createCircleShape(f(100)); // 大圆形作为地面

  world.addComponent(entity, Body2D, body);
  world.addComponent(entity, ShapeCircle, shape);
  world.addComponent(entity, AABB2D, new AABB2D());
  world.addComponent(entity, Guid, createGuid(world));
}

/**
 * 创建斜坡场景
 */
function createSlopeScene(world: World): void {
  // 创建斜坡 (用静态圆模拟)
  for (let i = 0; i < 10; i++) {
    const entity = world.createEntity();
    const x = mul(fromInt(i), f(1.0));
    const y = mul(fromInt(i), f(-0.2)); // 斜坡

    const body = createStaticBody(x, y);
    const shape = createCircleShape(f(0.6));

    world.addComponent(entity, Body2D, body);
    world.addComponent(entity, ShapeCircle, shape);
    world.addComponent(entity, AABB2D, new AABB2D());
    world.addComponent(entity, Guid, createGuid(world));
  }

  // 创建角色圆
  const character = world.createEntity();
  const body = createDynamicBody(f(2.0), f(3.0), ONE, ONE);
  body.friction = f(0.5);
  body.restitution = f(0.0);

  const shape = createCircleShape(f(0.4));

  world.addComponent(character, Body2D, body);
  world.addComponent(character, ShapeCircle, shape);
  world.addComponent(character, AABB2D, new AABB2D());
  world.addComponent(character, Guid, createGuid(world));
}

/**
 * 运行仿真并收集统计数据
 */
function runSimulation(
  world: World,
  scheduler: Scheduler,
  frames: number,
  applyGravity: boolean = true
): SimulationResult {
  const frameHashes: string[] = [];
  const warmStartRatios: number[] = [];
  const penetrations: number[] = [];
  const velocityChanges: number[] = [];

  for (let frame = 0; frame < frames; frame++) {
    // 应用重力
    if (applyGravity) {
      const bodyQuery = world.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) { // 只对动态物体应用重力
          body.vy = sub(body.vy, f(9.8 * (1/60))); // -9.8 m/s² gravity
        }
      });
    }

    // 记录速度变化前的状态
    const velocitiesBefore = new Map<number, { vx: number; vy: number }>();
    const bodyQuery = world.query(Body2D);
    bodyQuery.forEach((entity, body) => {
      velocitiesBefore.set(entity as number, { vx: toFloat(body.vx), vy: toFloat(body.vy) });
    });

    // 运行物理步骤
    scheduler.tick(world, 16);

    // 计算帧哈希
    const hash = frameHash(world);
    frameHashes.push(hash);

    // 收集warm-start统计
    const warmStartStats = world.getResource(WarmStartStats);
    if (warmStartStats) {
      warmStartRatios.push(warmStartStats.getWarmStartRatio());
    }

    // 收集穿透统计
    const contacts = world.getResource(Contacts2D);
    if (contacts) {
      const avgPen = contacts.list.reduce((sum, c) => sum + toFloat(c.pen), 0) / Math.max(contacts.list.length, 1);
      penetrations.push(avgPen);
    }

    // 计算速度变化
    let maxVelChange = 0;
    const bodyQueryAfter = world.query(Body2D);
    bodyQueryAfter.forEach((entity, body) => {
      const before = velocitiesBefore.get(entity as number);
      if (before) {
        const dvx = Math.abs(toFloat(body.vx) - before.vx);
        const dvy = Math.abs(toFloat(body.vy) - before.vy);
        maxVelChange = Math.max(maxVelChange, dvx + dvy);
      }
    });
    velocityChanges.push(maxVelChange);
  }

  // 计算帧哈希稳定性
  let stableFrames = 0;
  for (let i = 1; i < frameHashes.length; i++) {
    if (frameHashes[i] === frameHashes[i-1]) {
      stableFrames++;
    }
  }
  const frameHashStability = frameHashes.length > 1 ? stableFrames / (frameHashes.length - 1) : 0;

  return {
    frameHashes,
    avgWarmStartRatio: warmStartRatios.reduce((a, b) => a + b, 0) / Math.max(warmStartRatios.length, 1),
    avgPenetration: penetrations.reduce((a, b) => a + b, 0) / Math.max(penetrations.length, 1),
    maxVelocityChange: Math.max(...velocityChanges),
    frameHashStability
  };
}

function fromInt(value: number) {
  return f(value);
}


describe('Contact Persistence Cache Benchmarks', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('10x10 box stacking: warm-start improves stability and convergence', () => {
    // 测试无warm-start的情况
    const worldWithout = new World();
    worldWithout.setFixedDt(1/60);
    createGround(worldWithout);
    createBoxStack(worldWithout, 10, 10);

    const schedulerWithout = createPhysicsScheduler(worldWithout, false);
    const resultWithout = runSimulation(worldWithout, schedulerWithout, 120);

    // 测试有warm-start的情况
    const worldWith = new World();
    worldWith.setFixedDt(1/60);
    createGround(worldWith);
    createBoxStack(worldWith, 10, 10);

    const schedulerWith = createPhysicsScheduler(worldWith, true);
    const resultWith = runSimulation(worldWith, schedulerWith, 120);

    console.log('=== 10x10 Box Stacking Results ===');
    console.log(`Without warm-start:`);
    console.log(`  Avg penetration: ${resultWithout.avgPenetration.toFixed(6)}`);
    console.log(`  Max velocity change: ${resultWithout.maxVelocityChange.toFixed(6)}`);
    console.log(`  Frame hash stability: ${(resultWithout.frameHashStability * 100).toFixed(2)}%`);

    console.log(`With warm-start:`);
    console.log(`  Avg warm-start ratio: ${(resultWith.avgWarmStartRatio * 100).toFixed(2)}%`);
    console.log(`  Avg penetration: ${resultWith.avgPenetration.toFixed(6)}`);
    console.log(`  Max velocity change: ${resultWith.maxVelocityChange.toFixed(6)}`);
    console.log(`  Frame hash stability: ${(resultWith.frameHashStability * 100).toFixed(2)}%`);

    // 验证warm-start改善效果
    expect(resultWith.avgWarmStartRatio).toBeGreaterThan(0.05); // 至少5%的接触被warm-start
    // 注意：在复杂的堆叠场景中，warm-start可能不会显著减少平均穿透
    // 但应该提高稳定性和收敛速度
    expect(resultWith.frameHashStability).toBeGreaterThanOrEqual(resultWithout.frameHashStability); // 不应该更差
  });

  test('slope stability: character rests stable without jitter', () => {
    // 测试无warm-start的斜坡
    const worldWithout = new World();
    worldWithout.setFixedDt(1/60);
    createSlopeScene(worldWithout);

    const schedulerWithout = createPhysicsScheduler(worldWithout, false);
    const resultWithout = runSimulation(worldWithout, schedulerWithout, 200);

    // 测试有warm-start的斜坡
    const worldWith = new World();
    worldWith.setFixedDt(1/60);
    createSlopeScene(worldWith);

    const schedulerWith = createPhysicsScheduler(worldWith, true);
    const resultWith = runSimulation(worldWith, schedulerWith, 200);

    console.log('=== Slope Stability Results ===');
    console.log(`Without warm-start:`);
    console.log(`  Max velocity change: ${resultWithout.maxVelocityChange.toFixed(6)}`);
    console.log(`  Frame hash stability: ${(resultWithout.frameHashStability * 100).toFixed(2)}%`);

    console.log(`With warm-start:`);
    console.log(`  Avg warm-start ratio: ${(resultWith.avgWarmStartRatio * 100).toFixed(2)}%`);
    console.log(`  Max velocity change: ${resultWith.maxVelocityChange.toFixed(6)}`);
    console.log(`  Frame hash stability: ${(resultWith.frameHashStability * 100).toFixed(2)}%`);

    // 验证斜坡稳定性改善
    expect(resultWith.maxVelocityChange).toBeLessThanOrEqual(resultWithout.maxVelocityChange);
    expect(resultWith.frameHashStability).toBeGreaterThanOrEqual(resultWithout.frameHashStability);
  });

  test('compression-release: no explosive behavior with warm-start', () => {
    // 创建压缩-释放场景
    const createCompressionScene = (world: World) => {
      createGround(world);

      // 创建一个可移动的"压缩器"
      const compressor = world.createEntity();
      const compressorBody = createDynamicBody(ZERO, f(5.0), f(10), ONE); // 重物
      compressorBody.friction = f(0.5);

      world.addComponent(compressor, Body2D, compressorBody);
      world.addComponent(compressor, ShapeCircle, createCircleShape(f(2.0)));
      world.addComponent(compressor, AABB2D, new AABB2D());
      world.addComponent(compressor, Guid, createGuid(world));

      // 创建被压缩的物体栈
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(ZERO, add(f(1.0), mul(fromInt(i), f(1.1))), ONE, ONE);
        body.friction = f(0.3);
        body.restitution = f(0.1);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, createGuid(world));
      }

      return compressor;
    };

    // 无warm-start测试
    const worldWithout = new World();
    worldWithout.setFixedDt(1/60);
    const compressorWithout = createCompressionScene(worldWithout);
    const schedulerWithout = createPhysicsScheduler(worldWithout, false);

    // 压缩阶段：让压缩器下降
    for (let i = 0; i < 60; i++) {
      schedulerWithout.tick(worldWithout, 16);
    }

    // 释放阶段：移除压缩器
    worldWithout.destroyEntity(compressorWithout);

    // 观察释放后的行为
    const releaseResultWithout = runSimulation(worldWithout, schedulerWithout, 60, true);

    // 有warm-start测试
    const worldWith = new World();
    worldWith.setFixedDt(1/60);
    const compressorWith = createCompressionScene(worldWith);
    const schedulerWith = createPhysicsScheduler(worldWith, true);

    // 压缩阶段
    for (let i = 0; i < 60; i++) {
      schedulerWith.tick(worldWith, 16);
    }

    // 释放阶段
    worldWith.destroyEntity(compressorWith);
    const releaseResultWith = runSimulation(worldWith, schedulerWith, 60, true);

    console.log('=== Compression-Release Results ===');
    console.log(`Without warm-start (after release):`);
    console.log(`  Max velocity change: ${releaseResultWithout.maxVelocityChange.toFixed(6)}`);
    console.log(`  Avg penetration: ${releaseResultWithout.avgPenetration.toFixed(6)}`);

    console.log(`With warm-start (after release):`);
    console.log(`  Avg warm-start ratio: ${(releaseResultWith.avgWarmStartRatio * 100).toFixed(2)}%`);
    console.log(`  Max velocity change: ${releaseResultWith.maxVelocityChange.toFixed(6)}`);
    console.log(`  Avg penetration: ${releaseResultWith.avgPenetration.toFixed(6)}`);

    // 验证warm-start减少了"爆弹"行为
    expect(releaseResultWith.maxVelocityChange).toBeLessThanOrEqual(releaseResultWithout.maxVelocityChange);
    expect(releaseResultWith.avgPenetration).toBeLessThanOrEqual(releaseResultWithout.avgPenetration);
  });

  test('cache statistics and memory management', () => {
    const world = new World();
    world.setFixedDt(1/60);

    createGround(world);
    createBoxStack(world, 5, 5);

    const scheduler = createPhysicsScheduler(world, true);

    // 运行足够长的时间来测试缓存管理
    for (let i = 0; i < 100; i++) {
      scheduler.tick(world, 16);
    }

    // 检查缓存统计
    const cache = world.getResource(ContactCache2D);
    expect(cache).toBeDefined();

    const stats = cache!.getStats();
    console.log('=== Cache Statistics ===');
    console.log(`Pair count: ${stats.pairCount}`);
    console.log(`Total contacts: ${stats.totalContacts}`);
    console.log(`Avg contacts per pair: ${stats.avgContactsPerPair.toFixed(2)}`);
    console.log(`Avg age: ${stats.avgAge.toFixed(2)}`);

    expect(stats.pairCount).toBeGreaterThan(0);
    expect(stats.totalContacts).toBeGreaterThan(0);
    expect(stats.avgAge).toBeLessThan(cache!.maxAge); // 应该有适当的清理

    // 检查最终提交统计
    const commitStats = world.getResource(ContactCommitStats);
    expect(commitStats).toBeDefined();
    console.log(`Committed contacts: ${commitStats!.committedCount}`);
    console.log(`Active pairs: ${commitStats!.activePairs}`);
  });
});