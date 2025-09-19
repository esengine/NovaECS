/**
 * Contact Persistence Cache Demo Test
 * 接触持久化缓存演示测试
 *
 * 专门用于展示warm-start效果的简化测试
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

import { f, ONE, ZERO, add, sub, mul, toFloat } from '../src/math/fixed';

describe('Contact Persistence Demo', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('simple two-circle contact persistence across frames', () => {
    console.log('=== Simple Two-Circle Contact Demo ===');

    // 创建世界和调度器
    const world = new World();
    world.setFixedDt(1/60);

    const scheduler = new Scheduler(world);
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);
    scheduler.add(ContactsWarmStart2D);
    scheduler.add(SolverGS2D);
    scheduler.add(ContactsCommit2D);

    // 创建两个重叠的圆形
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(f(-0.4), ZERO, ONE, ONE);
    body1.vx = f(0.1); // 小速度
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, createCircleShape(f(0.5)));
    world.addComponent(entity1, AABB2D, new AABB2D());
    world.addComponent(entity1, Guid, createGuid(world));

    const entity2 = world.createEntity();
    const body2 = createStaticBody(f(0.4), ZERO); // 静态
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, createCircleShape(f(0.5)));
    world.addComponent(entity2, AABB2D, new AABB2D());
    world.addComponent(entity2, Guid, createGuid(world));

    console.log('Initial setup: Two overlapping circles');

    // 第一帧 - 建立接触
    scheduler.tick(world, 16);

    const contacts1 = world.getResource(Contacts2D);
    const warmStats1 = world.getResource(WarmStartStats);
    console.log(`Frame 1: Contacts=${contacts1?.list.length || 0}, Warm-start ratio=${((warmStats1?.getWarmStartRatio() || 0) * 100).toFixed(1)}%`);

    if (contacts1 && contacts1.list.length > 0) {
      const contact = contacts1.list[0];
      console.log(`  Contact impulses: jn=${toFloat(contact.jn).toFixed(4)}, jt=${toFloat(contact.jt).toFixed(4)}`);
    }

    // 第二帧 - 应该使用warm-start
    scheduler.tick(world, 16);

    const contacts2 = world.getResource(Contacts2D);
    const warmStats2 = world.getResource(WarmStartStats);
    console.log(`Frame 2: Contacts=${contacts2?.list.length || 0}, Warm-start ratio=${((warmStats2?.getWarmStartRatio() || 0) * 100).toFixed(1)}%`);

    if (contacts2 && contacts2.list.length > 0) {
      const contact = contacts2.list[0];
      console.log(`  Contact impulses: jn=${toFloat(contact.jn).toFixed(4)}, jt=${toFloat(contact.jt).toFixed(4)}`);
    }

    // 第三帧 - 继续warm-start
    scheduler.tick(world, 16);

    const contacts3 = world.getResource(Contacts2D);
    const warmStats3 = world.getResource(WarmStartStats);
    console.log(`Frame 3: Contacts=${contacts3?.list.length || 0}, Warm-start ratio=${((warmStats3?.getWarmStartRatio() || 0) * 100).toFixed(1)}%`);

    // 验证warm-start在后续帧中生效
    expect(warmStats2?.getWarmStartRatio()).toBeGreaterThan(0);
    expect(warmStats3?.getWarmStartRatio()).toBeGreaterThan(0);

    // 检查缓存
    const cache = world.getResource(ContactCache2D);
    expect(cache).toBeDefined();
    expect(cache!.getAllPairKeys().length).toBeGreaterThan(0);

    console.log('Cache statistics:');
    const stats = cache!.getStats();
    console.log(`  Pairs: ${stats.pairCount}, Total contacts: ${stats.totalContacts}`);
  });

  test('stack stability comparison: with vs without warm-start', () => {
    console.log('\n=== Stack Stability Comparison ===');

    const createStackWorld = (enableWarmStart: boolean) => {
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

      // 创建地面
      const ground = world.createEntity();
      world.addComponent(ground, Body2D, createStaticBody(ZERO, f(-2)));
      world.addComponent(ground, ShapeCircle, createCircleShape(f(10)));
      world.addComponent(ground, AABB2D, new AABB2D());
      world.addComponent(ground, Guid, createGuid(world));

      // 创建3个物体的小栈
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(ZERO, add(f(-1), mul(f(i), f(1.1))), ONE, ONE);
        body.friction = f(0.5);
        body.restitution = f(0.1);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, createCircleShape(f(0.5)));
        world.addComponent(entity, AABB2D, new AABB2D());
        world.addComponent(entity, Guid, createGuid(world));
      }

      return { world, scheduler };
    };

    // 无warm-start测试
    const { world: worldWithout, scheduler: schedulerWithout } = createStackWorld(false);
    let totalPenWithout = 0;
    let contactCountWithout = 0;

    console.log('Without warm-start:');
    for (let frame = 0; frame < 10; frame++) {
      // 应用重力
      const bodyQuery = worldWithout.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) {
          body.vy = sub(body.vy, f(9.8 * (1/60)));
        }
      });

      schedulerWithout.tick(worldWithout, 16);

      const contacts = worldWithout.getResource(Contacts2D);
      if (contacts) {
        const avgPen = contacts.list.reduce((sum, c) => sum + toFloat(c.pen), 0) / Math.max(contacts.list.length, 1);
        totalPenWithout += avgPen;
        contactCountWithout += contacts.list.length;
        console.log(`  Frame ${frame + 1}: Contacts=${contacts.list.length}, Avg penetration=${avgPen.toFixed(4)}`);
      }
    }

    // 有warm-start测试
    const { world: worldWith, scheduler: schedulerWith } = createStackWorld(true);
    let totalPenWith = 0;
    let contactCountWith = 0;
    let totalWarmStartRatio = 0;

    console.log('With warm-start:');
    for (let frame = 0; frame < 10; frame++) {
      // 应用重力
      const bodyQuery = worldWith.query(Body2D);
      bodyQuery.forEach((entity, body) => {
        if (body.invMass > 0) {
          body.vy = sub(body.vy, f(9.8 * (1/60)));
        }
      });

      schedulerWith.tick(worldWith, 16);

      const contacts = worldWith.getResource(Contacts2D);
      const warmStats = worldWith.getResource(WarmStartStats);

      if (contacts) {
        const avgPen = contacts.list.reduce((sum, c) => sum + toFloat(c.pen), 0) / Math.max(contacts.list.length, 1);
        totalPenWith += avgPen;
        contactCountWith += contacts.list.length;

        const warmRatio = warmStats?.getWarmStartRatio() || 0;
        totalWarmStartRatio += warmRatio;

        console.log(`  Frame ${frame + 1}: Contacts=${contacts.list.length}, Avg penetration=${avgPen.toFixed(4)}, Warm-start=${(warmRatio * 100).toFixed(1)}%`);
      }
    }

    const avgPenWithout = totalPenWithout / 10;
    const avgPenWith = totalPenWith / 10;
    const avgWarmRatio = totalWarmStartRatio / 10;

    console.log('\nSummary:');
    console.log(`Without warm-start: Avg penetration = ${avgPenWithout.toFixed(6)}`);
    console.log(`With warm-start: Avg penetration = ${avgPenWith.toFixed(6)}, Avg warm-start ratio = ${(avgWarmRatio * 100).toFixed(2)}%`);

    // 验证warm-start效果
    expect(avgWarmRatio).toBeGreaterThan(0.1); // 至少10%的接触被warm-start
    console.log(`Warm-start improvement: ${avgWarmRatio > 0.1 ? 'PASS' : 'FAIL'}`);
  });
});