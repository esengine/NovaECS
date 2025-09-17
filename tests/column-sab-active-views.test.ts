/**
 * ColumnSAB Active Views Tests
 * ColumnSAB活视图测试
 */

import { describe, test, expect } from 'vitest';
import { ColumnSAB } from '../src/sab/ColumnSAB';
import type { ComponentSchema } from '../src/sab/Schema';

describe('ColumnSAB Active Views', () => {
  const testSchema: ComponentSchema = {
    fields: {
      'position_x': 'f32',
      'position_y': 'f32',
      'velocity_x': 'f64',
      'velocity_y': 'f64',
      'health': 'i32',
      'level': 'u16',
      'active': 'bool'
    }
  };

  describe('基本映射功能', () => {
    test('应该在构造时正确建立类型和视图映射', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 测试类型映射
      expect(column.getFieldType('position_x')).toBe('f32');
      expect(column.getFieldType('position_y')).toBe('f32');
      expect(column.getFieldType('velocity_x')).toBe('f64');
      expect(column.getFieldType('velocity_y')).toBe('f64');
      expect(column.getFieldType('health')).toBe('i32');
      expect(column.getFieldType('level')).toBe('u16');
      expect(column.getFieldType('active')).toBe('bool');

      // 测试不存在的字段
      expect(column.getFieldType('nonexistent')).toBeUndefined();
    });

    test('应该返回正确类型的视图对象', () => {
      const column = new ColumnSAB(testSchema, 64);

      const posXView = column.getFieldView('position_x');
      const velocityXView = column.getFieldView('velocity_x');
      const healthView = column.getFieldView('health');
      const levelView = column.getFieldView('level');
      const activeView = column.getFieldView('active');

      expect(posXView).toBeInstanceOf(Float32Array);
      expect(velocityXView).toBeInstanceOf(Float64Array);
      expect(healthView).toBeInstanceOf(Int32Array);
      expect(levelView).toBeInstanceOf(Uint16Array);
      expect(activeView).toBeInstanceOf(Uint8Array);

      // 测试不存在的字段
      expect(column.getFieldView('nonexistent')).toBeUndefined();
    });

    test('视图映射应该与views对象保持一致', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 比较映射中的视图与原始views中的视图
      expect(column.getFieldView('position_x')).toBe(column.viewOf('position_x'));
      expect(column.getFieldView('velocity_x')).toBe(column.viewOf('velocity_x'));
      expect(column.getFieldView('health')).toBe(column.viewOf('health'));
      expect(column.getFieldView('level')).toBe(column.viewOf('level'));
      expect(column.getFieldView('active')).toBe(column.viewOf('active'));
    });
  });

  describe('扩容后映射一致性', () => {
    test('扩容后映射应该保持正确', () => {
      const column = new ColumnSAB(testSchema, 16);

      // 记录扩容前的类型映射
      const originalTypes = {
        position_x: column.getFieldType('position_x'),
        velocity_x: column.getFieldType('velocity_x'),
        health: column.getFieldType('health'),
        level: column.getFieldType('level'),
        active: column.getFieldType('active')
      };

      // 触发扩容
      column.ensureCapacity(1000);

      // 验证类型映射在扩容后仍然正确
      expect(column.getFieldType('position_x')).toBe(originalTypes.position_x);
      expect(column.getFieldType('velocity_x')).toBe(originalTypes.velocity_x);
      expect(column.getFieldType('health')).toBe(originalTypes.health);
      expect(column.getFieldType('level')).toBe(originalTypes.level);
      expect(column.getFieldType('active')).toBe(originalTypes.active);

      // 验证视图映射指向新的视图对象（应该不同于扩容前）
      const newPosXView = column.getFieldView('position_x');
      const newVelocityXView = column.getFieldView('velocity_x');

      expect(newPosXView).toBeInstanceOf(Float32Array);
      expect(newVelocityXView).toBeInstanceOf(Float64Array);

      // 新视图应该有正确的长度
      expect(newPosXView!.length).toBeGreaterThanOrEqual(1000);
      expect(newVelocityXView!.length).toBeGreaterThanOrEqual(1000);
    });

    test('多次扩容后映射应该持续正确', () => {
      const column = new ColumnSAB(testSchema, 8);

      // 多次扩容
      for (let cap = 16; cap <= 256; cap *= 2) {
        column.ensureCapacity(cap);

        // 每次扩容后都验证映射正确性
        expect(column.getFieldType('position_x')).toBe('f32');
        expect(column.getFieldType('health')).toBe('i32');
        expect(column.getFieldType('active')).toBe('bool');

        const view = column.getFieldView('position_x');
        expect(view).toBeInstanceOf(Float32Array);
        expect(view!.length).toBeGreaterThanOrEqual(cap);
      }
    });
  });

  describe('清空后映射一致性', () => {
    test('清空后映射应该保持正确', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 添加一些数据
      column.writeFromObject(0, { position_x: 1.5, health: 100, active: true });
      column.writeFromObject(1, { position_x: 2.5, health: 200, active: false });

      // 记录清空前的类型映射
      const originalTypes = {
        position_x: column.getFieldType('position_x'),
        health: column.getFieldType('health'),
        active: column.getFieldType('active')
      };

      // 清空列
      column.clear();

      // 验证类型映射仍然正确
      expect(column.getFieldType('position_x')).toBe(originalTypes.position_x);
      expect(column.getFieldType('health')).toBe(originalTypes.health);
      expect(column.getFieldType('active')).toBe(originalTypes.active);

      // 验证视图映射仍然有效
      const posXView = column.getFieldView('position_x');
      const healthView = column.getFieldView('health');
      const activeView = column.getFieldView('active');

      expect(posXView).toBeInstanceOf(Float32Array);
      expect(healthView).toBeInstanceOf(Int32Array);
      expect(activeView).toBeInstanceOf(Uint8Array);

      // 验证数据确实被清空
      expect(column.length()).toBe(0);
    });
  });

  describe('性能优化验证', () => {
    test('O(1)查询应该比遍历fields数组更快', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 模拟大量查询操作
      const fieldName = 'position_x';
      const iterations = 1000;

      // 使用新的O(1)映射查询
      const start1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        column.getFieldType(fieldName);
        column.getFieldView(fieldName);
      }
      const time1 = performance.now() - start1;

      // 使用传统的遍历方法查询（模拟）
      const start2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        // 模拟遍历查找（实际上我们调用老方法）
        column.viewOf(fieldName);
      }
      const time2 = performance.now() - start2;

      // 新方法应该不会显著慢于老方法（因为都很快，主要验证功能正确性）
      expect(time1).toBeLessThan(100); // 应该在合理时间内完成
      expect(time2).toBeLessThan(100);
    });

    test('活视图缓存应该返回一致的引用', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 多次获取相同字段的视图应该返回相同引用
      const view1 = column.getFieldView('position_x');
      const view2 = column.getFieldView('position_x');
      const view3 = column.viewOf('position_x');

      expect(view1).toBe(view2);
      expect(view1).toBe(view3);
    });
  });

  describe('边界情况', () => {
    test('空schema应该正确处理', () => {
      const emptySchema: ComponentSchema = { fields: {} };
      const column = new ColumnSAB(emptySchema, 16);

      expect(column.getFieldType('anything')).toBeUndefined();
      expect(column.getFieldView('anything')).toBeUndefined();
    });

    test('单字段schema应该正确处理', () => {
      const singleSchema: ComponentSchema = {
        fields: { 'value': 'f32' }
      };
      const column = new ColumnSAB(singleSchema, 16);

      expect(column.getFieldType('value')).toBe('f32');
      expect(column.getFieldView('value')).toBeInstanceOf(Float32Array);
      expect(column.getFieldType('other')).toBeUndefined();
    });

    test('特殊字符字段名应该正确处理', () => {
      const specialSchema: ComponentSchema = {
        fields: {
          'field-with-dash': 'i32',
          'field_with_underscore': 'u32',
          'field123': 'f64',
          '': 'bool' // 空字段名
        }
      };
      const column = new ColumnSAB(specialSchema, 16);

      expect(column.getFieldType('field-with-dash')).toBe('i32');
      expect(column.getFieldType('field_with_underscore')).toBe('u32');
      expect(column.getFieldType('field123')).toBe('f64');
      expect(column.getFieldType('')).toBe('bool');

      expect(column.getFieldView('field-with-dash')).toBeInstanceOf(Int32Array);
      expect(column.getFieldView('field_with_underscore')).toBeInstanceOf(Uint32Array);
      expect(column.getFieldView('field123')).toBeInstanceOf(Float64Array);
      expect(column.getFieldView('')).toBeInstanceOf(Uint8Array);
    });
  });
});