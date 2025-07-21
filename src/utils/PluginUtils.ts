import type { World } from '../core/World';
import type { Entity } from '../core/Entity';
import type { System } from '../core/System';
import type { ComponentType } from './Types';
import type {
  ECSPlugin,
  PluginMetadata,
  PluginInstallOptions
} from './PluginTypes';
import { PluginPriority } from './PluginTypes';

/**
 * Plugin utility functions for common plugin development tasks
 * 插件开发常用任务的实用工具函数
 */
export class PluginUtils {
  /**
   * Create plugin metadata with defaults
   * 创建带默认值的插件元数据
   * @param metadata Partial metadata | 部分元数据
   * @returns Complete metadata | 完整元数据
   */
  static createMetadata(metadata: Partial<PluginMetadata> & Pick<PluginMetadata, 'name' | 'version'>): PluginMetadata {
    return {
      description: `Plugin ${metadata.name}`,
      author: 'Unknown',
      license: 'MIT',
      keywords: [],
      dependencies: [],
      optionalDependencies: [],
      conflicts: [],
      priority: PluginPriority.Normal,
      ...metadata
    };
  }

  /**
   * Validate plugin metadata
   * 验证插件元数据
   * @param metadata Metadata to validate | 要验证的元数据
   * @returns Validation result | 验证结果
   */
  static validateMetadata(metadata: PluginMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    }

    // Validate semver format (basic check)
    if (metadata.version && !/^\d+\.\d+\.\d+/.test(metadata.version)) {
      errors.push('Plugin version must follow semver format (e.g., 1.0.0)');
    }

    if (metadata.dependencies && !Array.isArray(metadata.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    if (metadata.optionalDependencies && !Array.isArray(metadata.optionalDependencies)) {
      errors.push('Optional dependencies must be an array');
    }

    if (metadata.conflicts && !Array.isArray(metadata.conflicts)) {
      errors.push('Conflicts must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if plugin is compatible with ECS version
   * 检查插件是否与ECS版本兼容
   * @param plugin Plugin to check | 要检查的插件
   * @param ecsVersion Current ECS version | 当前ECS版本
   * @returns Whether plugin is compatible | 插件是否兼容
   */
  static isCompatible(plugin: ECSPlugin, ecsVersion: string): boolean {
    if (!plugin.metadata.minEcsVersion) {
      return true; // No minimum version requirement
    }

    return this.compareVersions(ecsVersion, plugin.metadata.minEcsVersion) >= 0;
  }

  /**
   * Compare two semver versions
   * 比较两个semver版本
   * @param version1 First version | 第一个版本
   * @param version2 Second version | 第二个版本
   * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }

  /**
   * Create a simple plugin configuration validator
   * 创建简单的插件配置验证器
   * @param schema Configuration schema | 配置模式
   * @returns Validator function | 验证器函数
   */
  static createConfigValidator(schema: Record<string, { type: string; required?: boolean; default?: unknown }>): (config: Record<string, unknown>) => boolean {
    return (config: Record<string, unknown>): boolean => {
      for (const [key, definition] of Object.entries(schema)) {
        const value = config[key];

        // Check required fields
        if (definition.required && (value === undefined || value === null)) {
          return false;
        }

        // Check type if value exists
        if (value !== undefined && value !== null) {
          const expectedType = definition.type;
          const actualType = typeof value;

          if (expectedType === 'array' && !Array.isArray(value)) {
            return false;
          } else if (expectedType !== 'array' && actualType !== expectedType) {
            return false;
          }
        }
      }

      return true;
    };
  }

  /**
   * Apply default configuration values
   * 应用默认配置值
   * @param config User configuration | 用户配置
   * @param defaults Default values | 默认值
   * @returns Merged configuration | 合并后的配置
   */
  static applyDefaults(config: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
    const result = { ...defaults };

    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create a plugin installation helper
   * 创建插件安装助手
   * @param world World instance | 世界实例
   * @returns Installation helper | 安装助手
   */
  static createInstallationHelper(world: World): {
    installMany(plugins: ECSPlugin[], options?: PluginInstallOptions): Promise<{ success: ECSPlugin[]; failed: { plugin: ECSPlugin; error: string }[] }>;
    sortByDependencies(plugins: ECSPlugin[]): ECSPlugin[];
  } {
    return {
      /**
       * Install multiple plugins in dependency order
       * 按依赖顺序安装多个插件
       * @param plugins Plugins to install | 要安装的插件
       * @param options Installation options | 安装选项
       */
      async installMany(
        plugins: ECSPlugin[],
        options?: PluginInstallOptions
      ): Promise<{ success: ECSPlugin[]; failed: { plugin: ECSPlugin; error: string }[] }> {
        const success: ECSPlugin[] = [];
        const failed: { plugin: ECSPlugin; error: string }[] = [];

        // Sort plugins by dependencies
        const sortedPlugins = this.sortByDependencies(plugins);

        for (const plugin of sortedPlugins) {
          try {
            const result = await world.plugins.install(plugin, options);
            if (result.success) {
              success.push(plugin);
            } else {
              failed.push({ plugin, error: result.error || 'Unknown error' });
            }
          } catch (error) {
            failed.push({
              plugin,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        return { success, failed };
      },

      /**
       * Sort plugins by dependencies
       * 按依赖关系排序插件
       * @param plugins Plugins to sort | 要排序的插件
       * @returns Sorted plugins | 排序后的插件
       */
      sortByDependencies(plugins: ECSPlugin[]): ECSPlugin[] {
        const sorted: ECSPlugin[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (plugin: ECSPlugin): void => {
          const name = plugin.metadata.name;

          if (visiting.has(name)) {
            throw new Error(`Circular dependency detected: ${name}`);
          }

          if (visited.has(name)) {
            return;
          }

          visiting.add(name);

          // Visit dependencies first
          if (plugin.metadata.dependencies) {
            for (const depName of plugin.metadata.dependencies) {
              const depPlugin = plugins.find(p => p.metadata.name === depName);
              if (depPlugin) {
                visit(depPlugin);
              }
            }
          }

          visiting.delete(name);
          visited.add(name);
          sorted.push(plugin);
        };

        for (const plugin of plugins) {
          visit(plugin);
        }

        return sorted;
      }
    };
  }
}

/**
 * Plugin development decorators and helpers
 * 插件开发装饰器和助手
 */
export class PluginDecorators {
  /**
   * Create a component filter decorator
   * 创建组件过滤器装饰器
   * @param componentTypes Component types to filter | 要过滤的组件类型
   * @returns Decorator function | 装饰器函数
   */
  static withComponents(...componentTypes: ComponentType[]): (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
    return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

      descriptor.value = function (entity: Entity, ...args: unknown[]): unknown {
        // Check if entity has all required components
        for (const componentType of componentTypes) {
          if (!entity.hasComponent(componentType)) {
            return; // Skip if entity doesn't have required components
          }
        }

        return originalMethod.call(this, entity, ...args);
      };

      return descriptor;
    };
  }

  /**
   * Create a system filter decorator
   * 创建系统过滤器装饰器
   * @param systemTypes System types to filter | 要过滤的系统类型
   * @returns Decorator function | 装饰器函数
   */
  static withSystems(...systemTypes: (new (...args: unknown[]) => System)[]): (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
    return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

      descriptor.value = function (system: System, ...args: unknown[]): unknown {
        // Check if system is one of the specified types
        const isTargetSystem = systemTypes.some(SystemType => system instanceof SystemType);
        if (!isTargetSystem) {
          return; // Skip if system is not of target type
        }

        return originalMethod.call(this, system, ...args);
      };

      return descriptor;
    };
  }

  /**
   * Create a throttle decorator for plugin methods
   * 为插件方法创建节流装饰器
   * @param delay Throttle delay in milliseconds | 节流延迟（毫秒）
   * @returns Decorator function | 装饰器函数
   */
  static throttle(delay: number): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
    const lastCallTimes = new Map<string, number>();

    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
      const key = `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`;

      descriptor.value = function (...args: unknown[]): unknown {
        const now = Date.now();
        const lastCallTime = lastCallTimes.get(key) || 0;

        if (now - lastCallTime >= delay) {
          lastCallTimes.set(key, now);
          return originalMethod.apply(this, args);
        }
        return undefined;
      };

      return descriptor;
    };
  }

  /**
   * Create a debounce decorator for plugin methods
   * 为插件方法创建防抖装饰器
   * @param delay Debounce delay in milliseconds | 防抖延迟（毫秒）
   * @returns Decorator function | 装饰器函数
   */
  static debounce(delay: number): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
    const timeouts = new Map<string, NodeJS.Timeout>();

    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
      const key = `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`;

      descriptor.value = function (...args: unknown[]): void {
        const existingTimeout = timeouts.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          timeouts.delete(key);
          originalMethod.apply(this, args);
        }, delay);

        timeouts.set(key, timeout);
      };

      return descriptor;
    };
  }
}
