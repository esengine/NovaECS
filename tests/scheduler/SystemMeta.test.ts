/**
 * SystemMeta tests
 * SystemMeta 测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  SystemMeta,
  SystemMetaBuilder,
  SystemMetaRegistry,
  createSystemMeta,
  AccessMode,
  ComponentAccess,
  ResourceAccess,
  SystemHandle,
  TypeId,
  ResourceId
} from '../../src/scheduler/SystemMeta';

describe('SystemMeta', () => {
  describe('AccessMode', () => {
    test('应该定义正确的访问模式', () => {
      expect(AccessMode.Read).toBe('read');
      expect(AccessMode.Write).toBe('write');
      expect(AccessMode.ReadWrite).toBe('readwrite');
    });
  });

  describe('SystemMetaBuilder', () => {
    let builder: SystemMetaBuilder;

    beforeEach(() => {
      builder = new SystemMetaBuilder('test-system', 'Test System');
    });

    test('应该创建基础系统元数据', () => {
      const meta = builder.build();

      expect(meta.handle).toBe('test-system');
      expect(meta.name).toBe('Test System');
      expect(meta.components).toEqual([]);
      expect(meta.resources).toEqual([]);
      expect(meta.dependencies).toEqual([]);
      expect(meta.dependents).toEqual([]);
      expect(meta.parallelizable).toBe(true);
      expect(meta.priority).toBeUndefined();
      expect(meta.estimatedTime).toBeUndefined();
    });

    test('应该添加组件访问', () => {
      const meta = builder
        .reads('Position')
        .writes('Velocity')
        .readWrites('Transform')
        .build();

      expect(meta.components).toHaveLength(3);
      expect(meta.components).toContainEqual({ typeId: 'Position', mode: AccessMode.Read });
      expect(meta.components).toContainEqual({ typeId: 'Velocity', mode: AccessMode.Write });
      expect(meta.components).toContainEqual({ typeId: 'Transform', mode: AccessMode.ReadWrite });
    });

    test('应该添加多个组件访问', () => {
      const meta = builder
        .readsMany(['Position', 'Scale'])
        .writesMany(['Velocity', 'Acceleration'])
        .build();

      expect(meta.components).toHaveLength(4);
      expect(meta.components).toContainEqual({ typeId: 'Position', mode: AccessMode.Read });
      expect(meta.components).toContainEqual({ typeId: 'Scale', mode: AccessMode.Read });
      expect(meta.components).toContainEqual({ typeId: 'Velocity', mode: AccessMode.Write });
      expect(meta.components).toContainEqual({ typeId: 'Acceleration', mode: AccessMode.Write });
    });

    test('应该添加资源访问', () => {
      const meta = builder
        .exclusiveResource('Physics')
        .sharedResource('Renderer')
        .build();

      expect(meta.resources).toHaveLength(2);
      expect(meta.resources).toContainEqual({ resourceId: 'Physics', exclusive: true });
      expect(meta.resources).toContainEqual({ resourceId: 'Renderer', exclusive: false });
    });

    test('应该添加系统依赖', () => {
      const meta = builder
        .dependsOn('InputSystem')
        .dependsOnMany(['PhysicsSystem', 'AnimationSystem'])
        .dependentSystem('RenderSystem')
        .build();

      expect(meta.dependencies).toContain('InputSystem');
      expect(meta.dependencies).toContain('PhysicsSystem');
      expect(meta.dependencies).toContain('AnimationSystem');
      expect(meta.dependents).toContain('RenderSystem');
    });

    test('应该设置系统属性', () => {
      const meta = builder
        .setPriority(10)
        .setParallelizable(false)
        .setEstimatedTime(16.67)
        .build();

      expect(meta.priority).toBe(10);
      expect(meta.parallelizable).toBe(false);
      expect(meta.estimatedTime).toBe(16.67);
    });

    test('应该在缺少必需参数时抛出错误', () => {
      const emptyBuilder = new SystemMetaBuilder('', '');
      expect(() => emptyBuilder.build()).toThrow('SystemMeta requires handle and name');
    });

    test('应该支持链式调用', () => {
      const meta = builder
        .reads('Position')
        .writes('Velocity')
        .exclusiveResource('Physics')
        .dependsOn('InputSystem')
        .setPriority(5)
        .build();

      expect(meta.components).toHaveLength(2);
      expect(meta.resources).toHaveLength(1);
      expect(meta.dependencies).toHaveLength(1);
      expect(meta.priority).toBe(5);
    });
  });

  describe('createSystemMeta', () => {
    test('应该创建SystemMetaBuilder', () => {
      const builder = createSystemMeta('test', 'Test');
      expect(builder).toBeInstanceOf(SystemMetaBuilder);

      const meta = builder.build();
      expect(meta.handle).toBe('test');
      expect(meta.name).toBe('Test');
    });
  });

  describe('SystemMetaRegistry', () => {
    let registry: SystemMetaRegistry;
    let testMeta: SystemMeta;

    beforeEach(() => {
      registry = new SystemMetaRegistry();
      testMeta = createSystemMeta('test-system', 'Test System')
        .reads('Position')
        .writes('Velocity')
        .setPriority(5)
        .build();
    });

    test('应该注册和获取系统元数据', () => {
      registry.register(testMeta);

      const retrieved = registry.get('test-system');
      expect(retrieved).toBe(testMeta);
    });

    test('应该通过名称获取系统元数据', () => {
      registry.register(testMeta);

      const retrieved = registry.getByName('Test System');
      expect(retrieved).toBe(testMeta);
    });

    test('应该检查系统是否已注册', () => {
      expect(registry.has('test-system')).toBe(false);
      expect(registry.hasName('Test System')).toBe(false);

      registry.register(testMeta);

      expect(registry.has('test-system')).toBe(true);
      expect(registry.hasName('Test System')).toBe(true);
    });

    test('应该防止重复注册', () => {
      registry.register(testMeta);

      expect(() => registry.register(testMeta)).toThrow("System with handle 'test-system' already registered");
    });

    test('应该防止重复名称注册', () => {
      registry.register(testMeta);

      const duplicateName = createSystemMeta('other-handle', 'Test System').build();
      expect(() => registry.register(duplicateName)).toThrow("System with name 'Test System' already registered");
    });

    test('应该取消注册系统', () => {
      registry.register(testMeta);

      const success = registry.unregister('test-system');
      expect(success).toBe(true);
      expect(registry.has('test-system')).toBe(false);
      expect(registry.hasName('Test System')).toBe(false);
    });

    test('应该获取所有系统', () => {
      const meta2 = createSystemMeta('system2', 'System 2').build();
      registry.register(testMeta);
      registry.register(meta2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(testMeta);
      expect(all).toContain(meta2);
    });

    test('应该获取所有系统句柄', () => {
      const meta2 = createSystemMeta('system2', 'System 2').build();
      registry.register(testMeta);
      registry.register(meta2);

      const handles = registry.getAllHandles();
      expect(handles).toHaveLength(2);
      expect(handles).toContain('test-system');
      expect(handles).toContain('system2');
    });

    test('应该清除所有系统', () => {
      registry.register(testMeta);
      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
      expect(registry.has('test-system')).toBe(false);
    });

    test('应该根据组件读取查找系统', () => {
      const meta2 = createSystemMeta('system2', 'System 2')
        .reads('Position')
        .writes('Scale')
        .build();

      registry.register(testMeta);
      registry.register(meta2);

      const readingPosition = registry.getSystemsReading('Position');
      expect(readingPosition).toHaveLength(2);
      expect(readingPosition).toContain(testMeta);
      expect(readingPosition).toContain(meta2);

      const readingVelocity = registry.getSystemsReading('Velocity');
      expect(readingVelocity).toHaveLength(0);
    });

    test('应该根据组件写入查找系统', () => {
      const meta2 = createSystemMeta('system2', 'System 2')
        .readWrites('Position')
        .writes('Scale')
        .build();

      registry.register(testMeta);
      registry.register(meta2);

      const writingPosition = registry.getSystemsWriting('Position');
      expect(writingPosition).toHaveLength(1);
      expect(writingPosition).toContain(meta2);

      const writingVelocity = registry.getSystemsWriting('Velocity');
      expect(writingVelocity).toHaveLength(1);
      expect(writingVelocity).toContain(testMeta);
    });

    test('应该根据资源访问查找系统', () => {
      const meta2 = createSystemMeta('system2', 'System 2')
        .exclusiveResource('Physics')
        .sharedResource('Input')
        .build();

      const meta3 = createSystemMeta('system3', 'System 3')
        .sharedResource('Physics')
        .build();

      registry.register(testMeta);
      registry.register(meta2);
      registry.register(meta3);

      const accessingPhysics = registry.getSystemsAccessingResource('Physics');
      expect(accessingPhysics).toHaveLength(2);
      expect(accessingPhysics).toContain(meta2);
      expect(accessingPhysics).toContain(meta3);

      const exclusivePhysics = registry.getSystemsWithExclusiveResource('Physics');
      expect(exclusivePhysics).toHaveLength(1);
      expect(exclusivePhysics).toContain(meta2);
    });
  });

  describe('ComponentAccess', () => {
    test('应该定义正确的组件访问结构', () => {
      const access: ComponentAccess = {
        typeId: 'Position',
        mode: AccessMode.Read
      };

      expect(access.typeId).toBe('Position');
      expect(access.mode).toBe(AccessMode.Read);
    });
  });

  describe('ResourceAccess', () => {
    test('应该定义正确的资源访问结构', () => {
      const access: ResourceAccess = {
        resourceId: 'Physics',
        exclusive: true
      };

      expect(access.resourceId).toBe('Physics');
      expect(access.exclusive).toBe(true);
    });
  });
});