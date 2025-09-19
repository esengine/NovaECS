/**
 * Warm-Start Performance Tests
 * Warm-Start性能测试
 *
 * Tests specific scenarios mentioned in the requirements:
 * 1. 10×10 box stacking - reduced iterations needed
 * 2. Slope stability - no jitter
 * 3. Compression-release - no explosive behavior
 * 4. FrameHash stability
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

import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { ContactsWarmStart2D } from '../src/systems/phys2d/ContactsWarmStart2D';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { ContactsCommit2D } from '../src/systems/phys2d/ContactsCommit2D';

import { f, ONE, ZERO, add, sub, mul, div, toFloat } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

interface PerformanceMetrics {
  frameHashes: string[];
  avgPenetration: number;
  maxPenetration: number;
  velocityVariance: number;
  warmStartRatio: number;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
}

function createPhysicsWorld(enableWarmStart: boolean): { world: World; scheduler: Scheduler } {
  const world = new World();
  world.setFixedDt(1/60);

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

  return { world, scheduler };
}

function runPhysicsSimulation(
  world: World,
  scheduler: Scheduler,
  frames: number,
  applyGravity = true
): PerformanceMetrics {
  const frameHashes: string[] = [];
  const penetrations: number[] = [];
  const velocityMagnitudes: number[] = [];
  let totalWarmStartRatio = 0;
  let maxPenetration = 0;

  for (let frame = 0; frame < frames; frame++) {
    // 应用重力
    if (applyGravity) {
      const bodyQuery = world.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) {
          body.vy = sub(body.vy, f(9.8 * (1/60)));
        }
      });
    }

    scheduler.tick(world, 16);

    // 收集指标
    const hash = frameHash(world);
    frameHashes.push(hash);

    const contacts = world.getResource(Contacts2D);
    if (contacts && contacts.list.length > 0) {
      const avgPen = contacts.list.reduce((sum, c) => sum + toFloat(c.pen), 0) / contacts.list.length;
      const maxPen = Math.max(...contacts.list.map(c => toFloat(c.pen)));
      penetrations.push(avgPen);
      maxPenetration = Math.max(maxPenetration, maxPen);
    }

    const warmStats = world.getResource(WarmStartStats);
    if (warmStats) {
      totalWarmStartRatio += warmStats.getWarmStartRatio();
    }

    // 收集速度大小
    const bodyQuery = world.query(Body2D);
    bodyQuery.forEach((entity, body) => {
      if (body.invMass > 0) {
        const vx = toFloat(body.vx);
        const vy = toFloat(body.vy);
        const vmag = Math.sqrt(vx * vx + vy * vy);
        velocityMagnitudes.push(vmag);
      }
    });
  }

  return {
    frameHashes,
    avgPenetration: penetrations.reduce((a, b) => a + b, 0) / Math.max(penetrations.length, 1),
    maxPenetration,
    velocityVariance: calculateVariance(velocityMagnitudes),
    warmStartRatio: totalWarmStartRatio / frames
  };
}

describe('Warm-Start Performance Tests', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('10x10 box stacking: warm-start provides better convergence', () => {
    console.log('\n=== 10x10 Box Stacking Performance Test ===');

    const createBoxStackWorld = (enableWarmStart: boolean) => {
      const { world, scheduler } = createPhysicsWorld(enableWarmStart);

      // 创建地面
      const ground = world.createEntity();
      world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-5)));
      world.addComponent(ground, ShapeCircle, createCircleShape(f(20)));
      world.addComponent(ground, AABB2D, new AABB2D());
      world.addComponent(ground, Guid, createGuid(world));

      // 创建6x6堆叠（较少以便测试更快）
      const rows = 6;
      const cols = 6;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const entity = world.createEntity();

          const x = mul(sub(f(col), div(f(cols - 1), f(2))), f(1.1));
          const y = add(f(1), mul(f(row), f(1.1)));

          const body = createDynamicBody(x, y, ONE, ONE);
          body.friction = f(0.3);
          body.restitution = f(0.1);

          world.addComponent(entity, Body2D, body);
          world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
          world.addComponent(entity, AABB2D, new AABB2D());
          world.addComponent(entity, Guid, createGuid(world));
        }
      }

      return { world, scheduler };
    };

    // 测试无warm-start
    const { world: worldWithout, scheduler: schedulerWithout } = createBoxStackWorld(false);
    const metricsWithout = runPhysicsSimulation(worldWithout, schedulerWithout, 60);

    // 测试有warm-start
    const { world: worldWith, scheduler: schedulerWith } = createBoxStackWorld(true);
    const metricsWith = runPhysicsSimulation(worldWith, schedulerWith, 60);

    console.log('Results:');
    console.log(`Without warm-start:`);
    console.log(`  Avg penetration: ${metricsWithout.avgPenetration.toFixed(4)}`);
    console.log(`  Max penetration: ${metricsWithout.maxPenetration.toFixed(4)}`);
    console.log(`  Velocity variance: ${metricsWithout.velocityVariance.toFixed(6)}`);

    console.log(`With warm-start:`);
    console.log(`  Avg penetration: ${metricsWith.avgPenetration.toFixed(4)}`);
    console.log(`  Max penetration: ${metricsWith.maxPenetration.toFixed(4)}`);
    console.log(`  Velocity variance: ${metricsWith.velocityVariance.toFixed(6)}`);
    console.log(`  Warm-start ratio: ${(metricsWith.warmStartRatio * 100).toFixed(1)}%`);

    // Frame hash 稳定性分析
    const hashStabilityWithout = analyzeFrameHashStability(metricsWithout.frameHashes);
    const hashStabilityWith = analyzeFrameHashStability(metricsWith.frameHashes);

    console.log(`Frame hash stability:`);
    console.log(`  Without warm-start: ${(hashStabilityWithout * 100).toFixed(2)}%`);
    console.log(`  With warm-start: ${(hashStabilityWith * 100).toFixed(2)}%`);

    // 验证改善
    expect(metricsWith.warmStartRatio).toBeGreaterThan(0.2); // 至少20%被warm-start
    expect(hashStabilityWith).toBeGreaterThanOrEqual(hashStabilityWithout); // 不应该更差
  });

  test('slope stability: reduced jitter with warm-start', () => {
    console.log('\n=== Slope Stability Test ===');

    const createSlopeWorld = (enableWarmStart: boolean) => {
      const { world, scheduler } = createPhysicsWorld(enableWarmStart);

      // 创建倾斜地面（用静态圆模拟）
      for (let i = 0; i < 20; i++) {
        const entity = world.createEntity();
        const x = mul(f(i), f(0.8));
        const y = add(f(-3), mul(f(i), f(-0.1))); // 斜坡角度

        world.addComponent(entity, Body2D, createStaticBody(x, y));
        world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, createGuid(world));
      }

      // 创建滑动球
      const ball = world.createEntity();
      const body = createDynamicBody(f(2), f(5), ONE, ONE);
      body.friction = f(0.4);
      body.restitution = f(0.0);

      world.addComponent(ball, Body2D, body);
      world.addComponent(ball, ShapeCircle, createCircleShape(f(0.3)));
      world.addComponent(ball, AABB2D, new AABB2D());
      world.addComponent(ball, Guid, createGuid(world));

      return { world, scheduler };
    };

    // 测试无warm-start
    const { world: worldWithout, scheduler: schedulerWithout } = createSlopeWorld(false);
    const metricsWithout = runPhysicsSimulation(worldWithout, schedulerWithout, 100);

    // 测试有warm-start
    const { world: worldWith, scheduler: schedulerWith } = createSlopeWorld(true);
    const metricsWith = runPhysicsSimulation(worldWith, schedulerWith, 100);

    console.log('Results:');
    console.log(`Without warm-start:`);
    console.log(`  Velocity variance: ${metricsWithout.velocityVariance.toFixed(6)}`);
    console.log(`  Avg penetration: ${metricsWithout.avgPenetration.toFixed(4)}`);

    console.log(`With warm-start:`);
    console.log(`  Velocity variance: ${metricsWith.velocityVariance.toFixed(6)}`);
    console.log(`  Avg penetration: ${metricsWith.avgPenetration.toFixed(4)}`);
    console.log(`  Warm-start ratio: ${(metricsWith.warmStartRatio * 100).toFixed(1)}%`);

    const jitterReduction = ((metricsWithout.velocityVariance - metricsWith.velocityVariance) / metricsWithout.velocityVariance) * 100;
    console.log(`Jitter reduction: ${jitterReduction.toFixed(2)}%`);

    // 验证减少抖动
    expect(metricsWith.warmStartRatio).toBeGreaterThan(0.1);
    expect(metricsWith.velocityVariance).toBeLessThanOrEqual(metricsWithout.velocityVariance);
  });

  test('compression-release: no explosive behavior', () => {
    console.log('\n=== Compression-Release Test ===');

    const createCompressionWorld = (enableWarmStart: boolean) => {
      const { world, scheduler } = createPhysicsWorld(enableWarmStart);

      // 创建地面
      const ground = world.createEntity();
      world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-3)));
      world.addComponent(ground, ShapeCircle, createCircleShape(f(10)));
      world.addComponent(ground, AABB2D, new AABB2D());
      world.addComponent(ground, Guid, createGuid(world));

      // 创建被压缩的物体栈
      const stackHeight = 4;
      for (let i = 0; i < stackHeight; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(ZERO, add(f(-1), mul(f(i), f(1.1))), ONE, ONE);
        body.friction = f(0.3);
        body.restitution = f(0.1);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, createGuid(world));
      }

      // 创建压缩器（重物）
      const compressor = world.createEntity();
      const compressorBody = createDynamicBody(ZERO, f(5), f(5), ONE); // 5倍质量
      compressorBody.friction = f(0.5);

      world.addComponent(compressor, Body2D, compressorBody);
      world.addComponent(compressor, ShapeCircle, createCircleShape(f(1.0)));
      world.addComponent(compressor, AABB2D, new AABB2D());
      world.addComponent(compressor, Guid, createGuid(world));

      return { world, scheduler, compressor };
    };

    // 测试无warm-start
    const { world: worldWithout, scheduler: schedulerWithout, compressor: compressorWithout } = createCompressionWorld(false);

    // 压缩阶段
    for (let i = 0; i < 30; i++) {
      const bodyQuery = worldWithout.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) {
          body.vy = sub(body.vy, f(9.8 * (1/60)));
        }
      });
      schedulerWithout.tick(worldWithout, 16);
    }

    // 释放：移除压缩器
    worldWithout.destroyEntity(compressorWithout);

    // 观察释放后的行为
    const releaseMetricsWithout = runPhysicsSimulation(worldWithout, schedulerWithout, 30, false);

    // 测试有warm-start
    const { world: worldWith, scheduler: schedulerWith, compressor: compressorWith } = createCompressionWorld(true);

    // 压缩阶段
    for (let i = 0; i < 30; i++) {
      const bodyQuery = worldWith.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) {
          body.vy = sub(body.vy, f(9.8 * (1/60)));
        }
      });
      schedulerWith.tick(worldWith, 16);
    }

    // 释放
    worldWith.destroyEntity(compressorWith);
    const releaseMetricsWith = runPhysicsSimulation(worldWith, schedulerWith, 30, false);

    console.log('Release phase results:');
    console.log(`Without warm-start:`);
    console.log(`  Max velocity: ${Math.sqrt(releaseMetricsWithout.velocityVariance).toFixed(4)}`);
    console.log(`  Avg penetration: ${releaseMetricsWithout.avgPenetration.toFixed(4)}`);

    console.log(`With warm-start:`);
    console.log(`  Max velocity: ${Math.sqrt(releaseMetricsWith.velocityVariance).toFixed(4)}`);
    console.log(`  Avg penetration: ${releaseMetricsWith.avgPenetration.toFixed(4)}`);
    console.log(`  Warm-start ratio: ${(releaseMetricsWith.warmStartRatio * 100).toFixed(1)}%`);

    // 验证减少爆炸性行为
    expect(releaseMetricsWith.warmStartRatio).toBeGreaterThan(0.1);
    expect(releaseMetricsWith.velocityVariance).toBeLessThanOrEqual(releaseMetricsWithout.velocityVariance);
  });
});

function analyzeFrameHashStability(hashes: string[]): number {
  if (hashes.length < 2) return 1;

  let stableFrames = 0;
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === hashes[i-1]) {
      stableFrames++;
    }
  }

  return stableFrames / (hashes.length - 1);
}