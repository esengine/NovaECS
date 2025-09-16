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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
      scheduler.add(SyncAABBSystem.build());
      scheduler.add(BroadphaseSAP.build());
      scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
    scheduler.add(SyncAABBSystem.build());
    scheduler.add(BroadphaseSAP.build());
    scheduler.add(NarrowphaseCircle.build());

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
});