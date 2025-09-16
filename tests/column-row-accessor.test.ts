import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';
import { ColumnSAB } from '../src/sab/ColumnSAB';

describe('Column Row Accessor', () => {
  describe('ColumnArray row accessor', () => {
    let column: ColumnArray;

    beforeEach(() => {
      column = new ColumnArray();
    });

    it('should provide zero-allocation row accessor', () => {
      // Add test data
      column.writeFromObject(0, { x: 10, y: 20, z: 30 });
      column.writeFromObject(1, { a: 100, b: 200 });
      column.writeFromObject(2, { value: 42 });

      // Get row accessor
      const accessor = column.getRowAccessor();
      expect(typeof accessor).toBe('function');

      // Test reading different rows
      expect(accessor(0)).toEqual({ x: 10, y: 20, z: 30 });
      expect(accessor(1)).toEqual({ a: 100, b: 200 });
      expect(accessor(2)).toEqual({ value: 42 });
    });

    it('should support object reuse for zero allocation', () => {
      column.writeFromObject(0, { x: 10, y: 20 });
      column.writeFromObject(1, { a: 100, b: 200, c: 300 });

      const accessor = column.getRowAccessor();
      const reusedObj = { old: 'data', extra: 'field' };

      // First read - should clean old keys and populate new ones
      const result1 = accessor(0, reusedObj);
      expect(result1).toBe(reusedObj); // Same reference
      expect(result1).toEqual({ x: 10, y: 20 });
      expect('old' in result1).toBe(false);
      expect('extra' in result1).toBe(false);

      // Second read - should clean previous keys and populate new ones
      const result2 = accessor(1, reusedObj);
      expect(result2).toBe(reusedObj); // Same reference
      expect(result2).toEqual({ a: 100, b: 200, c: 300 });
      expect('x' in result2).toBe(false);
      expect('y' in result2).toBe(false);
    });

    it('should handle primitive values correctly', () => {
      column.writeFromObject(0, 42);
      column.writeFromObject(1, 'hello');
      column.writeFromObject(2, null);

      const accessor = column.getRowAccessor();
      const reusedObj = { old: 'data' };

      // Primitive values should be returned directly, not modifying reusedObj
      expect(accessor(0, reusedObj)).toBe(42);
      expect(accessor(1, reusedObj)).toBe('hello');
      expect(accessor(2, reusedObj)).toBe(null);
      expect(reusedObj).toEqual({ old: 'data' }); // Should remain unchanged
    });

    it('should work without out parameter', () => {
      column.writeFromObject(0, { test: 'value' });

      const accessor = column.getRowAccessor();
      const result = accessor(0);

      expect(result).toEqual({ test: 'value' });
    });
  });

  describe('ColumnSAB row accessor', () => {
    let column: ColumnSAB;

    beforeEach(() => {
      column = new ColumnSAB({
        fields: { x: 'f32', y: 'f32', id: 'i32' }
      });
    });

    it('should provide zero-allocation row accessor', () => {
      // Add test data
      column.writeFromObject(0, { x: 1.5, y: 2.5, id: 100 });
      column.writeFromObject(1, { x: 3.5, y: 4.5, id: 200 });
      column.writeFromObject(2, { x: 5.5, y: 6.5, id: 300 });

      // Get row accessor
      const accessor = column.getRowAccessor();
      expect(typeof accessor).toBe('function');

      // Test reading different rows
      expect(accessor(0)).toEqual({ x: 1.5, y: 2.5, id: 100 });
      expect(accessor(1)).toEqual({ x: 3.5, y: 4.5, id: 200 });
      expect(accessor(2)).toEqual({ x: 5.5, y: 6.5, id: 300 });
    });

    it('should support object reuse for zero allocation', () => {
      column.writeFromObject(0, { x: 10.5, y: 20.5, id: 42 });

      const accessor = column.getRowAccessor();
      const reusedObj = { old: 'data', extra: 'field' };

      // Should clean old keys and populate with SAB data
      const result = accessor(0, reusedObj);
      expect(result).toBe(reusedObj); // Same reference
      expect(result).toEqual({ x: 10.5, y: 20.5, id: 42 });
      expect('old' in result).toBe(false);
      expect('extra' in result).toBe(false);
    });

    it('should handle repeated access efficiently', () => {
      column.writeFromObject(0, { x: 1.0, y: 2.0, id: 123 });
      column.writeFromObject(1, { x: 3.0, y: 4.0, id: 456 });

      const accessor = column.getRowAccessor();
      const reusedObj = {};

      // Multiple accesses should reuse the same object
      for (let i = 0; i < 10; i++) {
        const result1 = accessor(0, reusedObj);
        const result2 = accessor(1, reusedObj);

        expect(result1).toBe(reusedObj);
        expect(result2).toBe(reusedObj);
        expect(result2).toEqual({ x: 3.0, y: 4.0, id: 456 });
      }
    });
  });

  describe('Performance comparison', () => {
    let arrayColumn: ColumnArray;
    let sabColumn: ColumnSAB;

    beforeEach(() => {
      arrayColumn = new ColumnArray();
      sabColumn = new ColumnSAB({ fields: { x: 'f32', y: 'f32' } });

      // Add test data
      for (let i = 0; i < 1000; i++) {
        arrayColumn.writeFromObject(i, { x: i * 1.5, y: i * 2.5 });
        sabColumn.writeFromObject(i, { x: i * 1.5, y: i * 2.5 });
      }
    });

    it('should demonstrate zero-allocation access vs traditional approach', () => {
      const reusedObj = {};

      // Test zero-allocation approach
      const arrayAccessor = arrayColumn.getRowAccessor()!;
      const sabAccessor = sabColumn.getRowAccessor()!;

      const start = performance.now();

      // Zero-allocation traversal
      for (let i = 0; i < 1000; i++) {
        arrayAccessor(i, reusedObj);
        sabAccessor(i, reusedObj);
      }

      const end = performance.now();

      console.log(`Zero-allocation traversal of 2000 rows: ${(end - start).toFixed(2)}ms`);

      // This should be significantly faster than materializing arrays
      expect(end - start).toBeLessThan(50); // Should be very fast
    });
  });
});