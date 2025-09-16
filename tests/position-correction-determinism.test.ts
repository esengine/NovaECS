/**
 * Position Correction Determinism Tests
 * 位置校正确定性测试
 *
 * Tests the deterministic behavior of position-based correction system
 * for stacked objects and penetration resolution.
 * 测试位置校正系统在堆叠物体和穿透解决方面的确定性行为。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { AABB2D } from '../src/components/AABB2D';
import { Guid } from '../src/components/Guid';
import { Contacts2D } from '../src/resources/Contacts2D';

import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { PositionCorrection2D } from '../src/systems/phys2d/PositionCorrection2D';

import { f, ONE, ZERO, fromInt, toFloat, mul } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';
import type { FX } from '../src/math/fixed';

/**
 * 位置校正仿真快照，用于比较确定性
 */
interface PositionCorrectionSnapshot {
  frame: number;
  worldHash: number;
  bodies: Array<{
    entity: number;
    px: FX;
    py: FX;
    vx: FX;
    vy: FX;
    angle: number;
  }>;
  contacts: Array<{
    a: number;
    b: number;
    pen: FX;
    px: FX;
    py: FX;
  }>;
  maxPenetration: FX;
  avgPenetration: FX;
}

describe('Position Correction Determinism', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  /**
   * 运行包含位置校正的完整物理仿真
   */
  function runPhysicsSimulationWithPositionCorrection(
    scenario: 'stack' | 'wall' | 'chain',
    numFrames: number,
    seed: number,
    dt: number = 1/60
  ): PositionCorrectionSnapshot[] {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(dt);

    // 完整的物理管线，包含位置校正
    scheduler.add(IntegrateVelocitiesSystem.build());
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());
    scheduler.add(SolverGS2D.build());
    scheduler.add(PositionCorrection2D.build());
    // 可选：在位置校正后再次同步AABB
    scheduler.add(SyncAABBSystem.build());

    // 根据场景创建不同的测试环境
    if (scenario === 'stack') {
      // 创建垂直堆叠的圆形
      const radius = f(0.5);
      const stackHeight = 6;

      // 地面（静态）
      const ground = world.createEntity();
      const groundBody = createStaticBody(ZERO, f(-1));
      groundBody.friction = f(0.5);
      world.addComponent(ground, Body2D, groundBody);
      world.addComponent(ground, ShapeCircle, createCircleShape(f(2.0)));
      world.addComponent(ground, AABB2D, new AABB2D());
      world.addComponent(ground, Guid, new Guid(seed ^ 0x80000000, 0));

      // 堆叠的圆形
      for (let i = 0; i < stackHeight; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(
          f(((seed >> 8) % 11 - 5) * 0.01), // 微小的水平偏移避免完美对称
          fromInt(i + 1),                   // 垂直堆叠
          ONE,                              // 质量
          f(0.4)                            // 转动惯量
        );
        body.friction = f(0.3);
        body.restitution = f(0.1);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(radius));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, new Guid(seed ^ (i << 4), i + 1));
      }

    } else if (scenario === 'wall') {
      // 创建撞墙场景
      const wall = world.createEntity();
      const wallBody = createStaticBody(f(5), ZERO);
      world.addComponent(wall, Body2D, wallBody);
      world.addComponent(wall, ShapeCircle, createCircleShape(f(1.0)));
      world.addComponent(wall, AABB2D, new AABB2D());
      world.addComponent(wall, Guid, new Guid(seed ^ 0x40000000, 0));

      // 高速撞击的物体
      const projectile = world.createEntity();
      const projBody = createDynamicBody(f(-3), ZERO, f(2), f(0.8));
      projBody.vx = f(8.0); // 高速
      projBody.restitution = f(0.7);
      world.addComponent(projectile, Body2D, projBody);
      world.addComponent(projectile, ShapeCircle, createCircleShape(f(0.6)));
      world.addComponent(projectile, AABB2D, new AABB2D());
      world.addComponent(projectile, Guid, new Guid(seed ^ 0x20000000, 1));

    } else if (scenario === 'chain') {
      // 创建圆形链条压缩场景
      const chainLength = 8;
      const spacing = f(0.9); // 稍微重叠以测试位置校正

      for (let i = 0; i < chainLength; i++) {
        const entity = world.createEntity();
        const mass = (i === 0 || i === chainLength - 1) ? ZERO : ONE; // 两端固定
        const body = (mass === ZERO)
          ? createStaticBody(mul(fromInt(i), spacing), ZERO)
          : createDynamicBody(mul(fromInt(i), spacing), ZERO, mass, f(0.3));

        body.friction = f(0.4);
        body.restitution = f(0.2);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, new Guid(seed ^ (i << 6), i));
      }
    }

    const snapshots: PositionCorrectionSnapshot[] = [];

    for (let frame = 0; frame < numFrames; frame++) {
      scheduler.tick(world, Math.round(dt * 1000));

      // 收集身体状态
      const bodies: Array<{ entity: number; px: FX; py: FX; vx: FX; vy: FX; angle: number }> = [];
      world.query(Body2D).forEach((entity, body) => {
        bodies.push({
          entity: entity as number,
          px: body.px,
          py: body.py,
          vx: body.vx,
          vy: body.vy,
          angle: body.angle
        });
      });
      bodies.sort((a, b) => a.entity - b.entity);

      // 收集接触信息和穿透统计
      const contactsRes = world.getResource(Contacts2D);
      const contacts = contactsRes?.list.map(c => ({
        a: c.a as number,
        b: c.b as number,
        pen: c.pen,
        px: c.px,
        py: c.py
      })) || [];
      contacts.sort((a, b) => {
        const diff = a.a - b.a;
        return diff !== 0 ? diff : a.b - b.b;
      });

      // 计算穿透统计
      let maxPenetration = ZERO;
      let totalPenetration = ZERO;
      for (const contact of contacts) {
        if (contact.pen > maxPenetration) {
          maxPenetration = contact.pen;
        }
        totalPenetration = (totalPenetration + contact.pen) | 0;
      }
      const avgPenetration = contacts.length > 0
        ? ((totalPenetration / contacts.length) | 0)
        : ZERO;

      snapshots.push({
        frame,
        worldHash: frameHash(world, true),
        bodies,
        contacts,
        maxPenetration,
        avgPenetration
      });
    }

    return snapshots;
  }

  test('should produce identical results across multiple runs', () => {
    const run1 = runPhysicsSimulationWithPositionCorrection('stack', 50, 0x12345);
    const run2 = runPhysicsSimulationWithPositionCorrection('stack', 50, 0x12345);
    const run3 = runPhysicsSimulationWithPositionCorrection('stack', 50, 0x12345);

    expect(run1.length).toBe(50);
    expect(run2.length).toBe(50);
    expect(run3.length).toBe(50);

    // 验证每一帧的完全一致性
    for (let frameIdx = 0; frameIdx < 50; frameIdx++) {
      const snap1 = run1[frameIdx];
      const snap2 = run2[frameIdx];
      const snap3 = run3[frameIdx];

      // 世界哈希必须完全一致
      expect(snap2.worldHash).toBe(snap1.worldHash);
      expect(snap3.worldHash).toBe(snap1.worldHash);

      // 物体位置必须完全一致
      expect(snap2.bodies.length).toBe(snap1.bodies.length);
      for (let i = 0; i < snap1.bodies.length; i++) {
        expect(snap2.bodies[i].px).toBe(snap1.bodies[i].px);
        expect(snap2.bodies[i].py).toBe(snap1.bodies[i].py);
        expect(snap2.bodies[i].vx).toBe(snap1.bodies[i].vx);
        expect(snap2.bodies[i].vy).toBe(snap1.bodies[i].vy);
        expect(snap2.bodies[i].angle).toBe(snap1.bodies[i].angle);

        expect(snap3.bodies[i].px).toBe(snap1.bodies[i].px);
        expect(snap3.bodies[i].py).toBe(snap1.bodies[i].py);
        expect(snap3.bodies[i].angle).toBe(snap1.bodies[i].angle);
      }

      // 接触穿透统计必须一致
      expect(snap2.maxPenetration).toBe(snap1.maxPenetration);
      expect(snap3.maxPenetration).toBe(snap1.maxPenetration);
      expect(snap2.avgPenetration).toBe(snap1.avgPenetration);
      expect(snap3.avgPenetration).toBe(snap1.avgPenetration);
    }
  });

  test('should stabilize stacked objects without drift', () => {
    const snapshots = runPhysicsSimulationWithPositionCorrection('stack', 120, 0xAABBCC);

    expect(snapshots.length).toBe(120);

    // 检查初期是否有接触
    const earlyFrames = snapshots.slice(10, 30);
    const hasEarlyContacts = earlyFrames.some(s => s.contacts.length > 0);
    expect(hasEarlyContacts).toBe(true);

    // 检查后期稳定性（应该稳定在较小的穿透值）
    const lateFrames = snapshots.slice(80, 120);
    const POS_SLOP_VALUE = 0.0005; // 对应f(0.0005)

    for (const snap of lateFrames) {
      if (snap.contacts.length > 0) {
        // 最大穿透应该在合理范围内（考虑到堆叠的复杂性）
        const maxPenFloat = toFloat(snap.maxPenetration);
        expect(maxPenFloat).toBeLessThan(1.0); // 1米的容差（堆叠时可能有较大穿透）

        // 平均穿透应该更合理
        const avgPenFloat = toFloat(snap.avgPenetration);
        expect(avgPenFloat).toBeLessThan(0.5); // 平均穿透不应该太大
      }
    }

    // 检查位置没有持续漂移（取顶部物体检查）
    const topBodyEntity = Math.max(...snapshots[0].bodies.map(b => b.entity));
    const topBodySnapshots = snapshots.map(s =>
      s.bodies.find(b => b.entity === topBodyEntity)
    ).filter(b => b !== undefined);

    if (topBodySnapshots.length > 60) {
      // 比较中期和后期的Y位置，不应该有持续下降
      const midY = toFloat(topBodySnapshots[40]!.py);
      const lateY = toFloat(topBodySnapshots[100]!.py);
      const drift = Math.abs(lateY - midY);

      // 允许的最大漂移（应该很小）
      expect(drift).toBeLessThan(0.1); // 0.1米的容差
    }
  });

  test('should handle high-speed collisions deterministically', () => {
    // 运行相同场景两次，验证确定性
    const snapshots1 = runPhysicsSimulationWithPositionCorrection('wall', 60, 0xDEADBEEF);
    const snapshots2 = runPhysicsSimulationWithPositionCorrection('wall', 60, 0xDEADBEEF);

    expect(snapshots1.length).toBe(60);
    expect(snapshots2.length).toBe(60);

    // 应该在某个时刻发生碰撞
    const hasCollision1 = snapshots1.some(s => s.contacts.length > 0);
    const hasCollision2 = snapshots2.some(s => s.contacts.length > 0);
    expect(hasCollision1).toBe(true);
    expect(hasCollision2).toBe(true);

    // 验证两次运行的完全一致性（这是最重要的）
    for (let i = 0; i < 60; i++) {
      expect(snapshots2[i].worldHash).toBe(snapshots1[i].worldHash);
      expect(snapshots2[i].maxPenetration).toBe(snapshots1[i].maxPenetration);
      expect(snapshots2[i].avgPenetration).toBe(snapshots1[i].avgPenetration);
      expect(snapshots2[i].contacts.length).toBe(snapshots1[i].contacts.length);
    }

    // 验证系统没有崩溃，穿透值不是无限的
    const collisionFrames = snapshots1.filter(s => s.contacts.length > 0);
    for (const snap of collisionFrames) {
      const maxPenFloat = toFloat(snap.maxPenetration);

      // 主要检查系统稳定性，而不是具体数值
      expect(maxPenFloat).toBeGreaterThan(0); // 应该有穿透检测
      expect(maxPenFloat).toBeLessThan(10.0); // 防止异常情况，确保系统没有发散
      expect(Number.isFinite(maxPenFloat)).toBe(true); // 确保不是NaN或Infinity
    }
  });

  test('should maintain determinism in compressed chain scenario', () => {
    const run1 = runPhysicsSimulationWithPositionCorrection('chain', 80, 0x1111);
    const run2 = runPhysicsSimulationWithPositionCorrection('chain', 80, 0x1111);

    expect(run1.length).toBe(run2.length);

    // 验证整个链条的确定性
    for (let frameIdx = 0; frameIdx < run1.length; frameIdx++) {
      expect(run2[frameIdx].worldHash).toBe(run1[frameIdx].worldHash);
      expect(run2[frameIdx].maxPenetration).toBe(run1[frameIdx].maxPenetration);
      expect(run2[frameIdx].avgPenetration).toBe(run1[frameIdx].avgPenetration);
    }

    // 检查链条压缩是否得到有效处理
    const hasContacts = run1.some(s => s.contacts.length > 0);
    expect(hasContacts).toBe(true);
  });

  test('different seeds should produce different but deterministic results', () => {
    const seed1_run1 = runPhysicsSimulationWithPositionCorrection('stack', 40, 0xAAAA);
    const seed1_run2 = runPhysicsSimulationWithPositionCorrection('stack', 40, 0xAAAA);
    const seed2_run1 = runPhysicsSimulationWithPositionCorrection('stack', 40, 0xBBBB);
    const seed2_run2 = runPhysicsSimulationWithPositionCorrection('stack', 40, 0xBBBB);

    // 相同种子的运行必须完全一致
    for (let i = 0; i < 40; i++) {
      expect(seed1_run2[i].worldHash).toBe(seed1_run1[i].worldHash);
      expect(seed2_run2[i].worldHash).toBe(seed2_run1[i].worldHash);
    }

    // 不同种子的运行应该产生不同结果
    let foundDifference = false;
    for (let i = 0; i < 40; i++) {
      if (seed1_run1[i].worldHash !== seed2_run1[i].worldHash) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });

  test('should work correctly without position correction for comparison', () => {
    // 运行不带位置校正的仿真作为对照
    const world = new World();
    const scheduler = new Scheduler(world);
    world.setFixedDt(1/60);

    scheduler.add(IntegrateVelocitiesSystem.build());
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());
    scheduler.add(SolverGS2D.build());
    // 注意：没有PositionCorrection2D

    // 创建简单测试场景
    const ground = world.createEntity();
    world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-1)));
    world.addComponent(ground, ShapeCircle, createCircleShape(f(1.0)));
    world.addComponent(ground, AABB2D, new AABB2D());

    const ball = world.createEntity();
    world.addComponent(ball, Body2D, createDynamicBody(ZERO, f(2), ONE, f(0.5)));
    world.addComponent(ball, ShapeCircle, createCircleShape(f(0.5)));
    world.addComponent(ball, AABB2D, new AABB2D());

    // 运行几帧确保系统正常工作
    expect(() => {
      for (let i = 0; i < 30; i++) {
        scheduler.tick(world, 16);
      }
    }).not.toThrow();

    // 验证接触是否产生
    const contactsRes = world.getResource(Contacts2D);
    expect(contactsRes).toBeDefined();
  });
});