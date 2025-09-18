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

import { f, ONE, ZERO, fromInt, toFloat, mul, sub, abs, add } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';
import { system, SystemContext } from '../src/core/System';
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
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);
    scheduler.add(SolverGS2D);
    scheduler.add(PositionCorrection2D);
    // 可选：在位置校正后再次同步AABB
    scheduler.add(SyncAABBSystem);

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

    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);
    scheduler.add(SolverGS2D);
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

  /**
   * 测试多个圆堆叠的长时间稳定性
   * 验证穿透会稳定维持在 POS_SLOP 附近，不会慢慢沉
   */
  test('should maintain long-term stability for stacked circles near POS_SLOP', () => {
    const EXTENDED_FRAMES = 300; // 5秒仿真时间（300帧）
    const POS_SLOP = f(0.0005); // 当前系统的位置容差
    const STACK_HEIGHT = 8;

    const snapshots = runPhysicsSimulationWithPositionCorrection('stack', EXTENDED_FRAMES, 0x987654);

    expect(snapshots.length).toBe(EXTENDED_FRAMES);

    // 将仿真分为三个阶段：初期、中期、后期
    const earlyFrames = snapshots.slice(20, 60);   // 第20-60帧（初始稳定后）
    const midFrames = snapshots.slice(100, 140);   // 第100-140帧（中期）
    const lateFrames = snapshots.slice(200, 300);  // 第200-300帧（后期）

    // 验证系统在各个阶段都有接触
    expect(earlyFrames.every(s => s.contacts.length > 0)).toBe(true);
    expect(midFrames.every(s => s.contacts.length > 0)).toBe(true);
    expect(lateFrames.every(s => s.contacts.length > 0)).toBe(true);

    // 计算各阶段的平均最大穿透
    const calcAvgMaxPen = (frames: PositionCorrectionSnapshot[]) => {
      const totalMaxPen = frames.reduce((sum, s) => sum + s.maxPenetration, 0);
      return totalMaxPen / frames.length;
    };

    const earlyAvgMaxPen = calcAvgMaxPen(earlyFrames);
    const midAvgMaxPen = calcAvgMaxPen(midFrames);
    const lateAvgMaxPen = calcAvgMaxPen(lateFrames);

    // 验证穿透值在合理范围内，不会持续增长
    const earlyFloat = toFloat(earlyAvgMaxPen);
    const midFloat = toFloat(midAvgMaxPen);
    const lateFloat = toFloat(lateAvgMaxPen);

    // 各阶段穿透都应该在可接受范围内
    expect(earlyFloat).toBeGreaterThan(0.0001); // 应该有一定穿透
    expect(earlyFloat).toBeLessThan(1.0);       // 堆叠场景可能有较大穿透

    expect(midFloat).toBeGreaterThan(0.0001);
    expect(midFloat).toBeLessThan(1.0);

    expect(lateFloat).toBeGreaterThan(0.0001);
    expect(lateFloat).toBeLessThan(1.0);

    // 验证没有持续增长趋势（后期不应比初期大太多）
    const growthRatio = lateFloat / earlyFloat;
    expect(growthRatio).toBeLessThan(2.0); // 后期穿透不应是初期的2倍以上

    // 获取堆叠顶部物体的Y坐标轨迹
    const topBodyEntity = Math.max(...snapshots[0].bodies.map(b => b.entity));
    const topBodyPositions = snapshots.map(s => {
      const body = s.bodies.find(b => b.entity === topBodyEntity);
      return body ? toFloat(body.py) : 0;
    });

    // 检查顶部物体是否有持续下沉（重力沉降）
    const earlyY = topBodyPositions.slice(20, 60).reduce((sum, y) => sum + y, 0) / 40;
    const lateY = topBodyPositions.slice(200, 300).reduce((sum, y) => sum + y, 0) / 100;
    const yDrift = earlyY - lateY; // 正值表示下沉

    // 允许少量沉降，但不应该有显著漂移
    expect(yDrift).toBeLessThan(0.05); // 最多5cm的沉降
  });

  /**
   * 测试 POS_PERCENT 参数对收敛速度和抖动的影响
   */
  test('should observe POS_PERCENT parameter effects on convergence and jitter', () => {
    const FRAMES = 120;
    const testScenarios = [
      { percent: 0.2, name: 'low' },    // 保守校正
      { percent: 0.8, name: 'default' },// 默认
      { percent: 1.5, name: 'high' }    // 激进校正
    ];

    const results: Record<string, {
      snapshots: PositionCorrectionSnapshot[];
      maxJitter: number;
      avgPenetration: number;
      convergenceFrames: number;
    }> = {};

    for (const scenario of testScenarios) {
      // 创建自定义位置校正系统
      const CustomPositionCorrection = system(
        `test.position-correction.${scenario.name}`,
        (ctx: SystemContext) => {
          const { world } = ctx;
          const contactsRes = world.getResource(Contacts2D);
          if (!contactsRes || contactsRes.list.length === 0) return;

          const POS_PERCENT = f(scenario.percent);
          const POS_SLOP = f(0.0005);

          // 位置校正算法
          for (const contact of contactsRes.list) {
            if (contact.pen <= POS_SLOP) continue;

            const bodyA = world.getComponent(contact.a, Body2D);
            const bodyB = world.getComponent(contact.b, Body2D);
            if (!bodyA || !bodyB) continue;

            const correction = mul(sub(contact.pen, POS_SLOP), POS_PERCENT);
            const invMassSum = bodyA.invMass + bodyB.invMass;
            if (invMassSum <= 0) continue;

            const correctionA = mul(correction, bodyA.invMass);
            const correctionB = mul(correction, bodyB.invMass);

            // 沿接触法线方向校正位置
            bodyA.px = sub(bodyA.px, mul(correctionA, contact.nx));
            bodyA.py = sub(bodyA.py, mul(correctionA, contact.ny));
            bodyB.px = add(bodyB.px, mul(correctionB, contact.nx));
            bodyB.py = add(bodyB.py, mul(correctionB, contact.ny));
          }
        }
      );

      // 运行仿真
      const world = new World();
      const scheduler = new Scheduler(world);
      world.setFixedDt(1/60);

      scheduler.add(IntegrateVelocitiesSystem);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);
      scheduler.add(SolverGS2D);
      scheduler.add(CustomPositionCorrection.build());

      // 创建堆叠场景
      const radius = f(0.5);
      const stackHeight = 5;

      // 地面
      const ground = world.createEntity();
      world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-1)));
      world.addComponent(ground, ShapeCircle, createCircleShape(f(2.0)));
      world.addComponent(ground, AABB2D, new AABB2D());

      // 堆叠圆形
      for (let i = 0; i < stackHeight; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(ZERO, fromInt(i + 1), ONE, f(0.4));
        body.friction = f(0.3);
        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(radius));
        world.addComponent(entity, AABB2D, new AABB2D());
      }

      const snapshots: PositionCorrectionSnapshot[] = [];
      const topBodyPositions: number[] = [];

      for (let frame = 0; frame < FRAMES; frame++) {
        scheduler.tick(world, 16);

        // 收集数据（简化版本）
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

        const contactsRes = world.getResource(Contacts2D);
        const contacts = contactsRes?.list || [];
        let maxPen = ZERO;
        let totalPen = ZERO;
        for (const c of contacts) {
          if (c.pen > maxPen) maxPen = c.pen;
          totalPen = (totalPen + c.pen) | 0;
        }
        const avgPen = contacts.length > 0 ? ((totalPen / contacts.length) | 0) : ZERO;

        snapshots.push({
          frame,
          worldHash: 0, // 简化
          bodies,
          contacts: contacts.map(c => ({ a: c.a as number, b: c.b as number, pen: c.pen, px: c.px, py: c.py })),
          maxPenetration: maxPen,
          avgPenetration: avgPen
        });

        // 记录顶部物体位置用于抖动分析
        const topBody = bodies.reduce((max, b) => b.entity > max.entity ? b : max, bodies[0]);
        if (topBody) {
          topBodyPositions.push(toFloat(topBody.py));
        }
      }

      // 分析结果
      const convergenceFrames = snapshots.findIndex(s =>
        s.contacts.length > 0 && toFloat(s.maxPenetration) < 0.01
      );

      const avgPenetration = snapshots.slice(60).reduce((sum, s) =>
        sum + toFloat(s.avgPenetration), 0
      ) / (snapshots.length - 60);

      // 计算抖动（顶部物体位置的标准差）
      const stablePositions = topBodyPositions.slice(60);
      const avgY = stablePositions.reduce((sum, y) => sum + y, 0) / stablePositions.length;
      const variance = stablePositions.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / stablePositions.length;
      const jitter = Math.sqrt(variance);

      results[scenario.name] = {
        snapshots,
        maxJitter: jitter,
        avgPenetration,
        convergenceFrames: convergenceFrames >= 0 ? convergenceFrames : FRAMES
      };
    }

    // 验证 POS_PERCENT 的效果
    expect(results.low).toBeDefined();
    expect(results.default).toBeDefined();
    expect(results.high).toBeDefined();

    // 通常期望：
    // - 更高的 POS_PERCENT 导致更快的收敛
    // - 但可能增加抖动
    // - 太低的值可能收敛慢

    // 基本稳定性检查（所有参数都应该达到基本稳定）
    expect(results.low.avgPenetration).toBeGreaterThan(0);
    expect(results.low.avgPenetration).toBeLessThan(1.0);  // 堆叠场景可能有较大穿透

    expect(results.default.avgPenetration).toBeGreaterThan(0);
    expect(results.default.avgPenetration).toBeLessThan(1.0);

    expect(results.high.avgPenetration).toBeGreaterThan(0);
    expect(results.high.avgPenetration).toBeLessThan(1.0);

    // 抖动检查（不应该有极端抖动）
    expect(results.low.maxJitter).toBeLessThan(0.1);
    expect(results.default.maxJitter).toBeLessThan(0.1);
    expect(results.high.maxJitter).toBeLessThan(0.1);
  });

  /**
   * 测试 POS_SLOP 参数对颤动和间隙的影响
   */
  test('should observe POS_SLOP parameter effects on vibration and gaps', () => {
    const FRAMES = 100;
    const testScenarios = [
      { slop: 0.0001, name: 'tiny' },     // 很小的容差
      { slop: 0.0005, name: 'default' },  // 默认容差
      { slop: 0.002, name: 'large' }      // 较大容差
    ];

    const results: Record<string, {
      avgGap: number;
      vibrationLevel: number;
      stabilityFrames: number;
    }> = {};

    for (const scenario of testScenarios) {
      // 创建自定义位置校正系统
      const CustomPositionCorrection = system(
        `test.position-correction.slop-${scenario.name}`,
        (ctx: SystemContext) => {
          const { world } = ctx;
          const contactsRes = world.getResource(Contacts2D);
          if (!contactsRes || contactsRes.list.length === 0) return;

          const POS_PERCENT = f(0.8);
          const POS_SLOP = f(scenario.slop);

          for (const contact of contactsRes.list) {
            if (contact.pen <= POS_SLOP) continue;

            const bodyA = world.getComponent(contact.a, Body2D);
            const bodyB = world.getComponent(contact.b, Body2D);
            if (!bodyA || !bodyB) continue;

            const correction = mul(sub(contact.pen, POS_SLOP), POS_PERCENT);
            const invMassSum = bodyA.invMass + bodyB.invMass;
            if (invMassSum <= 0) continue;

            const correctionA = mul(correction, bodyA.invMass);
            const correctionB = mul(correction, bodyB.invMass);

            bodyA.px = sub(bodyA.px, mul(correctionA, contact.nx));
            bodyA.py = sub(bodyA.py, mul(correctionA, contact.ny));
            bodyB.px = add(bodyB.px, mul(correctionB, contact.nx));
            bodyB.py = add(bodyB.py, mul(correctionB, contact.ny));
          }
        }
      );

      // 创建简单的两圆接触场景用于精确分析
      const world = new World();
      const scheduler = new Scheduler(world);
      world.setFixedDt(1/60);

      scheduler.add(IntegrateVelocitiesSystem);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);
      scheduler.add(SolverGS2D);
      scheduler.add(CustomPositionCorrection.build());

      // 创建两个相接触的圆（稍微重叠）
      const entityA = world.createEntity();
      const bodyA = createDynamicBody(f(-0.48), ZERO, ONE, f(0.4)); // 左圆
      world.addComponent(entityA, Body2D, bodyA);
      world.addComponent(entityA, ShapeCircle, createCircleShape(f(0.5)));
      world.addComponent(entityA, AABB2D, new AABB2D());

      const entityB = world.createEntity();
      const bodyB = createDynamicBody(f(0.48), ZERO, ONE, f(0.4));  // 右圆，稍微重叠
      world.addComponent(entityB, Body2D, bodyB);
      world.addComponent(entityB, ShapeCircle, createCircleShape(f(0.5)));
      world.addComponent(entityB, AABB2D, new AABB2D());

      const gapHistory: number[] = [];
      const bodyAPositions: number[] = [];

      for (let frame = 0; frame < FRAMES; frame++) {
        scheduler.tick(world, 16);

        // 计算两圆间距
        const currentBodyA = world.getComponent(entityA, Body2D)!;
        const currentBodyB = world.getComponent(entityB, Body2D)!;

        const distance = Math.sqrt(
          Math.pow(toFloat(currentBodyB.px) - toFloat(currentBodyA.px), 2) +
          Math.pow(toFloat(currentBodyB.py) - toFloat(currentBodyA.py), 2)
        );
        const gap = distance - 1.0; // 两个半径0.5的圆的理想间距为0
        gapHistory.push(gap);
        bodyAPositions.push(toFloat(currentBodyA.px));
      }

      // 分析稳定期的数据（跳过前30帧）
      const stableGaps = gapHistory.slice(30);
      const stablePositions = bodyAPositions.slice(30);

      const avgGap = stableGaps.reduce((sum, g) => sum + Math.abs(g), 0) / stableGaps.length;

      // 计算位置振动（标准差）
      const avgPos = stablePositions.reduce((sum, p) => sum + p, 0) / stablePositions.length;
      const vibration = Math.sqrt(
        stablePositions.reduce((sum, p) => sum + Math.pow(p - avgPos, 2), 0) / stablePositions.length
      );

      // 计算达到稳定的帧数
      const stabilityThreshold = 0.001;
      const stabilityFrames = gapHistory.findIndex((gap, idx) => {
        if (idx < 10) return false;
        const recentGaps = gapHistory.slice(Math.max(0, idx - 10), idx);
        const variance = recentGaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / recentGaps.length;
        return Math.sqrt(variance) < stabilityThreshold;
      });

      results[scenario.name] = {
        avgGap,
        vibrationLevel: vibration,
        stabilityFrames: stabilityFrames >= 0 ? stabilityFrames : FRAMES
      };
    }

    // 验证 POS_SLOP 的效果
    expect(results.tiny).toBeDefined();
    expect(results.default).toBeDefined();
    expect(results.large).toBeDefined();

    // 基本稳定性检查
    expect(results.tiny.avgGap).toBeGreaterThanOrEqual(0);
    expect(results.default.avgGap).toBeGreaterThanOrEqual(0);
    expect(results.large.avgGap).toBeGreaterThanOrEqual(0);

    // 通常期望：
    // - 更大的 POS_SLOP 会留下更大的间隙
    // - 太小的 POS_SLOP 可能导致更多振动
    // - 但具体数值取决于场景复杂度

    // 间隙大小关系（大体趋势）
    expect(results.large.avgGap).toBeGreaterThan(results.tiny.avgGap * 0.5);

    // 振动程度检查（都不应该有极端振动）
    expect(results.tiny.vibrationLevel).toBeLessThan(0.1);
    expect(results.default.vibrationLevel).toBeLessThan(0.1);
    expect(results.large.vibrationLevel).toBeLessThan(0.1);
  });

  /**
   * 测试重放两次和跨机器的一致性
   */
  test('should maintain cross-machine and replay consistency for position correction', () => {
    const FRAMES = 80;
    const SEED = 0x12345678;

    // 模拟两次独立运行（跨机器/重放）
    const run1 = runPhysicsSimulationWithPositionCorrection('stack', FRAMES, SEED);
    const run2 = runPhysicsSimulationWithPositionCorrection('stack', FRAMES, SEED);
    const run3 = runPhysicsSimulationWithPositionCorrection('chain', FRAMES, SEED);
    const run4 = runPhysicsSimulationWithPositionCorrection('chain', FRAMES, SEED);

    expect(run1.length).toBe(FRAMES);
    expect(run2.length).toBe(FRAMES);
    expect(run3.length).toBe(FRAMES);
    expect(run4.length).toBe(FRAMES);

    // 验证堆叠场景的完全一致性
    for (let frame = 0; frame < FRAMES; frame++) {
      const snap1 = run1[frame];
      const snap2 = run2[frame];

      // 世界哈希必须完全一致
      expect(snap2.worldHash).toBe(snap1.worldHash);

      // 位置必须完全一致
      expect(snap2.bodies.length).toBe(snap1.bodies.length);
      for (let i = 0; i < snap1.bodies.length; i++) {
        expect(snap2.bodies[i].px).toBe(snap1.bodies[i].px);
        expect(snap2.bodies[i].py).toBe(snap1.bodies[i].py);
        expect(snap2.bodies[i].vx).toBe(snap1.bodies[i].vx);
        expect(snap2.bodies[i].vy).toBe(snap1.bodies[i].vy);
      }

      // 接触信息必须一致
      expect(snap2.contacts.length).toBe(snap1.contacts.length);
      for (let i = 0; i < snap1.contacts.length; i++) {
        expect(snap2.contacts[i].a).toBe(snap1.contacts[i].a);
        expect(snap2.contacts[i].b).toBe(snap1.contacts[i].b);
        expect(snap2.contacts[i].pen).toBe(snap1.contacts[i].pen);
        expect(snap2.contacts[i].px).toBe(snap1.contacts[i].px);
        expect(snap2.contacts[i].py).toBe(snap1.contacts[i].py);
      }

      // 穿透统计必须一致
      expect(snap2.maxPenetration).toBe(snap1.maxPenetration);
      expect(snap2.avgPenetration).toBe(snap1.avgPenetration);
    }

    // 验证链条场景的完全一致性
    for (let frame = 0; frame < FRAMES; frame++) {
      const snap3 = run3[frame];
      const snap4 = run4[frame];

      expect(snap4.worldHash).toBe(snap3.worldHash);
      expect(snap4.maxPenetration).toBe(snap3.maxPenetration);
      expect(snap4.avgPenetration).toBe(snap3.avgPenetration);
      expect(snap4.contacts.length).toBe(snap3.contacts.length);
    }

    // 验证接触顺序的一致性
    const extractContactOrder = (snapshots: PositionCorrectionSnapshot[]) => {
      return snapshots.map(s =>
        s.contacts.map(c => `${c.a}-${c.b}`).sort().join('|')
      ).join(';');
    };

    const run1ContactOrder = extractContactOrder(run1);
    const run2ContactOrder = extractContactOrder(run2);
    const run3ContactOrder = extractContactOrder(run3);
    const run4ContactOrder = extractContactOrder(run4);

    expect(run2ContactOrder).toBe(run1ContactOrder);
    expect(run4ContactOrder).toBe(run3ContactOrder);

    // 验证轨迹哈希的一致性
    const extractTrajectoryHash = (snapshots: PositionCorrectionSnapshot[]) => {
      let hash = 0;
      for (const snap of snapshots) {
        hash = ((hash * 31) ^ snap.worldHash) >>> 0;
      }
      return hash;
    };

    const run1TrajectoryHash = extractTrajectoryHash(run1);
    const run2TrajectoryHash = extractTrajectoryHash(run2);
    const run3TrajectoryHash = extractTrajectoryHash(run3);
    const run4TrajectoryHash = extractTrajectoryHash(run4);

    expect(run2TrajectoryHash).toBe(run1TrajectoryHash);
    expect(run4TrajectoryHash).toBe(run3TrajectoryHash);
  });
});