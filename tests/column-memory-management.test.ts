import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';

describe('Column Memory Management', () => {
  let column: ColumnArray;

  beforeEach(() => {
    column = new ColumnArray();
  });

  describe('swapRemove memory management', () => {
    it('should release reference when removing last element', () => {
      // Add some data
      const largeObject = { data: new Array(1000).fill('test') };
      column.writeFromObject(0, largeObject);
      column.writeFromObject(1, { small: 'data' });

      expect(column.length()).toBe(2);
      expect(column.readToObject(0)).toStrictEqual(largeObject);

      // Remove the first element (will swap with last, then remove last position)
      column.swapRemove(0);

      expect(column.length()).toBe(1);
      expect(column.readToObject(0)).toEqual({ small: 'data' }); // Last element moved to position 0

      // The original last position should be undefined to release reference
      const data = (column as any).data;
      expect(data[1]).toBeUndefined();
    });

    it('should handle removing middle element correctly', () => {
      column.writeFromObject(0, { a: 1 });
      column.writeFromObject(1, { b: 2 });
      column.writeFromObject(2, { c: 3 });

      expect(column.length()).toBe(3);

      // Remove middle element
      column.swapRemove(1);

      expect(column.length()).toBe(2);
      expect(column.readToObject(0)).toEqual({ a: 1 });
      expect(column.readToObject(1)).toEqual({ c: 3 }); // Last element moved to position 1

      // Position 2 should be undefined
      const data = (column as any).data;
      expect(data[2]).toBeUndefined();
    });

    it('should handle removing last element correctly', () => {
      column.writeFromObject(0, { a: 1 });
      column.writeFromObject(1, { b: 2 });

      expect(column.length()).toBe(2);

      // Remove last element
      column.swapRemove(1);

      expect(column.length()).toBe(1);
      expect(column.readToObject(0)).toEqual({ a: 1 });

      // Position 1 should be undefined
      const data = (column as any).data;
      expect(data[1]).toBeUndefined();
    });

    it('should handle removing only element correctly', () => {
      const testObject = { single: 'element' };
      column.writeFromObject(0, testObject);

      expect(column.length()).toBe(1);

      // Remove the only element
      column.swapRemove(0);

      expect(column.length()).toBe(0);

      // Position 0 should be undefined
      const data = (column as any).data;
      expect(data[0]).toBeUndefined();
    });

    it('should handle out-of-bounds removal gracefully', () => {
      column.writeFromObject(0, { a: 1 });
      column.writeFromObject(1, { b: 2 });

      expect(column.length()).toBe(2);

      // Try to remove invalid indices
      column.swapRemove(-1);
      column.swapRemove(2);
      column.swapRemove(10);

      // Length should remain unchanged
      expect(column.length()).toBe(2);
      expect(column.readToObject(0)).toEqual({ a: 1 });
      expect(column.readToObject(1)).toEqual({ b: 2 });
    });

    it('should preserve row epochs correctly during swap', () => {
      // Write with epochs
      column.writeFromObject(0, { a: 1 }, 100);
      column.writeFromObject(1, { b: 2 }, 200);
      column.writeFromObject(2, { c: 3 }, 300);

      const epochs = column.getRowEpochs();
      expect(epochs![0]).toBe(100);
      expect(epochs![1]).toBe(200);
      expect(epochs![2]).toBe(300);

      // Remove middle element (swap with last)
      column.swapRemove(1);

      expect(column.length()).toBe(2);
      expect(column.readToObject(0)).toEqual({ a: 1 });
      expect(column.readToObject(1)).toEqual({ c: 3 }); // Last moved to middle

      // Check epochs were swapped correctly
      expect(epochs![0]).toBe(100); // Unchanged
      expect(epochs![1]).toBe(300); // Last epoch moved to position 1
    });

    it('should handle multiple removals correctly', () => {
      // Add multiple elements
      for (let i = 0; i < 5; i++) {
        column.writeFromObject(i, { value: i });
      }

      expect(column.length()).toBe(5);

      // Remove elements one by one from the end
      column.swapRemove(4); // Remove last
      expect(column.length()).toBe(4);

      column.swapRemove(3); // Remove new last
      expect(column.length()).toBe(3);

      column.swapRemove(2); // Remove new last
      expect(column.length()).toBe(2);

      // Verify remaining elements
      expect(column.readToObject(0)).toEqual({ value: 0 });
      expect(column.readToObject(1)).toEqual({ value: 1 });

      // Verify released positions are undefined
      const data = (column as any).data;
      expect(data[2]).toBeUndefined();
      expect(data[3]).toBeUndefined();
      expect(data[4]).toBeUndefined();
    });
  });
});