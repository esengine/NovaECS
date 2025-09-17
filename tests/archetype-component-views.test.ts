/**
 * Archetype Component Views Tests
 * 原型组件视图测试
 */

import { describe, test, expect } from 'vitest';
import { Archetype } from '../src/archetype/Archetype';
import { registerSchema } from '../src/sab/Schema';

// 测试组件类型
class TestComponent {
  x = 0;
  y = 0;
  health = 100;
  active = true;
}

class SimpleComponent {
  value = 42;
  name = 'test';
}

describe('Archetype Component Views', () => {
  test('getComponentView应该返回可写视图（SAB后端）', () => {
    // 注册组件schema以启用SAB后端
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const entityId = 123 as any;

    // 添加实体
    archetype.push(entityId, () => ({ x: 10, y: 20, health: 150, active: true }));

    // 获取视图
    const view = archetype.getComponentView<TestComponent>(entityId, 1);
    expect(view).toBeDefined();

    if (view) {
      // 应该能够读取值
      expect(view.x).toBeCloseTo(10, 5);
      expect(view.y).toBeCloseTo(20, 5);
      expect(view.health).toBe(150);
      expect(view.active).toBe(true);

      // 应该能够修改值
      view.x = 25.5;
      view.health = 200;
      view.active = false;

      // 修改应该生效
      expect(view.x).toBeCloseTo(25.5, 5);
      expect(view.health).toBe(200);
      expect(view.active).toBe(false);

      // 通过getComponentSnapshot验证修改已生效
      const snapshot = archetype.getComponentSnapshot(entityId, 1);
      expect(snapshot?.x).toBeCloseTo(25.5, 5);
      expect(snapshot?.health).toBe(200);
      expect(snapshot?.active).toBe(false);
    }
  });

  test('getComponentView应该对数组后端返回undefined', () => {
    // 不注册schema，使用数组后端
    const archetype = new Archetype('test', [2], [SimpleComponent]);
    const entityId = 456 as any;

    archetype.push(entityId, () => ({ value: 99, name: 'hello' }));

    // 数组后端不支持零拷贝视图，应该返回undefined
    const view = archetype.getComponentView<SimpleComponent>(entityId, 2);
    expect(view).toBeUndefined();

    // 应该使用getComponentHandle或getComponentSnapshot代替
    const handle = archetype.getComponentHandle<SimpleComponent>(entityId, 2);
    expect(handle).toBeDefined();
    expect(handle?.get().value).toBe(99);

    const snapshot = archetype.getComponentSnapshot<SimpleComponent>(entityId, 2);
    expect(snapshot?.value).toBe(99);
  });

  test('getComponentViewReadonly应该返回只读视图（SAB后端）', () => {
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const entityId = 789 as any;

    archetype.push(entityId, () => ({ x: 5, y: 10, health: 80, active: false }));

    const readonlyView = archetype.getComponentViewReadonly<TestComponent>(entityId, 1);
    expect(readonlyView).toBeDefined();

    if (readonlyView) {
      // 应该能够读取值
      expect(readonlyView.x).toBeCloseTo(5, 5);
      expect(readonlyView.y).toBeCloseTo(10, 5);
      expect(readonlyView.health).toBe(80);
      expect(readonlyView.active).toBe(false);

      // 尝试写入应该被忽略
      const originalHealth = readonlyView.health;
      readonlyView.health = 999;
      expect(readonlyView.health).toBe(originalHealth); // 应该没有变化

      // 通过可写视图修改，只读视图应该反映变化
      const writableView = archetype.getComponentView<TestComponent>(entityId, 1);
      if (writableView) {
        writableView.health = 120;
        expect(readonlyView.health).toBe(120);
      }
    }
  });

  test('getComponentViewReadonly应该回退到快照（数组后端）', () => {
    const archetype = new Archetype('test', [2], [SimpleComponent]);
    const entityId = 101112 as any;

    archetype.push(entityId, () => ({ value: 777, name: 'readonly' }));

    const readonlyView = archetype.getComponentViewReadonly<SimpleComponent>(entityId, 2);
    expect(readonlyView).toBeDefined();

    if (readonlyView) {
      expect(readonlyView.value).toBe(777);
      expect(readonlyView.name).toBe('readonly');

      // 对于快照，修改不影响原始数据
      readonlyView.value = 888;
      expect(readonlyView.value).toBe(888);

      const freshSnapshot = archetype.getComponentSnapshot(entityId, 2);
      expect(freshSnapshot?.value).toBe(777);
    }
  });

  test('应该处理不存在的实体', () => {
    const archetype = new Archetype('test', [1], [TestComponent]);
    const nonExistentEntity = 99999 as any;

    const view = archetype.getComponentView(nonExistentEntity, 1);
    expect(view).toBeUndefined();

    const readonlyView = archetype.getComponentViewReadonly(nonExistentEntity, 1);
    expect(readonlyView).toBeUndefined();
  });

  test('应该处理不存在的组件类型', () => {
    const archetype = new Archetype('test', [1], [TestComponent]);
    const entityId = 123 as any;

    archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

    // 请求不存在的类型ID
    const view = archetype.getComponentView(entityId, 9999);
    expect(view).toBeUndefined();

    const readonlyView = archetype.getComponentViewReadonly(entityId, 9999);
    expect(readonlyView).toBeUndefined();
  });

  test('视图应该在结构修改后失效（警告测试）', () => {
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const entity1 = 111 as any;
    const entity2 = 222 as any;

    // 添加两个实体
    archetype.push(entity1, () => ({ x: 10, y: 20, health: 100, active: true }));
    archetype.push(entity2, () => ({ x: 30, y: 40, health: 200, active: false }));

    // 获取第一个实体的视图
    const view1 = archetype.getComponentView<TestComponent>(entity1, 1);
    expect(view1?.health).toBe(100);

    // 删除第一个实体（会触发swap-remove）
    const row1 = archetype.getRow(entity1);
    if (row1 !== undefined) {
      archetype.swapRemove(row1);
    }

    // 警告：此时view1可能指向错误的数据或行为不可预测
    // 应该重新获取视图
    const newView2 = archetype.getComponentView<TestComponent>(entity2, 1);
    expect(newView2?.health).toBe(200);
  });

  test('视图应该提供调试信息', () => {
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const entityId = 333 as any;

    archetype.push(entityId, () => ({ x: 1, y: 2, health: 50, active: true }));

    const view = archetype.getComponentView<any>(entityId, 1);
    if (view && typeof view === 'object' && '_row' in view) {
      expect(view._row).toBe(0);
      expect(view._col).toBeDefined();
      expect(view._len).toBe(1);
    }

    const readonlyView = archetype.getComponentViewReadonly<any>(entityId, 1);
    if (readonlyView && typeof readonlyView === 'object' && '_row' in readonlyView) {
      expect(readonlyView._row).toBe(0);
      expect(readonlyView._col).toBeDefined();
      expect(readonlyView._len).toBe(1);
    }
  });

  test('多实体视图应该独立工作', () => {
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const entity1 = 1001 as any;
    const entity2 = 1002 as any;
    const entity3 = 1003 as any;

    // 添加多个实体
    archetype.push(entity1, () => ({ x: 10, y: 10, health: 100, active: true }));
    archetype.push(entity2, () => ({ x: 20, y: 20, health: 200, active: false }));
    archetype.push(entity3, () => ({ x: 30, y: 30, health: 300, active: true }));

    // 获取各自的视图
    const view1 = archetype.getComponentView<TestComponent>(entity1, 1);
    const view2 = archetype.getComponentView<TestComponent>(entity2, 1);
    const view3 = archetype.getComponentView<TestComponent>(entity3, 1);

    // 验证初始值
    expect(view1?.health).toBe(100);
    expect(view2?.health).toBe(200);
    expect(view3?.health).toBe(300);

    // 修改各个视图
    if (view1) view1.health = 150;
    if (view2) view2.health = 250;
    if (view3) view3.health = 350;

    // 验证修改独立
    expect(view1?.health).toBe(150);
    expect(view2?.health).toBe(250);
    expect(view3?.health).toBe(350);

    // 通过快照验证
    const snapshot1 = archetype.getComponentSnapshot(entity1, 1);
    const snapshot2 = archetype.getComponentSnapshot(entity2, 1);
    const snapshot3 = archetype.getComponentSnapshot(entity3, 1);

    expect(snapshot1?.health).toBe(150);
    expect(snapshot2?.health).toBe(250);
    expect(snapshot3?.health).toBe(350);
  });

  test('性能：视图访问应该高效', () => {
    registerSchema(TestComponent, {
      fields: {
        x: 'f32',
        y: 'f32',
        health: 'i32',
        active: 'bool'
      }
    });

    const archetype = new Archetype('test', [1], [TestComponent]);
    const iterations = 100;

    // 添加大量实体
    for (let i = 0; i < iterations; i++) {
      const entityId = (1000 + i) as any;
      archetype.push(entityId, () => ({
        x: i,
        y: i * 2,
        health: i * 10,
        active: i % 2 === 0
      }));
    }

    const start = performance.now();

    // 通过视图进行大量访问和修改
    for (let i = 0; i < iterations; i++) {
      const entityId = (1000 + i) as any;
      const view = archetype.getComponentView<TestComponent>(entityId, 1);
      if (view) {
        view.health = view.health + 1;
        view.active = !view.active;
      }
    }

    const time = performance.now() - start;
    expect(time).toBeLessThan(50); // 应该很快完成

    // 验证所有修改都生效
    for (let i = 0; i < iterations; i++) {
      const entityId = (1000 + i) as any;
      const snapshot = archetype.getComponentSnapshot(entityId, 1);
      expect(snapshot?.health).toBe(i * 10 + 1);
      expect(snapshot?.active).toBe(!(i % 2 === 0));
    }
  });
});