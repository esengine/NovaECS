import type { World } from './World';
import type { Entity } from './Entity';
import type { System } from './System';
import type { Component } from './Component';
import type {
  ECSPlugin,
  PluginMetadata,
  PluginInstallOptions
} from '../utils/PluginTypes';

/**
 * Base plugin class that provides common functionality
 * 提供通用功能的基础插件类
 * 
 * @example
 * ```typescript
 * class MyPlugin extends BasePlugin {
 *   constructor() {
 *     super({
 *       name: 'MyPlugin',
 *       version: '1.0.0',
 *       description: 'My custom plugin',
 *       priority: PluginPriority.Normal
 *     });
 *   }
 * 
 *   async install(world: World): Promise<void> {
 *     // Plugin installation logic
 *     this.log('Plugin installed');
 *   }
 * 
 *   async uninstall(world: World): Promise<void> {
 *     // Plugin cleanup logic
 *     this.log('Plugin uninstalled');
 *   }
 * }
 * ```
 */
export abstract class BasePlugin implements ECSPlugin {
  /** Plugin metadata | 插件元数据 */
  public readonly metadata: PluginMetadata;

  /** Plugin configuration | 插件配置 */
  protected _config: Record<string, unknown> = {};

  /** Plugin enabled state | 插件启用状态 */
  protected _enabled = true;

  /** World instance reference | 世界实例引用 */
  protected _world?: World | undefined;

  /** Plugin logger prefix | 插件日志前缀 */
  protected readonly _logPrefix: string;

  /**
   * Create a new base plugin
   * 创建新的基础插件
   * @param metadata Plugin metadata | 插件元数据
   */
  constructor(metadata: PluginMetadata) {
    this.metadata = metadata;
    this._logPrefix = `[${metadata.name}]`;
  }

  /**
   * Get plugin enabled state
   * 获取插件启用状态
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Set plugin enabled state
   * 设置插件启用状态
   */
  set enabled(value: boolean) {
    this._enabled = value;
  }

  /**
   * Get world instance
   * 获取世界实例
   */
  get world(): World | undefined {
    return this._world;
  }

  /**
   * Install the plugin (must be implemented by subclasses)
   * 安装插件（必须由子类实现）
   * @param world The world instance | 世界实例
   * @param options Installation options | 安装选项
   */
  abstract install(world: World, options?: PluginInstallOptions): Promise<void> | void;

  /**
   * Uninstall the plugin (must be implemented by subclasses)
   * 卸载插件（必须由子类实现）
   * @param world The world instance | 世界实例
   */
  abstract uninstall(world: World): Promise<void> | void;

  /**
   * Update the plugin (optional override)
   * 更新插件（可选重写）
   * @param deltaTime Time elapsed since last update | 自上次更新以来经过的时间
   */
  update?(deltaTime: number): void | Promise<void>;

  /**
   * Called when world is created
   * 世界创建时调用
   * @param world The world instance | 世界实例
   */
  onWorldCreate?(world: World): void | Promise<void> {
    this._world = world;
    this.log('World created');
  }

  /**
   * Called when world is destroyed
   * 世界销毁时调用
   * @param _world The world instance | 世界实例
   */
  onWorldDestroy?(_world: World): void | Promise<void> {
    this.log('World destroyed');
    this._world = undefined;
  }

  /**
   * Called when world starts updating
   * 世界开始更新时调用
   * @param _world The world instance | 世界实例
   * @param _deltaTime Time elapsed since last update | 自上次更新以来经过的时间
   */
  onWorldUpdateStart?(_world: World, _deltaTime: number): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when world finishes updating
   * 世界完成更新时调用
   * @param _world The world instance | 世界实例
   * @param _deltaTime Time elapsed since last update | 自上次更新以来经过的时间
   */
  onWorldUpdateEnd?(_world: World, _deltaTime: number): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when entity is created
   * 实体创建时调用
   * @param _entity The created entity | 创建的实体
   */
  onEntityCreate?(_entity: Entity): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when entity is destroyed
   * 实体销毁时调用
   * @param _entity The destroyed entity | 销毁的实体
   */
  onEntityDestroy?(_entity: Entity): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when system is added to world
   * 系统添加到世界时调用
   * @param _system The added system | 添加的系统
   */
  onSystemAdd?(_system: System): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when system is removed from world
   * 系统从世界移除时调用
   * @param _system The removed system | 移除的系统
   */
  onSystemRemove?(_system: System): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when component is added to entity
   * 组件添加到实体时调用
   * @param _entity The entity | 实体
   * @param _component The added component | 添加的组件
   */
  onComponentAdd?(_entity: Entity, _component: Component): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Called when component is removed from entity
   * 组件从实体移除时调用
   * @param _entity The entity | 实体
   * @param _component The removed component | 移除的组件
   */
  onComponentRemove?(_entity: Entity, _component: Component): void | Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Get plugin configuration
   * 获取插件配置
   * @returns Configuration object | 配置对象
   */
  getConfig(): Record<string, unknown> {
    return { ...this._config };
  }

  /**
   * Set plugin configuration
   * 设置插件配置
   * @param config Configuration object | 配置对象
   */
  setConfig(config: Record<string, unknown>): void {
    this._config = { ...config };
    this.onConfigChanged?.(config);
  }

  /**
   * Validate plugin configuration
   * 验证插件配置
   * @param _config Configuration to validate | 要验证的配置
   * @returns Whether configuration is valid | 配置是否有效
   */
  validateConfig(_config: Record<string, unknown>): boolean {
    // Default implementation accepts any configuration
    // Override in subclasses for custom validation
    return true;
  }

  /**
   * Get plugin status information
   * 获取插件状态信息
   * @returns Status object | 状态对象
   */
  getStatus(): Record<string, unknown> {
    return {
      name: this.metadata.name,
      version: this.metadata.version,
      enabled: this._enabled,
      hasWorld: !!this._world,
      config: this.getConfig()
    };
  }

  /**
   * Called when configuration changes
   * 配置更改时调用
   * @param _config New configuration | 新配置
   */
  protected onConfigChanged?(_config: Record<string, unknown>): void;

  /**
   * Log a message with plugin prefix
   * 使用插件前缀记录消息
   * @param message Message to log | 要记录的消息
   * @param level Log level | 日志级别
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const fullMessage = `${this._logPrefix} ${message}`;
    
    switch (level) {
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
      default:
        console.log(fullMessage);
        break;
    }
  }

  /**
   * Log a warning message
   * 记录警告消息
   * @param message Warning message | 警告消息
   */
  protected warn(message: string): void {
    this.log(message, 'warn');
  }

  /**
   * Log an error message
   * 记录错误消息
   * @param message Error message | 错误消息
   */
  protected error(message: string): void {
    this.log(message, 'error');
  }

  /**
   * Check if plugin is properly installed
   * 检查插件是否正确安装
   * @returns Whether plugin is installed | 插件是否已安装
   */
  protected isInstalled(): boolean {
    return !!this._world;
  }

  /**
   * Assert that plugin is installed
   * 断言插件已安装
   * @throws Error if plugin is not installed | 如果插件未安装则抛出错误
   */
  protected assertInstalled(): void {
    if (!this.isInstalled()) {
      throw new Error(`Plugin ${this.metadata.name} is not installed`);
    }
  }

  /**
   * Get configuration value with default
   * 获取配置值，带默认值
   * @param key Configuration key | 配置键
   * @param defaultValue Default value if key not found | 键不存在时的默认值
   * @returns Configuration value | 配置值
   */
  protected getConfigValue<T>(key: string, defaultValue: T): T {
    return (this._config[key] as T) ?? defaultValue;
  }

  /**
   * Set configuration value
   * 设置配置值
   * @param key Configuration key | 配置键
   * @param value Configuration value | 配置值
   */
  protected setConfigValue(key: string, value: unknown): void {
    this._config[key] = value;
  }
}
