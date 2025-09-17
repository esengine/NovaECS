/**
 * ColumnSAB Readonly View Tests
 * ColumnSAB只读视图测试
 */

import { describe, test, expect } from 'vitest';
import { ColumnSAB } from '../src/sab/ColumnSAB';
import type { ComponentSchema } from '../src/sab/Schema';

describe('ColumnSAB Readonly View', () => {
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

  describe('基本只读功能', () => {
    test('应该能够读取所有字段值', () => {
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

      const readonlyView = column.viewReadonly(0);

      expect(readonlyView.position_x).toBeCloseTo(10.5, 5);
      expect(readonlyView.position_y).toBeCloseTo(-5.25, 5);
      expect(readonlyView.velocity_x).toBeCloseTo(1.23456789, 10);
      expect(readonlyView.health).toBe(-100);
      expect(readonlyView.level).toBe(5);
      expect(readonlyView.active).toBe(true);
      expect(readonlyView.score).toBe(999999);
    });

    test('应该能够访问特殊调试属性', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(3);

      const readonlyView = column.viewReadonly(3);

      expect(readonlyView._row).toBe(3);
      expect(readonlyView._col).toBe(column);
      expect(readonlyView._len).toBe(4);
    });

    test('只读视图应该反映底层数据的变化', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const readonlyView = column.viewReadonly(0);

      // 初始值应该为0
      expect(readonlyView.health).toBe(0);

      // 通过普通视图修改值
      const writableView = column.view(0);
      writableView.health = 150;

      // 只读视图应该反映变化
      expect(readonlyView.health).toBe(150);

      // 通过API直接修改
      column.writeFromObject(0, { health: 250 });
      expect(readonlyView.health).toBe(250);
    });
  });

  describe('写入保护', () => {
    test('应该阻止所有字段的写入', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.writeFromObject(0, {
        position_x: 10,
        health: 100,
        active: true,
        score: 1000
      });

      const readonlyView = column.viewReadonly(0);

      // 记录原始值
      const originalValues = {
        position_x: readonlyView.position_x,
        health: readonlyView.health,
        active: readonlyView.active,
        score: readonlyView.score
      };

      // 尝试写入不同类型的字段，都应该被阻止
      expect(() => { readonlyView.position_x = 99.9; }).not.toThrow();
      expect(() => { readonlyView.health = -500; }).not.toThrow();
      expect(() => { readonlyView.active = false; }).not.toThrow();
      expect(() => { readonlyView.score = 9999; }).not.toThrow();

      // 验证值没有改变
      expect(readonlyView.position_x).toBe(originalValues.position_x);
      expect(readonlyView.health).toBe(originalValues.health);
      expect(readonlyView.active).toBe(originalValues.active);
      expect(readonlyView.score).toBe(originalValues.score);
    });

    test('应该阻止不存在字段的写入', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const readonlyView = column.viewReadonly(0);

      // 尝试设置不存在的字段，应该被阻止且不抛错
      expect(() => { readonlyView.nonexistent_field = 123; }).not.toThrow();
      expect(readonlyView.nonexistent_field).toBeUndefined();
    });

    test('写入被阻止时不应该触发写掩码', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.clearChangeTracking();

      const readonlyView = column.viewReadonly(0);

      // 尝试写入各种值
      readonlyView.health = 999;
      readonlyView.position_x = 88.8;
      readonlyView.active = false;

      // 检查写掩码，应该没有被标记
      const writtenRows = column.drainWrittenRows();
      expect(writtenRows).toHaveLength(0);
    });
  });

  describe('Object方法支持', () => {
    test('Object.keys应该正常工作', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const readonlyView = column.viewReadonly(0);
      const keys = Object.keys(readonlyView);

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
        position_x: 1.5,
        health: 150,
        active: true
      });

      const readonlyView = column.viewReadonly(0);
      const foundFields: string[] = [];

      for (const field in readonlyView) {
        foundFields.push(field);
      }

      expect(foundFields).toContain('position_x');
      expect(foundFields).toContain('health');
      expect(foundFields).toContain('active');
      expect(foundFields).toHaveLength(8);
    });

    test('应该支持解构赋值（只读）', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.writeFromObject(0, {
        position_x: 42.5,
        position_y: -10.0,
        health: 200,
        active: true
      });

      const readonlyView = column.viewReadonly(0);

      // 解构赋值应该正常工作
      const { position_x, position_y, health, active } = readonlyView;

      expect(position_x).toBeCloseTo(42.5, 5);
      expect(position_y).toBeCloseTo(-10.0, 5);
      expect(health).toBe(200);
      expect(active).toBe(true);
    });
  });

  describe('边界检查', () => {
    test('应该在行超出范围时抛出错误', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);
      column.emplaceDefault(1);

      // 正常范围
      expect(() => column.viewReadonly(0)).not.toThrow();
      expect(() => column.viewReadonly(1)).not.toThrow();

      // 超出范围
      expect(() => column.viewReadonly(-1)).toThrow(RangeError);
      expect(() => column.viewReadonly(2)).toThrow(RangeError);
      expect(() => column.viewReadonly(100)).toThrow(RangeError);
    });

    test('错误消息应该包含有用信息', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      expect(() => column.viewReadonly(-1)).toThrow('Row -1 is out of bounds (len=1)');
      expect(() => column.viewReadonly(5)).toThrow('Row 5 is out of bounds (len=1)');
    });
  });

  describe('多行只读视图', () => {
    test('不同行的只读视图应该独立', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 设置不同行的数据
      column.writeFromObject(0, { health: 100, active: true });
      column.writeFromObject(1, { health: 200, active: false });
      column.writeFromObject(2, { health: 300, active: true });

      const view0 = column.viewReadonly(0);
      const view1 = column.viewReadonly(1);
      const view2 = column.viewReadonly(2);

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

    test('只读视图应该始终反映当前数据', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.emplaceDefault(0);

      const readonlyView = column.viewReadonly(0);
      const writableView = column.view(0);

      // 初始值
      expect(readonlyView.health).toBe(0);

      // 通过可写视图修改
      writableView.health = 100;
      expect(readonlyView.health).toBe(100);

      writableView.health = 200;
      expect(readonlyView.health).toBe(200);

      // 通过原始API修改
      column.writeFromObject(0, { health: 300 });
      expect(readonlyView.health).toBe(300);
    });
  });

  describe('调试和遍历场景', () => {
    test('应该安全用于调试输出', () => {
      const column = new ColumnSAB(testSchema, 64);
      column.writeFromObject(0, {
        position_x: 12.34,
        position_y: 56.78,
        health: 150,
        level: 5,
        active: true,
        score: 9876
      });

      const readonlyView = column.viewReadonly(0);

      // 模拟调试输出场景
      const debugInfo = {
        row: readonlyView._row,
        length: readonlyView._len,
        data: {
          position: [readonlyView.position_x, readonlyView.position_y],
          health: readonlyView.health,
          level: readonlyView.level,
          active: readonlyView.active,
          score: readonlyView.score
        }
      };

      expect(debugInfo.row).toBe(0);
      expect(debugInfo.length).toBe(1);
      expect(debugInfo.data.position[0]).toBeCloseTo(12.34, 2);
      expect(debugInfo.data.position[1]).toBeCloseTo(56.78, 2);
      expect(debugInfo.data.health).toBe(150);
      expect(debugInfo.data.level).toBe(5);
      expect(debugInfo.data.active).toBe(true);
      expect(debugInfo.data.score).toBe(9876);
    });

    test('应该安全用于数据遍历', () => {
      const column = new ColumnSAB(testSchema, 64);

      // 填充测试数据
      for (let i = 0; i < 5; i++) {
        column.writeFromObject(i, {
          health: i * 10,
          level: i + 1,
          active: i % 2 === 0
        });
      }

      // 安全遍历所有行
      const summaryData: Array<{ row: number; health: number; level: number; active: boolean }> = [];

      for (let i = 0; i < column.length(); i++) {
        const view = column.viewReadonly(i);
        summaryData.push({
          row: view._row,
          health: view.health,
          level: view.level,
          active: view.active
        });
      }

      expect(summaryData).toHaveLength(5);
      expect(summaryData[0]).toEqual({ row: 0, health: 0, level: 1, active: true });
      expect(summaryData[1]).toEqual({ row: 1, health: 10, level: 2, active: false });
      expect(summaryData[2]).toEqual({ row: 2, health: 20, level: 3, active: true });
      expect(summaryData[3]).toEqual({ row: 3, health: 30, level: 4, active: false });
      expect(summaryData[4]).toEqual({ row: 4, health: 40, level: 5, active: true });
    });
  });

  describe('性能特性', () => {
    test('只读视图访问应该高效', () => {
      const column = new ColumnSAB(testSchema, 64);
      const iterations = 1000;

      // 填充数据
      for (let i = 0; i < iterations; i++) {
        column.emplaceDefault(i);
      }

      const start = performance.now();

      // 大量只读视图访问
      let sum = 0;
      for (let i = 0; i < iterations; i++) {
        const view = column.viewReadonly(i);
        sum += view.health + view.level;
      }

      const time = performance.now() - start;

      // 应该在合理时间内完成
      expect(time).toBeLessThan(100);
      expect(sum).toBe(0); // health默认为0，level默认为0
    });
  });
});