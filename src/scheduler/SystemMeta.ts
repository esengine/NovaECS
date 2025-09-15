/**
 * System metadata and dependency information for parallel scheduling
 * 系统元数据和依赖信息，用于并行调度
 */

/**
 * Type identifier for components and resources
 * 组件和资源的类型标识符
 */
export type TypeId = number | string;

/**
 * Resource identifier for exclusive resources
 * 独占资源的资源标识符
 */
export type ResourceId = string | symbol;

/**
 * System handle for identification and dependency tracking
 * 系统句柄，用于标识和依赖跟踪
 */
export type SystemHandle = string | symbol | number;

/**
 * Component access mode enumeration
 * 组件访问模式枚举
 */
export enum AccessMode {
  /** Read-only access 只读访问 */
  Read = 'read',
  /** Write access (implies read) 写访问（包含读取） */
  Write = 'write',
  /** Read-write access (explicit) 显式读写访问 */
  ReadWrite = 'readwrite'
}

/**
 * Component access descriptor
 * 组件访问描述符
 */
export interface ComponentAccess {
  /** Component type identifier 组件类型标识符 */
  typeId: TypeId;
  /** Access mode for this component 此组件的访问模式 */
  mode: AccessMode;
}

/**
 * Resource access descriptor
 * 资源访问描述符
 */
export interface ResourceAccess {
  /** Resource identifier 资源标识符 */
  resourceId: ResourceId;
  /** Whether this is exclusive access 是否为独占访问 */
  exclusive: boolean;
}

/**
 * System metadata containing dependency and access information
 * 包含依赖和访问信息的系统元数据
 */
export interface SystemMeta {
  /** Unique system handle 唯一系统句柄 */
  handle: SystemHandle;

  /** System name for debugging 用于调试的系统名称 */
  name: string;

  /** Component access patterns 组件访问模式 */
  components: ComponentAccess[];

  /** Resource access patterns 资源访问模式 */
  resources: ResourceAccess[];

  /** Explicit dependencies on other systems 对其他系统的显式依赖 */
  dependencies: SystemHandle[];

  /** Systems that must run after this system 必须在此系统后运行的系统 */
  dependents: SystemHandle[];

  /** Optional priority for scheduling 调度的可选优先级 */
  priority?: number;

  /** Whether this system can be parallelized 此系统是否可以并行化 */
  parallelizable?: boolean;

  /** Estimated execution time in milliseconds 预估执行时间（毫秒） */
  estimatedTime?: number;
}

/**
 * System metadata builder for fluent API construction
 * 系统元数据构建器，用于流畅API构建
 */
export class SystemMetaBuilder {
  private meta: Partial<SystemMeta> = {};

  constructor(handle: SystemHandle, name: string) {
    this.meta.handle = handle;
    this.meta.name = name;
    this.meta.components = [];
    this.meta.resources = [];
    this.meta.dependencies = [];
    this.meta.dependents = [];
    this.meta.parallelizable = true;
  }

  /**
   * Add read-only component access
   * 添加只读组件访问
   */
  reads(typeId: TypeId): this {
    this.meta.components!.push({ typeId, mode: AccessMode.Read });
    return this;
  }

  /**
   * Add write component access
   * 添加写组件访问
   */
  writes(typeId: TypeId): this {
    this.meta.components!.push({ typeId, mode: AccessMode.Write });
    return this;
  }

  /**
   * Add read-write component access
   * 添加读写组件访问
   */
  readWrites(typeId: TypeId): this {
    this.meta.components!.push({ typeId, mode: AccessMode.ReadWrite });
    return this;
  }

  /**
   * Add multiple read-only component accesses
   * 添加多个只读组件访问
   */
  readsMany(typeIds: TypeId[]): this {
    for (const typeId of typeIds) {
      this.reads(typeId);
    }
    return this;
  }

  /**
   * Add multiple write component accesses
   * 添加多个写组件访问
   */
  writesMany(typeIds: TypeId[]): this {
    for (const typeId of typeIds) {
      this.writes(typeId);
    }
    return this;
  }

  /**
   * Add exclusive resource access
   * 添加独占资源访问
   */
  exclusiveResource(resourceId: ResourceId): this {
    this.meta.resources!.push({ resourceId, exclusive: true });
    return this;
  }

  /**
   * Add shared resource access
   * 添加共享资源访问
   */
  sharedResource(resourceId: ResourceId): this {
    this.meta.resources!.push({ resourceId, exclusive: false });
    return this;
  }

  /**
   * Add dependency on another system
   * 添加对另一个系统的依赖
   */
  dependsOn(systemHandle: SystemHandle): this {
    this.meta.dependencies!.push(systemHandle);
    return this;
  }

  /**
   * Add multiple dependencies
   * 添加多个依赖
   */
  dependsOnMany(systemHandles: SystemHandle[]): this {
    this.meta.dependencies!.push(...systemHandles);
    return this;
  }

  /**
   * Add system that depends on this system
   * 添加依赖此系统的系统
   */
  dependentSystem(systemHandle: SystemHandle): this {
    this.meta.dependents!.push(systemHandle);
    return this;
  }

  /**
   * Set system priority
   * 设置系统优先级
   */
  setPriority(priority: number): this {
    this.meta.priority = priority;
    return this;
  }

  /**
   * Set whether system can be parallelized
   * 设置系统是否可以并行化
   */
  setParallelizable(parallelizable: boolean): this {
    this.meta.parallelizable = parallelizable;
    return this;
  }

  /**
   * Set estimated execution time
   * 设置预估执行时间
   */
  setEstimatedTime(timeMs: number): this {
    this.meta.estimatedTime = timeMs;
    return this;
  }

  /**
   * Build the final SystemMeta object
   * 构建最终的SystemMeta对象
   */
  build(): SystemMeta {
    if (!this.meta.handle || !this.meta.name) {
      throw new Error('SystemMeta requires handle and name');
    }

    const result: SystemMeta = {
      handle: this.meta.handle,
      name: this.meta.name,
      components: this.meta.components || [],
      resources: this.meta.resources || [],
      dependencies: this.meta.dependencies || [],
      dependents: this.meta.dependents || [],
      parallelizable: this.meta.parallelizable ?? true
    };

    if (this.meta.priority !== undefined) {
      result.priority = this.meta.priority;
    }

    if (this.meta.estimatedTime !== undefined) {
      result.estimatedTime = this.meta.estimatedTime;
    }

    return result;
  }
}

/**
 * Create a new SystemMeta builder
 * 创建新的SystemMeta构建器
 */
export function createSystemMeta(handle: SystemHandle, name: string): SystemMetaBuilder {
  return new SystemMetaBuilder(handle, name);
}

/**
 * System metadata registry for tracking all system metadata
 * 系统元数据注册表，用于跟踪所有系统元数据
 */
export class SystemMetaRegistry {
  private metaMap = new Map<SystemHandle, SystemMeta>();
  private nameToHandle = new Map<string, SystemHandle>();

  /**
   * Register system metadata
   * 注册系统元数据
   */
  register(meta: SystemMeta): void {
    if (this.metaMap.has(meta.handle)) {
      throw new Error(`System with handle '${String(meta.handle)}' already registered`);
    }

    if (this.nameToHandle.has(meta.name)) {
      throw new Error(`System with name '${meta.name}' already registered`);
    }

    this.metaMap.set(meta.handle, meta);
    this.nameToHandle.set(meta.name, meta.handle);
  }

  /**
   * Unregister system metadata
   * 取消注册系统元数据
   */
  unregister(handle: SystemHandle): boolean {
    const meta = this.metaMap.get(handle);
    if (!meta) {
      return false;
    }

    this.metaMap.delete(handle);
    this.nameToHandle.delete(meta.name);
    return true;
  }

  /**
   * Get system metadata by handle
   * 通过句柄获取系统元数据
   */
  get(handle: SystemHandle): SystemMeta | undefined {
    return this.metaMap.get(handle);
  }

  /**
   * Get system metadata by name
   * 通过名称获取系统元数据
   */
  getByName(name: string): SystemMeta | undefined {
    const handle = this.nameToHandle.get(name);
    return handle ? this.metaMap.get(handle) : undefined;
  }

  /**
   * Get all registered system metadata
   * 获取所有已注册的系统元数据
   */
  getAll(): SystemMeta[] {
    return Array.from(this.metaMap.values());
  }

  /**
   * Get all system handles
   * 获取所有系统句柄
   */
  getAllHandles(): SystemHandle[] {
    return Array.from(this.metaMap.keys());
  }

  /**
   * Check if system is registered
   * 检查系统是否已注册
   */
  has(handle: SystemHandle): boolean {
    return this.metaMap.has(handle);
  }

  /**
   * Check if system name is registered
   * 检查系统名称是否已注册
   */
  hasName(name: string): boolean {
    return this.nameToHandle.has(name);
  }

  /**
   * Clear all registered systems
   * 清除所有已注册的系统
   */
  clear(): void {
    this.metaMap.clear();
    this.nameToHandle.clear();
  }

  /**
   * Get systems that read a specific component type
   * 获取读取特定组件类型的系统
   */
  getSystemsReading(typeId: TypeId): SystemMeta[] {
    return this.getAll().filter(meta =>
      meta.components.some(comp =>
        comp.typeId === typeId &&
        (comp.mode === AccessMode.Read || comp.mode === AccessMode.ReadWrite)
      )
    );
  }

  /**
   * Get systems that write a specific component type
   * 获取写入特定组件类型的系统
   */
  getSystemsWriting(typeId: TypeId): SystemMeta[] {
    return this.getAll().filter(meta =>
      meta.components.some(comp =>
        comp.typeId === typeId &&
        (comp.mode === AccessMode.Write || comp.mode === AccessMode.ReadWrite)
      )
    );
  }

  /**
   * Get systems that access a specific resource
   * 获取访问特定资源的系统
   */
  getSystemsAccessingResource(resourceId: ResourceId): SystemMeta[] {
    return this.getAll().filter(meta =>
      meta.resources.some(res => res.resourceId === resourceId)
    );
  }

  /**
   * Get systems with exclusive access to a resource
   * 获取对资源有独占访问权的系统
   */
  getSystemsWithExclusiveResource(resourceId: ResourceId): SystemMeta[] {
    return this.getAll().filter(meta =>
      meta.resources.some(res => res.resourceId === resourceId && res.exclusive)
    );
  }
}