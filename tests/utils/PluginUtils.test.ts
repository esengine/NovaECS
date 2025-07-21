import { PluginUtils } from '../../src/utils/PluginUtils';
import { BasePlugin } from '../../src/core/BasePlugin';
import { World } from '../../src/core/World';
import { PluginPriority } from '../../src/utils/PluginTypes';
import { beforeEach, describe, expect, test } from 'vitest';

// Test plugin implementations
class TestPlugin extends BasePlugin {
  constructor(name = 'TestPlugin', dependencies: string[] = []) {
    super({
      name,
      version: '1.0.0',
      description: 'Test plugin',
      dependencies,
      priority: PluginPriority.Normal
    });
  }

  async install(): Promise<void> {
    // Installation logic
  }

  async uninstall(): Promise<void> {
    // Uninstallation logic
  }

  // Method to set minEcsVersion for testing
  setMinEcsVersion(version: string): void {
    (this.metadata as any).minEcsVersion = version;
  }
}

class DependentPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'DependentPlugin',
      version: '1.0.0',
      dependencies: ['TestPlugin']
    });
  }

  async install(): Promise<void> {
    // Installation logic
  }

  async uninstall(): Promise<void> {
    // Uninstallation logic
  }
}

describe('PluginUtils', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('createMetadata', () => {
    test('should create metadata with defaults', () => {
      const metadata = PluginUtils.createMetadata({
        name: 'TestPlugin',
        version: '1.0.0'
      });

      expect(metadata.name).toBe('TestPlugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('Plugin TestPlugin');
      expect(metadata.author).toBe('Unknown');
      expect(metadata.license).toBe('MIT');
      expect(metadata.keywords).toEqual([]);
      expect(metadata.dependencies).toEqual([]);
      expect(metadata.priority).toBe(PluginPriority.Normal);
    });

    test('should override defaults with provided values', () => {
      const metadata = PluginUtils.createMetadata({
        name: 'CustomPlugin',
        version: '2.0.0',
        description: 'Custom description',
        author: 'Custom Author',
        license: 'Apache-2.0',
        keywords: ['test', 'plugin'],
        dependencies: ['OtherPlugin'],
        priority: PluginPriority.High
      });

      expect(metadata.description).toBe('Custom description');
      expect(metadata.author).toBe('Custom Author');
      expect(metadata.license).toBe('Apache-2.0');
      expect(metadata.keywords).toEqual(['test', 'plugin']);
      expect(metadata.dependencies).toEqual(['OtherPlugin']);
      expect(metadata.priority).toBe(PluginPriority.High);
    });
  });

  describe('validateMetadata', () => {
    test('should validate correct metadata', () => {
      const metadata = {
        name: 'TestPlugin',
        version: '1.0.0',
        description: 'Test plugin',
        dependencies: ['OtherPlugin'],
        optionalDependencies: ['OptionalPlugin'],
        conflicts: ['ConflictingPlugin']
      };

      const result = PluginUtils.validateMetadata(metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject metadata without name', () => {
      const metadata = {
        version: '1.0.0'
      } as any;

      const result = PluginUtils.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plugin name is required and must be a string');
    });

    test('should reject metadata without version', () => {
      const metadata = {
        name: 'TestPlugin'
      } as any;

      const result = PluginUtils.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plugin version is required and must be a string');
    });

    test('should reject invalid semver version', () => {
      const metadata = {
        name: 'TestPlugin',
        version: 'invalid-version'
      };

      const result = PluginUtils.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plugin version must follow semver format (e.g., 1.0.0)');
    });

    test('should reject invalid dependencies format', () => {
      const metadata = {
        name: 'TestPlugin',
        version: '1.0.0',
        dependencies: 'not-an-array'
      } as any;

      const result = PluginUtils.validateMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Dependencies must be an array');
    });
  });

  describe('isCompatible', () => {
    test('should be compatible when no minimum version is specified', () => {
      const plugin = new TestPlugin();
      const result = PluginUtils.isCompatible(plugin, '1.0.0');

      expect(result).toBe(true);
    });

    test('should be compatible when ECS version meets minimum requirement', () => {
      const plugin = new TestPlugin();
      plugin.setMinEcsVersion('1.0.0');

      expect(PluginUtils.isCompatible(plugin, '1.0.0')).toBe(true);
      expect(PluginUtils.isCompatible(plugin, '1.1.0')).toBe(true);
      expect(PluginUtils.isCompatible(plugin, '2.0.0')).toBe(true);
    });

    test('should be incompatible when ECS version is below minimum requirement', () => {
      const plugin = new TestPlugin();
      plugin.setMinEcsVersion('2.0.0');

      expect(PluginUtils.isCompatible(plugin, '1.0.0')).toBe(false);
      expect(PluginUtils.isCompatible(plugin, '1.9.9')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    test('should compare versions correctly', () => {
      expect(PluginUtils.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(PluginUtils.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(PluginUtils.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(PluginUtils.compareVersions('1.1.0', '1.0.9')).toBe(1);
      expect(PluginUtils.compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    test('should handle different version lengths', () => {
      expect(PluginUtils.compareVersions('1.0', '1.0.0')).toBe(0);
      expect(PluginUtils.compareVersions('1.0.0', '1.0')).toBe(0);
      expect(PluginUtils.compareVersions('1.0.1', '1.0')).toBe(1);
    });
  });

  describe('createConfigValidator', () => {
    test('should create validator that accepts valid configuration', () => {
      const schema = {
        name: { type: 'string', required: true },
        count: { type: 'number', required: false },
        items: { type: 'array', required: false }
      };

      const validator = PluginUtils.createConfigValidator(schema);

      expect(validator({ name: 'test', count: 42, items: [1, 2, 3] })).toBe(true);
      expect(validator({ name: 'test' })).toBe(true);
    });

    test('should create validator that rejects invalid configuration', () => {
      const schema = {
        name: { type: 'string', required: true },
        count: { type: 'number', required: false }
      };

      const validator = PluginUtils.createConfigValidator(schema);

      expect(validator({})).toBe(false); // Missing required field
      expect(validator({ name: 123 })).toBe(false); // Wrong type
      expect(validator({ name: 'test', count: 'not-a-number' })).toBe(false); // Wrong type
    });

    test('should handle array type validation', () => {
      const schema = {
        items: { type: 'array', required: true }
      };

      const validator = PluginUtils.createConfigValidator(schema);

      expect(validator({ items: [1, 2, 3] })).toBe(true);
      expect(validator({ items: [] })).toBe(true);
      expect(validator({ items: 'not-an-array' })).toBe(false);
    });
  });

  describe('applyDefaults', () => {
    test('should apply default values', () => {
      const config = { name: 'test' };
      const defaults = { name: 'default', count: 42, enabled: true };

      const result = PluginUtils.applyDefaults(config, defaults);

      expect(result).toEqual({ name: 'test', count: 42, enabled: true });
    });

    test('should not override existing values', () => {
      const config = { name: 'test', count: 100 };
      const defaults = { name: 'default', count: 42, enabled: true };

      const result = PluginUtils.applyDefaults(config, defaults);

      expect(result).toEqual({ name: 'test', count: 100, enabled: true });
    });

    test('should ignore null and undefined values in config', () => {
      const config = { name: 'test', count: null, enabled: undefined };
      const defaults = { name: 'default', count: 42, enabled: true };

      const result = PluginUtils.applyDefaults(config, defaults);

      expect(result).toEqual({ name: 'test', count: 42, enabled: true });
    });
  });

  describe('createInstallationHelper', () => {
    test('should create installation helper', () => {
      const helper = PluginUtils.createInstallationHelper(world);

      expect(helper).toBeDefined();
      expect(typeof helper.installMany).toBe('function');
      expect(typeof helper.sortByDependencies).toBe('function');
    });

    test('should sort plugins by dependencies', () => {
      const helper = PluginUtils.createInstallationHelper(world);
      const testPlugin = new TestPlugin();
      const dependentPlugin = new DependentPlugin();

      const sorted = helper.sortByDependencies([dependentPlugin, testPlugin]);

      expect(sorted[0]).toBe(testPlugin);
      expect(sorted[1]).toBe(dependentPlugin);
    });

    test('should detect circular dependencies', () => {
      const helper = PluginUtils.createInstallationHelper(world);
      const plugin1 = new TestPlugin('Plugin1', ['Plugin2']);
      const plugin2 = new TestPlugin('Plugin2', ['Plugin1']);

      expect(() => helper.sortByDependencies([plugin1, plugin2])).toThrow('Circular dependency detected');
    });

    test('should install multiple plugins successfully', async () => {
      const helper = PluginUtils.createInstallationHelper(world);
      const testPlugin = new TestPlugin();
      const dependentPlugin = new DependentPlugin();

      const result = await helper.installMany([dependentPlugin, testPlugin]);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(world.plugins.has('TestPlugin')).toBe(true);
      expect(world.plugins.has('DependentPlugin')).toBe(true);
    });
  });
});
