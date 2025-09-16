/**
 * Speculative Contact Generation Test
 * 推测接触生成测试
 *
 * Direct test for speculative contact generation with detailed debugging.
 * 带详细调试的推测接触生成直接测试。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { SystemContext } from '../src/core/System';

import { Body2D } from '../src/components/Body2D';
import { ShapeCircle } from '../src/components/ShapeCircle';
import { Contacts2D } from '../src/resources/Contacts2D';
import { BroadphasePairs } from '../src/resources/BroadphasePairs';

import { SpeculativeCCD2D } from '../src/systems/phys2d/SpeculativeCCD2D';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';

import { f, ONE, ZERO, toFloat } from '../src/math/fixed';
import type { FX } from '../src/math/fixed';

describe('Speculative Contact Generation', () => {
  let world: World;
  let entity1: any;
  let entity2: any;

  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    world = new World();
    world.setFixedDt(1/60);
    entity1 = world.createEntity();
    entity2 = world.createEntity();
  });

  test('应该为高速接近的物体生成推测接触', () => {
    const dt = f(1/60);
    const radius = f(0.1);

    // 设置两个精确配置的高速接近物体
    const body1 = new Body2D();
    body1.px = f(-0.5);   // 距离0.5单位
    body1.py = f(0);
    body1.vx = f(15);     // 速度15单位/秒
    body1.vy = f(0);
    body1.invMass = f(1);
    body1.friction = f(0.3);
    body1.restitution = f(0.0);

    const body2 = new Body2D();
    body2.px = f(0.5);    // 距离0.5单位
    body2.py = f(0);
    body2.vx = f(-15);    // 相向速度15单位/秒
    body2.vy = f(0);
    body2.invMass = f(1);
    body2.friction = f(0.3);
    body2.restitution = f(0.0);

    // 当前分离距离 = 1.0 - 0.2 = 0.8
    // 相对速度 = 30单位/秒
    // 碰撞时间 = 0.8/30 ≈ 0.027秒 > dt(0.0167秒)
    // 帧末分离 = 0.8 - 30*0.0167 = 0.8 - 0.5 = 0.3 > 0
    // 需要更高的速度！

    body1.vx = f(30);     // 提高到30单位/秒
    body2.vx = f(-30);    // 相向速度30单位/秒

    // 现在：相对速度 = 60单位/秒
    // 碰撞时间 = 0.8/60 ≈ 0.013秒 < dt(0.0167秒)
    // 帧末分离 = 0.8 - 60*0.0167 = 0.8 - 1.0 = -0.2 < 0
    // 应该生成推测接触！

    const shape1 = new ShapeCircle();
    shape1.r = radius;

    const shape2 = new ShapeCircle();
    shape2.r = radius;

    // 添加组件到世界
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, shape1);
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, shape2);

    // 手动创建宽相对
    const broadphase = new BroadphasePairs();
    broadphase.pairs = [{ a: entity1, b: entity2 }];
    world.setResource(BroadphasePairs, broadphase);

    // 调试输出配置
    console.log('=== 测试配置 ===');
    console.log(`dt: ${toFloat(dt)}`);
    console.log(`物体1: px=${toFloat(body1.px)}, vx=${toFloat(body1.vx)}, r=${toFloat(radius)}`);
    console.log(`物体2: px=${toFloat(body2.px)}, vx=${toFloat(body2.vx)}, r=${toFloat(radius)}`);

    const currentSeparation = 1.0 - 0.2; // 距离 - 半径和
    const relativeVel = 60.0; // 相对速度
    const predictedSeparation = currentSeparation - relativeVel * (1/60);
    console.log(`当前分离: ${currentSeparation}`);
    console.log(`相对速度: ${relativeVel}`);
    console.log(`预测分离: ${predictedSeparation}`);

    // 运行推测CCD系统
    const ccdConfig = SpeculativeCCD2D.build();
    ccdConfig.fn({ world } as SystemContext);

    // 验证推测接触生成
    const contactsRes = world.getResource(Contacts2D) as Contacts2D;
    expect(contactsRes).toBeDefined();

    console.log(`=== 接触结果 ===`);
    console.log(`生成的接触数量: ${contactsRes.list.length}`);

    contactsRes.list.forEach((c, i) => {
      console.log(`接触 ${i}:`);
      console.log(`  推测标志: ${(c as any).speculative}`);
      console.log(`  穿透深度: ${toFloat(c.pen)}`);
      console.log(`  TOI: ${(c as any).toi ? toFloat((c as any).toi) : 'undefined'}`);
      console.log(`  法向: (${toFloat(c.nx)}, ${toFloat(c.ny)})`);
      console.log(`  位置: (${toFloat(c.px)}, ${toFloat(c.py)})`);
    });

    expect(contactsRes.list.length).toBeGreaterThan(0);

    const speculativeContact = contactsRes.list.find(c => (c as any).speculative === 1);
    expect(speculativeContact).toBeDefined();

    if (speculativeContact) {
      // 验证接触数据的合理性
      expect(speculativeContact.pen).toBeGreaterThan(0); // 预测穿透深度为正
      expect((speculativeContact as any).toi).toBeGreaterThan(0); // TOI在0到1之间
      expect((speculativeContact as any).toi).toBeLessThanOrEqual(ONE);
    }
  });

  test('应该处理临界速度情况', () => {
    // 测试刚好在边界的情况
    const body1 = new Body2D();
    body1.px = f(-0.4);
    body1.py = f(0);
    body1.vx = f(24);     // 临界速度
    body1.vy = f(0);
    body1.invMass = f(1);

    const body2 = new Body2D();
    body2.px = f(0.4);
    body2.py = f(0);
    body2.vx = f(0);      // 静止
    body2.vy = f(0);
    body2.invMass = f(1);

    const shape1 = new ShapeCircle();
    shape1.r = f(0.1);
    const shape2 = new ShapeCircle();
    shape2.r = f(0.1);

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, shape1);
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, shape2);

    const broadphase = new BroadphasePairs();
    broadphase.pairs = [{ a: entity1, b: entity2 }];
    world.setResource(BroadphasePairs, broadphase);

    // 计算期望结果
    const currentSep = 0.8 - 0.2; // 0.6
    const relVel = 24; // 相对速度
    const predictedSep = currentSep - relVel * (1/60); // 0.6 - 0.4 = 0.2 > 0

    console.log(`=== 临界测试 ===`);
    console.log(`当前分离: ${currentSep}`);
    console.log(`预测分离: ${predictedSep}`);

    const ccdConfig = SpeculativeCCD2D.build();
    ccdConfig.fn({ world } as SystemContext);

    const contactsRes = world.getResource(Contacts2D) as Contacts2D;
    expect(contactsRes).toBeDefined();

    console.log(`接触数量: ${contactsRes.list.length}`);

    // 这种情况下不应该生成推测接触（预测分离 > 0）
    const speculativeContacts = contactsRes.list.filter(c => (c as any).speculative === 1);
    expect(speculativeContacts.length).toBe(0);
  });

  test('应该跳过已重叠的物体', () => {
    // 测试已经重叠的物体不生成推测接触
    const body1 = new Body2D();
    body1.px = f(-0.1);   // 重叠位置
    body1.py = f(0);
    body1.vx = f(10);
    body1.vy = f(0);
    body1.invMass = f(1);

    const body2 = new Body2D();
    body2.px = f(0.1);    // 重叠位置
    body2.py = f(0);
    body2.vx = f(-10);
    body2.vy = f(0);
    body2.invMass = f(1);

    const shape1 = new ShapeCircle();
    shape1.r = f(0.15);   // 大半径，确保重叠
    const shape2 = new ShapeCircle();
    shape2.r = f(0.15);

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, shape1);
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, shape2);

    const broadphase = new BroadphasePairs();
    broadphase.pairs = [{ a: entity1, b: entity2 }];
    world.setResource(BroadphasePairs, broadphase);

    console.log(`=== 重叠测试 ===`);
    const currentSep = 0.2 - 0.3; // -0.1 < 0 (重叠)
    console.log(`当前分离: ${currentSep} (应该 < 0)`);

    const ccdConfig = SpeculativeCCD2D.build();
    ccdConfig.fn({ world } as SystemContext);

    const contactsRes = world.getResource(Contacts2D) as Contacts2D;
    expect(contactsRes).toBeDefined();

    console.log(`接触数量: ${contactsRes.list.length}`);

    // 重叠物体不应该生成推测接触
    const speculativeContacts = contactsRes.list.filter(c => (c as any).speculative === 1);
    expect(speculativeContacts.length).toBe(0);
  });
});