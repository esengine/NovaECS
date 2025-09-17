/**
 * ColumnSAB View Tests
 * ColumnSAB视图测试
 */

import { describe, test, expect } from 'vitest';
import { ColumnSAB } from '../src/sab/ColumnSAB';
import type { ComponentSchema } from '../src/sab/Schema';

describe('ColumnSAB View', () => {
  const testSchema: ComponentSchema = {
    fields: {
      'position_x': 'f32',
      'position_y': 'f32',
      'velocity_x': 'f64',
      'velocity_y': 'f64',
      'health': 'i32',
      'level': 'u16',
      'active': 'bool',
      'score': 'u32'
    }
  };

  describe('基本读写功能', () => {
    test('应该能够读取字段值', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 写入测试数据
      column.writeFromObject(0, {
        position_x: 10.5,
        position_y: -5.25,
        velocity_x: 1.23456789,
        health: -100,
        level: 5,
        active: true,
        score: 999999
      });

      const view = column.view(0);

      expect(view.position_x).toBeCloseTo(10.5, 5);
      expect(view.position_y).toBeCloseTo(-5.25, 5);
      expect(view.velocity_x).toBeCloseTo(1.23456789, 10);
      expect(view.health).toBe(-100);
      expect(view.level).toBe(5);
      expect(view.active).toBe(true);
      expect(view.score).toBe(999999);
    });

    test('应该能够写入字段值', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // 写入不同类型的值
      view.position_x = 42.75;
      view.position_y = -12.5;
      view.velocity_x = 3.141592653589793;
      view.health = -500;
      view.level = 10;
      view.active = false;
      view.score = 1234567;

      // 验证值被正确写入
      expect(view.position_x).toBeCloseTo(42.75, 5);
      expect(view.position_y).toBeCloseTo(-12.5, 5);
      expect(view.velocity_x).toBeCloseTo(3.141592653589793, 10);
      expect(view.health).toBe(-500);
      expect(view.level).toBe(10);
      expect(view.active).toBe(false);
      expect(view.score).toBe(1234567);
    });

    test('应该正确处理布尔值转换', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // 测试各种真值
      view.active = true;
      expect(view.active).toBe(true);

      view.active = 1;
      expect(view.active).toBe(true);

      view.active = 'true';
      expect(view.active).toBe(true);

      view.active = {};
      expect(view.active).toBe(true);

      // 测试各种假值
      view.active = false;
      expect(view.active).toBe(false);

      view.active = 0;
      expect(view.active).toBe(false);

      view.active = '';
      expect(view.active).toBe(false);

      view.active = null;
      expect(view.active).toBe(false);

      view.active = undefined;
      expect(view.active).toBe(false);
    });

    test('应该自动标记写掩码', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.emplaceDefault(1);

      // 清空写掩码
      column.clearChangeTracking();

      const view0 = column.view(0);
      const view1 = column.view(1);

      // 写入第0行
      view0.health = 100;

      // 检查写掩码
      const writtenRows = column.drainWrittenRows();
      expect(writtenRows).toContain(0);
      expect(writtenRows).not.toContain(1);

      // 再次清空并写入第1行
      column.clearChangeTracking();
      view1.position_x = 50;

      const writtenRows2 = column.drainWrittenRows();
      expect(writtenRows2).toContain(1);
      expect(writtenRows2).not.toContain(0);
    });
  });

  describe('特殊属性', () => {
    test('应该提供调试用的特殊属性', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(5);

      const view = column.view(5);

      expect(view._row).toBe(5);
      expect(view._col).toBe(column);
      expect(view._len).toBe(6); // 长度应该是6（0-5）
    });

    test('特殊属性不应该触发写掩码', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.clearChangeTracking();

      const view = column.view(0);

      // 访问特殊属性
      const row = view._row;
      const col = view._col;
      const len = view._len;

      expect(row).toBe(0);
      expect(col).toBe(column);
      expect(len).toBe(1);

      // 确认没有标记写掩码
      const writtenRows = column.drainWrittenRows();
      expect(writtenRows).toHaveLength(0);
    });
  });

  describe('边界检查', () => {
    test('应该在行超出范围时抛出错误', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.emplaceDefault(1);

      // 正常范围
      expect(() => column.view(0)).not.toThrow();
      expect(() => column.view(1)).not.toThrow();

      // 超出范围
      expect(() => column.view(-1)).toThrow(RangeError);
      expect(() => column.view(2)).toThrow(RangeError);
      expect(() => column.view(100)).toThrow(RangeError);
    });

    test('错误消息应该包含有用信息', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.emplaceDefault(1);

      expect(() => column.view(-1)).toThrow('Row -1 is out of bounds (len=2)');
      expect(() => column.view(5)).toThrow('Row 5 is out of bounds (len=2)');
    });

    test('访问不存在的字段应该返回undefined', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      expect(view.nonexistent_field).toBeUndefined();
      expect(view['another-missing-field']).toBeUndefined();
    });

    test('设置不存在的字段应该被忽略', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // 尝试设置不存在的字段，应该被忽略但不抛错
      const result = view.nonexistent_field = 123;
      expect(result).toBe(123); // 赋值操作本身返回值
      expect(view.nonexistent_field).toBeUndefined(); // 但读取时仍然未定义
    });
  });

  describe('Object方法支持', () => {
    test('Object.keys应该返回所有字段名', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);
      const keys = Object.keys(view);

      expect(keys).toContain('position_x');
      expect(keys).toContain('position_y');
      expect(keys).toContain('velocity_x');
      expect(keys).toContain('velocity_y');
      expect(keys).toContain('health');
      expect(keys).toContain('level');
      expect(keys).toContain('active');
      expect(keys).toContain('score');

      expect(keys).toHaveLength(8);
    });

    test('for...in循环应该正常工作', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.writeFromObject(0, {
        position_x: 1,
        position_y: 2,
        health: 100,
        active: true
      });

      const view = column.view(0);
      const foundFields: string[] = [];

      for (const field in view) {
        foundFields.push(field);
      }

      expect(foundFields).toContain('position_x');
      expect(foundFields).toContain('position_y');
      expect(foundFields).toContain('health');
      expect(foundFields).toContain('active');
      expect(foundFields).toHaveLength(8);
    });

    test('Object.getOwnPropertyDescriptor应该正确工作', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      const desc = Object.getOwnPropertyDescriptor(view, 'position_x');
      expect(desc).toBeDefined();
      expect(desc!.enumerable).toBe(true);
      expect(desc!.configurable).toBe(true);

      const nonExistentDesc = Object.getOwnPropertyDescriptor(view, 'nonexistent');
      expect(nonExistentDesc).toBeUndefined();
    });
  });

  describe('多行视图', () => {
    test('不同行的视图应该独立工作', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.emplaceDefault(1);
      column.emplaceDefault(2);

      const view0 = column.view(0);
      const view1 = column.view(1);
      const view2 = column.view(2);

      // 设置不同的值
      view0.health = 100;
      view1.health = 200;
      view2.health = 300;

      view0.active = true;
      view1.active = false;
      view2.active = true;

      // 验证值独立
      expect(view0.health).toBe(100);
      expect(view1.health).toBe(200);
      expect(view2.health).toBe(300);

      expect(view0.active).toBe(true);
      expect(view1.active).toBe(false);
      expect(view2.active).toBe(true);

      // 验证行号正确
      expect(view0._row).toBe(0);
      expect(view1._row).toBe(1);
      expect(view2._row).toBe(2);
    });

    test('视图应该反映底层数据的变化', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // 通过视图设置值
      view.health = 150;
      expect(view.health).toBe(150);

      // 通过原始API设置值
      column.writeFromObject(0, { health: 250 });
      expect(view.health).toBe(250);

      // 通过原始视图设置值
      const healthArray = column.getFieldView('health') as Int32Array;
      healthArray[0] = 350;
      expect(view.health).toBe(350);
    });
  });

  describe('类型转换', () => {
    test('应该正确处理数值类型转换', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // 字符串数字
      view.health = '123';
      expect(view.health).toBe(123);

      // 浮点数到整数
      view.level = 15.7;
      expect(view.level).toBe(15);

      // 负数
      view.health = -456;
      expect(view.health).toBe(-456);

      // 浮点数
      view.position_x = '42.5';
      expect(view.position_x).toBeCloseTo(42.5, 5);
    });

    test('应该处理无效数值', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const view = column.view(0);

      // NaN应该转为0
      view.health = NaN;
      expect(view.health).toBe(0);

      // Infinity
      view.position_x = Infinity;
      expect(view.position_x).toBe(Infinity);

      view.position_y = -Infinity;
      expect(view.position_y).toBe(-Infinity);
    });
  });

  describe('性能特性', () => {
    test('视图访问应该是零拷贝的', () => {
      const column = new ColumnSAB(testSchema, 64);
      const iterations = 1000;

      // 填充数据
      for (let i = 0; i < iterations; i++) {
        column.emplaceDefault(i);
      }

      const start = performance.now();

      // 大量视图访问
      for (let i = 0; i < iterations; i++) {
        const view = column.view(i);
        view.health = i;
        view.position_x = i * 0.1;
        view.active = i % 2 === 0;
      }

      const time = performance.now() - start;

      // 应该在合理时间内完成
      expect(time).toBeLessThan(100);
    });

    test('重复获取同一行视图应该快速', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const start = performance.now();

      // 重复获取视图
      for (let i = 0; i < 1000; i++) {
        const view = column.view(0);
        const health = view.health;
        view.health = health + 1;
      }

      const time = performance.now() - start;
      expect(time).toBeLessThan(50);
    });
  });
});