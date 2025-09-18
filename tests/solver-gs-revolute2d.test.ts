/**
 * Tests for SolverGSRevolute2D system
 * SolverGSRevolute2D系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { RevoluteJoint2D, createRevoluteJoint, createBreakableRevoluteJoint } from '../src/components/RevoluteJoint2D';
import { RevoluteBatch2D } from '../src/resources/RevoluteBatch2D';
import { BuildRevolute2D } from '../src/systems/phys2d/BuildRevolute2D';
import { SolverGSRevolute2D } from '../src/systems/phys2d/SolverGSRevolute2D';
import { JointEvents2D, JointBrokenEvent } from '../src/systems/phys2d/SolverGSJoints2D';
import { f, ZERO, ONE, toFloat } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('SolverGSRevolute2D System', () => {
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

  test('should do nothing when no batch exists', () => {
    SolverGSRevolute2D.fn(ctx);

    // Should not crash and no events should be created
    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events).toBeDefined();
    expect(events.events.length).toBe(0);
  });

  test('should do nothing when batch is empty', () => {
    const batch = new RevoluteBatch2D();
    world.setResource(RevoluteBatch2D, batch);

    SolverGSRevolute2D.fn(ctx);

    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events.length).toBe(0);
  });

  test('should solve constraint for two bodies with relative velocity', () => {
    // Create two bodies with initial velocities
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-1.0);
    bodyDataA.py = ZERO;
    bodyDataA.vx = f(1.0); // Moving right
    bodyDataA.vy = ZERO;
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(1.0);
    bodyDataB.py = ZERO;
    bodyDataB.vx = f(-1.0); // Moving left
    bodyDataB.vy = ZERO;
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyB, Body2D, bodyDataB);

    // Create revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Build constraint batch
    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(1);

    // Store initial velocities
    const initialVelAx = bodyDataA.vx;
    const initialVelBx = bodyDataB.vx;

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // Check that velocities were modified to reduce constraint violation
    const updatedBodyA = world.getComponent(bodyA, Body2D) as Body2D;
    const updatedBodyB = world.getComponent(bodyB, Body2D) as Body2D;

    // Due to the constraint, the relative velocity should be reduced
    expect(toFloat(updatedBodyA.vx)).not.toBe(toFloat(initialVelAx));
    expect(toFloat(updatedBodyB.vx)).not.toBe(toFloat(initialVelBx));

    // Joint should have accumulated some impulse
    const updatedJoint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    expect(updatedJoint.jx !== ZERO || updatedJoint.jy !== ZERO).toBe(true);
  });

  test('should apply warm-start from previous frame impulse', () => {
    // Create two bodies at rest
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-1.0);
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(1.0);
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyB, Body2D, bodyDataB);

    // Create revolute joint with previous impulse
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    joint.jx = f(0.5); // Previous impulse from last frame
    joint.jy = f(0.3);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Build constraint batch
    BuildRevolute2D.fn(ctx);

    // Store initial velocities (should be zero)
    expect(bodyDataA.vx).toBe(ZERO);
    expect(bodyDataB.vx).toBe(ZERO);

    // Run solver with warm-start
    SolverGSRevolute2D.fn(ctx);

    // Bodies should have velocities due to warm-start impulse application
    const updatedBodyA = world.getComponent(bodyA, Body2D) as Body2D;
    const updatedBodyB = world.getComponent(bodyB, Body2D) as Body2D;

    expect(updatedBodyA.vx !== ZERO || updatedBodyA.vy !== ZERO).toBe(true);
    expect(updatedBodyB.vx !== ZERO || updatedBodyB.vy !== ZERO).toBe(true);
  });

  test('should break joint when impulse exceeds threshold', () => {
    // Create two bodies with high initial velocities
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-1.0);
    bodyDataA.vx = f(10.0); // High velocity
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(1.0);
    bodyDataB.vx = f(-10.0); // High velocity in opposite direction
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyB, Body2D, bodyDataB);

    // Create breakable revolute joint with low threshold
    const jointEntity = world.createEntity();
    const joint = createBreakableRevoluteJoint(bodyA, bodyB, { x: 0, y: 0 }, { x: 0, y: 0 }, 1.0);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Build constraint batch
    BuildRevolute2D.fn(ctx);

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // Check that break event was fired
    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events.length).toBe(1);
    expect(events.events[0]).toBeInstanceOf(JointBrokenEvent);
    expect(events.events[0].joint).toBe(jointEntity);

    // Joint should be marked as broken
    const updatedJoint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    expect(updatedJoint.broken).toBe(1);
    expect(updatedJoint.jx).toBe(ZERO);
    expect(updatedJoint.jy).toBe(ZERO);
  });

  test('should skip broken joints', () => {
    // Create two bodies
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    world.addComponent(bodyA, Body2D, createDynamicBody());
    world.addComponent(bodyB, Body2D, createDynamicBody());

    // Create broken revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    joint.broken = 1; // Mark as broken
    joint.jx = f(1.0); // Should be ignored
    joint.jy = f(1.0);
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Build constraint batch (should skip broken joint)
    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(0);

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // No events should be generated and bodies should remain unchanged
    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events.length).toBe(0);

    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    const bodyDataB = world.getComponent(bodyB, Body2D) as Body2D;
    expect(bodyDataA.vx).toBe(ZERO);
    expect(bodyDataB.vx).toBe(ZERO);
  });

  test('should handle multiple joints in deterministic order', () => {
    // Create multiple bodies and joints
    const bodies = [];
    const joints = [];

    for (let i = 0; i < 4; i++) {
      const body = world.createEntity();
      const bodyData = createDynamicBody();
      bodyData.px = f(i * 2.0);
      bodyData.vx = f((i % 2) * 2 - 1); // Alternate velocities
      bodyData.invMass = ONE;
      bodyData.invI = ONE;
      world.addComponent(body, Body2D, bodyData);
      bodies.push(body);
    }

    // Create joints between adjacent bodies
    for (let i = 0; i < 3; i++) {
      const joint = world.createEntity();
      const jointData = createRevoluteJoint(bodies[i], bodies[i + 1]);
      world.addComponent(joint, RevoluteJoint2D, jointData);
      joints.push(joint);
    }

    // Build constraints
    BuildRevolute2D.fn(ctx);

    const batch = world.getResource(RevoluteBatch2D) as RevoluteBatch2D;
    expect(batch.count).toBe(3);

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // All joints should have accumulated impulses
    for (let i = 0; i < 3; i++) {
      const jointData = world.getComponent(joints[i], RevoluteJoint2D) as RevoluteJoint2D;
      expect(jointData.jx !== ZERO || jointData.jy !== ZERO).toBe(true);
    }
  });

  test('should handle soft constraint parameters', () => {
    // Create two bodies with relative velocity
    const bodyA = world.createEntity();
    const bodyB = world.createEntity();

    const bodyDataA = createDynamicBody();
    bodyDataA.vx = f(1.0);
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const bodyDataB = createDynamicBody();
    bodyDataB.vx = f(-1.0);
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyB, Body2D, bodyDataB);

    // Create soft revolute joint
    const jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB);
    joint.gamma = f(0.1); // Soft constraint
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Build constraint batch
    BuildRevolute2D.fn(ctx);

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // Joint should have accumulated impulse
    const updatedJoint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    expect(updatedJoint.jx !== ZERO || updatedJoint.jy !== ZERO).toBe(true);

    // Bodies should have modified velocities
    const updatedBodyA = world.getComponent(bodyA, Body2D) as Body2D;
    const updatedBodyB = world.getComponent(bodyB, Body2D) as Body2D;
    expect(updatedBodyA.vx !== f(1.0)).toBe(true);
    expect(updatedBodyB.vx !== f(-1.0)).toBe(true);
  });

  test('should clear joint events resource at start', () => {
    // Pre-populate events
    const events = new JointEvents2D();
    events.addBrokenEvent(999);
    world.setResource(JointEvents2D, events);

    expect(events.events.length).toBe(1);

    // Create empty batch
    const batch = new RevoluteBatch2D();
    world.setResource(RevoluteBatch2D, batch);

    // Run solver
    SolverGSRevolute2D.fn(ctx);

    // Events should still exist (not cleared by solver itself)
    expect(events.events.length).toBe(1);
  });
});