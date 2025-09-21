/**
 * Guid Random Generation Tests
 * Guid随机生成测试
 */

import { describe, test, expect, vi } from 'vitest';
import { Guid } from '../src/components/Guid';

describe('Guid Random Generation', () => {
  test('应该生成不同的随机GUID', () => {
    const guid1 = new Guid();
    const guid2 = new Guid();

    // 两个随机GUID应该不同
    expect(guid1.hi !== guid2.hi || guid1.lo !== guid2.lo).toBe(true);
  });

  test('应该生成32位无符号整数范围内的值', () => {
    const guid = new Guid();

    // 值应该在32位无符号整数范围内
    expect(guid.hi).toBeGreaterThanOrEqual(0);
    expect(guid.hi).toBeLessThanOrEqual(0xFFFFFFFF);
    expect(guid.lo).toBeGreaterThanOrEqual(0);
    expect(guid.lo).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  test('应该优先使用crypto.getRandomValues', () => {
    // 创建mock crypto对象
    const mockCrypto = {
      getRandomValues: vi.fn((arr: Uint32Array) => {
        arr[0] = 0x12345678; // 固定值用于测试
        return arr;
      })
    };

    // 保存原始的crypto对象
    const originalCrypto = global.crypto;

    // 设置mock
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true
    });

    const guid = new Guid();

    // 应该调用crypto.getRandomValues两次（hi和lo）
    expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2);
    expect(guid.hi).toBe(0x12345678);
    expect(guid.lo).toBe(0x12345678);

    // 恢复原始crypto对象
    global.crypto = originalCrypto;
  });

  test('应该在crypto不可用时回退到Math.random', () => {
    // 保存原始的crypto对象
    const originalCrypto = global.crypto;

    // 移除crypto对象
    delete (global as any).crypto;

    // Mock Math.random返回固定值
    const mockMathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const guid = new Guid();

    // 应该调用Math.random两次
    expect(mockMathRandom).toHaveBeenCalledTimes(2);

    // 0.5 * 0x100000000 = 0x80000000
    expect(guid.hi).toBe(0x80000000);
    expect(guid.lo).toBe(0x80000000);

    // 恢复
    mockMathRandom.mockRestore();
    global.crypto = originalCrypto;
  });

  test('应该在crypto.getRandomValues不存在时回退到Math.random', () => {
    // 保存原始的crypto对象
    const originalCrypto = global.crypto;

    // 设置一个没有getRandomValues的crypto对象
    global.crypto = {} as any;

    // Mock Math.random
    const mockMathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.25);

    const guid = new Guid();

    // 应该调用Math.random
    expect(mockMathRandom).toHaveBeenCalledTimes(2);

    // 0.25 * 0x100000000 = 0x40000000
    expect(guid.hi).toBe(0x40000000);
    expect(guid.lo).toBe(0x40000000);

    // 恢复
    mockMathRandom.mockRestore();
    global.crypto = originalCrypto;
  });

  test('随机GUID应该具有良好的分布性', () => {
    const guids = [];
    const sampleSize = 100;

    // 生成大量随机GUID
    for (let i = 0; i < sampleSize; i++) {
      guids.push(new Guid());
    }

    // 检查唯一性（虽然理论上可能有重复，但概率极低）
    const uniqueGuids = new Set(guids.map(g => `${g.hi}-${g.lo}`));
    expect(uniqueGuids.size).toBe(sampleSize);

    // 检查hi值的分布（不应该都集中在某个范围）
    const hiValues = guids.map(g => g.hi);
    const minHi = Math.min(...hiValues);
    const maxHi = Math.max(...hiValues);

    // 在100个样本中，最大最小值的差值应该相当大
    expect(maxHi - minHi).toBeGreaterThan(0x10000000);

    // 检查lo值的分布
    const loValues = guids.map(g => g.lo);
    const minLo = Math.min(...loValues);
    const maxLo = Math.max(...loValues);

    expect(maxLo - minLo).toBeGreaterThan(0x10000000);
  });

  test('应该正确处理无符号32位整数转换', () => {
    // Mock crypto.getRandomValues返回最大值
    const mockCrypto = {
      getRandomValues: vi.fn((arr: Uint32Array) => {
        arr[0] = 0xFFFFFFFF;
        return arr;
      })
    };

    const originalCrypto = global.crypto;
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true
    });

    const guid = new Guid();

    // 最大32位无符号整数应该正确处理
    expect(guid.hi).toBe(0xFFFFFFFF);
    expect(guid.lo).toBe(0xFFFFFFFF);

    global.crypto = originalCrypto;
  });
});