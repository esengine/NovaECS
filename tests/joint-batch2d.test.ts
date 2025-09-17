/**
 * Tests for JointBatch2D resource
 * JointBatch2D资源测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { JointBatch2D } from '../src/resources/JointBatch2D';
import type { JointRow } from '../src/resources/JointBatch2D';
import { f, ZERO, ONE } from '../src/math/fixed';

describe('JointBatch2D Resource', () => {
  let batch: JointBatch2D;
  let sampleRow: JointRow;

  beforeEach(() => {
    batch = new JointBatch2D();

    sampleRow = {
      e: 1,
      a: 2,
      b: 3,
      rax: f(0.5),
      ray: f(0.0),
      rbx: f(-0.5),
      rby: f(0.0),
      nx: ONE,
      ny: ZERO,
      rest: f(2.0),
      mN: f(0.5),
      bias: f(0.1),
      gamma: ZERO,
      breakImpulse: ZERO,
      broken: 0
    };
  });

  test('should initialize with empty list', () => {
    expect(batch.list).toEqual([]);
    expect(batch.count).toBe(0);
  });

  test('should add joint rows', () => {
    batch.addRow(sampleRow);

    expect(batch.list).toHaveLength(1);
    expect(batch.count).toBe(1);
    expect(batch.list[0]).toEqual(sampleRow);
  });

  test('should add multiple joint rows', () => {
    const row2: JointRow = {
      ...sampleRow,
      e: 4,
      a: 5,
      b: 6,
      rest: f(3.0)
    };

    batch.addRow(sampleRow);
    batch.addRow(row2);

    expect(batch.count).toBe(2);
    expect(batch.list[0].e).toBe(1);
    expect(batch.list[1].e).toBe(4);
    expect(batch.list[0].rest).toBe(f(2.0));
    expect(batch.list[1].rest).toBe(f(3.0));
  });

  test('should clear all joint rows', () => {
    batch.addRow(sampleRow);
    batch.addRow(sampleRow);

    expect(batch.count).toBe(2);

    batch.clear();

    expect(batch.list).toEqual([]);
    expect(batch.count).toBe(0);
  });

  test('should support different joint configurations', () => {
    // Basic rigid joint
    const rigidJoint: JointRow = {
      e: 1,
      a: 2,
      b: 3,
      rax: ZERO,
      ray: ZERO,
      rbx: ZERO,
      rby: ZERO,
      nx: ONE,
      ny: ZERO,
      rest: f(1.0),
      mN: ONE,
      bias: ZERO,
      gamma: ZERO,
      breakImpulse: ZERO,
      broken: 0
    };

    // Soft springy joint
    const softJoint: JointRow = {
      e: 4,
      a: 5,
      b: 6,
      rax: f(0.5),
      ray: f(0.5),
      rbx: f(-0.5),
      rby: f(-0.5),
      nx: f(0.707),
      ny: f(0.707),
      rest: f(1.414),
      mN: f(0.8),
      bias: f(0.05),
      gamma: f(0.1),
      breakImpulse: ZERO,
      broken: 0
    };

    // Breakable joint
    const breakableJoint: JointRow = {
      e: 7,
      a: 8,
      b: 9,
      rax: ZERO,
      ray: ZERO,
      rbx: ZERO,
      rby: ZERO,
      nx: ZERO,
      ny: ONE,
      rest: f(2.0),
      mN: f(0.6),
      bias: f(0.2),
      gamma: ZERO,
      breakImpulse: f(10.0),
      broken: 0
    };

    batch.addRow(rigidJoint);
    batch.addRow(softJoint);
    batch.addRow(breakableJoint);

    expect(batch.count).toBe(3);

    // Verify rigid joint
    expect(batch.list[0].gamma).toBe(ZERO);
    expect(batch.list[0].breakImpulse).toBe(ZERO);

    // Verify soft joint
    expect(batch.list[1].gamma).toBe(f(0.1));
    expect(batch.list[1].bias).toBe(f(0.05));

    // Verify breakable joint
    expect(batch.list[2].breakImpulse).toBe(f(10.0));
    expect(batch.list[2].broken).toBe(0);
  });

  test('should handle broken joint status', () => {
    const brokenJoint: JointRow = {
      ...sampleRow,
      broken: 1,
      breakImpulse: f(5.0)
    };

    batch.addRow(brokenJoint);

    expect(batch.list[0].broken).toBe(1);
    expect(batch.list[0].breakImpulse).toBe(f(5.0));
  });

  test('should support anchor point offsets', () => {
    const offsetJoint: JointRow = {
      ...sampleRow,
      rax: f(1.0),
      ray: f(0.5),
      rbx: f(-0.8),
      rby: f(-0.3)
    };

    batch.addRow(offsetJoint);

    const joint = batch.list[0];
    expect(joint.rax).toBe(f(1.0));
    expect(joint.ray).toBe(f(0.5));
    expect(joint.rbx).toBe(f(-0.8));
    expect(joint.rby).toBe(f(-0.3));
  });

  test('should store constraint direction vectors', () => {
    const diagonalJoint: JointRow = {
      ...sampleRow,
      nx: f(0.6),
      ny: f(0.8)  // Normalized direction vector
    };

    batch.addRow(diagonalJoint);

    const joint = batch.list[0];
    expect(joint.nx).toBe(f(0.6));
    expect(joint.ny).toBe(f(0.8));
  });

  test('should store pre-computed effective mass', () => {
    const heavyMassJoint: JointRow = {
      ...sampleRow,
      mN: f(2.0)  // High effective mass
    };

    const lightMassJoint: JointRow = {
      ...sampleRow,
      e: 10,
      mN: f(0.1)  // Low effective mass
    };

    batch.addRow(heavyMassJoint);
    batch.addRow(lightMassJoint);

    expect(batch.list[0].mN).toBe(f(2.0));
    expect(batch.list[1].mN).toBe(f(0.1));
  });

  test('should store Baumgarte bias for position correction', () => {
    const highBiasJoint: JointRow = {
      ...sampleRow,
      bias: f(0.5)  // Strong position correction
    };

    const lowBiasJoint: JointRow = {
      ...sampleRow,
      e: 11,
      bias: f(0.01)  // Weak position correction
    };

    batch.addRow(highBiasJoint);
    batch.addRow(lowBiasJoint);

    expect(batch.list[0].bias).toBe(f(0.5));
    expect(batch.list[1].bias).toBe(f(0.01));
  });

  test('should reserve capacity efficiently', () => {
    // Initial state
    expect(batch.list.length).toBe(0);

    // Reserve capacity but keep empty
    batch.reserve(10);
    expect(batch.count).toBe(0); // Still empty

    // Add some items
    batch.addRow(sampleRow);
    batch.addRow(sampleRow);
    expect(batch.count).toBe(2);

    // Reserve smaller capacity should not affect current items
    batch.reserve(1);
    expect(batch.count).toBe(2);
  });

  test('should maintain order of joint rows', () => {
    const joints: JointRow[] = [];

    // Create 5 joints with different entity IDs
    for (let i = 0; i < 5; i++) {
      joints.push({
        ...sampleRow,
        e: i + 10,
        rest: f(i + 1)
      });
    }

    // Add in order
    for (const joint of joints) {
      batch.addRow(joint);
    }

    // Verify order is maintained
    for (let i = 0; i < 5; i++) {
      expect(batch.list[i].e).toBe(i + 10);
      expect(batch.list[i].rest).toBe(f(i + 1));
    }
  });
});