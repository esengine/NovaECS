import { BasePlugin } from '../../src/core/BasePlugin';
import { World } from '../../src/core/World';
import { PluginPriority } from '../../src/utils/PluginTypes';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Test plugin implementation
class TestPlugin extends BasePlugin {
  public installCalled = false;
  public uninstallCalled = false;
  public updateCalled = false;
  public configChangedCalled = false;

  constructor() {
    super({
      name: 'TestPlugin',
      version: '1.0.0',
      description: 'Test plugin for unit tests',
      author: 'Test Author',
      license: 'MIT',
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

  protected onConfigChanged(): void {
    this.configChangedCalled = true;
  }

  // Public methods for testing protected functionality
  public testGetConfigValue<T>(key: string, defaultValue: T): T {
    return this.getConfigValue(key, defaultValue);
  }

  public testSetConfigValue<T>(key: string, value: T): void {
    this.setConfigValue(key, value);
  }

  public testIsInstalled(): boolean {
    return this.isInstalled();
  }

  public testAssertInstalled(): void {
    this.assertInstalled();
  }

  public testLog(message: string): void {
    this.log(message);
  }

  public testWarn(message: string): void {
    this.warn(message);
  }

  public testError(message: string): void {
    this.error(message);
  }
}

class ConfigValidatingPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'ConfigValidatingPlugin',
      version: '1.0.0',
      description: 'Plugin that validates configuration'
    });
  }

  async install(): Promise<void> {
    // Installation logic
  }

  async uninstall(): Promise<void> {
    // Uninstallation logic
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.required === 'string' && typeof config.optional === 'number';
  }
}

describe('BasePlugin', () => {
  let plugin: TestPlugin;
  let world: World;

  beforeEach(() => {
    plugin = new TestPlugin();
    world = new World();
  });

  test('should initialize with correct metadata', () => {
    expect(plugin.metadata.name).toBe('TestPlugin');
    expect(plugin.metadata.version).toBe('1.0.0');
    expect(plugin.metadata.description).toBe('Test plugin for unit tests');
    expect(plugin.metadata.author).toBe('Test Author');
    expect(plugin.metadata.license).toBe('MIT');
    expect(plugin.metadata.priority).toBe(PluginPriority.Normal);
  });

  test('should be enabled by default', () => {
    expect(plugin.enabled).toBe(true);
  });

  test('should allow enabling/disabling', () => {
    plugin.enabled = false;
    expect(plugin.enabled).toBe(false);

    plugin.enabled = true;
    expect(plugin.enabled).toBe(true);
  });

  test('should not have world reference initially', () => {
    expect(plugin.world).toBeUndefined();
  });

  test('should set world reference on world create', async () => {
    await plugin.onWorldCreate?.(world);
    expect(plugin.world).toBe(world);
  });

  test('should clear world reference on world destroy', async () => {
    await plugin.onWorldCreate?.(world);
    expect(plugin.world).toBe(world);

    await plugin.onWorldDestroy?.(world);
    expect(plugin.world).toBeUndefined();
  });

  test('should manage configuration', () => {
    const config = { key1: 'value1', key2: 42 };

    plugin.setConfig(config);
    expect(plugin.getConfig()).toEqual(config);
    expect(plugin.configChangedCalled).toBe(true);
  });

  test('should get configuration value with default', () => {
    plugin.setConfig({ existing: 'value' });

    expect(plugin.testGetConfigValue('existing', 'default')).toBe('value');
    expect(plugin.testGetConfigValue('missing', 'default')).toBe('default');
  });

  test('should set configuration value', () => {
    plugin.testSetConfigValue('key', 'value');
    expect(plugin.testGetConfigValue('key', null)).toBe('value');
  });

  test('should validate configuration by default', () => {
    expect(plugin.validateConfig({ any: 'config' })).toBe(true);
  });

  test('should validate configuration with custom validator', () => {
    const validatingPlugin = new ConfigValidatingPlugin();

    expect(validatingPlugin.validateConfig({ required: 'test', optional: 42 })).toBe(true);
    expect(validatingPlugin.validateConfig({ required: 'test' })).toBe(false);
    expect(validatingPlugin.validateConfig({ optional: 42 })).toBe(false);
  });

  test('should provide status information', () => {
    plugin.setConfig({ test: true });
    
    const status = plugin.getStatus();

    expect(status.name).toBe('TestPlugin');
    expect(status.version).toBe('1.0.0');
    expect(status.enabled).toBe(true);
    expect(status.hasWorld).toBe(false);
    expect(status.config).toEqual({ test: true });
  });

  test('should check installation state', () => {
    expect(plugin.testIsInstalled()).toBe(false);

    plugin.onWorldCreate?.(world);
    expect(plugin.testIsInstalled()).toBe(true);
  });

  test('should assert installation state', async () => {
    expect(() => plugin.testAssertInstalled()).toThrow('Plugin TestPlugin is not installed');

    await plugin.onWorldCreate?.(world);
    expect(() => plugin.testAssertInstalled()).not.toThrow();
  });

  test('should log messages with plugin prefix', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    plugin.testLog('info message');
    plugin.testWarn('warning message');
    plugin.testError('error message');

    expect(consoleSpy).toHaveBeenCalledWith('[TestPlugin] info message');
    expect(warnSpy).toHaveBeenCalledWith('[TestPlugin] warning message');
    expect(errorSpy).toHaveBeenCalledWith('[TestPlugin] error message');

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('should call lifecycle hooks', async () => {
    const entity = world.createEntity();
    const system = { constructor: { name: 'TestSystem' } } as any;
    const component = { constructor: { name: 'TestComponent' } } as any;

    // Test all lifecycle hooks exist and can be called
    await plugin.onWorldCreate?.(world);
    await plugin.onWorldDestroy?.(world);
    await plugin.onWorldUpdateStart?.(world, 16);
    await plugin.onWorldUpdateEnd?.(world, 16);
    await plugin.onEntityCreate?.(entity);
    await plugin.onEntityDestroy?.(entity);
    await plugin.onSystemAdd?.(system);
    await plugin.onSystemRemove?.(system);
    await plugin.onComponentAdd?.(entity, component);
    await plugin.onComponentRemove?.(entity, component);

    // Should not throw any errors
    expect(true).toBe(true);
  });

  test('should handle abstract methods', async () => {
    // These should be implemented by subclasses
    await expect(plugin.install()).resolves.not.toThrow();
    await expect(plugin.uninstall()).resolves.not.toThrow();

    expect(plugin.installCalled).toBe(true);
    expect(plugin.uninstallCalled).toBe(true);
  });

  test('should handle optional update method', () => {
    plugin.update?.();
    expect(plugin.updateCalled).toBe(true);
  });

  test('should create plugin with minimal metadata', () => {
    // Create a concrete implementation for testing
    class MinimalPlugin extends BasePlugin {
      async install(): Promise<void> {}
      async uninstall(): Promise<void> {}
    }

    const minimalPlugin = new MinimalPlugin({
      name: 'MinimalPlugin',
      version: '1.0.0'
    });

    expect(minimalPlugin.metadata.name).toBe('MinimalPlugin');
    expect(minimalPlugin.metadata.version).toBe('1.0.0');
    expect(minimalPlugin.metadata.description).toBeUndefined();
    expect(minimalPlugin.metadata.author).toBeUndefined();
  });

  test('should handle configuration immutability', () => {
    const originalConfig = { key: 'value' };
    plugin.setConfig(originalConfig);

    const retrievedConfig = plugin.getConfig();
    retrievedConfig.key = 'modified';

    // Original config should not be modified
    expect(plugin.getConfig().key).toBe('value');
  });
});
