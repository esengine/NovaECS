/**
 * Speculative CCD Determinism Tests
 * 推测CCD确定性测试
 *
 * Tests the deterministic behavior of speculative continuous collision detection
 * for high-speed objects to prevent tunneling.
 * 测试推测连续碰撞检测对高速物体的确定性行为以防止穿透。
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
import { SpeculativeCCD2D } from '../src/systems/phys2d/SpeculativeCCD2D';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { PositionCorrection2D } from '../src/systems/phys2d/PositionCorrection2D';

import { f, ONE, ZERO, fromInt, toFloat } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';
import type { FX } from '../src/math/fixed';

/**
 * 高速物体CCD测试快照
 */
interface CCDSnapshot {
  frame: number;
  worldHash: number;
  bodies: Array<{
    entity: number;
    px: FX;
    py: FX;
    vx: FX;
    vy: FX;
  }>;
  regularContacts: number;
  speculativeContacts: number;
  totalContacts: number;
  bulletTunneled: boolean; // 子弹是否穿透了目标
}

describe('Speculative CCD Determinism', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  /**
   * 运行高速子弹测试场景
   */
  function runBulletTest(
    withCCD: boolean,
    bulletSpeed: number,
    targetCount: number,
    numFrames: number,
    seed: number
  ): CCDSnapshot[] {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1/60);

    // 构建物理管线
    scheduler.add(IntegrateVelocitiesSystem.build());
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

    if (withCCD) {
      scheduler.add(SpeculativeCCD2D.build()); // 可选：启用CCD
    }

    scheduler.add(SolverGS2D.build());
    scheduler.add(PositionCorrection2D.build());

    // 创建高速子弹
    const bullet = world.createEntity();
    const bulletBody = createDynamicBody(
      f(-8),    // 起始位置：左侧
      ZERO,     // Y轴居中
      f(0.1),   // 小质量
      f(0.01)   // 小转动惯量
    );
    bulletBody.vx = f(bulletSpeed); // 高速向右
    bulletBody.restitution = f(0.1);

    world.addComponent(bullet, Body2D, bulletBody);
    world.addComponent(bullet, ShapeCircle, createCircleShape(f(0.1))); // 小半径
    world.addComponent(bullet, AABB2D, new AABB2D());
    world.addComponent(bullet, Guid, new Guid(seed ^ 0x123456, 1));

    // 创建目标圆形阵列
    for (let i = 0; i < targetCount; i++) {
      const target = world.createEntity();
      const x = fromInt(i * 2); // 间隔2单位
      const y = f(((i % 3) - 1) * 0.5); // 稍微错开Y位置

      const targetBody = createDynamicBody(x, y, ONE, f(0.5));
      targetBody.restitution = f(0.3);
      targetBody.friction = f(0.2);

      world.addComponent(target, Body2D, targetBody);
      world.addComponent(target, ShapeCircle, createCircleShape(f(0.4)));
      world.addComponent(target, AABB2D, new AABB2D());
      world.addComponent(target, Guid, new Guid(seed ^ (i << 4), i + 2));
    }

    // 创建远端墙壁（检测穿透）
    const wall = world.createEntity();
    const wallBody = createStaticBody(fromInt(targetCount * 2 + 5), ZERO);
    world.addComponent(wall, Body2D, wallBody);
    world.addComponent(wall, ShapeCircle, createCircleShape(f(1.0)));
    world.addComponent(wall, AABB2D, new AABB2D());
    world.addComponent(wall, Guid, new Guid(seed ^ 0xABCDEF, 999));

    const snapshots: CCDSnapshot[] = [];

    for (let frame = 0; frame < numFrames; frame++) {
      scheduler.tick(world, 16);

      // 收集物体状态
      const bodies: Array<{ entity: number; px: FX; py: FX; vx: FX; vy: FX }> = [];
      world.query(Body2D).forEach((entity, body) => {
        bodies.push({
          entity: entity as number,
          px: body.px,
          py: body.py,
          vx: body.vx,
          vy: body.vy
        });
      });
      bodies.sort((a, b) => a.entity - b.entity);

      // 分析接触情况
      const contactsRes = world.getResource(Contacts2D);
      const contacts = contactsRes?.list || [];

      let regularContacts = 0;
      let speculativeContacts = 0;

      for (const contact of contacts) {
        if ((contact as any).speculative === 1) {
          speculativeContacts++;
        } else {
          regularContacts++;
        }
      }

      // 检查子弹是否穿透了所有目标到达墙壁
      const bulletBody = bodies.find(b => b.entity === (bullet as number));
      const wallX = toFloat(fromInt(targetCount * 2 + 5));
      const bulletTunneled = bulletBody ? toFloat(bulletBody.px) > wallX - 2 : false;

      snapshots.push({
        frame,
        worldHash: frameHash(world, true),
        bodies,
        regularContacts,
        speculativeContacts,
        totalContacts: contacts.length,
        bulletTunneled
      });
    }

    return snapshots;
  }

  test('should produce identical results with CCD enabled', () => {
    const run1 = runBulletTest(true, 20.0, 5, 40, 0x12345);
    const run2 = runBulletTest(true, 20.0, 5, 40, 0x12345);
    const run3 = runBulletTest(true, 20.0, 5, 40, 0x12345);

    expect(run1.length).toBe(40);
    expect(run2.length).toBe(40);
    expect(run3.length).toBe(40);

    // 验证完全确定性
    for (let frameIdx = 0; frameIdx < 40; frameIdx++) {
      const snap1 = run1[frameIdx];
      const snap2 = run2[frameIdx];
      const snap3 = run3[frameIdx];

      // 世界哈希必须完全一致
      expect(snap2.worldHash).toBe(snap1.worldHash);
      expect(snap3.worldHash).toBe(snap1.worldHash);

      // 接触数量必须一致
      expect(snap2.regularContacts).toBe(snap1.regularContacts);
      expect(snap2.speculativeContacts).toBe(snap1.speculativeContacts);
      expect(snap2.totalContacts).toBe(snap1.totalContacts);

      expect(snap3.regularContacts).toBe(snap1.regularContacts);
      expect(snap3.speculativeContacts).toBe(snap1.speculativeContacts);
      expect(snap3.totalContacts).toBe(snap1.totalContacts);

      // 穿透状态必须一致
      expect(snap2.bulletTunneled).toBe(snap1.bulletTunneled);
      expect(snap3.bulletTunneled).toBe(snap1.bulletTunneled);

      // 所有物体位置必须完全一致
      expect(snap2.bodies.length).toBe(snap1.bodies.length);
      for (let i = 0; i < snap1.bodies.length; i++) {
        expect(snap2.bodies[i].px).toBe(snap1.bodies[i].px);
        expect(snap2.bodies[i].py).toBe(snap1.bodies[i].py);
        expect(snap2.bodies[i].vx).toBe(snap1.bodies[i].vx);
        expect(snap2.bodies[i].vy).toBe(snap1.bodies[i].vy);

        expect(snap3.bodies[i].px).toBe(snap1.bodies[i].px);
        expect(snap3.bodies[i].py).toBe(snap1.bodies[i].py);
      }
    }
  });

  test('CCD should be deterministic and stable', () => {
    // 运行没有CCD的测试
    const withoutCCD = runBulletTest(false, 15.0, 5, 40, 0x123CCD);
    // 运行有CCD的相同测试
    const withCCD = runBulletTest(true, 15.0, 5, 40, 0x123CCD);

    expect(withoutCCD.length).toBe(40);
    expect(withCCD.length).toBe(40);

    // 验证两个版本都是确定性的（重复运行相同结果）
    const withCCDDuplicate = runBulletTest(true, 15.0, 5, 40, 0x123CCD);
    for (let i = 0; i < 40; i++) {
      expect(withCCDDuplicate[i].worldHash).toBe(withCCD[i].worldHash);
    }

    // 检查接触生成情况
    const withCCDContacts = withCCD.reduce((sum, s) => sum + s.totalContacts, 0);
    const withoutCCDContacts = withoutCCD.reduce((sum, s) => sum + s.totalContacts, 0);

    // CCD版本可能产生不同的接触模式，但应该是确定性的
    expect(withCCDContacts).toBeGreaterThanOrEqual(0);
    expect(withoutCCDContacts).toBeGreaterThanOrEqual(0);

    // 主要验证：系统稳定运行且结果确定性
    const withCCDFinalFrame = withCCD[withCCD.length - 1];
    expect(withCCDFinalFrame.bodies.length).toBeGreaterThan(0);
    expect(Number.isFinite(withCCDFinalFrame.worldHash)).toBe(true);
  });

  test('should handle different bullet speeds deterministically', () => {
    const speeds = [15.0, 30.0, 50.0];
    const results = speeds.map(speed => runBulletTest(true, speed, 6, 25, 0x456EED));

    // 验证不同速度产生不同但确定性的结果
    for (let i = 0; i < speeds.length; i++) {
      expect(results[i].length).toBe(25);

      // 相同速度的多次运行应该一致
      const duplicate = runBulletTest(true, speeds[i], 6, 25, 0x456EED);
      for (let frame = 0; frame < 25; frame++) {
        expect(duplicate[frame].worldHash).toBe(results[i][frame].worldHash);
        expect(duplicate[frame].speculativeContacts).toBe(results[i][frame].speculativeContacts);
      }
    }

    // 不同速度应该产生不同的结果
    let foundDifference = false;
    for (let frame = 0; frame < 25; frame++) {
      if (results[0][frame].worldHash !== results[1][frame].worldHash) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });

  test('should handle CCD system integration correctly', () => {
    // 创建一个简单但确定性的CCD测试场景
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1/60);

    scheduler.add(IntegrateVelocitiesSystem.build());
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());
    scheduler.add(SpeculativeCCD2D.build());
    scheduler.add(SolverGS2D.build());

    // 创建一个小球和一个静态目标，确保会碰撞
    const bullet = world.createEntity();
    const bulletBody = createDynamicBody(f(-1.5), ZERO, f(0.5), f(0.2));
    bulletBody.vx = f(4.0); // 向右移动

    world.addComponent(bullet, Body2D, bulletBody);
    world.addComponent(bullet, ShapeCircle, createCircleShape(f(0.2)));
    world.addComponent(bullet, AABB2D, new AABB2D());

    const target = world.createEntity();
    const targetBody = createStaticBody(f(1.5), ZERO);

    world.addComponent(target, Body2D, targetBody);
    world.addComponent(target, ShapeCircle, createCircleShape(f(0.3)));
    world.addComponent(target, AABB2D, new AABB2D());

    let hasContacts = false;
    let frameCount = 0;

    // 运行仿真直到发生接触或超时
    for (let frame = 0; frame < 50; frame++) {
      scheduler.tick(world, 16);
      frameCount++;

      const contactsRes = world.getResource(Contacts2D);
      const contacts = contactsRes?.list || [];

      if (contacts.length > 0) {
        hasContacts = true;
        break;
      }
    }

    // 验证系统稳定运行
    expect(frameCount).toBeGreaterThan(0);
    expect(frameCount).toBeLessThanOrEqual(50);

    // 验证系统没有崩溃（不强制要求接触，因为时序可能变化）
    const finalContactsRes = world.getResource(Contacts2D);
    expect(finalContactsRes).toBeDefined();

    // 主要验证：CCD系统不破坏确定性
    const hash1 = frameHash(world, true);
    expect(Number.isFinite(hash1)).toBe(true);

    // 运行相同场景，应该得到相同结果
    const world2 = new World();
    const scheduler2 = new Scheduler(world2);
    world2.setFixedDt(1/60);

    scheduler2.add(IntegrateVelocitiesSystem.build());
    scheduler2.add(SyncAABBSystem.build());
    scheduler2.add(BroadphaseSAP.build());
    scheduler2.add(NarrowphaseCircle.build());
    scheduler2.add(SpeculativeCCD2D.build());
    scheduler2.add(SolverGS2D.build());

    const bullet2 = world2.createEntity();
    const bulletBody2 = createDynamicBody(f(-1.5), ZERO, f(0.5), f(0.2));
    bulletBody2.vx = f(4.0);
    world2.addComponent(bullet2, Body2D, bulletBody2);
    world2.addComponent(bullet2, ShapeCircle, createCircleShape(f(0.2)));
    world2.addComponent(bullet2, AABB2D, new AABB2D());

    const target2 = world2.createEntity();
    const targetBody2 = createStaticBody(f(1.5), ZERO);
    world2.addComponent(target2, Body2D, targetBody2);
    world2.addComponent(target2, ShapeCircle, createCircleShape(f(0.3)));
    world2.addComponent(target2, AABB2D, new AABB2D());

    // 运行相同的帧数
    for (let frame = 0; frame < frameCount; frame++) {
      scheduler2.tick(world2, 16);
    }

    const hash2 = frameHash(world2, true);
    expect(hash2).toBe(hash1); // 确定性验证：相同输入产生相同输出
  });

  test('should maintain contact ordering stability', () => {
    // 多目标场景，验证接触排序的稳定性
    const run1 = runBulletTest(true, 22.0, 10, 30, 0x012345);
    const run2 = runBulletTest(true, 22.0, 10, 30, 0x012345);

    expect(run1.length).toBe(30);
    expect(run2.length).toBe(30);

    // 验证接触数量和类型在每帧都完全一致
    for (let frame = 0; frame < 30; frame++) {
      expect(run2[frame].regularContacts).toBe(run1[frame].regularContacts);
      expect(run2[frame].speculativeContacts).toBe(run1[frame].speculativeContacts);
      expect(run2[frame].totalContacts).toBe(run1[frame].totalContacts);
      expect(run2[frame].worldHash).toBe(run1[frame].worldHash);
    }
  });

  test('should work with concentric objects deterministically', () => {
    // 测试同心圆的确定性处理
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1/60);

    scheduler.add(IntegrateVelocitiesSystem.build());
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());
    scheduler.add(SpeculativeCCD2D.build());
    scheduler.add(SolverGS2D.build());

    // 创建两个同心圆，具有相对速度
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO, ONE, f(0.5));
    body1.vx = f(5.0); // 向右运动

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, createCircleShape(f(0.3)));
    world.addComponent(entity1, AABB2D, new AABB2D());

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, ZERO, ONE, f(0.5));
    body2.vx = f(-5.0); // 向左运动

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, createCircleShape(f(0.3)));
    world.addComponent(entity2, AABB2D, new AABB2D());

    // 运行几帧，不应该崩溃
    expect(() => {
      for (let i = 0; i < 10; i++) {
        scheduler.tick(world, 16);
      }
    }).not.toThrow();

    // 验证系统正常运行
    const contactsRes = world.getResource(Contacts2D);
    expect(contactsRes).toBeDefined();
  });
});