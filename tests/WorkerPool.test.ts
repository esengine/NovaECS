/**
 * Worker pool tests with mocked worker environment
 * 使用模拟工作线程环境的工作线程池测试
 */

import { vi } from 'vitest';
import { KernelPayload, KernelResult } from '../src/parallel/WorkerPool';

// Mock Worker class for testing
// 用于测试的模拟Worker类
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  private messageQueue: any[] = [];
  
  constructor(public url: string, public options?: any) {}
  
  postMessage(data: any) {
    // Simulate async message processing
    // 模拟异步消息处理
    setTimeout(() => {
      this.processMessage(data);
    }, 1);
  }
  
  private processMessage(data: any) {
    const { id, payload } = data as { id: number, payload: KernelPayload };
    
    // Mock kernel execution
    // 模拟核函数执行
    let result: KernelResult;
    
    switch (payload.kernelId) {
      case 'movement':
        // Simulate movement kernel
        // 模拟移动核函数
        const [positions, velocities] = payload.cols;
        const deltaTime = payload.params?.deltaTime || 1;
        
        for (let i = 0; i < payload.length; i++) {
          const pos = positions[i];
          const vel = velocities[i];
          pos.x += vel.dx * deltaTime;
          pos.y += vel.dy * deltaTime;
        }
        
        result = { written: [0] };
        break;
        
      case 'scale':
        // Simulate scaling kernel
        // 模拟缩放核函数
        const [scalePositions] = payload.cols;
        const scale = payload.params?.scale || 1;
        
        for (let i = 0; i < payload.length; i++) {
          const pos = scalePositions[i];
          pos.x *= scale;
          pos.y *= scale;
        }
        
        result = { written: [0] };
        break;
        
      default:
        throw new Error(`Unknown kernel: ${payload.kernelId}`);
    }
    
    // Send result back
    // 发送结果
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: { id, result } }));
    }
  }
  
  terminate() {
    // Cleanup mock worker
    // 清理模拟工作线程
  }
}

// Mock global Worker
// 模拟全局Worker
(global as any).Worker = MockWorker;
(global as any).navigator = { hardwareConcurrency: 4 };

// Now import and test WorkerPool
// 现在导入并测试WorkerPool
import { WorkerPool } from '../src/parallel/WorkerPool';

describe('WorkerPool', () => {
  let pool: WorkerPool;
  
  beforeEach(() => {
    pool = new WorkerPool('mock-worker.js', 2);
  });
  
  afterEach(() => {
    pool.dispose();
  });
  
  test('应该创建指定数量的工作线程', () => {
    expect(pool).toBeDefined();
  });
  
  test('应该处理空载荷数组', async () => {
    const results = await pool.run([]);
    expect(results).toEqual([]);
  });
  
  test('应该执行单个核函数载荷', async () => {
    const positions = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const velocities = [{ dx: 1, dy: 2 }, { dx: -1, dy: -2 }];
    
    const payload: KernelPayload = {
      kernelId: 'movement',
      cols: [positions, velocities],
      length: 2,
      params: { deltaTime: 1 }
    };
    
    const results = await pool.run([payload]);
    
    expect(results).toHaveLength(1);
    expect(results[0].written).toEqual([0]);
    
    // Check that positions were updated
    // 检查位置是否已更新
    expect(positions[0]).toEqual({ x: 1, y: 2 });
    expect(positions[1]).toEqual({ x: 9, y: 8 });
  });
  
  test('应该并行执行多个核函数载荷', async () => {
    const payloads: KernelPayload[] = [];
    
    // Create multiple chunks
    // 创建多个块
    for (let i = 0; i < 4; i++) {
      const positions = [
        { x: i * 10, y: i * 10 },
        { x: i * 10 + 5, y: i * 10 + 5 }
      ];
      
      payloads.push({
        kernelId: 'scale',
        cols: [positions],
        length: 2,
        params: { scale: 2 }
      });
    }
    
    const results = await pool.run(payloads);
    
    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result.written).toEqual([0]);
    });
    
    // Check that all positions were scaled
    // 检查所有位置是否已缩放
    payloads.forEach((payload, i) => {
      const positions = payload.cols[0];
      expect(positions[0]).toEqual({ x: i * 20, y: i * 20 });
      expect(positions[1]).toEqual({ x: i * 20 + 10, y: i * 20 + 10 });
    });
  });
  
  test('应该正确处理不同的核函数ID', async () => {
    const positions1 = [{ x: 0, y: 0 }];
    const velocities1 = [{ dx: 1, dy: 1 }];
    const positions2 = [{ x: 10, y: 10 }];
    
    const payloads: KernelPayload[] = [
      {
        kernelId: 'movement',
        cols: [positions1, velocities1],
        length: 1,
        params: { deltaTime: 2 }
      },
      {
        kernelId: 'scale',
        cols: [positions2],
        length: 1,
        params: { scale: 3 }
      }
    ];
    
    const results = await pool.run(payloads);
    
    expect(results).toHaveLength(2);
    expect(results[0].written).toEqual([0]);
    expect(results[1].written).toEqual([0]);
    
    // Check movement result
    // 检查移动结果
    expect(positions1[0]).toEqual({ x: 2, y: 2 });
    
    // Check scaling result
    // 检查缩放结果
    expect(positions2[0]).toEqual({ x: 30, y: 30 });
  });
  
  test('应该在dispose时清理所有工作线程', () => {
    const terminateSpy = vi.spyOn(MockWorker.prototype, 'terminate');
    
    pool.dispose();
    
    expect(terminateSpy).toHaveBeenCalledTimes(2); // 2 workers created
  });
});