/**
 * Tests for BuildJointsDistance2D system
 * BuildJointsDistance2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { JointDistance2D } from '../src/components/JointDistance2D';
import { Sleep2D } from '../src/components/Sleep2D';
import { JointBatch2D } from '../src/resources/JointBatch2D';
import { BuildJointsDistance2D } from '../src/systems/phys2d/BuildJointsDistance2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('BuildJointsDistance2D System', () => {
  let world: World;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;
  let ctx: SystemContext;

  beforeEach(() => {
    world = new World();

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
    world.getStore = () => ({ markChanged: vi.fn() });
  });

  test('should create JointBatch2D resource if not present', () => {
    expect(world.getResource(JointBatch2D)).toBeUndefined();

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch).toBeDefined();
    expect(batch).toBeInstanceOf(JointBatch2D);
  });

  test('should build empty batch when no joints present', () => {
    // Remove the joint
    world.removeComponent(jointEntity, JointDistance2D);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
    expect(batch.list).toEqual([]);
  });

  test('should build batch row from joint with stable sorting', () => {
    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.e).toBe(jointEntity);
    expect(row.a).toBe(bodyA);
    expect(row.b).toBe(bodyB);
    expect(row.rest).toBe(f(2.0));
  });

  test('should compute constraint direction correctly', () => {
    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    // Bodies are at (-1, 0) and (1, 0), so direction should be (1, 0)
    expect(row.nx).toBe(ONE);
    expect(row.ny).toBe(ZERO);
  });

  test('should use stable deterministic sorting with multiple joints', () => {
    // Create additional joints with different body pairs
    const bodyC = world.createEntity();
    const bodyD = world.createEntity();

    const body3 = new Body2D();
    body3.invMass = ONE;
    body3.invI = ONE;
    body3.px = f(2.0);
    body3.py = ZERO;

    const body4 = new Body2D();
    body4.invMass = ONE;
    body4.invI = ONE;
    body4.px = f(3.0);
    body4.py = ZERO;

    world.addComponent(bodyC, Body2D, body3);
    world.addComponent(bodyD, Body2D, body4);

    // Create multiple joints with same body pair (different entity IDs)
    const joint2 = world.createEntity();
    const joint3 = world.createEntity();

    const jd2 = new JointDistance2D();
    jd2.a = bodyA;
    jd2.b = bodyB;
    jd2.rest = f(1.5);
    world.addComponent(joint2, JointDistance2D, jd2);

    const jd3 = new JointDistance2D();
    jd3.a = bodyC;
    jd3.b = bodyD;
    jd3.rest = f(1.0);
    world.addComponent(joint3, JointDistance2D, jd3);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(3);

    // Verify sorting: same pair should be ordered by entity ID
    const sameBodyPairJoints = batch.list.filter(row =>
      (row.a === bodyA && row.b === bodyB) || (row.a === bodyB && row.b === bodyA)
    );
    expect(sameBodyPairJoints.length).toBe(2);

    if (sameBodyPairJoints.length === 2) {
      // Should be sorted by entity ID
      expect(sameBodyPairJoints[0].e).toBeLessThan(sameBodyPairJoints[1].e);
    }
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

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should skip joints with both sleeping bodies', () => {
    // Add sleeping components to both bodies
    const sleep1 = new Sleep2D();
    sleep1.sleeping = 1;
    const sleep2 = new Sleep2D();
    sleep2.sleeping = 1;

    world.addComponent(bodyA, Sleep2D, sleep1);
    world.addComponent(bodyB, Sleep2D, sleep2);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should wake up sleeping body when other is awake', () => {
    // Make bodyA sleeping, bodyB awake
    const sleep1 = new Sleep2D();
    sleep1.sleeping = 1;
    sleep1.timer = f(0.5);

    world.addComponent(bodyA, Sleep2D, sleep1);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    // Check that sleeping body was woken up
    const updatedSleep = world.getComponent(bodyA, Sleep2D) as Sleep2D;
    expect(updatedSleep.sleeping).toBe(0);
    expect(updatedSleep.timer).toBe(ZERO);

    const updatedBody = world.getComponent(bodyA, Body2D) as Body2D;
    expect(updatedBody.awake).toBe(1);
  });

  test('should auto-initialize rest length when rest < 0', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.rest = f(-1); // Auto-initialize flag
    joint.initialized = 0;
    world.setComponent(jointEntity, JointDistance2D, joint);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    expect(row.rest).toBe(f(2.0)); // Should be initialized to current distance

    // Check that component was updated
    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.rest).toBe(f(2.0));
    expect(updatedJoint.initialized).toBe(1);
  });

  test('should compute effective mass correctly', () => {
    BuildJointsDistance2D.fn(ctx);

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

    BuildJointsDistance2D.fn(ctx);

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

    BuildJointsDistance2D.fn(ctx);

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

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    expect(row.breakImpulse).toBe(f(10.0));
    expect(row.broken).toBe(0);
  });

  test('should compute relative anchor positions correctly', () => {
    // Set anchor offsets
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.ax = f(0.5);
    joint.ay = f(0.25);
    joint.bx = f(-0.3);
    joint.by = f(-0.15);
    world.setComponent(jointEntity, JointDistance2D, joint);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    expect(row.rax).toBe(f(0.5));
    expect(row.ray).toBe(f(0.25));
    expect(row.rbx).toBe(f(-0.3));
    expect(row.rby).toBe(f(-0.15));
  });

  test('should use fast approximate length calculation', () => {
    // Move bodies to create a diagonal distance
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(0.0);
    body1.py = f(0.0);
    body2.px = f(1.0);
    body2.py = f(1.0);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    const row = batch.list[0];

    // Should compute approximate length for diagonal (1,1) vector
    // In fixed-point, normalized components should be approximately equal
    expect(row.nx).toBe(row.ny); // Both components should be equal for 45-degree angle
    expect(row.nx).toBeGreaterThan(ZERO); // Should be positive
    expect(row.ny).toBeGreaterThan(ZERO); // Should be positive
  });

  test('should clear previous batch on each run', () => {
    // First run
    BuildJointsDistance2D.fn(ctx);
    let batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    // Remove joint and run again
    world.removeComponent(jointEntity, JointDistance2D);
    BuildJointsDistance2D.fn(ctx);

    batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });

  test('should have correct system configuration', () => {
    expect(BuildJointsDistance2D.name).toBe('phys.joint.build.distance');
    expect(BuildJointsDistance2D.stage).toBe('update');
    expect(BuildJointsDistance2D.after).toContain('phys.narrowphase');
    expect(BuildJointsDistance2D.before).toContain('phys.solver.joints2d');
  });

  test('should handle zero distance edge case gracefully', () => {
    // Move bodies to same position
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = ZERO;
    body1.py = ZERO;
    body2.px = ZERO;
    body2.py = ZERO;
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(1);

    const row = batch.list[0];
    // Should use fallback distance of ONE to prevent division by zero
    expect(row.nx).toBe(ZERO); // dx/dist = 0/1 = 0
    expect(row.ny).toBe(ZERO); // dy/dist = 0/1 = 0
  });

  test('should skip joints with invalid rest length after auto-init attempt', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.rest = f(-2); // Invalid rest that won't be auto-initialized
    joint.initialized = 1; // Already initialized, so won't retry
    world.setComponent(jointEntity, JointDistance2D, joint);

    BuildJointsDistance2D.fn(ctx);

    const batch = world.getResource(JointBatch2D) as JointBatch2D;
    expect(batch.count).toBe(0);
  });
});