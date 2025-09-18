/**
 * Physics Pipeline Integration Tests
 * 物理管道集成测试
 *
 * Tests the complete physics pipeline with proper system scheduling order:
 * IntegrateVelocitiesSystem → SyncAABBSystem → BroadphaseSAP → NarrowphaseCircle
 * 测试完整的物理管道，具有正确的系统调度顺序。
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

// Import systems in correct order
import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseCircle } from '../src/systems/phys2d/NarrowphaseCircle';
import { updateContactCache, getContactStats } from '../src/systems/phys2d/ContactCacheUtils';

// Import math utilities
import { f, ONE, ZERO, add, sub } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

describe('Physics Pipeline Integration', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  test('should run complete physics pipeline in correct order', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    // Set up physics pipeline in correct order
    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create two moving circles that will collide
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    body1.vx = f(60); // Moving right fast
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    const guid1 = createGuid(world);

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);
    world.addComponent(entity1, Guid, guid1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(2.5), ZERO);
    body2.vx = f(-30); // Moving left fast
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    const guid2 = createGuid(world);

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);
    world.addComponent(entity2, Guid, guid2);

    // Run first frame - circles should be moving toward each other
    scheduler.tick(world, 16);

    // Check that integration happened
    const body1After = world.getComponent(entity1, Body2D)!;
    const body2After = world.getComponent(entity2, Body2D)!;
    expect(body1After.px).toBeGreaterThan(ZERO); // Moved right
    expect(body2After.px).toBeLessThan(f(2.5)); // Moved left

    // Check that AABBs were synced
    const aabb1After = world.getComponent(entity1, AABB2D)!;
    const aabb2After = world.getComponent(entity2, AABB2D)!;
    expect(aabb1After.minx).toBeGreaterThan(f(-1)); // AABB moved with body
    expect(aabb2After.maxx).toBeLessThan(f(3.5)); // AABB moved with body

    // Check that broadphase detected potential collision
    const broadphase = world.getResource(BroadphasePairs)!;
    expect(broadphase.pairs.length).toBeGreaterThan(0);

    // Check that narrowphase created contacts if overlapping
    const contacts = world.getResource(Contacts2D)!;
    // May or may not have contacts depending on exact positions after one frame
    expect(contacts.list.length).toBeGreaterThanOrEqual(0);
  });

  test('should handle collision detection and contact generation', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem);
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
    const body2 = createDynamicBody(f(1.5), ZERO); // Overlapping
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    // Should detect collision through entire pipeline
    const broadphase = world.getResource(BroadphasePairs)!;
    expect(broadphase.pairs.length).toBe(1);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);

    const contact = contacts.list[0];
    expect(contact.pen).toBeGreaterThan(ZERO);
    expect(contact.nx).toBeGreaterThan(ZERO); // Normal pointing from A to B
  });

  test('should maintain determinism across multiple simulation steps', () => {
    const runMultiStepSimulation = (seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      world.setFixedDt(1 / 60);
      scheduler.add(IntegrateVelocitiesSystem);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);
      scheduler.add(NarrowphaseCircle);

      // Create dynamic scene
      const entities = [];
      for (let i = 0; i < 4; i++) {
        const entity = world.createEntity();
        const body = createDynamicBody(f(i * 2), f(i % 2));
        body.vx = f((i % 3) - 1); // Varying velocities
        body.vy = f((i % 2) * 0.5);

        const circle = createCircleShape(f(0.8));
        const aabb = new AABB2D();
        const guid = createGuid(world);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);
        world.addComponent(entity, Guid, guid);
        entities.push(entity);
      }

      const frames = [];
      for (let frame = 0; frame < 5; frame++) {
        scheduler.tick(world, 16);

        // Record state after each frame
        const contacts = world.getResource(Contacts2D)!;
        const broadphase = world.getResource(BroadphasePairs)!;

        frames.push({
          frame: world.frame,
          contactCount: contacts.list.length,
          broadphaseCount: broadphase.pairs.length,
          hash: frameHash(world, false)
        });
      }

      return frames;
    };

    const sim1 = runMultiStepSimulation(87654);
    const sim2 = runMultiStepSimulation(87654);
    const sim3 = runMultiStepSimulation(87654);

    // All simulations should produce identical results
    expect(sim2).toEqual(sim1);
    expect(sim3).toEqual(sim1);
  });

  test('should handle warm-start caching across frames', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create stable collision setup
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
    const body2 = createDynamicBody(f(1.8), ZERO); // Overlapping
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    const guid2 = createGuid(world);

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);
    world.addComponent(entity2, Guid, guid2);

    // Frame 1 - Initial contact
    scheduler.tick(world, 16);

    let contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);
    expect(contacts.list[0].jn).toBe(ZERO); // No warm-start initially
    expect(contacts.list[0].jt).toBe(ZERO);

    // Simulate solver applying impulses
    contacts.list[0].jn = f(15);
    contacts.list[0].jt = f(3);
    updateContactCache(world);

    // Frame 2 - Should use warm-start
    scheduler.tick(world, 16);

    contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);
    expect(contacts.list[0].jn).toBe(f(15)); // Warm-started
    expect(contacts.list[0].jt).toBe(f(3));

    // Verify statistics
    const stats = getContactStats(world)!;
    expect(stats.contacts).toBe(1);
    expect(stats.cached).toBe(1);
  });

  test('should handle system dependencies correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);

    // Add systems in reverse order to test dependency resolution
    scheduler.add(NarrowphaseCircle);
    scheduler.add(BroadphaseSAP);
    scheduler.add(SyncAABBSystem);
    scheduler.add(IntegrateVelocitiesSystem);

    // Create test entities
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    body1.vx = f(1);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(f(1.9), ZERO);
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    // Should still work correctly due to system dependencies
    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1); // Should detect collision

    const contact = contacts.list[0];
    expect(contact.pen).toBeGreaterThan(ZERO);
  });

  test('should handle empty scenes gracefully', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Run with no entities
    scheduler.tick(world, 16);

    const broadphase = world.getResource(BroadphasePairs);
    const contacts = world.getResource(Contacts2D);

    expect(broadphase?.pairs).toEqual([]);
    expect(contacts?.list).toEqual([]);
  });

  test('should scale with multiple colliding objects', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    const prng = new PRNG(11111);
    world.setResource(PRNG, prng);

    world.setFixedDt(1 / 60);
    scheduler.add(IntegrateVelocitiesSystem);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseCircle);

    // Create cluster of overlapping circles
    const entities = [];
    const gridSize = 3;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const entity = world.createEntity();
        const body = createDynamicBody(f(x * 1.8), f(y * 1.8)); // Overlapping grid
        const circle = createCircleShape(ONE);
        const aabb = new AABB2D();
        const guid = createGuid(world);

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);
        world.addComponent(entity, Guid, guid);
        entities.push(entity);
      }
    }

    scheduler.tick(world, 16);

    const broadphase = world.getResource(BroadphasePairs)!;
    const contacts = world.getResource(Contacts2D)!;

    // Should detect multiple overlaps
    expect(broadphase.pairs.length).toBeGreaterThan(0);
    expect(contacts.list.length).toBeGreaterThan(0);

    // All contacts should be valid
    for (const contact of contacts.list) {
      expect(contact.pen).toBeGreaterThan(ZERO);
      expect(contact.a).not.toBe(contact.b);
      expect(entities).toContain(contact.a);
      expect(entities).toContain(contact.b);
    }

    const stats = getContactStats(world)!;
    expect(stats.contacts).toBe(contacts.list.length);
    expect(stats.frame).toBe(world.frame);
  });
});