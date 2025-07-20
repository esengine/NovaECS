import superjson from 'superjson';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import type {
  SerializationOptions,
  DeserializationOptions,
  SerializationResult,
  DeserializationResult,
  SerializationVersion
} from '../utils/SerializationTypes';
import { CURRENT_SERIALIZATION_VERSION, SerializationFormat } from '../utils/SerializationTypes';

/**
 * Serialization manager using Superjson and MessagePack
 * 使用Superjson和MessagePack的序列化管理器
 * 
 * @example
 * ```typescript
 * const serializer = new Serializer();
 * 
 * // JSON serialization (human-readable)
 * const jsonResult = await serializer.serialize(world, { format: 'json' });
 * const restoredWorld = await serializer.deserialize(jsonResult.data, { format: 'json' });
 * 
 * // MessagePack serialization (binary, compact)
 * const binaryResult = await serializer.serialize(world, { format: 'msgpack' });
 * const restoredWorld2 = await serializer.deserialize(binaryResult.data, { format: 'msgpack' });
 * ```
 */
export class Serializer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _componentTypes = new Map<string, new (...args: any[]) => any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _systemTypes = new Map<string, new (...args: any[]) => any>();

  constructor() {
    this._setupSuperjson();
  }

  /**
   * Register component type for deserialization
   * 注册组件类型用于反序列化
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComponentType<T>(name: string, constructor: new (...args: any[]) => T): void {
    this._componentTypes.set(name, constructor);
  }

  /**
   * Register system type for deserialization
   * 注册系统类型用于反序列化
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSystemType<T>(name: string, constructor: new (...args: any[]) => T): void {
    this._systemTypes.set(name, constructor);
  }

  /**
   * Serialize object to specified format
   * 将对象序列化为指定格式
   */
  serialize<T>(
    obj: T,
    options: SerializationOptions = {}
  ): Promise<SerializationResult> {
    const startTime = performance.now();
    const format = options.format || SerializationFormat.JSON;

    try {
      let data: string | Uint8Array;
      let size: number;

      // Prepare data with version and metadata
      const wrappedData = {
        version: CURRENT_SERIALIZATION_VERSION,
        timestamp: Date.now(),
        data: obj
      };

      switch (format) {
        case SerializationFormat.JSON: {
          const jsonString = superjson.stringify(wrappedData);
          data = options.prettyPrint ? JSON.stringify(JSON.parse(jsonString), null, 2) : jsonString;
          size = new TextEncoder().encode(data).length;
          break;
        }

        case SerializationFormat.Binary: {
          // Use superjson to handle complex types, then encode with MessagePack
          const serialized = superjson.serialize(wrappedData);
          const encoded = msgpackEncode(serialized);
          data = new Uint8Array(encoded);
          size = data.length;
          break;
        }

        default:
          throw new Error(`Unsupported serialization format: ${String(format)}`);
      }

      const endTime = performance.now();

      const result: SerializationResult = {
        data,
        format,
        size,
        time: endTime - startTime
      };

      if (options.includeMetadata) {
        result.metadata = {
          version: CURRENT_SERIALIZATION_VERSION,
          timestamp: Date.now(),
          format
        };
      }

      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(new Error(`Serialization failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Deserialize data from specified format
   * 从指定格式反序列化数据
   */
  deserialize<T = unknown>(
    data: string | Uint8Array,
    options: DeserializationOptions = {}
  ): Promise<DeserializationResult<T>> {
    const startTime = performance.now();

    try {
      let wrappedData: {
        version: SerializationVersion;
        timestamp: number;
        data: T;
      };

      // Determine format and deserialize
      if (typeof data === 'string') {
        // JSON format
        wrappedData = superjson.parse(data);
      } else {
        // Binary format (MessagePack)
        const decoded = msgpackDecode(data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        wrappedData = superjson.deserialize(decoded as any);
      }

      // Version compatibility check
      if (!this._isVersionCompatible(wrappedData.version)) {
        if (options.strict) {
          throw new Error(
            `Incompatible version. Source: ${wrappedData.version.major}.${wrappedData.version.minor}.${wrappedData.version.patch}, ` +
            `Current: ${CURRENT_SERIALIZATION_VERSION.major}.${CURRENT_SERIALIZATION_VERSION.minor}.${CURRENT_SERIALIZATION_VERSION.patch}`
          );
        }
      }

      const endTime = performance.now();

      return Promise.resolve({
        object: wrappedData.data,
        sourceVersion: wrappedData.version,
        time: endTime - startTime,
        warnings: []
      });
    } catch (error) {
      return Promise.reject(new Error(`Deserialization failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Create a snapshot of an object (lightweight serialization)
   * 创建对象快照（轻量级序列化）
   */
  createSnapshot<T>(obj: T): T {
    // Use superjson for deep cloning with type preservation
    const serialized = superjson.serialize(obj);
    return superjson.deserialize(serialized);
  }

  /**
   * Setup Superjson with custom transformers
   * 设置Superjson的自定义转换器
   */
  private _setupSuperjson(): void {
    // Superjson already handles Map, Set, Date, etc. by default
    // We only need to add custom transformers for our specific types if needed
  }

  /**
   * Check if version is compatible
   * 检查版本是否兼容
   */
  private _isVersionCompatible(sourceVersion: SerializationVersion): boolean {
    const current = CURRENT_SERIALIZATION_VERSION;
    
    // Major version must match
    if (sourceVersion.major !== current.major) {
      return false;
    }
    
    // Source version should not be newer than current
    if (sourceVersion.minor > current.minor) {
      return false;
    }
    
    if (sourceVersion.minor === current.minor && sourceVersion.patch > current.patch) {
      return false;
    }
    
    return true;
  }

  /**
   * Get registered component types
   * 获取已注册的组件类型
   */
  getComponentTypes(): string[] {
    return Array.from(this._componentTypes.keys());
  }

  /**
   * Get registered system types
   * 获取已注册的系统类型
   */
  getSystemTypes(): string[] {
    return Array.from(this._systemTypes.keys());
  }

  /**
   * Clear all registered types
   * 清除所有已注册的类型
   */
  clearRegisteredTypes(): void {
    this._componentTypes.clear();
    this._systemTypes.clear();
  }
}

/**
 * Global serializer instance
 * 全局序列化器实例
 */
export const serializer = new Serializer();

/**
 * Convenience functions for common serialization tasks
 * 常见序列化任务的便利函数
 */
export const SerializationUtils = {
  /**
   * Serialize to JSON string
   * 序列化为JSON字符串
   */
  async toJSON<T>(obj: T, prettyPrint = false): Promise<string> {
    const result = await serializer.serialize(obj, {
      format: SerializationFormat.JSON,
      prettyPrint
    });
    return result.data as string;
  },

  /**
   * Deserialize from JSON string
   * 从JSON字符串反序列化
   */
  async fromJSON<T>(json: string): Promise<T> {
    const result = await serializer.deserialize<T>(json);
    return result.object;
  },

  /**
   * Serialize to MessagePack binary
   * 序列化为MessagePack二进制
   */
  async toBinary<T>(obj: T): Promise<Uint8Array> {
    const result = await serializer.serialize(obj, {
      format: SerializationFormat.Binary
    });
    return result.data as Uint8Array;
  },

  /**
   * Deserialize from MessagePack binary
   * 从MessagePack二进制反序列化
   */
  async fromBinary<T>(binary: Uint8Array): Promise<T> {
    const result = await serializer.deserialize<T>(binary);
    return result.object;
  },

  /**
   * Create a deep clone of an object
   * 创建对象的深拷贝
   */
  clone<T>(obj: T): T {
    return serializer.createSnapshot(obj);
  }
};
