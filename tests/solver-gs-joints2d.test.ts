/**
 * Tests for SolverGSJoints2D system
 * SolverGSJoints2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { JointDistance2D } from '../src/components/JointDistance2D';
import { JointBatch2D } from '../src/resources/JointBatch2D';
import type { JointRow } from '../src/resources/JointBatch2D';
import { SolverGSJoints2D, JointEvents2D, JointBrokenEvent } from '../src/systems/phys2d/SolverGSJoints2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('SolverGSJoints2D System', () => {
  let world: World;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;
  let batch: JointBatch2D;
  let ctx: SystemContext;

  beforeEach(() => {
    world = new World();
    batch = new JointBatch2D();
    world.setResource(JointBatch2D, batch);

    // Create two dynamic bodies
    bodyA = world.createEntity();
    bodyB = world.createEntity();

    const body1 = new Body2D();
    body1.invMass = ONE;
    body1.invI = ONE;
    body1.px = f(-1.0);
    body1.py = ZERO;

    const body2 = new Body2D();
    body2.invMass = ONE;
    body2.invI = ONE;
    body2.px = f(1.0);
    body2.py = ZERO;

    world.addComponent(bodyA, Body2D, body1);
    world.addComponent(bodyB, Body2D, body2);

    // Create joint entity and component
    jointEntity = world.createEntity();
    const joint = new JointDistance2D();
    joint.a = bodyA;
    joint.b = bodyB;
    joint.rest = f(2.0);
    joint.jn = ZERO;

    world.addComponent(jointEntity, JointDistance2D, joint);

    // Create system context
    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    // Mock required world methods
    world.getFixedDtFX = () => f(1/60);
    world.frame = 1;
    world.getStore = () => ({ markChanged: vi.fn() });
  });

  function createBasicJointRow(): JointRow {
    return {
      e: jointEntity,
      a: bodyA,
      b: bodyB,
      rax: ZERO,
      ray: ZERO,
      rbx: ZERO,
      rby: ZERO,
      nx: ONE,
      ny: ZERO,
      rest: f(2.0),
      mN: f(0.5),
      bias: ZERO,
      gamma: ZERO,
      breakImpulse: ZERO,
      broken: 0
    };
  }

  test('should create JointEvents2D resource if not present', () => {
    expect(world.getResource(JointEvents2D)).toBeUndefined();

    SolverGSJoints2D.fn(ctx);

    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events).toBeDefined();
    expect(events).toBeInstanceOf(JointEvents2D);
  });

  test('should skip when no joint batch present', () => {
    world.setResource(JointBatch2D, undefined);

    const spy = vi.spyOn(world, 'getComponent');

    SolverGSJoints2D.fn(ctx);

    expect(spy).not.toHaveBeenCalled();
  });

  test('should skip when joint batch is empty', () => {
    batch.clear();

    const spy = vi.spyOn(world, 'getComponent');

    SolverGSJoints2D.fn(ctx);

    expect(spy).not.toHaveBeenCalled();
  });

  test('should apply warm-start impulses', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.jn = f(0.5); // Previous accumulated impulse
    world.replaceComponent(jointEntity, JointDistance2D, joint);

    // Create constraint violation to trigger solving
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(0.1); // Small relative velocity
    body2.vx = f(-0.1);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Velocities should be modified by warm-start impulse
    expect(body1After.vx).not.toBe(body1Before.vx);
    expect(body2After.vx).not.toBe(body2Before.vx);
  });

  test('should solve velocity constraints with fixed iterations', () => {
    // Create constraint violation by setting initial velocities
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(1.0); // Moving toward each other
    body2.vx = f(-1.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.bias = f(0.1); // Position correction bias
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Velocities should be corrected to maintain constraint
    expect(body1After.vx).not.toBe(body1Before.vx);
    expect(body2After.vx).not.toBe(body2Before.vx);
  });

  test('should accumulate impulses during solving', () => {
    // Create significant constraint violation
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(2.0);
    body2.vx = f(-2.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.bias = f(0.5);
    batch.addRow(row);

    const jointBefore = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    const jnBefore = jointBefore.jn;

    SolverGSJoints2D.fn(ctx);

    const jointAfter = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;

    // Impulse should be accumulated
    expect(jointAfter.jn).not.toBe(jnBefore);
  });

  test('should handle constraint softening with gamma parameter', () => {
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(1.0);
    body2.vx = f(-1.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.gamma = f(0.1); // Soft constraint
    batch.addRow(row);

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Soft constraint should still apply forces
    expect(body1After.vx).not.toBe(f(1.0));
    expect(body2After.vx).not.toBe(f(-1.0));
  });

  test('should skip broken joints', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.broken = 1;
    world.replaceComponent(jointEntity, JointDistance2D, joint);

    const row = createBasicJointRow();
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Bodies should not be affected by broken joint
    expect(body1After.vx).toBe(body1Before.vx);
    expect(body2After.vx).toBe(body2Before.vx);
  });

  test('should skip joints with both static bodies', () => {
    // Make both bodies static
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.invMass = ZERO;
    body1.invI = ZERO;
    body2.invMass = ZERO;
    body2.invI = ZERO;
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Static bodies should not move
    expect(body1After.vx).toBe(body1Before.vx);
    expect(body2After.vx).toBe(body2Before.vx);
  });

  test('should handle one static body correctly', () => {
    // Make bodyA static
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    body1.invMass = ZERO;
    body1.invI = ZERO;
    world.replaceComponent(bodyA, Body2D, body1);

    // Set initial velocity on dynamic body
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body2.vx = f(2.0);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.bias = f(0.2);
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Static body should not move
    expect(body1After.vx).toBe(body1Before.vx);
    expect(body1After.vy).toBe(body1Before.vy);
    expect(body1After.w).toBe(body1Before.w);

    // Dynamic body should be affected
    expect(body2After.vx).not.toBe(body2Before.vx);
  });

  test('should detect joint breaking and fire event', () => {
    // Create severe constraint violation to generate large impulse
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(10.0); // High relative velocity
    body2.vx = f(-10.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.breakImpulse = f(0.5); // Low break threshold
    row.bias = f(5.0); // High bias to generate impulse
    batch.addRow(row);

    SolverGSJoints2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.broken).toBe(1);
    expect(updatedJoint.jn).toBe(ZERO);

    // Check break event was fired
    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events).toHaveLength(1);
    expect(events.events[0]).toBeInstanceOf(JointBrokenEvent);
    expect(events.events[0].joint).toBe(jointEntity);
  });

  test('should not break joint when impulse is below threshold', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.jn = f(2.0);
    world.replaceComponent(jointEntity, JointDistance2D, joint);

    const row = createBasicJointRow();
    row.breakImpulse = f(5.0); // High break threshold
    batch.addRow(row);

    SolverGSJoints2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.broken).toBe(0);

    // No break event should be fired
    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events).toHaveLength(0);
  });

  test('should handle negative impulses for breaking detection', () => {
    // Create severe constraint violation in opposite direction
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(-10.0); // Opposite direction high velocity
    body2.vx = f(10.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    const row = createBasicJointRow();
    row.breakImpulse = f(0.5);
    row.bias = f(-5.0); // Negative bias to generate negative impulse
    batch.addRow(row);

    SolverGSJoints2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.broken).toBe(1); // Should break on absolute value
    expect(updatedJoint.jn).toBe(ZERO);

    const events = world.getResource(JointEvents2D) as JointEvents2D;
    expect(events.events).toHaveLength(1);
  });

  test('should process multiple joints in stable order', () => {
    // Create second joint
    const jointEntity2 = world.createEntity();
    const joint2 = new JointDistance2D();
    joint2.a = bodyA;
    joint2.b = bodyB;
    joint2.rest = f(1.5);
    world.addComponent(jointEntity2, JointDistance2D, joint2);

    const row1 = createBasicJointRow();
    row1.bias = f(2.0); // Add bias to generate impulse
    const row2: JointRow = {
      ...createBasicJointRow(),
      e: jointEntity2,
      rest: f(1.5),
      bias: f(1.5) // Add bias to generate impulse
    };

    batch.addRow(row1);
    batch.addRow(row2);

    // Set constraint violations
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.vx = f(2.0);
    body2.vx = f(-2.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    SolverGSJoints2D.fn(ctx);

    // Both joints should have accumulated impulses
    const joint1After = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    const joint2After = world.getComponent(jointEntity2, JointDistance2D) as JointDistance2D;

    expect(joint1After.jn).not.toBe(ZERO);
    expect(joint2After.jn).not.toBe(ZERO);
  });

  test('should handle angular velocity contributions', () => {
    // Set angular velocity and linear velocity
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.w = f(2.0);
    body2.w = f(-2.0);
    body1.vx = f(1.0);
    body2.vx = f(-1.0);
    world.replaceComponent(bodyA, Body2D, body1);
    world.replaceComponent(bodyB, Body2D, body2);

    // Use offset anchors to create angular coupling
    const row = createBasicJointRow();
    row.rax = f(0.5);
    row.ray = f(0.5);
    row.rbx = f(-0.5);
    row.rby = f(-0.5);
    row.bias = f(1.0); // Add bias to ensure constraint solving
    batch.addRow(row);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    SolverGSJoints2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Angular velocities should be affected by constraint
    expect(body1After.w).not.toBe(body1Before.w);
    expect(body2After.w).not.toBe(body2Before.w);
  });

  test('should have correct system configuration', () => {
    expect(SolverGSJoints2D.name).toBe('phys.solver.joints.gs');
    expect(SolverGSJoints2D.stage).toBe('update');
    expect(SolverGSJoints2D.after).toContain('phys.joint.build.distance');
    expect(SolverGSJoints2D.before).toContain('phys.sleep.update');
  });
});