import type { World } from './World';
import type {
  ECSPlugin,
  PluginInstallOptions,
  PluginInstallResult,
  PluginDependencyResult,
  PluginRegistry
} from '../utils/PluginTypes';
import { PluginState, PluginPriority } from '../utils/PluginTypes';
import { PluginPerformanceAnalyzer, PluginPerformanceConfig } from './PluginPerformanceAnalyzer';
import { PluginSandbox, PluginSandboxConfig } from './PluginSandbox';

/**
 * Plugin instance information
 * 插件实例信息
 */
interface PluginInstance {
  plugin: ECSPlugin;
  state: PluginState;
  installTime: number;
  config?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

/**
 * Plugin manager for handling plugin lifecycle and dependencies
 * 插件管理器，用于处理插件生命周期和依赖关系
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const pluginManager = world.plugins;
 * 
 * // Install a plugin
 * await pluginManager.install(new MyPlugin(), { config: { enabled: true } });
 * 
 * // Get plugin instance
 * const myPlugin = pluginManager.get<MyPlugin>('MyPlugin');
 * 
 * // Uninstall plugin
 * await pluginManager.uninstall('MyPlugin');
 * ```
 */
export class PluginManager {
  private readonly _plugins = new Map<string, PluginInstance>();
  private readonly _world: World;
  private readonly _registry: PluginRegistry;
  private _updateOrder: string[] = [];
  private _performanceAnalyzer: PluginPerformanceAnalyzer | undefined;
  private _sandbox: PluginSandbox | undefined;

  /**
   * Create a new plugin manager
   * 创建新的插件管理器
   * @param world The world instance | 世界实例
   * @param performanceConfig Performance analyzer configuration | 性能分析器配置
   * @param sandboxConfig Sandbox configuration | 沙箱配置
   */
  constructor(
    world: World,
    performanceConfig?: PluginPerformanceConfig,
    sandboxConfig?: PluginSandboxConfig
  ) {
    this._world = world;
    this._registry = new DefaultPluginRegistry();

    // Initialize performance analyzer if config provided
    if (performanceConfig) {
      this._performanceAnalyzer = new PluginPerformanceAnalyzer(performanceConfig);
    }

    // Initialize sandbox if config provided
    if (sandboxConfig) {
      this._sandbox = new PluginSandbox(sandboxConfig);
    }
  }

  /**
   * Get the plugin registry
   * 获取插件注册表
   */
  get registry(): PluginRegistry {
    return this._registry;
  }

  /**
   * Install a plugin into the world
   * 将插件安装到世界中
   * @param plugin The plugin instance to install | 要安装的插件实例
   * @param options Installation options | 安装选项
   * @returns Installation result | 安装结果
   */
  async install<T extends ECSPlugin>(
    plugin: T,
    options?: PluginInstallOptions
  ): Promise<PluginInstallResult> {
    const startTime = Date.now();
    const pluginName = plugin.metadata.name;

    try {
      // Check if plugin is already installed
      if (this._plugins.has(pluginName)) {
        throw new Error(`Plugin ${pluginName} is already installed`);
      }

      // Check dependencies and conflicts
      const dependencyResult = this.checkDependencies(plugin);

      // Check conflicts first (higher priority error)
      if (dependencyResult.conflicts.length > 0 && !options?.force) {
        throw new Error(`Plugin ${pluginName} conflicts with: ${dependencyResult.conflicts.join(', ')}`);
      }

      // Then check dependencies
      if (!dependencyResult.satisfied && !options?.force) {
        const error = `Plugin ${pluginName} has unmet dependencies: ${dependencyResult.missing.join(', ')}`;
        throw new Error(error);
      }

      // Set plugin state to installing
      const instance: PluginInstance = {
        plugin,
        state: PluginState.Installing,
        installTime: startTime,
        config: options?.config
      };
      this._plugins.set(pluginName, instance);

      // Validate configuration if provided
      if (options?.config && plugin.validateConfig) {
        if (!plugin.validateConfig(options.config)) {
          throw new Error(`Invalid configuration for plugin ${pluginName}`);
        }
      }

      // Set configuration
      if (options?.config && plugin.setConfig) {
        plugin.setConfig(options.config);
      }

      // Install the plugin
      await plugin.install(this._world, options);

      // Update plugin state
      instance.state = PluginState.Installed;

      // Update execution order
      this._updateExecutionOrder();

      // Call lifecycle hook
      await plugin.onWorldCreate?.(this._world);

      const duration = Date.now() - startTime;
      const warnings = dependencyResult.missingOptional.length > 0
        ? [`Missing optional dependencies: ${dependencyResult.missingOptional.join(', ')}`]
        : [];

      const result: PluginInstallResult = {
        success: true,
        plugin,
        duration,
        warnings: warnings.length > 0 ? warnings : undefined
      };

      return result;

    } catch (error) {
      // Update plugin state to error
      const instance = this._plugins.get(pluginName);
      if (instance) {
        instance.state = PluginState.Error;
        instance.error = error instanceof Error ? error.message : String(error);
      } else {
        this._plugins.delete(pluginName);
      }

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Uninstall a plugin from the world
   * 从世界中卸载插件
   * @param pluginName The name of the plugin to uninstall | 要卸载的插件名称
   * @returns Whether uninstallation was successful | 卸载是否成功
   */
  async uninstall(pluginName: string): Promise<boolean> {
    try {
      const instance = this._plugins.get(pluginName);
      if (!instance) {
        throw new Error(`Plugin ${pluginName} is not installed`);
      }

      // Check if other plugins depend on this one
      const dependents = this._findDependents(pluginName);
      if (dependents.length > 0) {
        throw new Error(`Cannot uninstall ${pluginName}: required by ${dependents.join(', ')}`);
      }

      // Set state to uninstalling
      instance.state = PluginState.Uninstalling;

      // Call lifecycle hook
      await instance.plugin.onWorldDestroy?.(this._world);

      // Uninstall the plugin
      await instance.plugin.uninstall(this._world);

      // Remove from plugins map
      this._plugins.delete(pluginName);

      // Update execution order
      this._updateExecutionOrder();

      return true;

    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error);
      return false;
    }
  }

  /**
   * Get a plugin instance by name
   * 根据名称获取插件实例
   * @param name The plugin name | 插件名称
   * @returns The plugin instance or undefined | 插件实例或undefined
   */
  get<T extends ECSPlugin>(name: string): T | undefined {
    const instance = this._plugins.get(name);
    return instance?.plugin as T | undefined;
  }

  /**
   * Check if a plugin is installed
   * 检查插件是否已安装
   * @param name The plugin name | 插件名称
   * @returns Whether the plugin is installed | 插件是否已安装
   */
  has(name: string): boolean {
    return this._plugins.has(name);
  }

  /**
   * Get all installed plugin names
   * 获取所有已安装的插件名称
   * @returns Array of plugin names | 插件名称数组
   */
  list(): string[] {
    return Array.from(this._plugins.keys());
  }

  /**
   * Get plugin state
   * 获取插件状态
   * @param name The plugin name | 插件名称
   * @returns Plugin state or undefined | 插件状态或undefined
   */
  getState(name: string): PluginState | undefined {
    return this._plugins.get(name)?.state;
  }

  /**
   * Update all plugins
   * 更新所有插件
   * @param deltaTime Time elapsed since last update | 自上次更新以来经过的时间
   */
  async update(deltaTime: number): Promise<void> {
    // Update plugins in priority order
    for (const pluginName of this._updateOrder) {
      const instance = this._plugins.get(pluginName);
      if (instance?.state === PluginState.Installed && instance.plugin.update) {
        try {
          // Start performance measurement if analyzer is available
          const stopMeasure = this._performanceAnalyzer?.startMeasure(pluginName);

          // Execute plugin update in sandbox if available
          if (this._sandbox) {
            const result = await this._sandbox.execute(instance.plugin, 'update', deltaTime);
            if (!result.success) {
              throw new Error(result.error || 'Sandbox execution failed');
            }
          } else {
            await instance.plugin.update(deltaTime);
          }

          // Stop performance measurement
          stopMeasure?.();
        } catch (error) {
          console.error(`Error updating plugin ${pluginName}:`, error);
          instance.state = PluginState.Error;
          instance.error = error instanceof Error ? error.message : String(error);
        }
      }
    }
  }

  /**
   * Hot reload a plugin during development
   * 开发期间热重载插件
   * @param pluginName Name of the plugin to reload | 要重载的插件名称
   * @param newPlugin New plugin instance | 新的插件实例
   * @returns Success status | 成功状态
   */
  async hotReload(pluginName: string, newPlugin: ECSPlugin): Promise<boolean> {
    try {
      const oldInstance = this._plugins.get(pluginName);
      if (!oldInstance) {
        console.warn(`Plugin ${pluginName} not found for hot reload`);
        return false;
      }

      // 保存当前状态
      const oldConfig = oldInstance.plugin.getConfig?.() || {};
      const oldState = oldInstance.state;

      // 只有已安装的插件才能热重载
      if (oldState !== PluginState.Installed) {
        console.warn(`Plugin ${pluginName} is not installed, cannot hot reload`);
        return false;
      }

      // 卸载旧插件但不移除依赖关系
      if (oldInstance.plugin.uninstall) {
        await oldInstance.plugin.uninstall(this._world);
      }
      oldInstance.state = PluginState.Uninstalled;

      // 更新插件实例
      oldInstance.plugin = newPlugin;

      // 重新安装插件，恢复配置
      if (newPlugin.onWorldCreate && this._world) {
        newPlugin.onWorldCreate(this._world);
      }

      if (newPlugin.install) {
        await newPlugin.install(this._world);
      }
      oldInstance.state = PluginState.Installed;

      // 恢复配置
      if (newPlugin.setConfig && Object.keys(oldConfig).length > 0) {
        newPlugin.setConfig(oldConfig);
      }

      console.log(`Plugin ${pluginName} hot reloaded successfully`);
      return true;
    } catch (error) {
      console.error(`Hot reload failed for ${pluginName}:`, error);
      return false;
    }
  }

  /**
   * Enable performance monitoring
   * 启用性能监控
   * @param config Performance analyzer configuration | 性能分析器配置
   */
  enablePerformanceMonitoring(config?: Partial<PluginPerformanceConfig>): void {
    if (!this._performanceAnalyzer) {
      this._performanceAnalyzer = new PluginPerformanceAnalyzer(config);
    } else if (config) {
      this._performanceAnalyzer.updateConfig(config);
    }
  }

  /**
   * Disable performance monitoring
   * 禁用性能监控
   */
  disablePerformanceMonitoring(): void {
    if (this._performanceAnalyzer) {
      this._performanceAnalyzer.dispose();
      this._performanceAnalyzer = undefined;
    }
  }

  /**
   * Get performance analyzer
   * 获取性能分析器
   * @returns Performance analyzer instance or undefined | 性能分析器实例或undefined
   */
  getPerformanceAnalyzer(): PluginPerformanceAnalyzer | undefined {
    return this._performanceAnalyzer;
  }

  /**
   * Enable sandbox mode
   * 启用沙箱模式
   * @param config Sandbox configuration | 沙箱配置
   */
  enableSandbox(config?: Partial<PluginSandboxConfig>): void {
    if (!this._sandbox) {
      this._sandbox = new PluginSandbox(config);
    } else if (config) {
      this._sandbox.updateConfig(config);
    }
  }

  /**
   * Disable sandbox mode
   * 禁用沙箱模式
   */
  disableSandbox(): void {
    this._sandbox = undefined;
  }

  /**
   * Get sandbox instance
   * 获取沙箱实例
   * @returns Sandbox instance or undefined | 沙箱实例或undefined
   */
  getSandbox(): PluginSandbox | undefined {
    return this._sandbox;
  }

  /**
   * Check plugin dependencies
   * 检查插件依赖
   * @param plugin The plugin to check | 要检查的插件
   * @returns Dependency check result | 依赖检查结果
   */
  private checkDependencies(plugin: ECSPlugin): PluginDependencyResult {
    const missing: string[] = [];
    const missingOptional: string[] = [];
    const conflicts: string[] = [];

    // Check required dependencies
    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (!this._plugins.has(dep)) {
          missing.push(dep);
        }
      }
    }

    // Check optional dependencies
    if (plugin.metadata.optionalDependencies) {
      for (const dep of plugin.metadata.optionalDependencies) {
        if (!this._plugins.has(dep)) {
          missingOptional.push(dep);
        }
      }
    }

    // Check conflicts
    if (plugin.metadata.conflicts) {
      for (const conflict of plugin.metadata.conflicts) {
        if (this._plugins.has(conflict)) {
          conflicts.push(conflict);
        }
      }
    }

    return {
      satisfied: missing.length === 0 && conflicts.length === 0,
      missing,
      missingOptional,
      conflicts
    };
  }

  /**
   * Find plugins that depend on the given plugin
   * 查找依赖于给定插件的插件
   * @param pluginName The plugin name | 插件名称
   * @returns Array of dependent plugin names | 依赖插件名称数组
   */
  private _findDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    
    for (const [name, instance] of this._plugins) {
      const deps = instance.plugin.metadata.dependencies || [];
      if (deps.includes(pluginName)) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }

  /**
   * Update plugin execution order based on priority
   * 根据优先级更新插件执行顺序
   */
  private _updateExecutionOrder(): void {
    this._updateOrder = Array.from(this._plugins.entries())
      .filter(([, instance]) => instance.state === PluginState.Installed)
      .sort(([, a], [, b]) => {
        const priorityA = a.plugin.metadata.priority || PluginPriority.Normal;
        const priorityB = b.plugin.metadata.priority || PluginPriority.Normal;
        return priorityB - priorityA; // Higher priority first
      })
      .map(([name]) => name);
  }
}

/**
 * Default plugin registry implementation
 * 默认插件注册表实现
 */
class DefaultPluginRegistry implements PluginRegistry {
  private readonly _plugins = new Map<string, new () => ECSPlugin>();

  register<T extends ECSPlugin>(name: string, pluginClass: new () => T): void {
    this._plugins.set(name, pluginClass);
  }

  unregister(name: string): void {
    this._plugins.delete(name);
  }

  get<T extends ECSPlugin>(name: string): (new () => T) | undefined {
    return this._plugins.get(name) as (new () => T) | undefined;
  }

  list(): string[] {
    return Array.from(this._plugins.keys());
  }

  has(name: string): boolean {
    return this._plugins.has(name);
  }
}
