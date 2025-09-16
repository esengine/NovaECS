import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';
import { ColumnSAB } from '../src/sab/ColumnSAB';
import { ColumnType } from '../src/storage/IColumn';
import type { IColumn } from '../src/storage/IColumn';

describe('Column Compaction API', () => {
  describe('ColumnArray compaction', () => {
    let column: ColumnArray;

    beforeEach(() => {
      column = new ColumnArray();
    });

    it('should have correct columnType', () => {
      expect(column.columnType).toBe(ColumnType.ARRAY);
    });

    it('should spawn like column with specified capacity', () => {
      const newColumn = column.spawnLike(100) as ColumnArray;

      expect(newColumn).toBeInstanceOf(ColumnArray);
      expect(newColumn.columnType).toBe(ColumnType.ARRAY);
      expect(newColumn.capacity()).toBeGreaterThanOrEqual(100);
      expect(newColumn.length()).toBe(0);
    });

    it('should copy range to another ColumnArray', () => {
      // Add some test data
      column.writeFromObject(0, { x: 10, y: 20 });
      column.writeFromObject(1, { x: 30, y: 40 });
      column.writeFromObject(2, { x: 50, y: 60 });

      expect(column.length()).toBe(3);

      const dst = column.spawnLike(10) as ColumnArray;
      expect(dst.length()).toBe(0); // Initially empty

      column.copyRangeTo(dst, 2);

      expect(dst.length()).toBe(2); // Length should be set correctly
      expect(dst.readToObject(0)).toEqual({ x: 10, y: 20 });
      expect(dst.readToObject(1)).toEqual({ x: 30, y: 40 });
    });

    it('should provide bytes per row estimate', () => {
      const bytesPerRow = column.bytesPerRow();
      expect(bytesPerRow).toBeGreaterThan(0);
      expect(typeof bytesPerRow).toBe('number');
    });

    it('should use generic path when copying to different column type', () => {
      // Add test data to ColumnArray
      column.writeFromObject(0, { x: 10, y: 20 });
      column.writeFromObject(1, { x: 30, y: 40 });

      const sabColumn = new ColumnSAB({
        fields: { x: 'f32', y: 'f32' }
      });

      // Should use generic path (writeFromObject) instead of throwing
      column.copyRangeTo(sabColumn, 2);

      expect(sabColumn.length()).toBe(2);
      expect(sabColumn.readToObject(0)).toEqual({ x: 10, y: 20 });
      expect(sabColumn.readToObject(1)).toEqual({ x: 30, y: 40 });
    });
  });

  describe('ColumnSAB compaction', () => {
    let column: ColumnSAB;

    beforeEach(() => {
      column = new ColumnSAB({
        fields: { x: 'f32', y: 'f32', hp: 'i32' }
      });
    });

    it('should have correct columnType', () => {
      expect(column.columnType).toBe(ColumnType.SAB);
    });

    it('should spawn like column with same schema', () => {
      const newColumn = column.spawnLike(50) as ColumnSAB;

      expect(newColumn).toBeInstanceOf(ColumnSAB);
      expect(newColumn.columnType).toBe(ColumnType.SAB);
      expect(newColumn.capacity()).toBeGreaterThanOrEqual(50);
      expect(newColumn.length()).toBe(0);

      // Should have same field structure
      const originalFields = column.getFieldNames?.() || [];
      const newFields = newColumn.getFieldNames?.() || [];
      expect(newFields).toEqual(originalFields);
    });

    it('should copy range using TypedArray operations', () => {
      // Add test data
      column.writeFromObject(0, { x: 1.5, y: 2.5, hp: 100 });
      column.writeFromObject(1, { x: 3.5, y: 4.5, hp: 200 });
      column.writeFromObject(2, { x: 5.5, y: 6.5, hp: 300 });

      expect(column.length()).toBe(3);

      const dst = column.spawnLike(10) as ColumnSAB;
      expect(dst.length()).toBe(0); // Initially empty

      column.copyRangeTo(dst, 2);

      expect(dst.length()).toBe(2); // Length should be set correctly
      expect(dst.readToObject(0)).toEqual({ x: 1.5, y: 2.5, hp: 100 });
      expect(dst.readToObject(1)).toEqual({ x: 3.5, y: 4.5, hp: 200 });
    });

    it('should calculate accurate bytes per row', () => {
      const bytesPerRow = column.bytesPerRow();

      // f32 (4 bytes) + f32 (4 bytes) + i32 (4 bytes) + write mask (0.125 bytes)
      const expectedBytes = 4 + 4 + 4 + 0.125;
      expect(bytesPerRow).toBeCloseTo(expectedBytes, 3);
    });

    it('should copy write mask when available', () => {
      // Write to some rows to set write mask
      column.writeFromObject(0, { x: 1.0, y: 2.0, hp: 100 });
      column.writeFromObject(2, { x: 3.0, y: 4.0, hp: 200 });

      const dst = column.spawnLike(10) as ColumnSAB;
      column.copyRangeTo(dst, 3);

      // Both columns should have similar write mask patterns
      const srcMask = column.getWriteMask();
      const dstMask = dst.getWriteMask();

      if (srcMask && dstMask) {
        expect(dstMask[0]).toBe(srcMask[0]); // First byte should match
      }
    });

    it('should use generic path when copying to different column type', () => {
      // Add test data to ColumnSAB
      column.writeFromObject(0, { x: 1.5, y: 2.5, hp: 100 });

      const arrayColumn = new ColumnArray();

      // Should use generic path (writeFromObject) instead of throwing
      column.copyRangeTo(arrayColumn, 1);

      expect(arrayColumn.length()).toBe(1);
      expect(arrayColumn.readToObject(0)).toEqual({ x: 1.5, y: 2.5, hp: 100 });
    });
  });

  describe('Cross-type operations', () => {
    it('should allow copying between different column types using generic path', () => {
      const arrayColumn = new ColumnArray();
      const sabColumn = new ColumnSAB({ fields: { x: 'f32' } });

      // Add data to array column
      arrayColumn.writeFromObject(0, { x: 42.5 });

      // Should use generic path for cross-type copy
      arrayColumn.copyRangeTo(sabColumn, 1);
      expect(sabColumn.length()).toBe(1);
      expect(sabColumn.readToObject(0)).toEqual({ x: 42.5 });

      // And the reverse
      sabColumn.copyRangeTo(arrayColumn, 1);
      expect(arrayColumn.length()).toBe(1);
      expect(arrayColumn.readToObject(0)).toEqual({ x: 42.5 });
    });

    it('should support spawnLike for both column types', () => {
      const arrayColumn = new ColumnArray();
      const sabColumn = new ColumnSAB({ fields: { x: 'f32' } });

      const newArray = arrayColumn.spawnLike(100);
      const newSAB = sabColumn.spawnLike(100);

      expect(newArray.columnType).toBe(ColumnType.ARRAY);
      expect(newSAB.columnType).toBe(ColumnType.SAB);
    });
  });
});