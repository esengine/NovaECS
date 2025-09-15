/**
 * CommitChanged tests for SAB write mask integration
 * SAB写掩码集成的CommitChanged测试
 */

import { vi } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent, getComponentType } from '../src/core/ComponentRegistry';
import { registerSchema } from '../src/sab/Schema';
import { commitChangedFromMasks, commitChangedFromMasksForArchetype } from '../src/parallel/CommitChanged';
import * as Environment from '../src/sab/Environment';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

// Mock SAB environment
// 模拟SAB环境
(global as any).SharedArrayBuffer = class MockSharedArrayBuffer {
  byteLength: number;
  
  constructor(length: number) {
    this.byteLength = length;
  }
  
  slice() {
    return new MockSharedArrayBuffer(this.byteLength);
  }
};

describe('CommitChanged', () => {
  let world: World;
  
  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    
    // Register schemas for SAB optimization
    // 注册schema用于SAB优化
    registerSchema(Position, {
      fields: { x: 'f32', y: 'f32' }
    });
    registerSchema(Velocity, {
      fields: { dx: 'f32', dy: 'f32' }
    });
    
    // Mock SAB as available
    // 模拟SAB可用
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(true);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  test('应该从SAB写掩码提交变更', () => {
    // Create entities with SAB-backed components
    // 创建使用SAB后端组件的实体
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    world.add(entity1, Position, { x: 10, y: 20 });
    world.add(entity2, Position, { x: 30, y: 40 });
    
    const posStore = world.getStore(getComponentType(Position));
    
    // Record initial versions
    // 记录初始版本
    const initialVersion1 = posStore?.getVersion(entity1) || 0;
    const initialVersion2 = posStore?.getVersion(entity2) || 0;
    
    // Simulate worker writing to SAB and setting write masks
    // 模拟worker写入SAB并设置写掩码
    world.beginFrame();
    
    // Mock drainWrittenRows to return entity row indices
    // 模拟drainWrittenRows返回实体行索引
    const mockDrainWrittenRows = vi.fn().mockReturnValue([0, 1]); // Both entities modified
    
    // Get archetype and mock its column
    // 获取原型并模拟其列
    const archetypes = Array.from(world.getArchetypeIndex().getAll());
    const archetype = archetypes.find(arch => arch.types.includes(getComponentType(Position).id));
    
    if (archetype) {
      const posCol = archetype.cols.get(getComponentType(Position).id);
      if (posCol) {
        (posCol as any).drainWrittenRows = mockDrainWrittenRows;
      }
    }
    
    // Commit changes from masks
    // 从掩码提交变更
    commitChangedFromMasks(world, [Position]);
    
    // Verify that drainWrittenRows was called
    // 验证drainWrittenRows被调用
    expect(mockDrainWrittenRows).toHaveBeenCalled();
    
    // Verify that component versions were updated
    // 验证组件版本已更新
    const newVersion1 = posStore?.getVersion(entity1) || 0;
    const newVersion2 = posStore?.getVersion(entity2) || 0;
    
    expect(newVersion1).toBeGreaterThan(initialVersion1);
    expect(newVersion2).toBeGreaterThan(initialVersion2);
  });
  
  test('应该跳过没有写掩码支持的列', () => {
    // Create entity with non-SAB component
    // 创建使用非SAB组件的实体
    const entity = world.createEntity();
    world.add(entity, Position, { x: 5, y: 5 });
    
    // Get archetype and remove drainWrittenRows method
    // 获取原型并移除drainWrittenRows方法
    const archetypes = Array.from(world.getArchetypeIndex().getAll());
    const archetype = archetypes.find(arch => arch.types.includes(getComponentType(Position).id));
    
    if (archetype) {
      const posCol = archetype.cols.get(getComponentType(Position).id);
      if (posCol) {
        delete (posCol as any).drainWrittenRows;
      }
    }
    
    const posStore = world.getStore(getComponentType(Position));
    const initialVersion = posStore?.getVersion(entity) || 0;
    
    world.beginFrame();
    
    // Should not throw and should not change version
    // 不应该抛出异常且不应改变版本
    expect(() => commitChangedFromMasks(world, [Position])).not.toThrow();
    
    const newVersion = posStore?.getVersion(entity) || 0;
    expect(newVersion).toBe(initialVersion);
  });
  
  test('应该为特定原型提交变更', () => {
    // Create entities in different archetypes
    // 在不同原型中创建实体
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    world.add(entity1, Position, { x: 1, y: 2 });
    world.add(entity2, Position, { x: 3, y: 4 });
    world.add(entity2, Velocity, { dx: 5, dy: 6 }); // Different archetype
    
    const posStore = world.getStore(getComponentType(Position));
    
    // Find archetype with only Position
    // 查找仅包含Position的原型
    const archetypes = Array.from(world.getArchetypeIndex().getAll());
    const posOnlyArchetype = archetypes.find(arch => 
      arch.types.includes(getComponentType(Position).id) && 
      !arch.types.includes(getComponentType(Velocity).id)
    );
    
    if (posOnlyArchetype) {
      const mockDrainWrittenRows = vi.fn().mockReturnValue([0]); // Only first entity
      const posCol = posOnlyArchetype.cols.get(getComponentType(Position).id);
      if (posCol) {
        (posCol as any).drainWrittenRows = mockDrainWrittenRows;
      }
      
      const initialVersion1 = posStore?.getVersion(entity1) || 0;
      const initialVersion2 = posStore?.getVersion(entity2) || 0;
      
      world.beginFrame();
      
      // Commit changes for specific archetype only
      // 仅为特定原型提交变更
      commitChangedFromMasksForArchetype(world, posOnlyArchetype, [Position]);
      
      const newVersion1 = posStore?.getVersion(entity1) || 0;
      const newVersion2 = posStore?.getVersion(entity2) || 0;
      
      // Only entity1 should be updated (in posOnlyArchetype)
      // 只有entity1应该被更新（在posOnlyArchetype中）
      expect(newVersion1).toBeGreaterThan(initialVersion1);
      expect(newVersion2).toBe(initialVersion2); // entity2 is in different archetype
    }
  });
  
  test('应该处理多个组件类型', () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 10, y: 20 });
    world.add(entity, Velocity, { dx: 1, dy: 2 });
    
    const posStore = world.getStore(getComponentType(Position));
    const velStore = world.getStore(getComponentType(Velocity));
    
    const initialPosVersion = posStore?.getVersion(entity) || 0;
    const initialVelVersion = velStore?.getVersion(entity) || 0;
    
    // Mock both columns with write masks
    // 模拟两个列都有写掩码
    const archetypes = Array.from(world.getArchetypeIndex().getAll());
    const archetype = archetypes.find(arch => 
      arch.types.includes(getComponentType(Position).id) && 
      arch.types.includes(getComponentType(Velocity).id)
    );
    
    if (archetype) {
      const posCol = archetype.cols.get(getComponentType(Position).id);
      const velCol = archetype.cols.get(getComponentType(Velocity).id);
      
      if (posCol && velCol) {
        (posCol as any).drainWrittenRows = vi.fn().mockReturnValue([0]);
        (velCol as any).drainWrittenRows = vi.fn().mockReturnValue([0]);
        
        world.beginFrame();
        
        // Commit changes for both component types
        // 为两种组件类型提交变更
        commitChangedFromMasks(world, [Position, Velocity]);
        
        const newPosVersion = posStore?.getVersion(entity) || 0;
        const newVelVersion = velStore?.getVersion(entity) || 0;
        
        expect(newPosVersion).toBeGreaterThan(initialPosVersion);
        expect(newVelVersion).toBeGreaterThan(initialVelVersion);
      }
    }
  });
});