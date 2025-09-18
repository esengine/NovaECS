/**
 * Tests for RevoluteJoint2D component
 * RevoluteJoint2D组件测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  RevoluteJoint2D,
  createRevoluteJoint,
  createBreakableRevoluteJoint,
  createSoftRevoluteJoint
} from '../src/components/RevoluteJoint2D';
import { f, ZERO } from '../src/math/fixed';

describe('RevoluteJoint2D Component', () => {
  let joint: RevoluteJoint2D;

  beforeEach(() => {
    joint = new RevoluteJoint2D();
  });

  test('should initialize with default values', () => {
    expect(joint.ax).toBe(ZERO);
    expect(joint.ay).toBe(ZERO);
    expect(joint.bx).toBe(ZERO);
    expect(joint.by).toBe(ZERO);
    expect(joint.beta).toBe(f(0.2));
    expect(joint.gamma).toBe(ZERO);
    expect(joint.jx).toBe(ZERO);
    expect(joint.jy).toBe(ZERO);
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

  test('should allow setting constraint parameters', () => {
    joint.beta = f(0.1);
    joint.gamma = f(0.05);

    expect(joint.beta).toBe(f(0.1));
    expect(joint.gamma).toBe(f(0.05));
  });

  test('should support warm-start impulse accumulation', () => {
    joint.jx = f(0.5);
    joint.jy = f(-0.3);

    expect(joint.jx).toBe(f(0.5));
    expect(joint.jy).toBe(f(-0.3));
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

describe('Joint Creation Helper Functions', () => {
  let bodyA: number;
  let bodyB: number;

  beforeEach(() => {
    bodyA = 1;
    bodyB = 2;
  });

  test('createRevoluteJoint should create basic joint with default parameters', () => {
    const joint = createRevoluteJoint(bodyA, bodyB);

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(ZERO);
    expect(joint.ay).toBe(ZERO);
    expect(joint.bx).toBe(ZERO);
    expect(joint.by).toBe(ZERO);
    expect(joint.breakImpulse).toBe(ZERO); // No breaking
    expect(joint.beta).toBe(f(0.2)); // Default Baumgarte
    expect(joint.gamma).toBe(ZERO); // Rigid by default
  });

  test('createRevoluteJoint should accept custom anchor points', () => {
    const joint = createRevoluteJoint(
      bodyA,
      bodyB,
      { x: 1.5, y: -0.5 },
      { x: -2.0, y: 1.0 }
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(f(1.5));
    expect(joint.ay).toBe(f(-0.5));
    expect(joint.bx).toBe(f(-2.0));
    expect(joint.by).toBe(f(1.0));
  });

  test('createBreakableRevoluteJoint should create joint with break impulse', () => {
    const joint = createBreakableRevoluteJoint(
      bodyA,
      bodyB,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      15.0
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.breakImpulse).toBe(f(15.0));
    expect(joint.broken).toBe(0); // Initially not broken
  });

  test('createSoftRevoluteJoint should create joint with spring parameters', () => {
    const joint = createSoftRevoluteJoint(
      bodyA,
      bodyB,
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: -0.5 },
      0.05,
      0.15
    );

    expect(joint.a).toBe(bodyA);
    expect(joint.b).toBe(bodyB);
    expect(joint.ax).toBe(f(0.5));
    expect(joint.ay).toBe(f(0.5));
    expect(joint.bx).toBe(f(-0.5));
    expect(joint.by).toBe(f(-0.5));
    expect(joint.beta).toBe(f(0.05)); // Custom Baumgarte
    expect(joint.gamma).toBe(f(0.15)); // Soft constraint
  });

  test('helper functions should work with Entity type', () => {
    const entityA = 42 as number; // Simulate Entity type
    const entityB = 84 as number;

    const joint = createRevoluteJoint(entityA, entityB);
    expect(joint.a).toBe(entityA);
    expect(joint.b).toBe(entityB);

    const breakableJoint = createBreakableRevoluteJoint(entityA, entityB);
    expect(breakableJoint.a).toBe(entityA);
    expect(breakableJoint.b).toBe(entityB);

    const softJoint = createSoftRevoluteJoint(entityA, entityB);
    expect(softJoint.a).toBe(entityA);
    expect(softJoint.b).toBe(entityB);
  });
});