import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';
import { ColumnSAB } from '../src/sab/ColumnSAB';

describe('Column markWrittenRange functionality', () => {
  describe('ColumnArray markWrittenRange', () => {
    let column: ColumnArray;

    beforeEach(() => {
      column = new ColumnArray();
    });

    it('should mark range of rows with epoch for parallel write-back', () => {
      // Ensure column has capacity for our test
      column.ensureCapacity(10);

      // Mark rows [2, 6) with epoch 100
      column.markWrittenRange(2, 6, 100);

      const epochs = column.getRowEpochs();
      expect(epochs).toBeDefined();

      // Check that rows in range are marked with correct epoch
      expect(epochs![2]).toBe(100);
      expect(epochs![3]).toBe(100);
      expect(epochs![4]).toBe(100);
      expect(epochs![5]).toBe(100);

      // Check that rows outside range are not marked (should be 0)
      expect(epochs![0]).toBe(0);
      expect(epochs![1]).toBe(0);
      expect(epochs![6]).toBe(0);
      expect(epochs![7]).toBe(0);
    });

    it('should auto-expand capacity when marking beyond current size', () => {
      // Initially empty
      expect(column.getRowEpochs()!.length).toBe(0);

      // Mark a range that requires expansion
      column.markWrittenRange(5, 10, 200);

      const epochs = column.getRowEpochs();
      expect(epochs!.length).toBeGreaterThanOrEqual(10);

      // Check marked range
      for (let i = 5; i < 10; i++) {
        expect(epochs![i]).toBe(200);
      }
    });

    it('should handle overlapping markWrittenRange calls', () => {
      column.ensureCapacity(15);

      // Mark first range
      column.markWrittenRange(0, 5, 100);

      // Mark overlapping range with different epoch
      column.markWrittenRange(3, 8, 200);

      const epochs = column.getRowEpochs();

      // Check first part keeps original epoch
      expect(epochs![0]).toBe(100);
      expect(epochs![1]).toBe(100);
      expect(epochs![2]).toBe(100);

      // Check overlapping part has newer epoch
      expect(epochs![3]).toBe(200);
      expect(epochs![4]).toBe(200);

      // Check second part has newer epoch
      expect(epochs![5]).toBe(200);
      expect(epochs![6]).toBe(200);
      expect(epochs![7]).toBe(200);

      // Check untouched areas
      expect(epochs![8]).toBe(0);
    });

    it('should handle zero-length ranges gracefully', () => {
      column.ensureCapacity(5);

      // Mark zero-length range (should be no-op)
      column.markWrittenRange(3, 3, 100);

      const epochs = column.getRowEpochs();
      for (let i = 0; i < 5; i++) {
        expect(epochs![i]).toBe(0);
      }
    });

    it('should use unsigned 32-bit epoch values', () => {
      column.ensureCapacity(5);

      // Test with large epoch value (should be handled as unsigned)
      const largeEpoch = 0xFFFFFFFF;
      column.markWrittenRange(0, 3, largeEpoch);

      const epochs = column.getRowEpochs();
      expect(epochs![0]).toBe(0xFFFFFFFF);
      expect(epochs![1]).toBe(0xFFFFFFFF);
      expect(epochs![2]).toBe(0xFFFFFFFF);
    });
  });

  describe('ColumnSAB markWrittenRange', () => {
    let column: ColumnSAB;

    beforeEach(() => {
      column = new ColumnSAB({
        fields: { x: 'f32', y: 'f32' }
      });
    });

    it('should mark write mask bits for range', () => {
      // Mark rows [1, 5)
      column.markWrittenRange(1, 5, 100); // epoch is ignored for SAB

      const writeMask = column.getWriteMask();
      expect(writeMask).toBeDefined();

      // Check that bits 1-4 are set
      expect((writeMask![0] >> 1) & 1).toBe(1); // bit 1
      expect((writeMask![0] >> 2) & 1).toBe(1); // bit 2
      expect((writeMask![0] >> 3) & 1).toBe(1); // bit 3
      expect((writeMask![0] >> 4) & 1).toBe(1); // bit 4

      // Check that bit 0 and 5+ are not set
      expect(writeMask![0] & 1).toBe(0); // bit 0
      expect((writeMask![0] >> 5) & 1).toBe(0); // bit 5
    });

    it('should handle cross-byte boundaries', () => {
      // Mark range that crosses byte boundary (bits 6-10)
      column.markWrittenRange(6, 11, 100);

      const writeMask = column.getWriteMask();
      expect(writeMask).toBeDefined();

      // Check bits 6-7 in first byte
      expect((writeMask![0] >> 6) & 1).toBe(1);
      expect((writeMask![0] >> 7) & 1).toBe(1);

      // Check bits 0-2 in second byte (rows 8-10)
      expect(writeMask![1] & 1).toBe(1); // bit 0 (row 8)
      expect((writeMask![1] >> 1) & 1).toBe(1); // bit 1 (row 9)
      expect((writeMask![1] >> 2) & 1).toBe(1); // bit 2 (row 10)

      // Check that other bits are not set
      expect((writeMask![1] >> 3) & 1).toBe(0); // bit 3 (row 11)
    });

    it('should work correctly when writeMask is not initialized', () => {
      // Create a column that might not have writeMask initialized
      const columnNoMask = new ColumnSAB({
        fields: { value: 'i32' }
      });

      // This should not crash even if writeMask is not initialized
      expect(() => {
        columnNoMask.markWrittenRange(0, 5, 100);
      }).not.toThrow();
    });

    it('should combine with previous writes', () => {
      // Set some individual bits first
      column.writeFromObject(0, { x: 1.0, y: 2.0 });
      column.writeFromObject(10, { x: 3.0, y: 4.0 });

      // Mark additional range
      column.markWrittenRange(2, 6, 100);

      const writeMask = column.getWriteMask();
      expect(writeMask).toBeDefined();

      // Check individual writes are preserved
      expect(writeMask![0] & 1).toBe(1); // bit 0 (individual write)
      expect((writeMask![1] >> 2) & 1).toBe(1); // bit 2 of byte 1 (row 10)

      // Check range writes
      expect((writeMask![0] >> 2) & 1).toBe(1); // bit 2
      expect((writeMask![0] >> 3) & 1).toBe(1); // bit 3
      expect((writeMask![0] >> 4) & 1).toBe(1); // bit 4
      expect((writeMask![0] >> 5) & 1).toBe(1); // bit 5
    });
  });
});