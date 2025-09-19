/**
 * Narrowphase Hull-Hull Collision Detection Tests
 * 凸包-凸包窄相碰撞检测测试
 *
 * Tests deterministic convex hull collision detection using SAT with contact manifold generation,
 * Sutherland-Hodgman clipping, and cross-platform determinism validation.
 * 测试使用SAT的确定性凸包碰撞检测，包括接触流形生成、Sutherland-Hodgman裁剪和跨平台确定性验证。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

// Import physics components and systems
import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { ConvexHull2D, createBoxHull, createTriangleHull } from '../src/components/ConvexHull2D';
import { HullWorld2D } from '../src/components/HullWorld2D';
import { AABB2D } from '../src/components/AABB2D';
import { ShapeCircle } from '../src/components/ShapeCircle';
import { Guid, createGuid } from '../src/components/Guid';
import { BroadphasePairs } from '../src/resources/BroadphasePairs';
import { Contacts2D } from '../src/resources/Contacts2D';
import { PRNG } from '../src/determinism/PRNG';

// Import systems
import { SyncHullWorld2D } from '../src/systems/geom/SyncHullWorld2D';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseHullHull2D } from '../src/systems/phys2d/NarrowphaseHullHull2D';
import { updateContactCache, clearContactCache, getContactStats } from '../src/systems/phys2d/ContactCacheUtils';

// Import math utilities
import { f, ONE, ZERO, add, sub, mul, div } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

describe('Narrowphase Hull-Hull Collision Detection', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ConvexHull2D);
    registerComponent(HullWorld2D);
    registerComponent(AABB2D);
    registerComponent(ShapeCircle);
    registerComponent(Guid);
  });

  test('should detect overlapping boxes and create contacts', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create two overlapping boxes
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createBoxHull(f(2), f(2)); // 2x2 box
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.5), ZERO); // 50% overlap
    const hull2 = createBoxHull(f(2), f(2));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    // Run one frame
    scheduler.tick(world, 16);

    // Check contacts were generated
    const contacts = world.getResource(Contacts2D);
    expect(contacts).toBeDefined();
    expect(contacts!.list.length).toBeGreaterThan(0);

    // Check contact properties
    for (const contact of contacts!.list) {
      expect(contact.a).toBeDefined();
      expect(contact.b).toBeDefined();
      expect(contact.pen).toBeGreaterThan(ZERO); // Should have penetration
      expect(contact.nx).toBeCloseTo(ONE, 0.1); // Normal pointing horizontally
      expect(Math.abs(contact.ny)).toBeLessThan(f(0.1)); // Minimal Y component
    }
  });

  test('should not create contacts for non-overlapping boxes', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create two distant boxes
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createBoxHull(f(2), f(2));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(5), ZERO); // Far apart
    const hull2 = createBoxHull(f(2), f(2));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    expect(contacts!.list).toHaveLength(0);
  });

  test('should handle box stacking deterministically', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create stacked boxes
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, f(-0.5)); // Ground box - changed to dynamic
    const hull1 = createBoxHull(f(4), f(2));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, f(1)); // Box on top - moved down for overlap
    const hull2 = createBoxHull(f(2), f(2));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);

    expect(contacts!.list).toHaveLength(1);

    const contact = contacts!.list[0];
    // Normal should point upward (from ground to top box)
    expect(Math.abs(contact.nx)).toBeLessThan(f(0.1));
    expect(contact.ny).toBeGreaterThan(f(0.9));
    expect(contact.pen).toBeGreaterThan(ZERO);
  });

  test('should handle rotated box collisions', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create two boxes with rotation
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    body1.angle = 0; // No rotation
    const hull1 = createBoxHull(f(2), f(1));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.2), ZERO);
    body2.angle = 16384; // 45 degrees in 16-bit format (π/4)
    const hull2 = createBoxHull(f(2), f(1));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    expect(contacts!.list.length).toBeGreaterThan(0);

    // Check that world space transformation occurred
    const worldCache1 = world.getComponent(entity1, HullWorld2D)!;
    const worldCache2 = world.getComponent(entity2, HullWorld2D)!;
    expect(worldCache1.count).toBe(4); // Box has 4 vertices
    expect(worldCache2.count).toBe(4);
  });

  test('should handle triangle vs box collisions', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create triangle and box
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createTriangleHull(f(-1), f(-1), f(1), f(-1), ZERO, f(1));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, f(0.5)); // Overlapping with triangle
    const hull2 = createBoxHull(f(1), f(1));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    expect(contacts!.list.length).toBeGreaterThan(0);

    for (const contact of contacts!.list) {
      expect(contact.pen).toBeGreaterThan(ZERO);
    }
  });

  test('should produce deterministic results across multiple runs', () => {
    const runSimulation = (seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncHullWorld2D);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseHullHull2D);

      // Create multiple overlapping convex hulls with GUIDs
      const entities = [];
      for (let i = 0; i < 4; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(f(i * 1.5), f(i * 0.3));
        body.angle = i * 8192; // Different rotations

        const hull = i % 2 === 0
          ? createBoxHull(f(2), f(1.5))
          : createTriangleHull(f(-1), f(-0.5), f(1), f(-0.5), ZERO, f(1));

        const hullWorld = new HullWorld2D();
        const aabb = new AABB2D();
        const guid = createGuid(world);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ConvexHull2D, hull);
        world.addComponent(entity, HullWorld2D, hullWorld);
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
        ny: c.ny,
        px: c.px,
        py: c.py
      }));

      return {
        contacts: contactData,
        hash: frameHash(world, false)
      };
    };

    const result1 = runSimulation(12345);
    const result2 = runSimulation(12345);
    const result3 = runSimulation(12345);

    // All runs should produce identical results
    expect(result2.contacts).toEqual(result1.contacts);
    expect(result3.contacts).toEqual(result1.contacts);
    expect(result2.hash).toBe(result1.hash);
    expect(result3.hash).toBe(result1.hash);
  });

  test('should maintain stable contact ordering', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    const prng = new PRNG(54321);
    world.setResource(PRNG, prng);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create overlapping chain of boxes
    const entities = [];
    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      const body = createDynamicBody(f(i * 1.2), ZERO); // Overlapping chain
      const hull = createBoxHull(f(1.5), f(1.5));
      const hullWorld = new HullWorld2D();
      const aabb = new AABB2D();
      const guid = createGuid(world);

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, ConvexHull2D, hull);
      world.addComponent(entity, HullWorld2D, hullWorld);
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

  test('should handle warm-start impulse caching', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create overlapping boxes
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createBoxHull(f(2), f(2));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    const guid1 = createGuid(world);
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);
    world.addComponent(entity1, Guid, guid1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.5), ZERO);
    const hull2 = createBoxHull(f(2), f(2));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    const guid2 = createGuid(world);
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);
    world.addComponent(entity2, Guid, guid2);

    // First frame - no warm-start
    scheduler.tick(world, 16);
    const contacts1 = world.getResource(Contacts2D)!;
    expect(contacts1.list.length).toBeGreaterThan(0);

    // All contacts should start with zero impulse
    for (const contact of contacts1.list) {
      expect(contact.jn).toBe(ZERO);
      expect(contact.jt).toBe(ZERO);
    }

    // Simulate solver setting impulse values
    for (const contact of contacts1.list) {
      contact.jn = f(15);
      contact.jt = f(8);
    }
    updateContactCache(world);

    // Second frame - should use warm-start
    scheduler.tick(world, 16);
    const contacts2 = world.getResource(Contacts2D)!;
    expect(contacts2.list.length).toBeGreaterThan(0);

    // Contacts should have warm-start impulses
    for (const contact of contacts2.list) {
      expect(contact.jn).toBe(f(15));
      expect(contact.jt).toBe(f(8));
    }
  });

  test('should skip non-hull entities', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create one hull and one without hull components
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createBoxHull(f(2), f(2));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(0.5), ZERO); // Would overlap if it had hull
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    // No ConvexHull2D or HullWorld2D components
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    // Should create broadphase pair but no narrowphase contacts
    const broadphase = world.getResource(BroadphasePairs);
    const contacts = world.getResource(Contacts2D);

    expect(broadphase!.pairs.length).toBeGreaterThan(0); // Broadphase detects overlap
    expect(contacts!.list).toHaveLength(0); // Narrowphase skips non-hull
  });

  test('should maintain deterministic contact generation with FPS consistency', () => {
    // Test that frame hash remains consistent across runs at different frame rates
    // 测试在不同帧率下运行时帧哈希保持一致
    const runAtFrameRate = (fps: number, seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / fps);
      scheduler.add(SyncHullWorld2D);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseHullHull2D);

      // Create deterministic scene
      const scenarios = [
        { pos: [0, 0], rot: 0, type: 'box' },
        { pos: [1.2, 0], rot: 8192, type: 'box' },
        { pos: [0.6, 1.0], rot: 16384, type: 'triangle' },
        { pos: [-0.8, 0.5], rot: 24576, type: 'box' }
      ];

      scenarios.forEach((scenario, i) => {
        const entity = world.createEntity();
        const body = createDynamicBody(f(scenario.pos[0]), f(scenario.pos[1]));
        body.angle = scenario.rot;

        const hull = scenario.type === 'box'
          ? createBoxHull(f(1.5), f(1))
          : createTriangleHull(f(-0.8), f(-0.5), f(0.8), f(-0.5), ZERO, f(0.8));

        const hullWorld = new HullWorld2D();
        const aabb = new AABB2D();
        const guid = new Guid(seed >>> 0, (i << 16 | (seed & 0xFFFF)));

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ConvexHull2D, hull);
        world.addComponent(entity, HullWorld2D, hullWorld);
        world.addComponent(entity, AABB2D, aabb);
        world.addComponent(entity, Guid, guid);
      });

      // Run single frame
      const frameTime = Math.round(1000 / fps);
      scheduler.tick(world, frameTime);

      const contacts = world.getResource(Contacts2D)!;
      return {
        contactCount: contacts.list.length,
        contacts: contacts.list.map(c => ({
          a: c.a, b: c.b, pen: c.pen, nx: c.nx, ny: c.ny
        })),
        frameHash: frameHash(world, false)
      };
    };

    // Test at different frame rates with same seed
    const result60fps = runAtFrameRate(60, 98765);
    const result120fps = runAtFrameRate(120, 98765);
    const result30fps = runAtFrameRate(30, 98765);

    // Contact generation should be frame-rate independent for single frame
    expect(result60fps.contactCount).toBe(result120fps.contactCount);
    expect(result60fps.contactCount).toBe(result30fps.contactCount);

    // Frame hashes should be identical (deterministic physics)
    expect(result60fps.frameHash).toBe(result120fps.frameHash);
    expect(result60fps.frameHash).toBe(result30fps.frameHash);

    // Contact details should be identical
    expect(result60fps.contacts).toEqual(result120fps.contacts);
    expect(result60fps.contacts).toEqual(result30fps.contacts);
  });

  test('should handle edge cases with skin radius and separated objects', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    // Correct system order: Hull transform → AABB sync → Broadphase → Narrowphase
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create boxes that are just touching (within skin radius)
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createBoxHull(f(2), f(2), f(0.02)); // Small skin radius
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(2.01), ZERO); // Just outside skin radius
    const hull2 = createBoxHull(f(2), f(2), f(0.02));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D);
    // Should not create contacts as objects are separated beyond skin radius
    expect(contacts!.list).toHaveLength(0);

    // Move closer within skin radius
    const body2Updated = world.getComponent(entity2, Body2D)!;
    body2Updated.px = f(2.02); // Within combined skin radius
    world.replaceComponent(entity2, Body2D, body2Updated);

    scheduler.tick(world, 16);
    const contactsAfter = world.getResource(Contacts2D);
    // Should now create contacts due to skin radius tolerance
    expect(contactsAfter!.list.length).toBeGreaterThan(0);
  });
});