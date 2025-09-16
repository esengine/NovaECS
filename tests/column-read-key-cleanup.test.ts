import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';

describe('ColumnArray readToObject key cleanup', () => {
  let column: ColumnArray;

  beforeEach(() => {
    column = new ColumnArray();
  });

  it('should clean up extra keys when reusing output object', () => {
    // Add test data
    column.writeFromObject(0, { x: 10, y: 20 });
    column.writeFromObject(1, { a: 1, b: 2, c: 3 });

    // Create reusable output object with extra keys
    const reusedOut = { x: 0, y: 0, z: 999, extra: 'should be removed' };

    // Read first object - should clean extra keys and keep relevant ones
    const result1 = column.readToObject(0, reusedOut);

    expect(result1).toBe(reusedOut); // Should return same object
    expect(result1).toEqual({ x: 10, y: 20 }); // Should have only source keys
    expect('z' in result1).toBe(false); // Extra key should be removed
    expect('extra' in result1).toBe(false); // Extra key should be removed

    // Read second object - should clean previous keys and add new ones
    const result2 = column.readToObject(1, reusedOut);

    expect(result2).toBe(reusedOut); // Should return same object
    expect(result2).toEqual({ a: 1, b: 2, c: 3 }); // Should have only new keys
    expect('x' in result2).toBe(false); // Previous key should be removed
    expect('y' in result2).toBe(false); // Previous key should be removed
  });

  it('should handle primitive values correctly', () => {
    // Add primitive data
    column.writeFromObject(0, 42);
    column.writeFromObject(1, 'hello');

    const reusedOut = { old: 'data', x: 1 };

    // Read primitive - should return the primitive directly, not modify out
    const result1 = column.readToObject(0, reusedOut);
    expect(result1).toBe(42);
    expect(reusedOut).toEqual({ old: 'data', x: 1 }); // Should remain unchanged

    const result2 = column.readToObject(1, reusedOut);
    expect(result2).toBe('hello');
    expect(reusedOut).toEqual({ old: 'data', x: 1 }); // Should remain unchanged
  });

  it('should handle null and undefined src values', () => {
    // Add null/undefined data
    column.writeFromObject(0, null);
    column.writeFromObject(1, undefined);

    const reusedOut = { old: 'data', x: 1 };

    // Read null - should return null directly
    const result1 = column.readToObject(0, reusedOut);
    expect(result1).toBe(null);
    expect(reusedOut).toEqual({ old: 'data', x: 1 }); // Should remain unchanged

    // Read undefined - should return undefined directly
    const result2 = column.readToObject(1, reusedOut);
    expect(result2).toBe(undefined);
    expect(reusedOut).toEqual({ old: 'data', x: 1 }); // Should remain unchanged
  });

  it('should handle empty objects correctly', () => {
    // Add empty object
    column.writeFromObject(0, {});

    const reusedOut = { old: 'data', x: 1, y: 2 };

    // Read empty object - should clean all keys from out
    const result = column.readToObject(0, reusedOut);

    expect(result).toBe(reusedOut); // Should return same object
    expect(result).toEqual({}); // Should be empty
    expect(Object.keys(result)).toHaveLength(0); // No keys should remain
  });

  it('should work with nested objects', () => {
    // Add nested object data
    column.writeFromObject(0, {
      position: { x: 10, y: 20 },
      velocity: { dx: 1, dy: 2 },
      health: 100
    });

    const reusedOut = {
      old: 'data',
      position: { x: 0, y: 0, z: 0 }, // Extra z should be removed by Object.assign
      health: 0
    };

    // Read nested object
    const result = column.readToObject(0, reusedOut);

    expect(result).toBe(reusedOut);
    expect(result.position).toEqual({ x: 10, y: 20 }); // Object.assign replaces entirely
    expect(result.velocity).toEqual({ dx: 1, dy: 2 });
    expect(result.health).toBe(100);
    expect('old' in result).toBe(false); // Old key should be cleaned
  });

  it('should preserve object references correctly', () => {
    const sharedData = { x: 100, y: 200 };
    column.writeFromObject(0, sharedData);

    const reusedOut = { old: 'data' };

    const result = column.readToObject(0, reusedOut);

    // Should assign properties, not change reference
    expect(result).toBe(reusedOut);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect('old' in result).toBe(false);

    // Original data should be unchanged
    expect(sharedData).toEqual({ x: 100, y: 200 });
  });

  it('should handle out parameter with null or undefined', () => {
    column.writeFromObject(0, { x: 10, y: 20 });

    // Test with null out
    const result1 = column.readToObject(0, null);
    expect(result1).toEqual({ x: 10, y: 20 }); // Should work normally

    // Test with undefined out
    const result2 = column.readToObject(0, undefined);
    expect(result2).toEqual({ x: 10, y: 20 }); // Should work normally

    // Test without out parameter
    const result3 = column.readToObject(0);
    expect(result3).toEqual({ x: 10, y: 20 }); // Should work normally
  });
});