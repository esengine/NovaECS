/**
 * Tests for JointDistance2D component and JointConstraints2D resource
 * JointDistance2D组件和JointConstraints2D资源测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import {
  JointDistance2D,
  createDistanceJoint,
  createBreakableDistanceJoint,
  createSoftDistanceJoint
} from '../src/components/JointDistance2D';
import { JointConstraints2D } from '../src/resources/JointConstraints2D';
import { f, ZERO, ONE } from '../src/math/fixed';

describe('JointDistance2D Component', () => {
  let joint: JointDistance2D;

  beforeEach(() => {
    joint = new JointDistance2D();
  });

  test('should initialize with default values', () => {
    expect(joint.ax).toBe(ZERO);
    expect(joint.ay).toBe(ZERO);
    expect(joint.bx).toBe(ZERO);
    expect(joint.by).toBe(ZERO);
    expect(joint.rest).toBe(f(-1)); // Auto-initialize flag
    expect(joint.beta).toBe(f(0.2));
    expect(joint.gamma).toBe(ZERO);
    expect(joint.jn).toBe(ZERO);
    expect(joint.breakImpulse).toBe(ZERO);
    expect(joint.broken).toBe(0);
    expect(joint.initialized).toBe(0);
  });

  test('should allow setting anchor points', () => {
    joint.ax = f(1.5);
    joint.ay = f(-0.5);
    joint.bx = f(2.0);
    joint.by = f(1.0);

    expect(joint.ax).toBe(f(1.5));
    expect(joint.ay).toBe(f(-0.5));
    expect(joint.bx).toBe(f(2.0));
    expect(joint.by).toBe(f(1.0));
  });

  test('should allow setting rest length and constraint parameters', () => {
    joint.rest = f(3.0);
    joint.beta = f(0.1);
    joint.gamma = f(0.05);

    expect(joint.rest).toBe(f(3.0));
    expect(joint.beta).toBe(f(0.1));
    expect(joint.gamma).toBe(f(0.05));
  });

  test('should support warm-start impulse accumulation', () => {
    joint.jn = f(0.5);
    expect(joint.jn).toBe(f(0.5));
  });

  test('should support breaking configuration', () => {
    joint.breakImpulse = f(10.0);
    joint.broken = 1;

    expect(joint.breakImpulse).toBe(f(10.0));
    expect(joint.broken).toBe(1);
  });

  test('should track initialization state', () => {
    expect(joint.initialized).toBe(0);
    joint.initialized = 1;
    expect(joint.initialized).toBe(1);
  });
});

describe('JointConstraints2D Resource', () => {
  let world: World;
  let constraints: JointConstraints2D;
  let jointEntityA: number;
  let jointEntityB: number;

  beforeEach(() => {
    world = new World();
    constraints = new JointConstraints2D();

    // Create joint entities
    jointEntityA = world.createEntity();
    jointEntityB = world.createEntity();

    const jointA = new JointDistance2D();
    const jointB = new JointDistance2D();

    world.addComponent(jointEntityA, JointDistance2D, jointA);
    world.addComponent(jointEntityB, JointDistance2D, jointB);
  });

  test('should initialize with empty list', () => {
    expect(constraints.list).toEqual([]);
    expect(constraints.count).toBe(0);
  });

  test('should add joint entities', () => {
    constraints.addJoint(jointEntityA);
    expect(constraints.list).toContain(jointEntityA);
    expect(constraints.count).toBe(1);

    constraints.addJoint(jointEntityB);
    expect(constraints.list).toContain(jointEntityB);
    expect(constraints.count).toBe(2);
  });

  test('should remove joint entities', () => {
    constraints.addJoint(jointEntityA);
    constraints.addJoint(jointEntityB);

    constraints.removeJoint(jointEntityA);
    expect(constraints.list).not.toContain(jointEntityA);
    expect(constraints.list).toContain(jointEntityB);
    expect(constraints.count).toBe(1);
  });

  test('should handle removing non-existent joint', () => {
    constraints.addJoint(jointEntityA);
    const nonExistentEntity = 999;

    constraints.removeJoint(nonExistentEntity);
    expect(constraints.count).toBe(1);
    expect(constraints.list).toContain(jointEntityA);
  });

  test('should clear all joints', () => {
    constraints.addJoint(jointEntityA);
    constraints.addJoint(jointEntityB);

    constraints.clear();
    expect(constraints.list).toEqual([]);
    expect(constraints.count).toBe(0);
  });
});

describe('JointDistance2D Integration', () => {
  let world: World;
  let constraints: JointConstraints2D;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;

  beforeEach(() => {
    world = new World();
    constraints = new JointConstraints2D();

    // Create two bodies
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
    joint.ax = ZERO; // Center of body A
    joint.ay = ZERO;
    joint.bx = ZERO; // Center of body B
    joint.by = ZERO;
    joint.rest = f(2.0); // 2 units apart

    world.addComponent(jointEntity, JointDistance2D, joint);
    world.setResource(JointConstraints2D, constraints);
  });

  test('should create valid joint configuration', () => {
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.rest).toBe(f(2.0));
    expect(joint.broken).toBe(0);
  });

  test('should add joint to constraints for processing', () => {
    constraints.addJoint(jointEntity);

    expect(constraints.count).toBe(1);
    expect(constraints.list).toContain(jointEntity);

    // Verify joint can be retrieved and processed
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(joint).toBeDefined();
    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
  });

  test('should support multiple joints between different body pairs', () => {
    // Create second joint
    const jointEntity2 = world.createEntity();
    const joint2 = new JointDistance2D();
    joint2.a = bodyA;
    joint2.b = bodyB;
    joint2.ax = f(0.5); // Different anchor points
    joint2.ay = f(0.5);
    joint2.bx = f(-0.5);
    joint2.by = f(-0.5);
    joint2.rest = f(1.5);

    world.addComponent(jointEntity2, JointDistance2D, joint2);

    constraints.addJoint(jointEntity);
    constraints.addJoint(jointEntity2);

    expect(constraints.count).toBe(2);

    // Both joints should be independently configurable
    const joint1 = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    const joint2Retrieved = world.getComponent(jointEntity2, JointDistance2D) as JointDistance2D;

    expect(joint1.rest).toBe(f(2.0));
    expect(joint2Retrieved.rest).toBe(f(1.5));
    expect(joint1.ax).toBe(ZERO);
    expect(joint2Retrieved.ax).toBe(f(0.5));
  });
});

describe('Joint Creation Helper Functions', () => {
  let bodyA: number;
  let bodyB: number;

  beforeEach(() => {
    bodyA = 1;
    bodyB = 2;
  });

  test('createDistanceJoint should create basic joint with default parameters', () => {
    const joint = createDistanceJoint(bodyA, bodyB);

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(ZERO);
    expect(joint.ay).toBe(ZERO);
    expect(joint.bx).toBe(ZERO);
    expect(joint.by).toBe(ZERO);
    expect(joint.rest).toBe(f(-1)); // Auto-initialize
    expect(joint.breakImpulse).toBe(ZERO); // No breaking
    expect(joint.beta).toBe(f(0.2)); // Default Baumgarte
    expect(joint.gamma).toBe(ZERO); // Rigid by default
  });

  test('createDistanceJoint should accept custom anchor points and rest length', () => {
    const joint = createDistanceJoint(
      bodyA,
      bodyB,
      { x: 1.5, y: -0.5 },
      { x: -2.0, y: 1.0 },
      3.5
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(f(1.5));
    expect(joint.ay).toBe(f(-0.5));
    expect(joint.bx).toBe(f(-2.0));
    expect(joint.by).toBe(f(1.0));
    expect(joint.rest).toBe(f(3.5));
  });

  test('createBreakableDistanceJoint should create joint with break impulse', () => {
    const joint = createBreakableDistanceJoint(
      bodyA,
      bodyB,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      2.0,
      15.0
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.rest).toBe(f(2.0));
    expect(joint.breakImpulse).toBe(f(15.0));
    expect(joint.broken).toBe(0); // Initially not broken
  });

  test('createSoftDistanceJoint should create joint with spring parameters', () => {
    const joint = createSoftDistanceJoint(
      bodyA,
      bodyB,
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: -0.5 },
      1.5,
      0.05,
      0.15
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(f(0.5));
    expect(joint.ay).toBe(f(0.5));
    expect(joint.bx).toBe(f(-0.5));
    expect(joint.by).toBe(f(-0.5));
    expect(joint.rest).toBe(f(1.5));
    expect(joint.beta).toBe(f(0.05)); // Custom Baumgarte
    expect(joint.gamma).toBe(f(0.15)); // Soft constraint
  });

  test('helper functions should work with Entity type', () => {
    const entityA = 42 as number; // Simulate Entity type
    const entityB = 84 as number;

    const joint = createDistanceJoint(entityA, entityB);
    expect(joint.a).toBe(entityA);
    expect(joint.b).toBe(entityB);

    const breakableJoint = createBreakableDistanceJoint(entityA, entityB);
    expect(breakableJoint.a).toBe(entityA);
    expect(breakableJoint.b).toBe(entityB);

    const softJoint = createSoftDistanceJoint(entityA, entityB);
    expect(softJoint.a).toBe(entityA);
    expect(softJoint.b).toBe(entityB);
  });
});