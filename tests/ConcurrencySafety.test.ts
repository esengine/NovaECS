/**
 * Concurrency safety tests for SAB parallel processing
 * SAB并行处理的并发安全测试
 */

import { vi } from 'vitest';
import { 
  validateNonOverlappingChunks, 
  MemoryBarrier, 
  AtomicHelper, 
  VisibilityGuard 
} from '../src/parallel/ConcurrencySafety';
import type { ChunkView } from '../src/core/ChunkedQuery';

// Mock SAB environment
// 模拟SAB环境
(global as any).SharedArrayBuffer = class MockSharedArrayBuffer extends ArrayBuffer {
  constructor(length: number) { 
    super(length);
    // SharedArrayBuffer特性：byteLength已从ArrayBuffer继承
  }
  
  slice() { 
    return new MockSharedArrayBuffer(this.byteLength); 
  }
};

(global as any).Atomics = {
  store: vi.fn((arr: any, idx: number, val: number) => { arr[idx] = val; return val; }),
  load: vi.fn((arr: any, idx: number) => arr[idx]),
  add: vi.fn((arr: any, idx: number, val: number) => { 
    const old = arr[idx]; 
    arr[idx] += val; 
    return old; 
  }),
  compareExchange: vi.fn((arr: any, idx: number, expected: number, value: number) => {
    const old = arr[idx] || 0; // Default to 0 if undefined
    if (old === expected) arr[idx] = value;
    return old;
  }),
  wait: vi.fn(() => 'ok'),
  notify: vi.fn(() => 1)
};

describe('ConcurrencySafety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateNonOverlappingChunks', () => {
    test('应该验证非重叠块', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [],
          length: 3,
          archetypeKey: 'arch1',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [4, 5],
          cols: [],
          length: 2,
          archetypeKey: 'arch1',
          startRow: 3,
          endRow: 5
        }
      ];

      expect(validateNonOverlappingChunks(chunks)).toBe(true);
    });

    test('应该检测重叠块', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [],
          length: 3,
          archetypeKey: 'arch1',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [3, 4, 5],
          cols: [],
          length: 3,
          archetypeKey: 'arch1',
          startRow: 2, // Overlaps with previous chunk
          endRow: 5
        }
      ];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
      expect(validateNonOverlappingChunks(chunks)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overlapping chunks detected')
      );
      consoleSpy.mockRestore();
    });

    test('应该允许不同原型的重叠行', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [],
          length: 3,
          archetypeKey: 'arch1',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [4, 5, 6],
          cols: [],
          length: 3,
          archetypeKey: 'arch2', // Different archetype
          startRow: 0, // Same rows but different archetype is OK
          endRow: 3
        }
      ];

      expect(validateNonOverlappingChunks(chunks)).toBe(true);
    });
  });

  describe('MemoryBarrier', () => {
    test('应该创建和管理内存屏障', () => {
      const barrier1 = MemoryBarrier.getBarrier('test1', 4);
      const barrier2 = MemoryBarrier.getBarrier('test1', 4); // Same name
      
      expect(barrier1).toBe(barrier2); // Should return same instance
      expect(barrier1.length).toBe(5); // workerCount + 1
    });

    test('应该处理worker完成信号', () => {
      const barrier = MemoryBarrier.getBarrier('test-signal', 2);
      
      MemoryBarrier.signalCompletion(barrier, 0); // Worker 0
      MemoryBarrier.signalCompletion(barrier, 1); // Worker 1
      
      expect(global.Atomics.store).toHaveBeenCalledWith(barrier, 1, 1);
      expect(global.Atomics.store).toHaveBeenCalledWith(barrier, 2, 1);
      expect(global.Atomics.add).toHaveBeenCalledWith(barrier, 0, 1);
    });

    test('应该等待所有worker完成', async () => {
      const barrier = MemoryBarrier.getBarrier('test-wait', 2);
      
      // Simulate barrier state where all workers completed
      // 模拟所有worker完成的屏障状态
      barrier[0] = 2; // completion counter
      
      const result = await MemoryBarrier.waitForCompletion(barrier, 2, 1000);
      expect(result).toBe(true);
    });
  });

  describe('AtomicHelper', () => {
    test('应该执行原子比较交换', () => {
      const array = new Int32Array(new SharedArrayBuffer(16));
      array[0] = 5;
      
      // Mock the compareExchange to return the expected value (5)
      // Mock compareExchange 返回期望值 (5)
      (global.Atomics.compareExchange as any).mockReturnValueOnce(5);
      
      const success = AtomicHelper.compareAndSwap(array, 0, 5, 10);
      expect(success).toBe(true);
      expect(global.Atomics.compareExchange).toHaveBeenCalledWith(array, 0, 5, 10);
    });

    test('应该执行原子递增', () => {
      const array = new Int32Array(new SharedArrayBuffer(16));
      array[0] = 5;
      
      // Mock the return value (old value + 1)
      // 模拟返回值（旧值 + 1）
      (global.Atomics.add as any).mockReturnValue(5);
      
      const result = AtomicHelper.incrementAndGet(array, 0);
      expect(result).toBe(6);
      expect(global.Atomics.add).toHaveBeenCalledWith(array, 0, 1);
    });

    test('应该安全读写bool值', () => {
      const array = new Uint8Array(new SharedArrayBuffer(8));
      
      AtomicHelper.writeBool(array, 0, true);
      // writeBool creates Int8Array internally, so expect that
      // writeBool内部创建Int8Array，所以期望那个
      expect(global.Atomics.store).toHaveBeenCalledWith(expect.any(Int8Array), 0, 1);
      
      AtomicHelper.writeBool(array, 1, false);
      expect(global.Atomics.store).toHaveBeenCalledWith(expect.any(Int8Array), 1, 0);
      
      // Mock read operations
      // 模拟读操作
      (global.Atomics.load as any).mockReturnValue(1);
      expect(AtomicHelper.readBool(array, 0)).toBe(true);
      
      (global.Atomics.load as any).mockReturnValue(0);
      expect(AtomicHelper.readBool(array, 1)).toBe(false);
    });
  });

  describe('VisibilityGuard', () => {
    test('应该执行内存栅栏', () => {
      // Initialize fence first
      // 先初始化栅栏
      VisibilityGuard.initFence();
      
      // Clear previous mocks to get clean call count
      // 清除之前的mock以获得干净的调用计数
      vi.clearAllMocks();
      
      VisibilityGuard.memoryFence();
      
      // Should call Atomics.add for fence effect
      // 应该调用Atomics.add产生栅栏效果
      expect(global.Atomics.add).toHaveBeenCalled();
    });

    test('应该验证数据一致性', () => {
      const buffer = new SharedArrayBuffer(16);
      const view = new Uint32Array(buffer);
      view[0] = 0x12345678;
      view[1] = 0x9ABCDEF0;
      view[2] = 0x11111111;
      view[3] = 0x22222222;
      
      // Calculate expected checksum
      // 计算期望的校验和
      const expectedChecksum = 0x12345678 ^ 0x9ABCDEF0 ^ 0x11111111 ^ 0x22222222;
      
      expect(VisibilityGuard.verifyConsistency(buffer, expectedChecksum)).toBe(true);
      expect(VisibilityGuard.verifyConsistency(buffer, expectedChecksum + 1)).toBe(false);
    });
    
    test('应该处理未初始化的栅栏', () => {
      // Reset fence to null
      // 重置栅栏为null
      (VisibilityGuard as any).fence = null;
      (VisibilityGuard as any).fenceBuffer = null;
      
      // Should not throw when fence is not initialized
      // 栅栏未初始化时不应该抛出异常
      expect(() => VisibilityGuard.memoryFence()).not.toThrow();
      expect(() => VisibilityGuard.workerFenceRelease()).not.toThrow();
    });
  });
});