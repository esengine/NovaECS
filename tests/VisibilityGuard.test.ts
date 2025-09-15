/**
 * Test VisibilityGuard memory fence mechanisms for SAB concurrency
 * 测试VisibilityGuard内存栅栏机制用于SAB并发
 */

import { vi } from 'vitest';
import { VisibilityGuard } from '../src/parallel/ConcurrencySafety';

describe('VisibilityGuard', () => {
  beforeEach(() => {
    // Reset static state
    (VisibilityGuard as any).fence = null;
    (VisibilityGuard as any).fenceBuffer = null;
  });
  
  test('应该初始化内存栅栏', () => {
    const buffer = VisibilityGuard.initFence();
    
    if (typeof SharedArrayBuffer !== 'undefined') {
      expect(buffer).toBeInstanceOf(SharedArrayBuffer);
      expect(buffer?.byteLength).toBe(4);
    } else {
      expect(buffer).toBeNull();
    }
  });
  
  test('应该初始化新的SharedArrayBuffer', () => {
    if (typeof SharedArrayBuffer === 'undefined') {
      // Skip test in environments without SAB support
      return;
    }
    
    const buffer = VisibilityGuard.initFence();
    
    expect(buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(buffer?.byteLength).toBe(4);
  });
  
  test('应该在无SAB支持的环境中优雅降级', () => {
    // Mock SharedArrayBuffer as undefined
    const originalSAB = global.SharedArrayBuffer;
    (global as any).SharedArrayBuffer = undefined;
    
    const buffer = VisibilityGuard.initFence();
    expect(buffer).toBeNull();
    
    // Memory fence operations should not throw
    expect(() => VisibilityGuard.memoryFence()).not.toThrow();
    expect(() => VisibilityGuard.workerFenceRelease(new ArrayBuffer(4) as SharedArrayBuffer)).not.toThrow();
    
    // Restore
    global.SharedArrayBuffer = originalSAB;
  });
  
  test('应该正确执行内存栅栏操作', () => {
    if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
      // Skip test in environments without SAB/Atomics support
      return;
    }
    
    // Initialize fence
    const buffer = VisibilityGuard.initFence();
    expect(buffer).not.toBeNull();
    
    // Spy on Atomics operations
    const addSpy = vi.spyOn(Atomics, 'add');
    const loadSpy = vi.spyOn(Atomics, 'load');
    const storeSpy = vi.spyOn(Atomics, 'store');
    
    // Test memory fence (acquire operation)
    VisibilityGuard.memoryFence();
    expect(addSpy).toHaveBeenCalledWith(expect.any(Int32Array), 0, 0);
    
    // Test worker fence release with buffer parameter
    VisibilityGuard.workerFenceRelease(buffer!);
    expect(loadSpy).toHaveBeenCalled();
    expect(storeSpy).toHaveBeenCalled();
    
    addSpy.mockRestore();
    loadSpy.mockRestore();
    storeSpy.mockRestore();
  });
  
  test('应该正确处理fence计数器', () => {
    if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
      return;
    }
    
    VisibilityGuard.initFence();
    
    // Initial fence value should be 0
    const buffer = VisibilityGuard.initFence()!;
    const view = new Int32Array(buffer);
    expect(Atomics.load(view, 0)).toBe(0);
    
    // Worker fence release should increment counter
    VisibilityGuard.workerFenceRelease(buffer);
    expect(Atomics.load(view, 0)).toBe(1);
    
    VisibilityGuard.workerFenceRelease(buffer);
    expect(Atomics.load(view, 0)).toBe(2);
  });
  
  test('应该正确验证数据一致性', () => {
    if (typeof SharedArrayBuffer === 'undefined') {
      return;
    }
    
    const buffer = new SharedArrayBuffer(16); // 4 x Uint32 = 16 bytes
    const view = new Uint32Array(buffer);
    
    // Set some test data
    view[0] = 0x12345678;
    view[1] = 0xABCDEF00;
    view[2] = 0x87654321;
    view[3] = 0x00FEDCBA;
    
    // Calculate expected checksum (XOR)
    const expectedChecksum = 0x12345678 ^ 0xABCDEF00 ^ 0x87654321 ^ 0x00FEDCBA;
    
    // Verify consistency
    expect(VisibilityGuard.verifyConsistency(buffer, expectedChecksum)).toBe(true);
    expect(VisibilityGuard.verifyConsistency(buffer, expectedChecksum + 1)).toBe(false);
  });
  
  test('应该在异常情况下优雅处理', () => {
    // Test with uninitialized fence
    expect(() => VisibilityGuard.memoryFence()).not.toThrow();
    expect(() => VisibilityGuard.workerFenceRelease(new ArrayBuffer(4) as SharedArrayBuffer)).not.toThrow();
  });
});