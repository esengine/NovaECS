/**
 * Tests for JointBatchBuilder2D system
 * JointBatchBuilder2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { JointDistance2D } from '../src/components/JointDistance2D';
import { JointConstraints2D } from '../src/resources/JointConstraints2D';
import { JointBatch2D } from '../src/resources/JointBatch2D';
import { JointBatchBuilder2D } from '../src/systems/phys2d/JointBatchBuilder2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('JointBatchBuilder2D System', () => {
  let world: World;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;
  let constraints: JointConstraints2D;
  let ctx: SystemContext;

  beforeEach(() => {
    world = new World();
    constraints = new JointConstraints2D();
    world.setResource(JointConstraints2D, constraints);

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

    // Create joint entity
    jointEntity = world.createEntity();
    const joint = new JointDistance2D();
    joint.a = bodyA;
    joint.b = bodyB;
    joint.ax = ZERO;
    joint.ay = ZERO;
    joint.bx = ZERO;
    joint.by = ZERO;
    joint.rest = f(2.0); // 2 units apart

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
  });

  test('should create JointBatch2D resource if not present', () => {
    expect(world.getResource(JointBatch2D)).toBeUndefined();

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch).toBeDefined();
    expect(batch).toBeInstanceOf(JointBatch2D);
  });

  test('should build empty batch when no joints present', () => {
    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
    expect(batch.list).toEqual([]);
  });

  test('should build batch row from joint constraint', () => {
    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.e).toBe(jointEntity);
    expect(row.a).toBe(bodyA);
    expect(row.b).toBe(bodyB);
    expect(row.rest).toBe(f(2.0));
  });

  test('should compute constraint direction correctly', () => {
    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    // Bodies are at (-1, 0) and (1, 0), so direction should be (1, 0)
    expect(row.nx).toBe(ONE);
    expect(row.ny).toBe(ZERO);
  });

  test('should compute relative anchor positions', () => {
    // Set anchor offsets
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.ax = f(0.5);
    joint.ay = f(0.25);
    joint.bx = f(-0.3);
    joint.by = f(-0.15);
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    expect(row.rax).toBe(f(0.5));
    expect(row.ray).toBe(f(0.25));
    expect(row.rbx).toBe(f(-0.3));
    expect(row.rby).toBe(f(-0.15));
  });

  test('should compute effective mass correctly', () => {
    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    // With both bodies having invMass = 1 and no angular contribution (center anchors)
    // effective mass should be 1/(1+1) = 0.5
    expect(row.mN).toBe(f(0.5));
  });

  test('should compute Baumgarte bias for position correction', () => {
    // Move bodies closer to create constraint violation
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.5);
    body2.px = f(0.5);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    // Current distance is 1.0, rest is 2.0, so C = -1.0
    // Bias should be beta * C / dt = 0.2 * (-1.0) / (1/60) = -12.0
    expect(row.bias).toBeLessThan(ZERO); // Should be negative (compression)
  });

  test('should handle constraint softening parameter', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.gamma = f(0.1);
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    expect(row.gamma).toBe(f(0.1));
    // Effective mass should be different due to gamma softening
    expect(row.mN).toBeLessThan(f(0.5));
  });

  test('should handle breakable joints', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.breakImpulse = f(10.0);
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    expect(row.breakImpulse).toBe(f(10.0));
    expect(row.broken).toBe(0);
  });

  test('should skip broken joints', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.broken = 1;
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should skip joints with both static bodies', () => {
    // Make both bodies static
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.invMass = ZERO;
    body1.invI = ZERO;
    body2.invMass = ZERO;
    body2.invI = ZERO;
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should auto-initialize rest length when rest < 0', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.rest = f(-1); // Auto-initialize flag
    joint.initialized = 0;
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.rest).toBe(f(2.0)); // Should be initialized to current distance

    // Check that component was updated
    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.rest).toBe(f(2.0));
    expect(updatedJoint.initialized).toBe(1);
  });

  test('should handle multiple joints', () => {
    // Create second joint
    const jointEntity2 = world.createEntity();
    const joint2 = new JointDistance2D();
    joint2.a = bodyA;
    joint2.b = bodyB;
    joint2.ax = f(0.5);
    joint2.ay = f(0.5);
    joint2.bx = f(-0.5);
    joint2.by = f(-0.5);
    joint2.rest = f(1.5);

    world.addComponent(jointEntity2, JointDistance2D, joint2);

    constraints.addJoint(jointEntity);
    constraints.addJoint(jointEntity2);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(2);

    // Check both joints are processed
    expect(batch.list[0].e).toBe(jointEntity);
    expect(batch.list[1].e).toBe(jointEntity2);
    expect(batch.list[0].rest).toBe(f(2.0));
    expect(batch.list[1].rest).toBe(f(1.5));
  });

  test('should clear previous batch on each run', () => {
    constraints.addJoint(jointEntity);

    // First run
    JointBatchBuilder2D.fn(ctx);
    let batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    // Remove joint and run again
    constraints.removeJoint(jointEntity);
    JointBatchBuilder2D.fn(ctx);

    batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should have correct system configuration', () => {
    expect(JointBatchBuilder2D.name).toBe('phys.joints.batch');
    expect(JointBatchBuilder2D.stage).toBe('update');
    expect(JointBatchBuilder2D.after).toContain('phys.narrowphase');
    expect(JointBatchBuilder2D.before).toContain('phys.solver.joints2d');
  });

  test('should handle zero distance edge case', () => {
    // Move bodies to same position (zero distance)
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = ZERO;
    body1.py = ZERO;
    body2.px = ZERO;
    body2.py = ZERO;
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    JointBatchBuilder2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0); // Should skip zero distance joints
  });
});