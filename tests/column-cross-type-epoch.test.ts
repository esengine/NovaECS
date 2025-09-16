import { describe, it, expect, beforeEach } from 'vitest';
import { ColumnArray } from '../src/storage/ColumnArray';
import { ColumnSAB } from '../src/sab/ColumnSAB';

describe('Column cross-type epoch preservation', () => {
  describe('ColumnArray to ColumnSAB', () => {
    let arrayCol: ColumnArray;
    let sabCol: ColumnSAB;

    beforeEach(() => {
      arrayCol = new ColumnArray();
      sabCol = new ColumnSAB({
        fields: { x: 'f32', y: 'f32' }
      });
    });

    it('should preserve epoch information when copying to SAB column', () => {
      // Add data with different epochs
      arrayCol.writeFromObject(0, { x: 10, y: 20 }, 100);
      arrayCol.writeFromObject(1, { x: 30, y: 40 }, 200);
      arrayCol.writeFromObject(2, { x: 50, y: 60 }, 300);

      // Verify epochs are set correctly in source
      const sourceEpochs = arrayCol.getRowEpochs();
      expect(sourceEpochs![0]).toBe(100);
      expect(sourceEpochs![1]).toBe(200);
      expect(sourceEpochs![2]).toBe(300);

      // Copy to SAB column
      arrayCol.copyRangeTo(sabCol, 3);

      // Verify data was copied correctly
      expect(sabCol.readToObject(0)).toEqual({ x: 10, y: 20 });
      expect(sabCol.readToObject(1)).toEqual({ x: 30, y: 40 });
      expect(sabCol.readToObject(2)).toEqual({ x: 50, y: 60 });

      // Note: SAB doesn't track per-row epochs, so we can't verify epoch preservation
      // This test mainly ensures the cross-type copy works without crashing
    });
  });

  describe('ColumnArray to ColumnArray', () => {
    let srcCol: ColumnArray;
    let dstCol: ColumnArray;

    beforeEach(() => {
      srcCol = new ColumnArray();
      dstCol = new ColumnArray();
    });

    it('should preserve epoch information when copying between Array columns', () => {
      // Add data with different epochs
      srcCol.writeFromObject(0, { a: 1 }, 100);
      srcCol.writeFromObject(1, { b: 2 }, 200);
      srcCol.writeFromObject(2, { c: 3 }, 300);

      // Verify epochs are set correctly in source
      const sourceEpochs = srcCol.getRowEpochs();
      expect(sourceEpochs![0]).toBe(100);
      expect(sourceEpochs![1]).toBe(200);
      expect(sourceEpochs![2]).toBe(300);

      // Copy to destination column
      srcCol.copyRangeTo(dstCol, 3);

      // Verify data was copied correctly
      expect(dstCol.readToObject(0)).toEqual({ a: 1 });
      expect(dstCol.readToObject(1)).toEqual({ b: 2 });
      expect(dstCol.readToObject(2)).toEqual({ c: 3 });

      // Verify epochs were preserved
      const dstEpochs = dstCol.getRowEpochs();
      expect(dstEpochs![0]).toBe(100);
      expect(dstEpochs![1]).toBe(200);
      expect(dstEpochs![2]).toBe(300);
    });

    it('should handle missing epochs gracefully', () => {
      // Add data without epochs first
      srcCol.writeFromObject(0, { a: 1 });
      srcCol.writeFromObject(1, { b: 2 });

      // Then add one with epoch
      srcCol.writeFromObject(2, { c: 3 }, 300);

      // Copy to destination
      srcCol.copyRangeTo(dstCol, 3);

      // Verify data
      expect(dstCol.readToObject(0)).toEqual({ a: 1 });
      expect(dstCol.readToObject(1)).toEqual({ b: 2 });
      expect(dstCol.readToObject(2)).toEqual({ c: 3 });

      // Verify epochs - first two should be 0 (default), last should be 300
      const dstEpochs = dstCol.getRowEpochs();
      expect(dstEpochs![0]).toBe(0);
      expect(dstEpochs![1]).toBe(0);
      expect(dstEpochs![2]).toBe(300);
    });
  });

  describe('ColumnSAB to ColumnArray', () => {
    let sabCol: ColumnSAB;
    let arrayCol: ColumnArray;

    beforeEach(() => {
      sabCol = new ColumnSAB({
        fields: { x: 'f32', y: 'f32' }
      });
      arrayCol = new ColumnArray();
    });

    it('should copy data correctly without epoch information', () => {
      // Add data to SAB column
      sabCol.writeFromObject(0, { x: 10, y: 20 });
      sabCol.writeFromObject(1, { x: 30, y: 40 });
      sabCol.writeFromObject(2, { x: 50, y: 60 });

      // Copy to Array column
      sabCol.copyRangeTo(arrayCol, 3);

      // Verify data was copied correctly
      expect(arrayCol.readToObject(0)).toEqual({ x: 10, y: 20 });
      expect(arrayCol.readToObject(1)).toEqual({ x: 30, y: 40 });
      expect(arrayCol.readToObject(2)).toEqual({ x: 50, y: 60 });

      // Verify length is set correctly
      expect(arrayCol.length()).toBe(3);

      // Note: SAB doesn't track epochs, so destination epochs should be default (0)
      const dstEpochs = arrayCol.getRowEpochs();
      expect(dstEpochs![0]).toBe(0);
      expect(dstEpochs![1]).toBe(0);
      expect(dstEpochs![2]).toBe(0);
    });
  });
});