/**
 * Tests for RevoluteBatch2D resource
 * RevoluteBatch2D资源测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { RevoluteBatch2D, type RevoluteRow } from '../src/resources/RevoluteBatch2D';
import { f } from '../src/math/fixed';

describe('RevoluteBatch2D Resource', () => {
  let batch: RevoluteBatch2D;

  beforeEach(() => {
    batch = new RevoluteBatch2D();
  });

  test('should initialize with empty list', () => {
    expect(batch.list).toEqual([]);
    expect(batch.count).toBe(0);
  });

  test('should add revolute constraint rows', () => {
    const row1: RevoluteRow = {
      e: 1, a: 2, b: 3,
      rax: f(1.0), ray: f(0.5),
      rbx: f(-1.0), rby: f(-0.5),
      im00: f(2.0), im01: f(0.1), im11: f(1.8),
      biasX: f(0.01), biasY: f(-0.02),
      gamma: f(0.05)
    };

    const row2: RevoluteRow = {
      e: 4, a: 5, b: 6,
      rax: f(0.8), ray: f(-0.3),
      rbx: f(-0.8), rby: f(0.3),
      im00: f(1.5), im01: f(0.2), im11: f(2.1),
      biasX: f(-0.005), biasY: f(0.015),
      gamma: f(0.1)
    };

    batch.addRow(row1);
    expect(batch.count).toBe(1);
    expect(batch.list).toContain(row1);

    batch.addRow(row2);
    expect(batch.count).toBe(2);
    expect(batch.list).toContain(row2);
  });

  test('should clear all rows', () => {
    const row: RevoluteRow = {
      e: 1, a: 2, b: 3,
      rax: f(1.0), ray: f(0.5),
      rbx: f(-1.0), rby: f(-0.5),
      im00: f(2.0), im01: f(0.1), im11: f(1.8),
      biasX: f(0.01), biasY: f(-0.02),
      gamma: f(0.05)
    };

    batch.addRow(row);
    expect(batch.count).toBe(1);

    batch.clear();
    expect(batch.count).toBe(0);
    expect(batch.list).toEqual([]);
  });

  test('should handle multiple constraint rows correctly', () => {
    const rows: RevoluteRow[] = [];

    // Add multiple rows
    for (let i = 0; i < 5; i++) {
      const row: RevoluteRow = {
        e: i + 1, a: i + 10, b: i + 20,
        rax: f(i * 0.1), ray: f(i * 0.2),
        rbx: f(-i * 0.1), rby: f(-i * 0.2),
        im00: f(1.0 + i * 0.1), im01: f(i * 0.05), im11: f(1.0 + i * 0.1),
        biasX: f(i * 0.001), biasY: f(-i * 0.001),
        gamma: f(i * 0.02)
      };
      rows.push(row);
      batch.addRow(row);
    }

    expect(batch.count).toBe(5);

    // Verify all rows are present and in correct order
    for (let i = 0; i < 5; i++) {
      expect(batch.list[i]).toBe(rows[i]);
      expect(batch.list[i].e).toBe(i + 1);
      expect(batch.list[i].a).toBe(i + 10);
      expect(batch.list[i].b).toBe(i + 20);
    }
  });

  test('should support accessing individual row properties', () => {
    const row: RevoluteRow = {
      e: 42, a: 84, b: 126,
      rax: f(2.5), ray: f(-1.5),
      rbx: f(-2.5), rby: f(1.5),
      im00: f(3.0), im01: f(0.5), im11: f(2.8),
      biasX: f(0.1), biasY: f(-0.1),
      gamma: f(0.08)
    };

    batch.addRow(row);

    const addedRow = batch.list[0];
    expect(addedRow.e).toBe(42);
    expect(addedRow.a).toBe(84);
    expect(addedRow.b).toBe(126);
    expect(addedRow.rax).toBe(f(2.5));
    expect(addedRow.ray).toBe(f(-1.5));
    expect(addedRow.rbx).toBe(f(-2.5));
    expect(addedRow.rby).toBe(f(1.5));
    expect(addedRow.im00).toBe(f(3.0));
    expect(addedRow.im01).toBe(f(0.5));
    expect(addedRow.im11).toBe(f(2.8));
    expect(addedRow.biasX).toBe(f(0.1));
    expect(addedRow.biasY).toBe(f(-0.1));
    expect(addedRow.gamma).toBe(f(0.08));
  });

  test('should handle empty batch operations', () => {
    expect(batch.count).toBe(0);

    // Clear empty batch should work
    batch.clear();
    expect(batch.count).toBe(0);

    // List should remain empty
    expect(batch.list).toEqual([]);
  });
});