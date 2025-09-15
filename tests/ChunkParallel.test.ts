/**
 * ChunkParallel tests with mocked worker environment
 * 使用模拟工作线程环境的并行块处理测试
 */

import { vi } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent, getComponentType } from '../src/core/ComponentRegistry';
import { WorkerPool } from '../src/parallel/WorkerPool';
import { forEachChunkParallel } from '../src/parallel/ChunkParallel';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

// Mock Worker for testing
// 测试用模拟Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(public url: string, public options?: any) {}
  
  postMessage(data: any) {
    setTimeout(() => {
      this.processMessage(data);
    }, 1);
  }
  
  private processMessage(data: any) {
    const { id, payload } = data;
    let result = { written: [] };
    
    if (payload.kernelId === 'movement') {
      const [positions, velocities] = payload.cols;
      const deltaTime = payload.params?.deltaTime || 1;
      
      for (let i = 0; i < payload.length; i++) {
        const pos = positions[i];
        const vel = velocities[i];
        pos.x += vel.dx * deltaTime;
        pos.y += vel.dy * deltaTime;
      }
      
      result = { written: [0] };
    } else if (payload.kernelId === 'scale') {
      const [positions] = payload.cols;
      const scale = payload.params?.scale || 1;
      
      for (let i = 0; i < payload.length; i++) {
        const pos = positions[i];
        pos.x *= scale;
        pos.y *= scale;
      }
      
      result = { written: [0] };
    }
    
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: { id, result } }));
    }
  }
  
  terminate() {}
}

// Mock global environment
// 模拟全局环境
(global as any).Worker = MockWorker;
(global as any).navigator = { hardwareConcurrency: 4 };

describe('ChunkParallel', () => {
  let world: World;
  let pool: WorkerPool;
  
  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    pool = new WorkerPool('mock-worker.js', 2);
  });
  
  afterEach(() => {
    pool.dispose();
  });
  
  test('应该并行处理单个块', async () => {
    // Create test entities
    // 创建测试实体
    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      world.add(entity, Position, { x: i, y: i });
      world.add(entity, Velocity, { dx: 1, dy: 1 });
    }
    
    // Execute parallel chunk processing
    // 执行并行块处理
    await forEachChunkParallel(
      world,
      [Position, Velocity],
      pool,
      'movement',
      { deltaTime: 2 },
      10 // Large chunk size to keep all entities in one chunk
    );
    
    // Verify results
    // 验证结果
    for (let i = 0; i < 5; i++) {
      const entity = i + 1; // Entity IDs start from 1
      const pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: i + 2, y: i + 2 }); // moved by velocity * deltaTime
    }
  });
  
  test('应该并行处理多个块', async () => {
    // Create test entities
    // 创建测试实体
    for (let i = 0; i < 10; i++) {
      const entity = world.createEntity();
      world.add(entity, Position, { x: i * 10, y: i * 10 });
    }
    
    // Execute parallel chunk processing with small chunk size
    // 使用小块大小执行并行块处理
    await forEachChunkParallel(
      world,
      [Position],
      pool,
      'scale',
      { scale: 2 },
      3 // Small chunk size to create multiple chunks
    );
    
    // Verify all positions were scaled
    // 验证所有位置都被缩放
    for (let i = 0; i < 10; i++) {
      const entity = i + 1;
      const pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: i * 20, y: i * 20 }); // scaled by 2
    }
  });
  
  test('应该处理空实体集合', async () => {
    // No entities created
    // 未创建实体
    
    await forEachChunkParallel(
      world,
      [Position, Velocity],
      pool,
      'movement',
      { deltaTime: 1 }
    );
    
    // Should complete without error
    // 应该无错误完成
    expect(true).toBe(true);
  });
  
  test('应该正确标记组件为已更改', async () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 10, y: 10 });
    world.add(entity, Velocity, { dx: 5, dy: 5 });
    
    const posStore = world.getStore(getComponentType(Position));
    const velStore = world.getStore(getComponentType(Velocity));
    
    // Record initial versions
    // 记录初始版本
    const initialPosVersion = posStore?.getVersion(entity) || 0;
    const initialVelVersion = velStore?.getVersion(entity) || 0;
    
    // Mark initial frame
    // 标记初始帧
    world.beginFrame();
    
    // Execute parallel processing
    // 执行并行处理
    await forEachChunkParallel(
      world,
      [Position, Velocity],
      pool,
      'movement',
      { deltaTime: 1 }
    );
    
    // Check that position component version was updated
    // 检查位置组件版本是否已更新
    const newPosVersion = posStore?.getVersion(entity) || 0;
    const newVelVersion = velStore?.getVersion(entity) || 0;
    
    expect(newPosVersion).toBeGreaterThan(initialPosVersion);
    // Velocity version should not change (not in written array)
    // Velocity版本不应改变（不在written数组中）
    expect(newVelVersion).toBe(initialVelVersion);
  });
  
  test('应该处理不同的核函数参数', async () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 5, y: 5 });
    
    // First scaling
    // 第一次缩放
    await forEachChunkParallel(
      world,
      [Position],
      pool,
      'scale',
      { scale: 3 }
    );
    
    let pos = world.getComponent(entity, Position);
    expect(pos).toEqual({ x: 15, y: 15 });
    
    // Second scaling with different parameter
    // 使用不同参数的第二次缩放
    await forEachChunkParallel(
      world,
      [Position],
      pool,
      'scale',
      { scale: 0.5 }
    );
    
    pos = world.getComponent(entity, Position);
    expect(pos).toEqual({ x: 7.5, y: 7.5 });
  });
});