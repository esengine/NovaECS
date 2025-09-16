/**
 * Tests for SAB bool field handling
 * SAB bool字段处理测试
 */

import { vi } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { registerSchema } from '../src/sab/Schema';
import { ColumnSAB } from '../src/sab/ColumnSAB';
import * as Environment from '../src/sab/Environment';

class GameState {
  constructor(
    public isActive: boolean = false,
    public isPaused: boolean = false,
    public score: number = 0
  ) {}
}

// Mock SAB environment
// 模拟SAB环境
(global as any).SharedArrayBuffer = class MockSharedArrayBuffer extends ArrayBuffer {
  constructor(length: number) {
    super(length);
  }
  slice(start?: number, end?: number) {
    const newLength = end ? Math.max(0, end - (start || 0)) : this.byteLength - (start || 0);
    return new MockSharedArrayBuffer(newLength);
  }
};

describe('SAB Bool Field Handling', () => {
  let world: World;
  
  beforeEach(() => {
    world = new World();
    registerComponent(GameState);
    
    // Register schema with bool fields
    // 注册包含bool字段的schema
    registerSchema(GameState, {
      fields: {
        isActive: 'bool',
        isPaused: 'bool', 
        score: 'i32'
      }
    });
    
    // Mock SAB as available
    // 模拟SAB可用
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(true);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  test('应该正确写入和读取bool值', () => {
    const schema = {
      fields: {
        isActive: 'bool' as const,
        isPaused: 'bool' as const,
        score: 'i32' as const
      }
    };
    
    const column = new ColumnSAB(schema, 10);
    
    // Write object with bool values
    // 写入包含bool值的对象
    column.writeFromObject(0, { isActive: true, isPaused: false, score: 100 });
    column.writeFromObject(1, { isActive: false, isPaused: true, score: 0 });
    
    // Read back and verify bool conversion
    // 读取并验证bool转换
    const obj1 = column.readToObject(0);
    expect(obj1.isActive).toBe(true);
    expect(obj1.isPaused).toBe(false);
    expect(obj1.score).toBe(100);
    
    const obj2 = column.readToObject(1);
    expect(obj2.isActive).toBe(false);
    expect(obj2.isPaused).toBe(true);
    expect(obj2.score).toBe(0);
  });
  
  test('应该将truthy值转换为1，falsy值转换为0', () => {
    const schema = {
      fields: { 
        flag: 'bool' as const 
      }
    };
    
    const column = new ColumnSAB(schema, 10);
    
    // Test various truthy/falsy values
    // 测试各种truthy/falsy值
    const testValues = [
      { input: true, expected: true },
      { input: false, expected: false },
      { input: 1, expected: true },
      { input: 0, expected: false },
      { input: 'string', expected: true },
      { input: '', expected: false },
      { input: {}, expected: true },
      { input: null, expected: false },
      { input: undefined, expected: false }
    ];
    
    testValues.forEach((test, idx) => {
      column.writeFromObject(idx, { flag: test.input });
      const result = column.readToObject(idx);
      expect(result.flag).toBe(test.expected);
    });
  });
  
  test('应该在buildSliceDescriptor中正确处理bool字段', () => {
    const schema = {
      fields: {
        enabled: 'bool' as const,
        value: 'f32' as const
      }
    };
    
    const column = new ColumnSAB(schema, 10);
    
    // Write some data
    // 写入一些数据
    column.writeFromObject(0, { enabled: true, value: 1.5 });
    column.writeFromObject(1, { enabled: false, value: 2.5 });
    
    // Build slice descriptor
    // 构建切片描述符
    const descriptor = column.buildSliceDescriptor(0, 2);
    
    expect(descriptor.view.fields.enabled.type).toBe('bool');
    expect(descriptor.view.fields.value.type).toBe('f32');
    expect(descriptor.view.fields.enabled.length).toBe(2);
    expect(descriptor.view.fields.value.length).toBe(2);
  });
  
  test('应该在World中正确处理bool组件', () => {
    const entity = world.createEntity();
    world.add(entity, GameState, { isActive: true, isPaused: false, score: 42 });
    
    const component = world.getComponent(entity, GameState);
    expect(component.isActive).toBe(true);
    expect(component.isPaused).toBe(false);
    expect(component.score).toBe(42);
    
    // Update component by modifying the existing component
    // 通过修改现有组件来更新组件
    const updatedComponent = world.getComponent(entity, GameState);
    updatedComponent.isActive = false;
    updatedComponent.isPaused = true;
    updatedComponent.score = 100;
    
    expect(updatedComponent.isActive).toBe(false);
    expect(updatedComponent.isPaused).toBe(true);
    expect(updatedComponent.score).toBe(100);
  });
  
  test('应该处理默认bool值', () => {
    const schema = {
      fields: {
        defaultFlag: 'bool' as const
      }
    };
    
    const column = new ColumnSAB(schema, 10);
    
    // Write object without bool field (should default to false)
    // 写入不包含bool字段的对象（应默认为false）
    column.writeFromObject(0, {});
    
    const result = column.readToObject(0);
    expect(result.defaultFlag).toBe(false);
  });
});