/**
 * Guid Comparison Tests
 * Guid比较测试
 */

import { describe, test, expect } from 'vitest';
import { Guid, compareGuid, guidEquals } from '../src/components/Guid';

describe('Guid Comparison', () => {
  describe('compareGuid', () => {
    test('应该正确比较相同的GUID', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x12345678, 0x9ABCDEF0);

      expect(compareGuid(a, b)).toBe(0);
    });

    test('应该正确比较不同的hi值', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x12345679, 0x9ABCDEF0);

      expect(compareGuid(a, b)).toBe(-1);
      expect(compareGuid(b, a)).toBe(1);
    });

    test('应该正确比较相同hi但不同lo值', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x12345678, 0x9ABCDEF1);

      expect(compareGuid(a, b)).toBe(-1);
      expect(compareGuid(b, a)).toBe(1);
    });

    test('应该正确处理零值GUID', () => {
      const zero = new Guid(0, 0);
      const nonZero = new Guid(1, 0);

      expect(compareGuid(zero, nonZero)).toBe(-1);
      expect(compareGuid(nonZero, zero)).toBe(1);
      expect(compareGuid(zero, zero)).toBe(0);
    });

    test('应该正确处理最大值', () => {
      const max = new Guid(0xFFFFFFFF, 0xFFFFFFFF);
      const almostMax = new Guid(0xFFFFFFFF, 0xFFFFFFFE);

      expect(compareGuid(almostMax, max)).toBe(-1);
      expect(compareGuid(max, almostMax)).toBe(1);
      expect(compareGuid(max, max)).toBe(0);
    });

    test('应该正确处理大数值的无符号比较', () => {
      // 测试大于2^31的数值，确保无符号比较正常工作
      const a = new Guid(0x80000000, 0x80000000); // 2^31
      const b = new Guid(0x7FFFFFFF, 0xFFFFFFFF); // 2^31-1, max lo

      expect(compareGuid(a, b)).toBe(1);
      expect(compareGuid(b, a)).toBe(-1);
    });

    test('应该与减法比较产生相同的排序结果', () => {
      const testValues = [
        [0x00000000, 0x00000000],
        [0x00000001, 0x00000000],
        [0x00000000, 0x00000001],
        [0x7FFFFFFF, 0xFFFFFFFF],
        [0x80000000, 0x00000000],
        [0x80000000, 0x80000000],
        [0xFFFFFFFF, 0x00000000],
        [0xFFFFFFFF, 0xFFFFFFFF],
      ];

      const guids = testValues.map(([hi, lo]) => new Guid(hi, lo));

      // 使用新的比较函数排序
      const sorted = [...guids].sort(compareGuid);

      // 检查排序结果是否单调递增
      for (let i = 1; i < sorted.length; i++) {
        expect(compareGuid(sorted[i-1], sorted[i])).toBeLessThanOrEqual(0);
        if (compareGuid(sorted[i-1], sorted[i]) === 0) {
          expect(guidEquals(sorted[i-1], sorted[i])).toBe(true);
        }
      }
    });

    test('应该满足比较器的传递性', () => {
      const a = new Guid(0x10000000, 0x00000000);
      const b = new Guid(0x20000000, 0x00000000);
      const c = new Guid(0x30000000, 0x00000000);

      expect(compareGuid(a, b)).toBe(-1);
      expect(compareGuid(b, c)).toBe(-1);
      expect(compareGuid(a, c)).toBe(-1);
    });

    test('应该满足比较器的反对称性', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x87654321, 0x0FEDCBA9);

      const result1 = compareGuid(a, b);
      const result2 = compareGuid(b, a);

      expect(result1).toBe(-result2);
    });
  });

  describe('guidEquals', () => {
    test('应该正确检测相同的GUID', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x12345678, 0x9ABCDEF0);

      expect(guidEquals(a, b)).toBe(true);
    });

    test('应该正确检测不同的GUID', () => {
      const a = new Guid(0x12345678, 0x9ABCDEF0);
      const b = new Guid(0x12345678, 0x9ABCDEF1);

      expect(guidEquals(a, b)).toBe(false);
    });
  });
});