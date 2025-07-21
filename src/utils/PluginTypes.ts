import type { World } from '../core/World';
import type { Entity } from '../core/Entity';
import type { System } from '../core/System';
import type { Component } from '../core/Component';

/**
 * Plugin lifecycle phases for fine-grained control
 * 插件生命周期阶段，用于精细控制
 */
export enum PluginLifecyclePhase {
  PreInstall = 'pre-install',
  Install = 'install',
  PostInstall = 'post-install',
  PreUninstall = 'pre-uninstall',
  Uninstall = 'uninstall',
  PostUninstall = 'post-uninstall'
}

/**
 * Plugin priority levels for execution order
 * 插件优先级级别，用于执行顺序
 */
export enum PluginPriority {
  Highest = 1000,
  High = 750,
  Normal = 500,
  Low = 250,
  Lowest = 0
}

/**
 * Plugin installation options
 * 插件安装选项
 */
export interface PluginInstallOptions {
  /** Plugin configuration options | 插件配置选项 */
  config?: Record<string, unknown>;
  /** Whether to force installation even if dependencies are missing | 是否强制安装，即使依赖缺失 */
  force?: boolean;
  /** Custom installation context | 自定义安装上下文 */
  context?: Record<string, unknown>;
}

/**
 * Plugin metadata for registration and discovery
 * 插件元数据，用于注册和发现
 */
export interface PluginMetadata {
  /** Plugin unique identifier | 插件唯一标识符 */
  readonly name: string;
  /** Plugin version (semver format) | 插件版本（semver格式） */
  readonly version: string;
  /** Plugin description | 插件描述 */
  readonly description?: string;
  /** Plugin author information | 插件作者信息 */
  readonly author?: string;
  /** Plugin license | 插件许可证 */
  readonly license?: string;
  /** Plugin homepage or repository URL | 插件主页或仓库URL */
  readonly homepage?: string;
  /** Plugin keywords for discovery | 插件关键词，用于发现 */
  readonly keywords?: string[];
  /** Required dependencies (plugin names) | 必需的依赖（插件名称） */
  readonly dependencies?: string[];
  /** Optional dependencies (plugin names) | 可选的依赖（插件名称） */
  readonly optionalDependencies?: string[];
  /** Plugins that conflict with this one | 与此插件冲突的插件 */
  readonly conflicts?: string[];
  /** Minimum required NovaECS version | 最低要求的NovaECS版本 */
  readonly minEcsVersion?: string;
  /** Plugin execution priority | 插件执行优先级 */
  readonly priority?: PluginPriority;
}

/**
 * Plugin lifecycle hooks for integration with ECS events
 * 插件生命周期钩子，用于与ECS事件集成
 */
export interface PluginLifecycleHooks {
  /** Called when world is created | 世界创建时调用 */
  onWorldCreate?(world: World): void | Promise<void>;
  /** Called when world is destroyed | 世界销毁时调用 */
  onWorldDestroy?(world: World): void | Promise<void>;
  /** Called when world starts updating | 世界开始更新时调用 */
  onWorldUpdateStart?(world: World, deltaTime: number): void | Promise<void>;
  /** Called when world finishes updating | 世界完成更新时调用 */
  onWorldUpdateEnd?(world: World, deltaTime: number): void | Promise<void>;
  /** Called when entity is created | 实体创建时调用 */
  onEntityCreate?(entity: Entity): void | Promise<void>;
  /** Called when entity is destroyed | 实体销毁时调用 */
  onEntityDestroy?(entity: Entity): void | Promise<void>;
  /** Called when system is added to world | 系统添加到世界时调用 */
  onSystemAdd?(system: System): void | Promise<void>;
  /** Called when system is removed from world | 系统从世界移除时调用 */
  onSystemRemove?(system: System): void | Promise<void>;
  /** Called when component is added to entity | 组件添加到实体时调用 */
  onComponentAdd?(entity: Entity, component: Component): void | Promise<void>;
  /** Called when component is removed from entity | 组件从实体移除时调用 */
  onComponentRemove?(entity: Entity, component: Component): void | Promise<void>;
}

/**
 * Plugin state information
 * 插件状态信息
 */
export enum PluginState {
  Uninstalled = 'uninstalled',
  Installing = 'installing',
  Installed = 'installed',
  Uninstalling = 'uninstalling',
  Error = 'error'
}

/**
 * Plugin installation result
 * 插件安装结果
 */
export interface PluginInstallResult {
  /** Whether installation was successful | 安装是否成功 */
  success: boolean;
  /** Plugin instance if successful | 成功时的插件实例 */
  plugin?: ECSPlugin | undefined;
  /** Error message if failed | 失败时的错误信息 */
  error?: string | undefined;
  /** Installation duration in milliseconds | 安装持续时间（毫秒） */
  duration: number;
  /** Warnings during installation | 安装过程中的警告 */
  warnings?: string[] | undefined;
}

/**
 * Plugin dependency resolution result
 * 插件依赖解析结果
 */
export interface PluginDependencyResult {
  /** Whether all dependencies are satisfied | 是否满足所有依赖 */
  satisfied: boolean;
  /** Missing required dependencies | 缺失的必需依赖 */
  missing: string[];
  /** Missing optional dependencies | 缺失的可选依赖 */
  missingOptional: string[];
  /** Conflicting plugins | 冲突的插件 */
  conflicts: string[];
}

/**
 * Core plugin interface that all plugins must implement
 * 所有插件必须实现的核心插件接口
 */
export interface ECSPlugin extends PluginLifecycleHooks {
  /** Plugin metadata | 插件元数据 */
  readonly metadata: PluginMetadata;

  /**
   * Install the plugin into the world
   * 将插件安装到世界中
   * @param world The world instance | 世界实例
   * @param options Installation options | 安装选项
   */
  install(world: World, options?: PluginInstallOptions): Promise<void> | void;

  /**
   * Uninstall the plugin from the world
   * 从世界中卸载插件
   * @param world The world instance | 世界实例
   */
  uninstall(world: World): Promise<void> | void;

  /**
   * Update the plugin (called during world update)
   * 更新插件（在世界更新期间调用）
   * @param deltaTime Time elapsed since last update | 自上次更新以来经过的时间
   */
  update?(deltaTime: number): void | Promise<void>;

  /**
   * Get plugin configuration
   * 获取插件配置
   */
  getConfig?(): Record<string, unknown>;

  /**
   * Set plugin configuration
   * 设置插件配置
   * @param config Configuration object | 配置对象
   */
  setConfig?(config: Record<string, unknown>): void;

  /**
   * Validate plugin configuration
   * 验证插件配置
   * @param config Configuration to validate | 要验证的配置
   */
  validateConfig?(config: Record<string, unknown>): boolean;

  /**
   * Get plugin status information
   * 获取插件状态信息
   */
  getStatus?(): Record<string, unknown>;
}

/**
 * Plugin manager events
 * 插件管理器事件
 */
export interface PluginManagerEvents {
  /** Plugin installation started | 插件安装开始 */
  'plugin:install:start': { plugin: string; options?: PluginInstallOptions };
  /** Plugin installation completed | 插件安装完成 */
  'plugin:install:complete': { plugin: string; result: PluginInstallResult };
  /** Plugin installation failed | 插件安装失败 */
  'plugin:install:error': { plugin: string; error: string };
  /** Plugin uninstallation started | 插件卸载开始 */
  'plugin:uninstall:start': { plugin: string };
  /** Plugin uninstallation completed | 插件卸载完成 */
  'plugin:uninstall:complete': { plugin: string };
  /** Plugin uninstallation failed | 插件卸载失败 */
  'plugin:uninstall:error': { plugin: string; error: string };
  /** Plugin dependency error | 插件依赖错误 */
  'plugin:dependency:error': { plugin: string; dependencies: string[] };
}

/**
 * Plugin registry for managing available plugins
 * 插件注册表，用于管理可用插件
 */
export interface PluginRegistry {
  /** Register a plugin class | 注册插件类 */
  register<T extends ECSPlugin>(name: string, pluginClass: new () => T): void;
  /** Unregister a plugin class | 注销插件类 */
  unregister(name: string): void;
  /** Get a plugin class by name | 根据名称获取插件类 */
  get<T extends ECSPlugin>(name: string): (new () => T) | undefined;
  /** List all registered plugin names | 列出所有已注册的插件名称 */
  list(): string[];
  /** Check if a plugin is registered | 检查插件是否已注册 */
  has(name: string): boolean;
}
