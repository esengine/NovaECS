import { PluginManager } from '../../src/core/PluginManager';
import { BasePlugin } from '../../src/core/BasePlugin';
import { World } from '../../src/core/World';
import { PluginPriority, PluginState } from '../../src/utils/PluginTypes';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Test plugin implementations
class TestPlugin extends BasePlugin {
  public installCalled = false;
  public uninstallCalled = false;
  public updateCalled = false;

  constructor(name = 'TestPlugin', version = '1.0.0') {
    super({
      name,
      version,
      description: 'Test plugin for unit tests',
      priority: PluginPriority.Normal
    });
  }

  async install(): Promise<void> {
    this.installCalled = true;
  }

  async uninstall(): Promise<void> {
    this.uninstallCalled = true;
  }

  update(): void {
    this.updateCalled = true;
  }
}

class DependentPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'DependentPlugin',
      version: '1.0.0',
      description: 'Plugin with dependencies',
      dependencies: ['TestPlugin'],
      priority: PluginPriority.Low
    });
  }

  async install(): Promise<void> {
    // Installation logic
  }

  async uninstall(): Promise<void> {
    // Uninstallation logic
  }
}

class ConflictingPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'ConflictingPlugin',
      version: '1.0.0',
      description: 'Plugin that conflicts with TestPlugin',
      conflicts: ['TestPlugin'],
      priority: PluginPriority.High
    });
  }

  async install(): Promise<void> {
    // Installation logic
  }

  async uninstall(): Promise<void> {
    // Uninstallation logic
  }
}

describe('PluginManager', () => {
  let world: World;
  let pluginManager: PluginManager;

  beforeEach(() => {
    world = new World();
    pluginManager = world.plugins;
  });

  test('should create plugin manager with world reference', () => {
    expect(pluginManager).toBeDefined();
    expect(pluginManager.registry).toBeDefined();
  });

  test('should install plugin successfully', async () => {
    const plugin = new TestPlugin();
    const result = await pluginManager.install(plugin);

    expect(result.success).toBe(true);
    expect(result.plugin).toBe(plugin);
    expect(result.duration).toBeGreaterThan(0);
    expect(plugin.installCalled).toBe(true);
    expect(pluginManager.has('TestPlugin')).toBe(true);
    expect(pluginManager.get('TestPlugin')).toBe(plugin);
  });

  test('should fail to install plugin twice', async () => {
    const plugin1 = new TestPlugin();
    const plugin2 = new TestPlugin();

    await pluginManager.install(plugin1);
    const result = await pluginManager.install(plugin2);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already installed');
  });

  test('should check dependencies before installation', async () => {
    const dependentPlugin = new DependentPlugin();
    const result = await pluginManager.install(dependentPlugin);

    expect(result.success).toBe(false);
    expect(result.error).toContain('unmet dependencies');
    expect(result.error).toContain('TestPlugin');
  });

  test('should install dependent plugin after dependency', async () => {
    const testPlugin = new TestPlugin();
    const dependentPlugin = new DependentPlugin();

    // Install dependency first
    await pluginManager.install(testPlugin);
    
    // Then install dependent plugin
    const result = await pluginManager.install(dependentPlugin);

    expect(result.success).toBe(true);
    expect(pluginManager.has('DependentPlugin')).toBe(true);
  });

  test('should check conflicts before installation', async () => {
    const testPlugin = new TestPlugin();
    const conflictingPlugin = new ConflictingPlugin();

    await pluginManager.install(testPlugin);
    const result = await pluginManager.install(conflictingPlugin, { force: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain('conflicts with');
    expect(result.error).toContain('TestPlugin');
  });

  test('should force install with conflicts when force option is used', async () => {
    const testPlugin = new TestPlugin();
    const conflictingPlugin = new ConflictingPlugin();

    await pluginManager.install(testPlugin);
    const result = await pluginManager.install(conflictingPlugin, { force: true });

    expect(result.success).toBe(true);
    expect(pluginManager.has('ConflictingPlugin')).toBe(true);
  });

  test('should uninstall plugin successfully', async () => {
    const plugin = new TestPlugin();
    await pluginManager.install(plugin);

    const result = await pluginManager.uninstall('TestPlugin');

    expect(result).toBe(true);
    expect(plugin.uninstallCalled).toBe(true);
    expect(pluginManager.has('TestPlugin')).toBe(false);
  });

  test('should fail to uninstall non-existent plugin', async () => {
    const result = await pluginManager.uninstall('NonExistentPlugin');

    expect(result).toBe(false);
  });

  test('should prevent uninstalling plugin with dependents', async () => {
    const testPlugin = new TestPlugin();
    const dependentPlugin = new DependentPlugin();

    await pluginManager.install(testPlugin);
    await pluginManager.install(dependentPlugin);

    const result = await pluginManager.uninstall('TestPlugin');

    expect(result).toBe(false);
    expect(pluginManager.has('TestPlugin')).toBe(true);
  });

  test('should list installed plugins', async () => {
    const plugin1 = new TestPlugin('Plugin1');
    const plugin2 = new TestPlugin('Plugin2');

    await pluginManager.install(plugin1);
    await pluginManager.install(plugin2);

    const pluginNames = pluginManager.list();

    expect(pluginNames).toContain('Plugin1');
    expect(pluginNames).toContain('Plugin2');
    expect(pluginNames).toHaveLength(2);
  });

  test('should get plugin state', async () => {
    const plugin = new TestPlugin();
    
    expect(pluginManager.getState('TestPlugin')).toBeUndefined();

    await pluginManager.install(plugin);
    expect(pluginManager.getState('TestPlugin')).toBe(PluginState.Installed);
  });

  test('should update plugins in priority order', async () => {
    // Create plugins with different priorities in constructor
    class HighPriorityPlugin extends BasePlugin {
      public updateCalled = false;

      constructor() {
        super({
          name: 'HighPriority',
          version: '1.0.0',
          description: 'High priority test plugin',
          priority: PluginPriority.High
        });
      }

      async install(): Promise<void> {}
      async uninstall(): Promise<void> {}

      update(_deltaTime: number): void {
        this.updateCalled = true;
      }
    }

    class LowPriorityPlugin extends BasePlugin {
      public updateCalled = false;

      constructor() {
        super({
          name: 'LowPriority',
          version: '1.0.0',
          description: 'Low priority test plugin',
          priority: PluginPriority.Low
        });
      }

      async install(): Promise<void> {}
      async uninstall(): Promise<void> {}

      update(_deltaTime: number): void {
        this.updateCalled = true;
      }
    }

    const highPriorityPlugin = new HighPriorityPlugin();
    const lowPriorityPlugin = new LowPriorityPlugin();

    await pluginManager.install(lowPriorityPlugin);
    await pluginManager.install(highPriorityPlugin);

    await pluginManager.update(16);

    expect(highPriorityPlugin.updateCalled).toBe(true);
    expect(lowPriorityPlugin.updateCalled).toBe(true);
  });

  test('should handle plugin configuration', async () => {
    const plugin = new TestPlugin();
    const config = { enabled: true, value: 42 };

    const result = await pluginManager.install(plugin, { config });

    expect(result.success).toBe(true);
    expect(plugin.getConfig()).toEqual(config);
  });

  test('should validate plugin configuration', async () => {
    const plugin = new TestPlugin();
    plugin.validateConfig = vi.fn().mockReturnValue(false);

    const result = await pluginManager.install(plugin, { config: { invalid: true } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid configuration');
    expect(plugin.validateConfig).toHaveBeenCalled();
  });

  test('should handle plugin installation errors', async () => {
    const plugin = new TestPlugin();
    plugin.install = vi.fn().mockRejectedValue(new Error('Installation failed'));

    const result = await pluginManager.install(plugin);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Installation failed');
    expect(pluginManager.getState('TestPlugin')).toBe(PluginState.Error);
  });

  test('should handle plugin update errors', async () => {
    const plugin = new TestPlugin();
    plugin.update = vi.fn().mockImplementation(() => {
      throw new Error('Update failed');
    });

    await pluginManager.install(plugin);

    // Should not throw, but log error
    await expect(pluginManager.update(16)).resolves.not.toThrow();
    expect(pluginManager.getState('TestPlugin')).toBe(PluginState.Error);
  });

  test('should register and retrieve plugins from registry', () => {
    const registry = pluginManager.registry;

    registry.register('TestPlugin', TestPlugin);

    expect(registry.has('TestPlugin')).toBe(true);
    expect(registry.get('TestPlugin')).toBe(TestPlugin);
    expect(registry.list()).toContain('TestPlugin');

    registry.unregister('TestPlugin');
    expect(registry.has('TestPlugin')).toBe(false);
  });

  describe('Hot Reload', () => {
    test('should hot reload installed plugin', async () => {
      const oldPlugin = new TestPlugin();
      await pluginManager.install(oldPlugin);

      expect(pluginManager.getState('TestPlugin')).toBe(PluginState.Installed);

      // Create new plugin version
      const newPlugin = new TestPlugin();
      newPlugin.setConfig({ newFeature: true });

      const result = await pluginManager.hotReload('TestPlugin', newPlugin);

      expect(result).toBe(true);
      expect(pluginManager.getState('TestPlugin')).toBe(PluginState.Installed);

      // Verify it's the new plugin instance
      const currentPlugin = pluginManager.get('TestPlugin');
      expect(currentPlugin).toBe(newPlugin);
    });

    test('should fail to hot reload non-existent plugin', async () => {
      const newPlugin = new TestPlugin();

      const result = await pluginManager.hotReload('NonExistent', newPlugin);

      expect(result).toBe(false);
    });

    test('should fail to hot reload uninstalled plugin', async () => {
      const plugin = new TestPlugin();
      await pluginManager.install(plugin);
      await pluginManager.uninstall('TestPlugin');

      const newPlugin = new TestPlugin();
      const result = await pluginManager.hotReload('TestPlugin', newPlugin);

      expect(result).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    test('should enable performance monitoring', () => {
      pluginManager.enablePerformanceMonitoring({
        enabled: true,
        warningThreshold: 10
      });

      const analyzer = pluginManager.getPerformanceAnalyzer();
      expect(analyzer).toBeDefined();
      expect(analyzer!.getConfig().warningThreshold).toBe(10);
    });

    test('should disable performance monitoring', () => {
      pluginManager.enablePerformanceMonitoring();
      expect(pluginManager.getPerformanceAnalyzer()).toBeDefined();

      pluginManager.disablePerformanceMonitoring();
      expect(pluginManager.getPerformanceAnalyzer()).toBeUndefined();
    });
  });

  describe('Sandbox Mode', () => {
    test('should enable sandbox mode', () => {
      pluginManager.enableSandbox({
        allowEval: false,
        executionTimeout: 1000
      });

      const sandbox = pluginManager.getSandbox();
      expect(sandbox).toBeDefined();
      expect(sandbox!.getConfig().executionTimeout).toBe(1000);
    });

    test('should disable sandbox mode', () => {
      pluginManager.enableSandbox();
      expect(pluginManager.getSandbox()).toBeDefined();

      pluginManager.disableSandbox();
      expect(pluginManager.getSandbox()).toBeUndefined();
    });
  });
});
