/**
 * Narrowphase Circle Collision Detection Tests
 * 圆形窄相碰撞检测测试
 *
 * Tests deterministic circle-circle collision detection with contact manifold generation
 * and warm-start impulse caching across multiple simulation runs.
 * 测试确定性圆-圆碰撞检测，包括接触流形生成和跨多次仿真运行的warm-start冲量缓存。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

// Import physics components and systems
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { AABB2D } from '../src/components/AABB2D';
import { Guid, createGuid } from '../src/components/Guid';
import { BroadphasePairs } from '../src/resources/BroadphasePairs';
import { Contacts2D } from '../src/resources/Contacts2D';
import { PRNG } from '../src/determinism/PRNG';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { updateContactCache, clearContactCache, getContactStats } from '../src/systems/phys2d/ContactCacheUtils';

// Import math utilities
import { f, ONE, ZERO, add } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

describe('Narrowphase Circle Collision Detection', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  test('should detect overlapping circles and create contacts', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create two overlapping circles
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE); // radius = 1.0
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.5), ZERO); // 50% overlap
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    // Run one frame
    scheduler.tick(world, 16);

    // Check contacts were generated
    const contacts = world.getResource(Contacts2D);
    expect(contacts).toBeDefined();
    expect(contacts!.list).toHaveLength(1);

    const contact = contacts!.list[0];
    expect(contact.a).toBeDefined();
    expect(contact.b).toBeDefined();
    expect(contact.pen).toBeGreaterThan(ZERO); // Should have penetration
    expect(contact.nx).toBeGreaterThan(ZERO); // Normal pointing from A to B
    expect(contact.ny).toBe(ZERO); // Y component should be zero for horizontal overlap
  });

  test('should not create contacts for non-overlapping circles', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create two distant circles
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(3), ZERO); // Far apart
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    expect(contacts!.list).toHaveLength(0);
  });

  test('should handle concentric circles deterministically', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create two concentric circles
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, ZERO); // Same position
    const circle2 = createCircleShape(f(0.5));
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    expect(contacts!.list).toHaveLength(1);

    const contact = contacts!.list[0];
    // Should use deterministic fallback normal (1, 0)
    expect(contact.nx).toBe(ONE);
    expect(contact.ny).toBe(ZERO);
  });

  test('should produce deterministic results across multiple runs', () => {
    const runSimulation = (seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);

      // Create multiple overlapping circles with GUIDs
      const entities = [];
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(f(i * 1.5), f(i * 0.5));
        const circle = createCircleShape(ONE);
        const aabb = new AABB2D();
        const guid = createGuid(world);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);
        world.addComponent(entity, Guid, guid);
        entities.push(entity);
      }

      scheduler.tick(world, 16);

      const contacts = world.getResource(Contacts2D);
      const contactData = contacts!.list.map(c => ({
        a: c.a,
        b: c.b,
        pen: c.pen,
        nx: c.nx,
        ny: c.ny
      }));

      return {
        contacts: contactData,
        hash: frameHash(world, false)
      };
    };

    const result1 = runSimulation(54321);
    const result2 = runSimulation(54321);
    const result3 = runSimulation(54321);

    // All runs should produce identical results
    expect(result2.contacts).toEqual(result1.contacts);
    expect(result3.contacts).toEqual(result1.contacts);
    expect(result2.hash).toBe(result1.hash);
    expect(result3.hash).toBe(result1.hash);
  });

  test('should implement warm-start impulse caching', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create overlapping circles
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    const guid1 = createGuid(world);
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);
    world.addComponent(entity1, Guid, guid1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.5), ZERO);
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    const guid2 = createGuid(world);
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);
    world.addComponent(entity2, Guid, guid2);

    // First frame - no warm-start
    scheduler.tick(world, 16);
    const contacts1 = world.getResource(Contacts2D)!;
    expect(contacts1.list).toHaveLength(1);
    expect(contacts1.list[0].jn).toBe(ZERO); // No warm-start impulse
    expect(contacts1.list[0].jt).toBe(ZERO);

    // Simulate solver setting impulse values
    contacts1.list[0].jn = f(10);
    contacts1.list[0].jt = f(5);
    updateContactCache(world);

    // Second frame - should use warm-start
    scheduler.tick(world, 16);
    const contacts2 = world.getResource(Contacts2D)!;
    expect(contacts2.list).toHaveLength(1);
    expect(contacts2.list[0].jn).toBe(f(10)); // Should have warm-start impulse
    expect(contacts2.list[0].jt).toBe(f(5));
  });

  test('should handle cache clearing and statistics', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create overlapping circles
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.5), ZERO);
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    // Check statistics
    const stats = getContactStats(world);
    expect(stats).toBeDefined();
    expect(stats!.contacts).toBe(1);
    expect(stats!.cached).toBe(0); // No cache yet

    // Update cache and check again
    updateContactCache(world);
    const statsAfterCache = getContactStats(world);
    expect(statsAfterCache!.cached).toBe(1);

    // Clear cache
    clearContactCache(world);
    const statsAfterClear = getContactStats(world);
    expect(statsAfterClear!.cached).toBe(0);
  });

  test('should maintain stable contact ordering', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    const prng = new PRNG(98765);
    world.setResource(PRNG, prng);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create multiple overlapping pairs
    const entities = [];
    for (let i = 0; i < 4; i++) {
      const entity = world.createEntity();
      const body = createDynamicBody(f(i * 0.8), ZERO); // Overlapping chain
      const circle = createCircleShape(f(0.6));
      const aabb = new AABB2D();
      const guid = createGuid(world);

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, ShapeCircle, circle);
      world.addComponent(entity, AABB2D, aabb);
      world.addComponent(entity, Guid, guid);
      entities.push(entity);
    }

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBeGreaterThan(0);

    // Contacts should be sorted by entity IDs
    for (let i = 1; i < contacts.list.length; i++) {
      const prev = contacts.list[i - 1];
      const curr = contacts.list[i];

      if (prev.a === curr.a) {
        expect(prev.b).toBeLessThanOrEqual(curr.b);
      } else {
        expect(prev.a).toBeLessThan(curr.a);
      }
    }
  });

  test('should skip non-circle entities', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create one circle and one without circle shape
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(0.5), ZERO); // Would overlap if it had circle
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    // No ShapeCircle component
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    // Should create broadphase pair but no narrowphase contacts
    const broadphase = world.getResource(BroadphasePairs);
    const contacts = world.getResource(Contacts2D);

    expect(broadphase!.pairs.length).toBeGreaterThan(0); // Broadphase detects overlap
    expect(contacts!.list).toHaveLength(0); // Narrowphase skips non-circle
  });

  test('should handle random N circles with deterministic contacts', () => {
    // Test different scales of random circle arrangements
    // 测试不同规模的随机圆形排列
    const runRandomCircleTest = (entityCount: number, areaSize: number, seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);

      // Use deterministic RNG for positions
      // 使用确定性随机数生成器生成位置
      let rng = seed;
      const nextRandom = () => {
        rng = (rng * 1664525 + 1013904223) % 4294967296;
        return rng / 4294967296;
      };

      // Create random circles
      // 创建随机圆形
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();

        // Random position within area
        // 区域内的随机位置
        const x = f((nextRandom() - 0.5) * areaSize);
        const y = f((nextRandom() - 0.5) * areaSize);

        const body = createDynamicBody(x, y, ONE, ONE);

        // Small random velocity for movement
        // 小的随机速度用于移动
        body.vx = f((nextRandom() - 0.5) * 0.5);
        body.vy = f((nextRandom() - 0.5) * 0.5);

        // Variable radius for diverse overlaps
        // 可变半径产生不同程度的重叠
        const radius = f(0.3 + nextRandom() * 0.4); // 0.3-0.7
        const circle = createCircleShape(radius);
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        // Add GUID for stable sorting
        // 添加GUID用于稳定排序
        const guid = new Guid(seed >>> 0, (i << 16 | (seed & 0xFFFF)));
        world.addComponent(entity, Guid, guid);
      }

      // Run a few frames to let objects move and create contacts
      // 运行几帧让物体移动并创建接触
      for (let frame = 0; frame < 3; frame++) {
        scheduler.tick(world, 16);
      }

      const broadphase = world.getResource(BroadphasePairs)!;
      const contacts = world.getResource(Contacts2D)!;

      return {
        broadphasePairs: broadphase.pairs.length,
        broadphaseGenerated: broadphase.generated,
        broadphaseCulled: broadphase.culled,
        contactCount: contacts.list.length,
        contactOrder: contacts.list.map(c => `${c.a}-${c.b}`),
        worldHash: frameHash(world, true),
        worldHashNoRng: frameHash(world, false)
      };
    };

    // Test with different entity counts
    // 测试不同的实体数量

    // Small test: 50 entities
    // 小规模测试：50个实体
    const smallTest = runRandomCircleTest(50, 20, 11111);

    // Medium test: 200 entities
    // 中等规模测试：200个实体
    const mediumTest = runRandomCircleTest(200, 30, 11111);

    // Large test: 500 entities
    // 大规模测试：500个实体
    const largeTest = runRandomCircleTest(500, 40, 11111);

    // Contact count should generally increase with entity count
    // 接触数量通常应该随实体数量增加
    expect(smallTest.contactCount).toBeLessThan(mediumTest.contactCount);
    expect(mediumTest.contactCount).toBeLessThan(largeTest.contactCount);

    // Broadphase pairs should increase with entity count
    // 宽相配对数量应该随实体数量增加
    expect(smallTest.broadphasePairs).toBeLessThan(mediumTest.broadphasePairs);
    expect(mediumTest.broadphasePairs).toBeLessThan(largeTest.broadphasePairs);

    // Contact count should be less than or equal to broadphase pairs
    // 接触数量应该小于等于宽相配对数量
    expect(smallTest.contactCount).toBeLessThanOrEqual(smallTest.broadphasePairs);
    expect(mediumTest.contactCount).toBeLessThanOrEqual(mediumTest.broadphasePairs);
    expect(largeTest.contactCount).toBeLessThanOrEqual(largeTest.broadphasePairs);
  });

  test('should maintain contact list determinism across multiple runs', () => {
    // Test deterministic behavior of contact generation
    // 测试接触生成的确定性行为
    const runContactDeterminismTest = (seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);

      // Create deterministic overlapping circles
      // 创建确定性重叠圆形
      const entityCount = 100;
      let rng = seed;
      const nextRandom = () => {
        rng = (rng * 1664525 + 1013904223) % 4294967296;
        return rng / 4294967296;
      };

      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();

        // Clustered positioning for more overlaps
        // 聚集式定位产生更多重叠
        const clusterX = Math.floor(i / 10) * 5;
        const clusterY = Math.floor(i / 20) * 5;
        const x = f(clusterX + (nextRandom() - 0.5) * 3);
        const y = f(clusterY + (nextRandom() - 0.5) * 3);

        const body = createDynamicBody(x, y, ONE, ONE);

        // Small movements for frame-to-frame variation
        // 小幅移动产生帧间变化
        body.vx = f((nextRandom() - 0.5) * 0.2);
        body.vy = f((nextRandom() - 0.5) * 0.2);

        const radius = f(0.8); // Fixed radius for predictable overlaps
        const circle = createCircleShape(radius);
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        // Stable GUID for consistent sorting
        // 稳定的GUID用于一致性排序
        const guid = new Guid(seed >>> 0, (i << 16 | (seed & 0xFFFF)));
        world.addComponent(entity, Guid, guid);
      }

      // Run multiple frames to establish contacts
      // 运行多帧建立接触
      for (let frame = 0; frame < 5; frame++) {
        scheduler.tick(world, 16);
      }

      const broadphase = world.getResource(BroadphasePairs)!;
      const contacts = world.getResource(Contacts2D)!;

      return {
        contactCount: contacts.list.length,
        contactOrder: contacts.list.map(c => `${c.a}-${c.b}`), // Preserve original order
        sortedContacts: contacts.list.map(c => `${c.a}-${c.b}`).sort(),
        broadphasePairs: broadphase.pairs.length,
        worldHashWithRng: frameHash(world, true),
        worldHashNoRng: frameHash(world, false),
        contactDetails: contacts.list.map(c => ({
          a: c.a,
          b: c.b,
          pen: c.pen,
          nx: c.nx,
          ny: c.ny,
          jn: c.jn,
          jt: c.jt
        }))
      };
    };

    // Run same test multiple times
    // 多次运行相同测试
    const result1 = runContactDeterminismTest(22222);
    const result2 = runContactDeterminismTest(22222);
    const result3 = runContactDeterminismTest(22222);

    // All runs should produce identical results
    // 所有运行应产生相同结果

    // Contact count should be identical
    // 接触数量应该相同
    expect(result2.contactCount).toBe(result1.contactCount);
    expect(result3.contactCount).toBe(result1.contactCount);

    // Contact order should be identical (deterministic)
    // 接触顺序应该相同（确定性）
    expect(result2.contactOrder).toEqual(result1.contactOrder);
    expect(result3.contactOrder).toEqual(result1.contactOrder);

    // Sorted contacts should also be identical
    // 排序后的接触也应该相同
    expect(result2.sortedContacts).toEqual(result1.sortedContacts);
    expect(result3.sortedContacts).toEqual(result1.sortedContacts);

    // Broadphase pairs should be identical
    // 宽相配对应该相同
    expect(result2.broadphasePairs).toBe(result1.broadphasePairs);
    expect(result3.broadphasePairs).toBe(result1.broadphasePairs);

    // Frame hashes should be identical
    // 帧哈希应该相同
    expect(result2.worldHashWithRng).toBe(result1.worldHashWithRng);
    expect(result3.worldHashWithRng).toBe(result1.worldHashWithRng);
    expect(result2.worldHashNoRng).toBe(result1.worldHashNoRng);
    expect(result3.worldHashNoRng).toBe(result1.worldHashNoRng);

    // Contact details should be identical
    // 接触详情应该相同
    expect(result2.contactDetails).toEqual(result1.contactDetails);
    expect(result3.contactDetails).toEqual(result1.contactDetails);

    // Different seeds should produce different results
    // 不同种子应产生不同结果
    const differentSeedResult = runContactDeterminismTest(99999);
    expect(differentSeedResult.worldHashWithRng).not.toBe(result1.worldHashWithRng);
    expect(differentSeedResult.contactOrder).not.toEqual(result1.contactOrder);
  });

  test('should maintain reasonable broadphase-to-contacts ratio', () => {
    // Test relationship between broadphase pairs and generated contacts
    // 测试宽相配对与生成接触的关系
    const testBroadphaseContactRatio = (density: 'low' | 'medium' | 'high') => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(33333);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);

      // Configure test based on density
      // 根据密度配置测试
      let entityCount: number;
      let areaSize: number;
      let radius: number;

      switch (density) {
        case 'low':
          entityCount = 100;
          areaSize = 50;
          radius = 0.5;
          break;
        case 'medium':
          entityCount = 200;
          areaSize = 40;
          radius = 0.6;
          break;
        case 'high':
          entityCount = 300;
          areaSize = 30;
          radius = 0.7;
          break;
      }

      let rng = 33333;
      const nextRandom = () => {
        rng = (rng * 1664525 + 1013904223) % 4294967296;
        return rng / 4294967296;
      };

      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();

        const x = f((nextRandom() - 0.5) * areaSize);
        const y = f((nextRandom() - 0.5) * areaSize);

        const body = createDynamicBody(x, y, ONE, ONE);
        const circle = createCircleShape(f(radius));
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        const guid = new Guid(33333 >>> 0, (i << 16 | (33333 & 0xFFFF)));
        world.addComponent(entity, Guid, guid);
      }

      scheduler.tick(world, 16);

      const broadphase = world.getResource(BroadphasePairs)!;
      const contacts = world.getResource(Contacts2D)!;

      return {
        density,
        entityCount,
        broadphasePairs: broadphase.pairs.length,
        broadphaseGenerated: broadphase.generated,
        broadphaseCulled: broadphase.culled,
        contactCount: contacts.list.length,
        contactRatio: contacts.list.length / Math.max(broadphase.pairs.length, 1),
        cullRatio: broadphase.culled / Math.max(broadphase.generated, 1)
      };
    };

    const lowDensity = testBroadphaseContactRatio('low');
    const mediumDensity = testBroadphaseContactRatio('medium');
    const highDensity = testBroadphaseContactRatio('high');

    // Broadphase pairs should increase with density
    // 宽相配对应随密度增加
    expect(lowDensity.broadphasePairs).toBeLessThan(mediumDensity.broadphasePairs);
    expect(mediumDensity.broadphasePairs).toBeLessThan(highDensity.broadphasePairs);

    // Contact count should increase with density
    // 接触数量应随密度增加
    expect(lowDensity.contactCount).toBeLessThan(mediumDensity.contactCount);
    expect(mediumDensity.contactCount).toBeLessThan(highDensity.contactCount);

    // Contacts should never exceed broadphase pairs
    // 接触数量不应超过宽相配对数量
    expect(lowDensity.contactCount).toBeLessThanOrEqual(lowDensity.broadphasePairs);
    expect(mediumDensity.contactCount).toBeLessThanOrEqual(mediumDensity.broadphasePairs);
    expect(highDensity.contactCount).toBeLessThanOrEqual(highDensity.broadphasePairs);

    // Contact ratio should be reasonable (not 0, not 1)
    // 接触比例应该合理（非0，非1）
    expect(lowDensity.contactRatio).toBeGreaterThan(0);
    expect(mediumDensity.contactRatio).toBeGreaterThan(0);
    expect(highDensity.contactRatio).toBeGreaterThan(0);

    expect(lowDensity.contactRatio).toBeLessThanOrEqual(1);
    expect(mediumDensity.contactRatio).toBeLessThanOrEqual(1);
    expect(highDensity.contactRatio).toBeLessThanOrEqual(1);

    // At higher density, contact ratio should increase
    // 高密度时接触比例应该增加
    expect(highDensity.contactRatio).toBeGreaterThanOrEqual(mediumDensity.contactRatio);

    // Broadphase statistics should be consistent
    // 宽相统计应该一致
    expect(lowDensity.broadphasePairs + lowDensity.broadphaseCulled).toBe(lowDensity.broadphaseGenerated);
    expect(mediumDensity.broadphasePairs + mediumDensity.broadphaseCulled).toBe(mediumDensity.broadphaseGenerated);
    expect(highDensity.broadphasePairs + highDensity.broadphaseCulled).toBe(highDensity.broadphaseGenerated);
  });
});