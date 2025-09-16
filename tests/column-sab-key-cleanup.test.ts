import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnSAB } from '../src/sab/ColumnSAB';

describe('ColumnSAB readToObject key cleanup', () => {
  let column: ColumnSAB;

  beforeEach(() => {
    column = new ColumnSAB({
      fields: { x: 'f32', y: 'f32', id: 'i32' }
    });
  });

  it('should clean up extra keys when reusing output object', () => {
    // Add test data
    column.writeFromObject(0, { x: 10.5, y: 20.5, id: 100 });
    column.writeFromObject(1, { x: 30.5, y: 40.5, id: 200 });

    // Create reusable output object with extra keys
    const reusedOut = { x: 0, y: 0, id: 0, extra: 'should be removed', old: 'data' };

    // Read first object - should clean extra keys and keep relevant ones
    const result1 = column.readToObject(0, reusedOut);

    expect(result1).toBe(reusedOut); // Should return same object
    expect(result1).toEqual({ x: 10.5, y: 20.5, id: 100 }); // Should have only schema fields
    expect('extra' in result1).toBe(false); // Extra key should be removed
    expect('old' in result1).toBe(false); // Extra key should be removed

    // Read second object - should clean any remaining keys and add new ones
    const result2 = column.readToObject(1, reusedOut);

    expect(result2).toBe(reusedOut); // Should return same object
    expect(result2).toEqual({ x: 30.5, y: 40.5, id: 200 }); // Should have new values
  });

  it('should handle empty objects correctly', () => {
    // Add data
    column.writeFromObject(0, { x: 1.0, y: 2.0, id: 42 });

    const reusedOut = { old: 'data', extra: 123, unused: true };

    // Read object - should clean all non-schema keys
    const result = column.readToObject(0, reusedOut);

    expect(result).toBe(reusedOut); // Should return same object
    expect(result).toEqual({ x: 1.0, y: 2.0, id: 42 }); // Should have only schema fields
    expect(Object.keys(result)).toHaveLength(3); // Only x, y, id should remain
  });

  it('should work with boolean fields and key cleanup', () => {
    const boolColumn = new ColumnSAB({
      fields: { active: 'bool', value: 'f32' }
    });

    boolColumn.writeFromObject(0, { active: true, value: 123.5 });

    const reusedOut = { old: 'data', active: false, value: 0, extra: 'remove' };

    const result = boolColumn.readToObject(0, reusedOut);

    expect(result).toBe(reusedOut);
    expect(result).toEqual({ active: true, value: 123.5 });
    expect('old' in result).toBe(false);
    expect('extra' in result).toBe(false);
  });

  it('should preserve object references correctly', () => {
    column.writeFromObject(0, { x: 100.5, y: 200.5, id: 999 });

    const reusedOut = { old: 'data', x: 0, y: 0, id: 0 };

    const result = column.readToObject(0, reusedOut);

    // Should assign properties, not change reference
    expect(result).toBe(reusedOut);
    expect(result.x).toBe(100.5);
    expect(result.y).toBe(200.5);
    expect(result.id).toBe(999);
    expect('old' in result).toBe(false);
  });

  it('should handle out parameter with null or undefined', () => {
    column.writeFromObject(0, { x: 10.5, y: 20.5, id: 42 });

    // Test with undefined out
    const result1 = column.readToObject(0, undefined as any);
    expect(result1).toEqual({ x: 10.5, y: 20.5, id: 42 }); // Should work normally

    // Test without out parameter
    const result2 = column.readToObject(0);
    expect(result2).toEqual({ x: 10.5, y: 20.5, id: 42 }); // Should work normally
  });
});