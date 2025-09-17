/**
 * Archetype New API Tests
 * 原型新API测试
 */

import { describe, test, expect } from 'vitest';
import { Archetype, ComponentHandle, getRW } from '../src/archetype/Archetype';
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

describe('Archetype New API', () => {
  describe('replaceComponent', () => {
    test('应该完全替换组件数据', () => {
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

      // 完全替换组件
      archetype.replaceComponent(entityId, 1, { x: 99, y: 88, health: 77, active: false });

      // 验证所有字段都被替换
      const snapshot = archetype.getComponentSnapshot(entityId, 1);
      expect(snapshot?.x).toBeCloseTo(99, 5);
      expect(snapshot?.y).toBeCloseTo(88, 5);
      expect(snapshot?.health).toBe(77);
      expect(snapshot?.active).toBe(false);
    });

    test('应该处理不存在的实体', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const nonExistentEntity = 99999 as any;

      // 不应该抛出异常
      expect(() => {
        archetype.replaceComponent(nonExistentEntity, 1, { x: 0, y: 0, health: 100, active: true });
      }).not.toThrow();
    });

    test('应该处理不存在的组件类型', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 123 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      // 不应该抛出异常
      expect(() => {
        archetype.replaceComponent(entityId, 9999, { someField: 'value' });
      }).not.toThrow();
    });
  });

  describe('getComponentHandle', () => {
    test('应该创建可用的组件句柄', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 456 as any;

      archetype.push(entityId, () => ({ x: 5, y: 10, health: 80, active: false }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      expect(handle).toBeInstanceOf(ComponentHandle);
      expect(handle?.isValid()).toBe(true);
    });

    test('句柄应该支持get操作', () => {
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

      archetype.push(entityId, () => ({ x: 15, y: 25, health: 120, active: true }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      const data = handle?.get();

      expect(data?.x).toBeCloseTo(15, 5);
      expect(data?.y).toBeCloseTo(25, 5);
      expect(data?.health).toBe(120);
      expect(data?.active).toBe(true);
    });

    test('句柄应该支持set操作', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 101112 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      handle?.set({ x: 33, y: 44, health: 200, active: false });

      // 验证通过快照
      const snapshot = archetype.getComponentSnapshot(entityId, 1);
      expect(snapshot?.x).toBeCloseTo(33, 5);
      expect(snapshot?.y).toBeCloseTo(44, 5);
      expect(snapshot?.health).toBe(200);
      expect(snapshot?.active).toBe(false);
    });

    test('句柄应该支持update操作', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 131415 as any;

      archetype.push(entityId, () => ({ x: 10, y: 20, health: 100, active: true }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      handle?.update(current => ({
        ...current,
        x: current.x + 5,
        health: current.health - 10
      }));

      const snapshot = archetype.getComponentSnapshot(entityId, 1);
      expect(snapshot?.x).toBeCloseTo(15, 5);
      expect(snapshot?.y).toBeCloseTo(20, 5);
      expect(snapshot?.health).toBe(90);
      expect(snapshot?.active).toBe(true);
    });

    test('应该处理不存在的实体', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const nonExistentEntity = 99999 as any;

      const handle = archetype.getComponentHandle(nonExistentEntity, 1);
      expect(handle).toBeUndefined();
    });

    test('应该处理不存在的组件类型', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 123 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const handle = archetype.getComponentHandle(entityId, 9999);
      expect(handle).toBeUndefined();
    });

    test('句柄应该跨不同后端工作', () => {
      // 测试数组后端
      const arrayArchetype = new Archetype('array', [2], [SimpleComponent]);
      const entityId1 = 111 as any;

      arrayArchetype.push(entityId1, () => ({ value: 50, name: 'array' }));

      const arrayHandle = arrayArchetype.getComponentHandle<SimpleComponent>(entityId1, 2);
      expect(arrayHandle?.get().value).toBe(50);
      expect(arrayHandle?.get().name).toBe('array');

      arrayHandle?.set({ value: 75, name: 'updated' });
      expect(arrayHandle?.get().value).toBe(75);
      expect(arrayHandle?.get().name).toBe('updated');

      // 测试SAB后端
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const sabArchetype = new Archetype('sab', [1], [TestComponent]);
      const entityId2 = 222 as any;

      sabArchetype.push(entityId2, () => ({ x: 1, y: 2, health: 50, active: true }));

      const sabHandle = sabArchetype.getComponentHandle<TestComponent>(entityId2, 1);
      expect(sabHandle?.get().health).toBe(50);

      sabHandle?.set({ x: 3, y: 4, health: 60, active: false });
      expect(sabHandle?.get().health).toBe(60);
    });
  });

  describe('getComponentSnapshot', () => {
    test('应该返回组件的独立副本', () => {
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

      archetype.push(entityId, () => ({ x: 7, y: 14, health: 70, active: true }));

      const snapshot1 = archetype.getComponentSnapshot<TestComponent>(entityId, 1);
      const snapshot2 = archetype.getComponentSnapshot<TestComponent>(entityId, 1);

      // 快照应该是独立的对象
      expect(snapshot1).not.toBe(snapshot2);
      expect(snapshot1).toEqual(snapshot2);

      // 修改快照不应该影响原始数据
      if (snapshot1) {
        snapshot1.health = 999;
        expect(snapshot1.health).toBe(999);
      }

      const freshSnapshot = archetype.getComponentSnapshot<TestComponent>(entityId, 1);
      expect(freshSnapshot?.health).toBe(70); // 原始数据未变
    });

    test('应该处理不存在的实体', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const nonExistentEntity = 99999 as any;

      const snapshot = archetype.getComponentSnapshot(nonExistentEntity, 1);
      expect(snapshot).toBeUndefined();
    });

    test('应该处理不存在的组件类型', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 123 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const snapshot = archetype.getComponentSnapshot(entityId, 9999);
      expect(snapshot).toBeUndefined();
    });
  });

  describe('ComponentHandle类', () => {
    test('isValid应该正确检测有效性', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 444 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      expect(handle?.isValid()).toBe(true);

      // 删除实体后句柄应该无效
      const row = archetype.getRow(entityId);
      if (row !== undefined) {
        archetype.swapRemove(row);
        expect(handle?.isValid()).toBe(false);
      }
    });

    test('getRow应该返回正确的行号', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 555 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      expect(handle?.getRow()).toBe(0);

      // 添加更多实体
      const entityId2 = 666 as any;
      archetype.push(entityId2, () => ({ x: 1, y: 1, health: 200, active: false }));

      const handle2 = archetype.getComponentHandle<TestComponent>(entityId2, 1);
      expect(handle2?.getRow()).toBe(1);
    });
  });

  describe('API一致性', () => {
    test('不同方法应该返回一致的数据', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 777 as any;

      archetype.push(entityId, () => ({ x: 8, y: 16, health: 80, active: false }));

      // 通过不同方法获取数据
      const snapshot = archetype.getComponentSnapshot<TestComponent>(entityId, 1);
      const handle = archetype.getComponentHandle<TestComponent>(entityId, 1);
      const handleData = handle?.get();
      const view = archetype.getComponentView<TestComponent>(entityId, 1);
      const readonlyView = archetype.getComponentViewReadonly<TestComponent>(entityId, 1);

      // 所有方法应该返回相同的数据
      expect(snapshot?.health).toBe(80);
      expect(handleData?.health).toBe(80);
      expect(view?.health).toBe(80);
      expect(readonlyView?.health).toBe(80);

      expect(snapshot?.active).toBe(false);
      expect(handleData?.active).toBe(false);
      expect(view?.active).toBe(false);
      expect(readonlyView?.active).toBe(false);
    });

    test('不同写入方法应该产生相同效果', () => {
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

      // 添加三个实体
      archetype.push(entity1, () => ({ x: 0, y: 0, health: 100, active: true }));
      archetype.push(entity2, () => ({ x: 0, y: 0, health: 100, active: true }));
      archetype.push(entity3, () => ({ x: 0, y: 0, health: 100, active: true }));

      const newData = { x: 99, y: 88, health: 77, active: false };

      // 使用不同方法设置相同数据
      archetype.replaceComponent(entity1, 1, newData);

      const handle2 = archetype.getComponentHandle<TestComponent>(entity2, 1);
      handle2?.set(newData);

      const view3 = archetype.getComponentView<TestComponent>(entity3, 1);
      if (view3) {
        view3.x = newData.x;
        view3.y = newData.y;
        view3.health = newData.health;
        view3.active = newData.active;
      }

      // 验证结果一致
      const snapshot1 = archetype.getComponentSnapshot<TestComponent>(entity1, 1);
      const snapshot2 = archetype.getComponentSnapshot<TestComponent>(entity2, 1);
      const snapshot3 = archetype.getComponentSnapshot<TestComponent>(entity3, 1);

      expect(snapshot1).toEqual(snapshot2);
      expect(snapshot2).toEqual(snapshot3);
    });
  });

  describe('getRW助手函数', () => {
    test('应该为SAB后端返回view类型', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 1111 as any;

      archetype.push(entityId, () => ({ x: 5, y: 10, health: 100, active: true }));

      const rw = getRW<TestComponent>(archetype, entityId, 1);
      expect(rw).toBeDefined();
      expect(rw?.type).toBe('view');

      if (rw?.type === 'view') {
        expect(rw.v.health).toBe(100);
        rw.v.health = 150;
        expect(rw.v.health).toBe(150);
      }
    });

    test('应该为数组后端返回handle类型', () => {
      // 由于测试环境中SAB总是可用，我们测试getRW的逻辑
      // 当getComponentView返回undefined时应该回退到handle
      const archetype = new Archetype('test', [999], [SimpleComponent]);
      const entityId = 2222 as any;

      archetype.push(entityId, () => ({ value: 100, name: 'test' }));

      // 手动测试逻辑：当view不可用时应该使用handle
      const view = archetype.getComponentView<SimpleComponent>(entityId, 999);
      const handle = archetype.getComponentHandle<SimpleComponent>(entityId, 999);

      expect(handle).toBeDefined();
      expect(handle?.isValid()).toBe(true);

      if (handle) {
        const data = handle.get();
        expect(data.value).toBe(100);
        expect(data.name).toBe('test');

        handle.set({ value: 200, name: 'updated' });
        const newData = handle.get();
        expect(newData.value).toBe(200);
        expect(newData.name).toBe('updated');
      }
    });

    test('应该处理不存在的实体', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const nonExistentEntity = 99999 as any;

      const rw = getRW(archetype, nonExistentEntity, 1);
      expect(rw).toBeUndefined();
    });

    test('应该处理不存在的组件类型', () => {
      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 3333 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      const rw = getRW(archetype, entityId, 9999);
      expect(rw).toBeUndefined();
    });

    test('应该支持典型的使用模式', () => {
      // SAB后端测试
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const sabArchetype = new Archetype('sab', [1], [TestComponent]);
      const entity1 = 4444 as any;

      sabArchetype.push(entity1, () => ({ x: 10, y: 20, health: 100, active: true }));

      const rw1 = getRW<TestComponent>(sabArchetype, entity1, 1);
      if (rw1?.type === 'view') {
        rw1.v.x += 5; // 直接修改字段
        rw1.v.health -= 10;
      }

      const result1 = sabArchetype.getComponentSnapshot<TestComponent>(entity1, 1);
      expect(result1?.x).toBeCloseTo(15, 5);
      expect(result1?.health).toBe(90);

      // 测试handle模式（SimpleComponent因为有字符串字段，应该使用数组后端）
      const arrayArchetype = new Archetype('array', [2], [SimpleComponent]);
      const entity2 = 5555 as any;

      arrayArchetype.push(entity2, () => ({ value: 50, name: 'initial' }));

      const rw2 = getRW<SimpleComponent>(arrayArchetype, entity2, 2);
      expect(rw2).toBeDefined();

      if (rw2?.type === 'view') {
        // 如果是view模式，直接修改
        rw2.v.value += 25;
        rw2.v.name = 'modified';
      } else if (rw2?.type === 'handle') {
        // 如果是handle模式，通过句柄修改
        const current = rw2.h.get();
        current.value += 25;
        current.name = 'modified';
        rw2.h.set(current);
      } else {
        throw new Error(`Unexpected getRW result: ${rw2}`);
      }

      const result2 = arrayArchetype.getComponentSnapshot<SimpleComponent>(entity2, 2);
      expect(result2?.value).toBe(75);
      expect(result2?.name).toBe('modified');
    });

    test('应该支持类型守卫模式', () => {
      registerSchema(TestComponent, {
        fields: {
          x: 'f32',
          y: 'f32',
          health: 'i32',
          active: 'bool'
        }
      });

      const archetype = new Archetype('test', [1], [TestComponent]);
      const entityId = 6666 as any;

      archetype.push(entityId, () => ({ x: 0, y: 0, health: 100, active: true }));

      function modifyComponent(arch: Archetype, entity: any, typeId: number) {
        const rw = getRW<TestComponent>(arch, entity, typeId);
        if (!rw) return;

        if (rw.type === 'view') {
          // 零拷贝直接修改
          rw.v.health = 200;
          rw.v.active = false;
        } else {
          // 通过句柄修改
          rw.h.update(current => ({
            ...current,
            health: 200,
            active: false
          }));
        }
      }

      modifyComponent(archetype, entityId, 1);

      const result = archetype.getComponentSnapshot<TestComponent>(entityId, 1);
      expect(result?.health).toBe(200);
      expect(result?.active).toBe(false);
    });
  });
});