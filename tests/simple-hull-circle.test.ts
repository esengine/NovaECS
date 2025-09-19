/**
 * Simple Hull-Circle System Test
 * 简单Hull-Circle系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

// Import components
import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { ConvexHull2D } from '../src/components/ConvexHull2D';
import { HullWorld2D } from '../src/components/HullWorld2D';
import { Circle2D, createCircle2D } from '../src/components/Circle2D';
import { CircleWorld2D } from '../src/components/CircleWorld2D';
import { AABB2D } from '../src/components/AABB2D';
import { Guid, createGuid } from '../src/components/Guid';

// Import resources
import { BroadphasePairs } from '../src/resources/BroadphasePairs';
import { Contacts2D } from '../src/resources/Contacts2D';

// Import systems
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { SyncHullWorld2D } from '../src/systems/geom/SyncHullWorld2D';
import { SyncCircleWorld2D } from '../src/systems/geom/SyncCircleWorld2D';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseHullCircle2D } from '../src/systems/phys2d/NarrowphaseHullCircle2D';

// Import math
import { f, ONE, ZERO, sub, div, add } from '../src/math/fixed';

describe('Simple Hull-Circle System Test', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ConvexHull2D);
    registerComponent(HullWorld2D);
    registerComponent(Circle2D);
    registerComponent(CircleWorld2D);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  function setupMinimalPipeline(world: World, scheduler: Scheduler) {
    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncCircleWorld2D);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullCircle2D);
  }

  function createBox(world: World, x: any, y: any, width: any, height: any): number {
    const entity = world.createEntity();

    const body = createStaticBody(x, y);
    world.addComponent(entity, Body2D, body);

    const hw = div(width, f(2));
    const hh = div(height, f(2));

    const hull = new ConvexHull2D();
    hull.setVertices([
      sub(ZERO, hw), sub(ZERO, hh), // bottom-left
      hw, sub(ZERO, hh), // bottom-right
      hw, hh, // top-right
      sub(ZERO, hw), hh  // top-left
    ]);
    hull.radius = f(0.01);
    world.addComponent(entity, ConvexHull2D, hull);

    world.addComponent(entity, HullWorld2D, new HullWorld2D());
    world.addComponent(entity, AABB2D, new AABB2D());
    world.addComponent(entity, Guid, createGuid(world));

    return entity;
  }

  function createCircle(world: World, x: any, y: any, radius: any): number {
    const entity = world.createEntity();

    const body = createDynamicBody(x, y);
    world.addComponent(entity, Body2D, body);

    const circle = createCircle2D(radius, ZERO, ZERO, f(0.01));
    world.addComponent(entity, Circle2D, circle);

    world.addComponent(entity, CircleWorld2D, new CircleWorld2D());
    world.addComponent(entity, AABB2D, new AABB2D());
    world.addComponent(entity, Guid, createGuid(world));

    return entity;
  }

  test('should detect overlapping hull-circle collision', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    setupMinimalPipeline(world, scheduler);

    // Create overlapping box and circle
    const box = createBox(world, ZERO, ZERO, f(2), f(2)); // 2x2 box at origin
    const circle = createCircle(world, f(0.5), ZERO, f(0.8)); // Large circle overlapping box

    // Run systems
    scheduler.tick(world, 16);

    // Check for contact generation
    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);

    const contact = contacts.list[0];
    expect(contact.a).toBeOneOf([box, circle]);
    expect(contact.b).toBeOneOf([box, circle]);
    expect(contact.pen).toBeGreaterThan(ZERO);
    expect(contact.pen).toBeLessThan(f(5)); // Reasonable penetration for heavy overlap
  });

  test('should not detect separated hull-circle pairs', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    setupMinimalPipeline(world, scheduler);

    // Create separated box and circle
    const box = createBox(world, ZERO, ZERO, f(1), f(1));
    const circle = createCircle(world, f(3), ZERO, f(0.5)); // Far away circle

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(0);
  });

  test('should handle edge contact correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    setupMinimalPipeline(world, scheduler);

    // Create circle overlapping box edge
    const box = createBox(world, ZERO, ZERO, f(2), f(2));
    const circle = createCircle(world, f(1.2), ZERO, f(0.5)); // Clearly overlapping right edge

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);

    const contact = contacts.list[0];
    expect(contact.pen).toBeGreaterThan(ZERO);
    expect(contact.pen).toBeLessThan(f(1)); // Reasonable penetration for edge contact

    // Normal should point roughly horizontally (right edge contact)
    expect(Math.abs(contact.nx)).toBeGreaterThan(f(0.5));
  });

  test('should handle corner contact correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    setupMinimalPipeline(world, scheduler);

    // Create circle overlapping box corner
    const box = createBox(world, ZERO, ZERO, f(1), f(1));
    const circle = createCircle(world, f(0.6), f(0.6), f(0.4)); // Clearly overlapping top-right corner

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);

    const contact = contacts.list[0];
    expect(contact.pen).toBeGreaterThan(ZERO);

    // For corner contact, both normal components should be significant
    expect(Math.abs(contact.nx)).toBeGreaterThan(f(0.3));
    expect(Math.abs(contact.ny)).toBeGreaterThan(f(0.3));
  });

  test('should demonstrate skin radius effect on stability', () => {
    const scenarios = [
      { hullSkin: f(0.005), circleSkin: f(0.005), name: 'minimal' },
      { hullSkin: f(0.02), circleSkin: f(0.02), name: 'increased' }
    ];

    const results = scenarios.map(scenario => {
      const world = new World();
      const scheduler = new Scheduler(world);
      setupMinimalPipeline(world, scheduler);

      // Create box with specified skin
      const box = createBox(world, ZERO, ZERO, f(2), f(2));
      const boxHull = world.getComponent(box, ConvexHull2D)!;
      boxHull.radius = scenario.hullSkin;

      // Create circle with specified skin
      const circle = createCircle(world, f(0.7), ZERO, f(0.5));
      const circleComp = world.getComponent(circle, Circle2D)!;
      circleComp.skin = scenario.circleSkin;

      // Run multiple frames to test stability
      let contactCount = 0;
      let totalPenetration = 0;
      const frames = 10;

      for (let i = 0; i < frames; i++) {
        scheduler.tick(world, 16);
        const contacts = world.getResource(Contacts2D)!;
        if (contacts.list.length > 0) {
          contactCount++;
          totalPenetration += contacts.list[0].pen;
        }
      }

      return {
        name: scenario.name,
        contactCount,
        avgPenetration: contactCount > 0 ? totalPenetration / contactCount : 0,
        consistency: contactCount / frames
      };
    });

    console.log('Skin radius stability results:', results);

    const minimal = results.find(r => r.name === 'minimal')!;
    const increased = results.find(r => r.name === 'increased')!;

    // Both should detect contacts
    expect(minimal.contactCount).toBeGreaterThan(0);
    expect(increased.contactCount).toBeGreaterThan(0);

    // Increased skin should have more consistent contact detection
    expect(increased.consistency).toBeGreaterThanOrEqual(minimal.consistency);
  });

  test('should handle overlapping hull-circle pair consistently', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    setupMinimalPipeline(world, scheduler);

    // Create a single clearly overlapping hull-circle pair
    const box = createBox(world, ZERO, ZERO, f(2), f(2));
    const circle = createCircle(world, f(0.8), ZERO, f(0.6)); // Large overlap

    scheduler.tick(world, 16);

    const contacts = world.getResource(Contacts2D)!;
    expect(contacts.list.length).toBe(1);

    const contact = contacts.list[0];
    expect(contact.pen).toBeGreaterThan(ZERO);
    expect(contact.a).not.toBe(contact.b);

    // Should be one of the expected entities
    expect([box, circle]).toContain(contact.a);
    expect([box, circle]).toContain(contact.b);
  });
});