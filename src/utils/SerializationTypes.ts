/**
 * Serialization system type definitions for NovaECS
 * NovaECS序列化系统类型定义
 */

/**
 * Serialization format types
 * 序列化格式类型
 */
export enum SerializationFormat {
  /** JSON format for human-readable output JSON格式，便于阅读 */
  JSON = 'json',
  /** Binary format for performance 二进制格式，性能优化 */
  Binary = 'binary'
}

/**
 * Serialization mode
 * 序列化模式
 */
export enum SerializationMode {
  /** Full serialization 完整序列化 */
  Full = 'full',
  /** Incremental serialization 增量序列化 */
  Incremental = 'incremental'
}

/**
 * Serialization version information
 * 序列化版本信息
 */
export interface SerializationVersion {
  /** Major version 主版本号 */
  major: number;
  /** Minor version 次版本号 */
  minor: number;
  /** Patch version 补丁版本号 */
  patch: number;
}

/**
 * Serialization context for maintaining state during serialization
 * 序列化上下文，用于在序列化过程中维护状态
 */
export interface SerializationContext {
  /** Serialization format 序列化格式 */
  format: SerializationFormat;
  /** Serialization mode 序列化模式 */
  mode: SerializationMode;
  /** Version information 版本信息 */
  version: SerializationVersion;
  /** Custom options 自定义选项 */
  options: Record<string, unknown>;
  /** Reference tracking for circular references 循环引用跟踪 */
  references: Map<object, string>;
  /** Reference counter 引用计数器 */
  referenceCounter: number;
}

/**
 * Deserialization context for maintaining state during deserialization
 * 反序列化上下文，用于在反序列化过程中维护状态
 */
export interface DeserializationContext {
  /** Serialization format 序列化格式 */
  format: SerializationFormat;
  /** Version information 版本信息 */
  version: SerializationVersion;
  /** Custom options 自定义选项 */
  options: Record<string, unknown>;
  /** Reference mapping for circular references 循环引用映射 */
  references: Map<string, object>;
  /** Component type registry 组件类型注册表 */
  componentTypes: Map<string, new (...args: unknown[]) => unknown>;
}

/**
 * Serializable interface for objects that can be serialized
 * 可序列化接口，用于可以被序列化的对象
 */
export interface ISerializable {
  /**
   * Serialize object to data
   * 将对象序列化为数据
   */
  serialize(context: SerializationContext): SerializedData;
  
  /**
   * Deserialize data to object
   * 将数据反序列化为对象
   */
  deserialize(data: SerializedData, context: DeserializationContext): void;
}

/**
 * Serialized data structure
 * 序列化数据结构
 */
export interface SerializedData {
  /** Data type identifier 数据类型标识符 */
  type: string;
  /** Serialization version 序列化版本 */
  version: SerializationVersion;
  /** Actual data 实际数据 */
  data: unknown;
  /** Metadata 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Serialized component data
 * 序列化组件数据
 */
export interface SerializedComponent extends SerializedData {
  /** Component type name 组件类型名称 */
  componentType: string;
  /** Component enabled state 组件启用状态 */
  enabled: boolean;
  /** Component properties 组件属性 */
  properties: Record<string, unknown>;
}

/**
 * Serialized entity data
 * 序列化实体数据
 */
export interface SerializedEntity extends SerializedData {
  /** Entity ID 实体ID */
  id: number;
  /** Entity active state 实体激活状态 */
  active: boolean;
  /** Entity components 实体组件 */
  components: SerializedComponent[];
}

/**
 * Serialized world data
 * 序列化世界数据
 */
export interface SerializedWorld extends SerializedData {
  /** Entity ID counter 实体ID计数器 */
  entityIdCounter: number;
  /** World paused state 世界暂停状态 */
  paused: boolean;
  /** Entities 实体列表 */
  entities: SerializedEntity[];
  /** Systems configuration 系统配置 */
  systems: SerializedSystemConfig[];
}

/**
 * Serialized system configuration
 * 序列化系统配置
 */
export interface SerializedSystemConfig {
  /** System type name 系统类型名称 */
  type: string;
  /** System enabled state 系统启用状态 */
  enabled: boolean;
  /** System priority 系统优先级 */
  priority: number;
  /** System configuration 系统配置 */
  config?: Record<string, unknown>;
}

/**
 * Serialization options
 * 序列化选项
 */
export interface SerializationOptions {
  /** Serialization format 序列化格式 */
  format?: SerializationFormat;
  /** Serialization mode 序列化模式 */
  mode?: SerializationMode;
  /** Include metadata 包含元数据 */
  includeMetadata?: boolean;
  /** Pretty print JSON 格式化JSON */
  prettyPrint?: boolean;
  /** Compression level (for binary) 压缩级别（二进制格式） */
  compressionLevel?: number;
  /** Custom serializers 自定义序列化器 */
  customSerializers?: Map<string, ISerializer>;
}

/**
 * Deserialization options
 * 反序列化选项
 */
export interface DeserializationOptions {
  /** Strict mode (fail on unknown types) 严格模式（遇到未知类型时失败） */
  strict?: boolean;
  /** Component type registry 组件类型注册表 */
  componentTypes?: Map<string, new (...args: unknown[]) => unknown>;
  /** Custom deserializers 自定义反序列化器 */
  customDeserializers?: Map<string, IDeserializer>;
  /** Migration handlers for version compatibility 版本兼容性迁移处理器 */
  migrationHandlers?: Map<string, (data: unknown, fromVersion: SerializationVersion, toVersion: SerializationVersion) => unknown>;
}

/**
 * Serializer interface
 * 序列化器接口
 */
export interface ISerializer {
  /**
   * Serialize object to data
   * 将对象序列化为数据
   */
  serialize(obj: unknown, context: SerializationContext): SerializedData;
}

/**
 * Deserializer interface
 * 反序列化器接口
 */
export interface IDeserializer {
  /**
   * Deserialize data to object
   * 将数据反序列化为对象
   */
  deserialize(data: SerializedData, context: DeserializationContext): unknown;
}

/**
 * Serialization result
 * 序列化结果
 */
export interface SerializationResult {
  /** Serialized data 序列化数据 */
  data: string | Uint8Array;
  /** Serialization format 序列化格式 */
  format: SerializationFormat;
  /** Data size in bytes 数据大小（字节） */
  size: number;
  /** Serialization time in milliseconds 序列化时间（毫秒） */
  time: number;
  /** Metadata 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Deserialization result
 * 反序列化结果
 */
export interface DeserializationResult<T = unknown> {
  /** Deserialized object 反序列化对象 */
  object: T;
  /** Source version 源版本 */
  sourceVersion: SerializationVersion;
  /** Deserialization time in milliseconds 反序列化时间（毫秒） */
  time: number;
  /** Warnings during deserialization 反序列化过程中的警告 */
  warnings: string[];
}

/**
 * Current serialization version
 * 当前序列化版本
 */
export const CURRENT_SERIALIZATION_VERSION: SerializationVersion = {
  major: 1,
  minor: 0,
  patch: 0
};

/**
 * Default serialization options
 * 默认序列化选项
 */
export const DEFAULT_SERIALIZATION_OPTIONS: Required<SerializationOptions> = {
  format: SerializationFormat.JSON,
  mode: SerializationMode.Full,
  includeMetadata: true,
  prettyPrint: false,
  compressionLevel: 6,
  customSerializers: new Map()
};

/**
 * Default deserialization options
 * 默认反序列化选项
 */
export const DEFAULT_DESERIALIZATION_OPTIONS: Required<DeserializationOptions> = {
  strict: false,
  componentTypes: new Map(),
  customDeserializers: new Map(),
  migrationHandlers: new Map()
};
