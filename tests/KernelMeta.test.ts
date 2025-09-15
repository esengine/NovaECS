/**
 * Test kernel metadata system for static write analysis
 * 测试内核元数据系统用于静态写分析
 */

import { 
  registerHostKernel,
  getHostKernel,
  getKernelMeta, 
  hasKernelMeta, 
  getRegisteredKernelIds, 
  clearHostKernels,
  validateWrittenAgainstMeta,
  type HostKernel,
  type KernelMeta
} from '../src/parallel/KernelRegistry';

describe('Unified KernelRegistry', () => {
  beforeEach(() => {
    clearHostKernels();
  });

  describe('registerHostKernel', () => {
    test('应该注册宿主内核函数和元数据', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [0, 1] });
      const meta: KernelMeta = { writes: [0, 1, 3] };
      
      registerHostKernel('test-kernel', hostKernel, meta);

      expect(hasKernelMeta('test-kernel')).toBe(true);
      expect(getKernelMeta('test-kernel')).toEqual(meta);
      expect(getHostKernel('test-kernel')).toBe(hostKernel);
    });

    test('应该允许覆盖已有的内核和元数据', () => {
      const hostKernel1: HostKernel = (cols, length) => ({ written: [0] });
      const meta1: KernelMeta = { writes: [0, 1] };
      const hostKernel2: HostKernel = (cols, length) => ({ written: [2] });
      const meta2: KernelMeta = { writes: [2, 3, 4] };
      
      registerHostKernel('overwrite-test', hostKernel1, meta1);
      expect(getKernelMeta('overwrite-test')).toEqual(meta1);
      expect(getHostKernel('overwrite-test')).toBe(hostKernel1);
      
      registerHostKernel('overwrite-test', hostKernel2, meta2);
      expect(getKernelMeta('overwrite-test')).toEqual(meta2);
      expect(getHostKernel('overwrite-test')).toBe(hostKernel2);
    });

    test('应该支持空写集合的只读内核', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [] });
      const meta: KernelMeta = { writes: [] };
      
      registerHostKernel('read-only-kernel', hostKernel, meta);

      expect(getKernelMeta('read-only-kernel')).toEqual(meta);
      expect(getHostKernel('read-only-kernel')).toBe(hostKernel);
    });
  });

  describe('getKernelMeta', () => {
    test('应该返回未注册内核的undefined', () => {
      expect(getKernelMeta('non-existent')).toBeUndefined();
    });

    test('应该返回正确的元数据', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [1, 2, 5] });
      const meta: KernelMeta = { writes: [1, 2, 5] };
      
      registerHostKernel('get-test', hostKernel, meta);

      const retrieved = getKernelMeta('get-test');
      expect(retrieved).toEqual(meta);
      expect(retrieved).not.toBe(meta); // Should be a separate object
    });
  });

  describe('hasKernelMeta', () => {
    test('应该正确检查元数据是否存在', () => {
      expect(hasKernelMeta('not-registered')).toBe(false);
      
      const hostKernel: HostKernel = (cols, length) => ({ written: [0] });
      registerHostKernel('registered', hostKernel, { writes: [0] });
      expect(hasKernelMeta('registered')).toBe(true);
    });
  });

  describe('getRegisteredKernelIds', () => {
    test('应该返回空数组当无注册时', () => {
      expect(getRegisteredKernelIds()).toEqual([]);
    });

    test('应该返回所有注册的内核ID', () => {
      const kernel1: HostKernel = (cols, length) => ({ written: [0] });
      const kernel2: HostKernel = (cols, length) => ({ written: [1, 2] });
      const kernel3: HostKernel = (cols, length) => ({ written: [] });
      
      registerHostKernel('kernel1', kernel1, { writes: [0] });
      registerHostKernel('kernel2', kernel2, { writes: [1, 2] });
      registerHostKernel('kernel3', kernel3, { writes: [] });

      const ids = getRegisteredKernelIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('kernel1');
      expect(ids).toContain('kernel2');
      expect(ids).toContain('kernel3');
    });
  });

  describe('clearHostKernels', () => {
    test('应该清除所有内核和元数据', () => {
      const kernel1: HostKernel = (cols, length) => ({ written: [0] });
      const kernel2: HostKernel = (cols, length) => ({ written: [1] });
      
      registerHostKernel('clear1', kernel1, { writes: [0] });
      registerHostKernel('clear2', kernel2, { writes: [1] });
      
      expect(getRegisteredKernelIds()).toHaveLength(2);
      
      clearHostKernels();
      
      expect(getRegisteredKernelIds()).toHaveLength(0);
      expect(hasKernelMeta('clear1')).toBe(false);
      expect(hasKernelMeta('clear2')).toBe(false);
    });
  });

  describe('validateWrittenAgainstMeta', () => {
    test('应该验证运行时写入与元数据匹配', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [0, 1, 2, 5] });
      registerHostKernel('valid-kernel', hostKernel, { writes: [0, 1, 2, 5] });

      // Runtime writes subset of declared
      const result1 = validateWrittenAgainstMeta('valid-kernel', [0, 2]);
      expect(result1.isValid).toBe(true);
      expect(result1.message).toBeUndefined();

      // Runtime writes exactly match declared
      const result2 = validateWrittenAgainstMeta('valid-kernel', [0, 1, 2, 5]);
      expect(result2.isValid).toBe(true);

      // Empty runtime writes should be valid
      const result3 = validateWrittenAgainstMeta('valid-kernel', []);
      expect(result3.isValid).toBe(true);
    });

    test('应该检测未声明的写入', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [1, 3] });
      registerHostKernel('restricted-kernel', hostKernel, { writes: [1, 3] });

      // Write to undeclared column
      const result1 = validateWrittenAgainstMeta('restricted-kernel', [1, 4]);
      expect(result1.isValid).toBe(false);
      expect(result1.message).toContain("wrote to undeclared columns [4]");
      expect(result1.message).toContain("Declared writes: [1, 3]");

      // Multiple undeclared writes
      const result2 = validateWrittenAgainstMeta('restricted-kernel', [0, 1, 2, 4]);
      expect(result2.isValid).toBe(false);
      expect(result2.message).toContain("wrote to undeclared columns [0, 2, 4]");
    });

    test('应该处理未注册的内核', () => {
      const result = validateWrittenAgainstMeta('unregistered-kernel', [0, 1]);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("No metadata registered for kernel 'unregistered-kernel'");
      expect(result.message).toContain("Use registerHostKernel() first");
    });

    test('应该处理只读内核', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [] });
      registerHostKernel('read-only', hostKernel, { writes: [] });

      // No writes should be valid
      const result1 = validateWrittenAgainstMeta('read-only', []);
      expect(result1.isValid).toBe(true);

      // Any write should be invalid
      const result2 = validateWrittenAgainstMeta('read-only', [0]);
      expect(result2.isValid).toBe(false);
      expect(result2.message).toContain("wrote to undeclared columns [0]");
      expect(result2.message).toContain("Declared writes: []");
    });

    test('应该支持大列索引', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [10, 50, 100] });
      registerHostKernel('large-indices', hostKernel, { writes: [10, 50, 100] });

      const result1 = validateWrittenAgainstMeta('large-indices', [10, 100]);
      expect(result1.isValid).toBe(true);

      const result2 = validateWrittenAgainstMeta('large-indices', [10, 99]);
      expect(result2.isValid).toBe(false);
      expect(result2.message).toContain("wrote to undeclared columns [99]");
    });

    test('应该处理重复的运行时写入', () => {
      const hostKernel: HostKernel = (cols, length) => ({ written: [0, 1, 2] });
      registerHostKernel('duplicate-test', hostKernel, { writes: [0, 1, 2] });

      // Duplicates in runtime writes should still validate correctly
      const result = validateWrittenAgainstMeta('duplicate-test', [0, 1, 1, 2, 0]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('集成场景', () => {
    test('应该支持复杂的内核注册和验证流程', () => {
      // Register multiple kernels with different write patterns
      const physicsKernel: HostKernel = (cols, length) => ({ written: [0, 1] });
      const renderKernel: HostKernel = (cols, length) => ({ written: [2] });
      const collisionKernel: HostKernel = (cols, length) => ({ written: [] });
      const healthKernel: HostKernel = (cols, length) => ({ written: [3, 4] });
      
      registerHostKernel('physics-update', physicsKernel, { writes: [0, 1] }); // Position, Velocity
      registerHostKernel('render-prep', renderKernel, { writes: [2] }); // Transform
      registerHostKernel('collision-detect', collisionKernel, { writes: [] }); // Read-only
      registerHostKernel('health-regen', healthKernel, { writes: [3, 4] }); // Health, Mana

      // Verify all registered
      const allIds = getRegisteredKernelIds();
      expect(allIds).toHaveLength(4);

      // Test each kernel's validation
      expect(validateWrittenAgainstMeta('physics-update', [0]).isValid).toBe(true);
      expect(validateWrittenAgainstMeta('physics-update', [2]).isValid).toBe(false);

      expect(validateWrittenAgainstMeta('render-prep', [2]).isValid).toBe(true);
      expect(validateWrittenAgainstMeta('render-prep', [0, 2]).isValid).toBe(false);

      expect(validateWrittenAgainstMeta('collision-detect', []).isValid).toBe(true);
      expect(validateWrittenAgainstMeta('collision-detect', [0]).isValid).toBe(false);

      expect(validateWrittenAgainstMeta('health-regen', [3, 4]).isValid).toBe(true);
      expect(validateWrittenAgainstMeta('health-regen', [3]).isValid).toBe(true);
      expect(validateWrittenAgainstMeta('health-regen', [3, 4, 5]).isValid).toBe(false);
    });
  });
});