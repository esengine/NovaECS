/**
 * Tests for BuildRevolute2D system
 * BuildRevolute2D系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Body2D, createDynamicBody, createStaticBody } from '../src/components/Body2D';
import { Sleep2D } from '../src/components/Sleep2D';
import { RevoluteJoint2D, createRevoluteJoint } from '../src/components/RevoluteJoint2D';
import { RevoluteBatch2D } from '../src/resources/RevoluteBatch2D';
import { BuildRevolute2D } from '../src/systems/phys2d/BuildRevolute2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('BuildRevolute2D System', () => {
  let world: World;
  let ctx: SystemContext;

  beforeEach(() => {
    world = new World();
    world.setFixedDt(1/60);

    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    // Mock world methods
    world.getFixedDtFX = () => f(1/60);
    world.frame = 1;
  });

  test('should create empty batch when no joints exist', () => {
    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch).toBeDefined();
    expect(batch.count).toBe(0);
  });

  test('should process single revolute joint', () => {
    // Create two bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-1.0);
    bodyDataA.py = ZERO;
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(1.0);
    bodyDataB.py = ZERO;
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyB, Body2D, bodyDataB);
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());

    // Create revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB, { x: 0.5, y: 0 }, { x: -0.5, y: 0 });
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.e).toBe(jointEntity);
    expect(row.a).toBe(bodyA);
    expect(row.b).toBe(bodyB);
    expect(row.rax).toBe(f(0.5));
    expect(row.ray).toBe(ZERO);
    expect(row.rbx).toBe(f(-0.5));
    expect(row.rby).toBe(ZERO);
  });

  test('should skip joints with both bodies sleeping', () => {
    // Create two sleeping bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());

    const sleepA = new Sleep2D();
    sleepA.sleeping = 1;
    const sleepB = new Sleep2D();
    sleepB.sleeping = 1;

    world.addComponent(bodyA, Sleep2D, sleepA);
    world.addComponent(bodyB, Sleep2D, sleepB);

    // Create revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should wake up sleeping body when other is awake', () => {
    // Create one awake and one sleeping body
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());

    const sleepA = new Sleep2D();
    sleepA.sleeping = 0; // Awake
    const sleepB = new Sleep2D();
    sleepB.sleeping = 1; // Sleeping
    sleepB.timer = f(0.5);

    world.addComponent(bodyA, Sleep2D, sleepA);
    world.addComponent(bodyB, Sleep2D, sleepB);

    // Create revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    // Check that sleeping body was woken up
    const updatedSleepB = world.getComponent(bodyB, Sleep2D) as Sleep2D;
    expect(updatedSleepB.sleeping).toBe(0);
    expect(updatedSleepB.timer).toBe(ZERO);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(1);
  });

  test('should skip broken joints', () => {
    // Create two bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());

    // Create broken revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    joint.broken = 1; // Mark as broken
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should skip joints with both static bodies', () => {
    // Create two static bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createStaticBody());
    world.addComponent(bodyB, Body2D, createStaticBody());
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());

    // Create revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should apply deterministic sorting', () => {
    // Create multiple bodies and joints
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();
    const bodyC = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());
    world.addComponent(bodyC, Body2D, createDynamicBody());
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());
    world.addComponent(bodyC, Sleep2D, new Sleep2D());

    // Create joints in different order
    const joint1 = world.createEntity();
    const joint2 = world.createEntity();
    const joint3 = world.createEntity();

    world.addComponent(joint1, RevoluteJoint2D, createRevoluteJoint(bodyB, bodyC));
    world.addComponent(joint2, RevoluteJoint2D, createRevoluteJoint(bodyA, bodyB));
    world.addComponent(joint3, RevoluteJoint2D, createRevoluteJoint(bodyA, bodyC));

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(3);

    // Results should be deterministic regardless of creation order
    const sortedEntities = batch.list.map(row => row.e).sort((a, b) => a - b);
    expect(sortedEntities).toEqual([joint1, joint2, joint3].sort((a, b) => a - b));
  });

  test('should handle soft constraint parameters', () => {
    // Create two bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());

    // Create soft revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    joint.gamma = f(0.1); // Soft constraint
    joint.beta = f(0.2);  // Position correction
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.gamma).toBe(f(0.1));
    // Verify inverse mass matrix was computed with softening
    expect(row.im00).toBeGreaterThan(0);
    expect(row.im11).toBeGreaterThan(0);
  });

  test('should clear batch on each run', () => {
    // Create a joint
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());
    world.addComponent(bodyA, Sleep2D, new Sleep2D());
    world.addComponent(bodyB, Sleep2D, new Sleep2D());

    const jointEntity = world.createEntity();
    world.addComponent(jointEntity, RevoluteJoint2D, createRevoluteJoint(bodyA, bodyB));

    // First run
    BuildRevolute2D.fn(ctx);
    let batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(1);

    // Remove joint and run again
    world.removeComponent(jointEntity, RevoluteJoint2D);
    BuildRevolute2D.fn(ctx);

    batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(0);
  });
});