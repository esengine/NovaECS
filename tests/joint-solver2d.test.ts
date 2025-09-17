/**
 * Tests for JointSolver2D system
 * JointSolver2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { JointDistance2D } from '../src/components/JointDistance2D';
import { JointConstraints2D } from '../src/resources/JointConstraints2D';
import { JointSolver2D } from '../src/systems/phys2d/JointSolver2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('JointSolver2D System', () => {
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
    world.getStore = () => ({ markChanged: vi.fn() });
  });

  test('should skip when no joints are present', () => {
    const spy = vi.spyOn(world, 'getComponent');

    JointSolver2D.fn(ctx);

    expect(spy).not.toHaveBeenCalled();
  });

  test('should skip broken joints', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.broken = 1;
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    expect(body1After.vx).toBe(body1Before.vx);
    expect(body2After.vx).toBe(body2Before.vx);
  });

  test('should auto-initialize rest length when rest < 0', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.rest = f(-1); // Auto-initialize flag
    joint.initialized = 0;
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointSolver2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.rest).toBe(f(2.0)); // Should be initialized to current distance
    expect(updatedJoint.initialized).toBe(1);
  });

  test('should apply warm-start impulses', () => {
    // Move bodies slightly off from equilibrium to trigger constraint
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.9); // Slightly closer than rest distance
    body2.px = f(0.9);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.jn = f(0.5); // Previous accumulated impulse
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Velocities should be modified by warm-start impulse
    expect(body1After.vx).not.toBe(body1Before.vx);
    expect(body2After.vx).not.toBe(body2Before.vx);
  });

  test('should solve distance constraint when bodies are too close', () => {
    // Move bodies closer together
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.5);
    body2.px = f(0.5);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Bodies should move apart to satisfy distance constraint
    expect(body1After.vx).toBeLessThan(body1Before.vx);
    expect(body2After.vx).toBeGreaterThan(body2Before.vx);
  });

  test('should solve distance constraint when bodies are too far', () => {
    // Move bodies further apart
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-2.0);
    body2.px = f(2.0);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Bodies should move together to satisfy distance constraint
    expect(body1After.vx).toBeGreaterThan(body1Before.vx);
    expect(body2After.vx).toBeLessThan(body2Before.vx);
  });

  test('should break joint when impulse exceeds breakImpulse', () => {
    // Create significant constraint violation to generate large impulse
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.1); // Very close together (will violate 2.0 rest distance)
    body2.px = f(0.1);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.breakImpulse = f(0.01); // Very low breaking threshold
    joint.jn = ZERO; // Start with no impulse
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointSolver2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.broken).toBe(1);
    expect(updatedJoint.jn).toBe(ZERO);
  });

  test('should handle static bodies correctly', () => {
    // Create constraint violation and make bodyA static
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.5); // Move closer together
    body2.px = f(0.5);
    body1.invMass = ZERO; // Make static
    body1.invI = ZERO;
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Static body should not move
    expect(body1After.vx).toBe(body1Before.vx);
    expect(body1After.vy).toBe(body1Before.vy);
    expect(body1After.w).toBe(body1Before.w);

    // Dynamic body should still be affected
    expect(body2After.vx).not.toBe(body2Before.vx);
  });

  test('should handle both static bodies by skipping constraint', () => {
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

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Both bodies should remain unchanged
    expect(body1After.vx).toBe(body1Before.vx);
    expect(body2After.vx).toBe(body2Before.vx);
  });

  test('should support anchor points offset from center', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.ax = f(0.5); // Offset anchor on body A
    joint.ay = f(0.5);
    joint.bx = f(-0.5); // Offset anchor on body B
    joint.by = f(-0.5);
    joint.rest = f(-1); // Auto-initialize
    joint.initialized = 0;
    world.setComponent(jointEntity, JointDistance2D, joint);

    constraints.addJoint(jointEntity);

    JointSolver2D.fn(ctx);

    const updatedJoint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(updatedJoint.initialized).toBe(1);
    // Rest length should be distance between offset anchor points
    expect(updatedJoint.rest).toBeGreaterThan(f(1.4)); // Should be sqrt(2) * 1.414...
  });

  test('should have correct system configuration', () => {
    expect(JointSolver2D.name).toBe('phys.solver.joints2d');
    expect(JointSolver2D.stage).toBe('update');
    expect(JointSolver2D.after).toContain('phys.solver.gs2d');
    expect(JointSolver2D.before).toContain('phys.sleep.update');
  });

  test('should handle constraint softening with gamma parameter', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.gamma = f(0.1); // Add softening
    world.setComponent(jointEntity, JointDistance2D, joint);

    // Move bodies closer to create constraint violation
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.5);
    body2.px = f(0.5);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    const body1Before = { ...world.getComponent(bodyA, Body2D) } as Body2D;
    const body2Before = { ...world.getComponent(bodyB, Body2D) } as Body2D;

    JointSolver2D.fn(ctx);

    const body1After = world.getComponent(bodyA, Body2D) as Body2D;
    const body2After = world.getComponent(bodyB, Body2D) as Body2D;

    // Soft constraint should still apply forces but with reduced magnitude
    expect(body1After.vx).toBeLessThan(body1Before.vx);
    expect(body2After.vx).toBeGreaterThan(body2Before.vx);
  });

  test('should accumulate impulses across iterations', () => {
    // Create constraint violation to trigger impulse accumulation
    const body1 = world.getComponent(bodyA, Body2D) as Body2D;
    const body2 = world.getComponent(bodyB, Body2D) as Body2D;
    body1.px = f(-0.8); // Move closer together
    body2.px = f(0.8);
    world.setComponent(bodyA, Body2D, body1);
    world.setComponent(bodyB, Body2D, body2);

    constraints.addJoint(jointEntity);

    const jointBefore = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    const jnBefore = jointBefore.jn;

    JointSolver2D.fn(ctx);

    const jointAfter = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;

    // Impulse should be accumulated
    expect(jointAfter.jn).not.toBe(jnBefore);
  });
});