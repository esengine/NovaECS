/**
 * Debug test for hull collision pipeline
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { ConvexHull2D, createBoxHull, createTriangleHull } from '../src/components/ConvexHull2D';
import { HullWorld2D } from '../src/components/HullWorld2D';
import { AABB2D } from '../src/components/AABB2D';
import { ShapeCircle } from '../src/components/ShapeCircle';
import { BroadphasePairs } from '../src/resources/BroadphasePairs';
import { Contacts2D } from '../src/resources/Contacts2D';

import { SyncHullWorld2D } from '../src/systems/geom/SyncHullWorld2D';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { NarrowphaseHullHull2D } from '../src/systems/phys2d/NarrowphaseHullHull2D';

import { f, ONE, ZERO } from '../src/math/fixed';

describe('Debug Hull Pipeline', () => {
  beforeEach(() => {
    registerComponent(Body2D);
    registerComponent(ConvexHull2D);
    registerComponent(HullWorld2D);
    registerComponent(AABB2D);
    registerComponent(ShapeCircle);
  });

  test('debug box stacking', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create stacked boxes exactly like the failing test
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, f(-0.5)); // Ground box
    const hull1 = createBoxHull(f(4), f(2));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, f(1)); // Box on top
    const hull2 = createBoxHull(f(2), f(2));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    console.log('Entity 1 (Ground):', entity1);
    console.log('Body1 position:', body1.px, body1.py);
    console.log('Hull1 vertices:', hull1.verts, 'count:', hull1.count);

    console.log('Entity 2 (Top):', entity2);
    console.log('Body2 position:', body2.px, body2.py);
    console.log('Hull2 vertices:', hull2.verts, 'count:', hull2.count);

    scheduler.tick(world, 16);

    const hullWorld1After = world.getComponent(entity1, HullWorld2D)!;
    const hullWorld2After = world.getComponent(entity2, HullWorld2D)!;
    console.log('HullWorld1 count:', hullWorld1After.count, 'wverts:', hullWorld1After.wverts.slice(0, 8));
    console.log('HullWorld2 count:', hullWorld2After.count, 'wverts:', hullWorld2After.wverts.slice(0, 8));

    const aabb1After = world.getComponent(entity1, AABB2D)!;
    const aabb2After = world.getComponent(entity2, AABB2D)!;
    console.log('AABB1:', { minx: aabb1After.minx, miny: aabb1After.miny, maxx: aabb1After.maxx, maxy: aabb1After.maxy });
    console.log('AABB2:', { minx: aabb2After.minx, miny: aabb2After.miny, maxx: aabb2After.maxx, maxy: aabb2After.maxy });

    const broadphase = world.getResource(BroadphasePairs);
    console.log('Broadphase pairs:', broadphase ? broadphase.pairs.length : 'undefined');
    if (broadphase && broadphase.pairs.length > 0) {
      console.log('Pairs:', broadphase.pairs);
    }

    const contacts = world.getResource(Contacts2D);
    console.log('Contacts:', contacts ? contacts.list.length : 'undefined');
    if (contacts && contacts.list.length > 0) {
      console.log('All contacts:', contacts.list);
    }

    // Calculate expected overlap
    // Ground box: center=(0, -0.5), size=4x2, so it spans from y=-1.5 to y=0.5
    // Top box: center=(0, 1), size=2x2, so it spans from y=0 to y=2
    // They should overlap from y=0 to y=0.5
    console.log('Expected geometry:');
    console.log('Ground box: y from', f(-0.5) - f(1), 'to', f(-0.5) + f(1)); // -1.5 to 0.5
    console.log('Top box: y from', f(1) - f(1), 'to', f(1) + f(1)); // 0 to 2
    console.log('Should have overlap from y=0 to y=0.5');

    expect(hull1.count).toBe(4);
    expect(hull2.count).toBe(4);
  });

  test('debug step by step pipeline', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncHullWorld2D);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);
    scheduler.add(NarrowphaseHullHull2D);

    // Create triangle and box for debugging
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const hull1 = createTriangleHull(f(-1), f(-1), f(1), f(-1), ZERO, f(1));
    const hullWorld1 = new HullWorld2D();
    const aabb1 = new AABB2D();

    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ConvexHull2D, hull1);
    world.addComponent(entity1, HullWorld2D, hullWorld1);
    world.addComponent(entity1, AABB2D, aabb1);

    console.log('Entity 1 (Triangle):', entity1);
    console.log('Hull 1 vertices:', hull1.verts, 'count:', hull1.count);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ZERO, f(0.5)); // Overlapping with triangle
    const hull2 = createBoxHull(f(1), f(1));
    const hullWorld2 = new HullWorld2D();
    const aabb2 = new AABB2D();

    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ConvexHull2D, hull2);
    world.addComponent(entity2, HullWorld2D, hullWorld2);
    world.addComponent(entity2, AABB2D, aabb2);

    console.log('Entity 2 (Box):', entity2);
    console.log('Hull 2 vertices:', hull2.verts, 'count:', hull2.count);

    // Run one frame
    console.log('Running scheduler...');
    scheduler.tick(world, 16);


    // Debug each step
    console.log('\n=== After one frame ===');

    const hullWorld1After = world.getComponent(entity1, HullWorld2D)!;
    const hullWorld2After = world.getComponent(entity2, HullWorld2D)!;
    console.log('HullWorld1 count:', hullWorld1After.count, 'wverts:', hullWorld1After.wverts.slice(0, 8));
    console.log('HullWorld2 count:', hullWorld2After.count, 'wverts:', hullWorld2After.wverts.slice(0, 8));

    const aabb1After = world.getComponent(entity1, AABB2D)!;
    const aabb2After = world.getComponent(entity2, AABB2D)!;
    console.log('AABB1:', { minx: aabb1After.minx, miny: aabb1After.miny, maxx: aabb1After.maxx, maxy: aabb1After.maxy });
    console.log('AABB2:', { minx: aabb2After.minx, miny: aabb2After.miny, maxx: aabb2After.maxx, maxy: aabb2After.maxy });

    const broadphase = world.getResource(BroadphasePairs);
    console.log('Broadphase pairs:', broadphase ? broadphase.pairs.length : 'undefined');
    if (broadphase && broadphase.pairs.length > 0) {
      console.log('First pair:', broadphase.pairs[0]);
    }

    const contacts = world.getResource(Contacts2D);
    console.log('Contacts:', contacts ? contacts.list.length : 'undefined');
    if (contacts && contacts.list.length > 0) {
      console.log('First contact:', contacts.list[0]);
    }

    // Debug narrowphase input
    if (broadphase && broadphase.pairs.length > 0) {
      const pair = broadphase.pairs[0];
      console.log('\n=== Narrowphase Debug ===');
      console.log('Pair entities:', pair.a, pair.b);

      const hasHull1 = world.hasComponent(pair.a, ConvexHull2D);
      const hasHull2 = world.hasComponent(pair.b, ConvexHull2D);
      const hasHullWorld1 = world.hasComponent(pair.a, HullWorld2D);
      const hasHullWorld2 = world.hasComponent(pair.b, HullWorld2D);

      console.log('Entity', pair.a, 'has ConvexHull2D:', hasHull1, 'HullWorld2D:', hasHullWorld1);
      console.log('Entity', pair.b, 'has ConvexHull2D:', hasHull2, 'HullWorld2D:', hasHullWorld2);

      if (hasHull1 && hasHullWorld1) {
        const h1 = world.getComponent(pair.a, ConvexHull2D);
        const hw1 = world.getComponent(pair.a, HullWorld2D);
        console.log('Hull1 count:', h1.count, 'radius:', h1.radius);
        console.log('HullWorld1 count:', hw1.count);
      }

      if (hasHull2 && hasHullWorld2) {
        const h2 = world.getComponent(pair.b, ConvexHull2D);
        const hw2 = world.getComponent(pair.b, HullWorld2D);
        console.log('Hull2 count:', h2.count, 'radius:', h2.radius);
        console.log('HullWorld2 count:', hw2.count);
      }
    }

    // Basic checks
    expect(hull1.count).toBe(3); // Triangle has 3 vertices
    expect(hull2.count).toBe(4); // Box has 4 vertices
    expect(hullWorld1After.count).toBe(3);
    expect(hullWorld2After.count).toBe(4);
  });
});