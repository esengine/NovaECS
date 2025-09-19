/**
 * Component schema system for SharedArrayBuffer optimization
 * 用于SharedArrayBuffer优化的组件模式系统
 */

/**
 * Supported field types for SAB storage
 * SAB存储支持的字段类型
 */
export type FieldType = 'f32' | 'f64' | 'i32' | 'u32' | 'i16' | 'u16' | 'i8' | 'u8' | 'bool';

/**
 * Component schema defining field types for SAB storage
 * 定义SAB存储字段类型的组件模式
 */
export type ComponentSchema = { 
  fields: Record<string, FieldType> 
};

/**
 * Global schema registry mapping constructors to schemas
 * 将构造函数映射到模式的全局模式注册表
 */
const schemaMap = new Map<Function, ComponentSchema>();

/**
 * Register a schema for a component type to enable SAB storage
 * 为组件类型注册模式以启用SAB存储
 */
export function registerSchema<C>(ctor: new (...a: any[]) => C, schema: ComponentSchema): void {
  schemaMap.set(ctor, schema);
}

/**
 * Get the registered schema for a component type
 * 获取组件类型的已注册模式
 */
export function getSchema(ctor: Function): ComponentSchema | undefined {
  return schemaMap.get(ctor);
}

/**
 * Check if a component type has a registered schema
 * 检查组件类型是否有已注册的模式
 */
export function hasSchema(ctor: Function): boolean {
  return schemaMap.has(ctor);
}

/**
 * Clear all registered schemas (for testing)
 * 清除所有已注册的模式（用于测试）
 */
export function __resetSchemas(): void {
  schemaMap.clear();
}

/**
 * Get byte size for a field type
 * 获取字段类型的字节大小
 */
export function getFieldByteSize(type: FieldType): number {
  switch (type) {
    case 'f64': return 8;
    case 'f32': case 'i32': case 'u32': return 4;
    case 'i16': case 'u16': return 2;
    case 'i8': case 'u8': case 'bool': return 1;
    default: throw new Error(`Unknown field type: ${String(type)}`);
  }
}

/**
 * Calculate total byte size for a component schema
 * 计算组件模式的总字节大小
 */
export function getSchemaByteSize(schema: ComponentSchema): number {
  let size = 0;
  for (const fieldType of Object.values(schema.fields)) {
    size += getFieldByteSize(fieldType);
  }
  return size;
}

/**
 * Get TypedArray constructor for a field type
 * 获取字段类型的TypedArray构造函数
 */
export function getTypedArrayConstructor(type: FieldType): new (buffer: ArrayBufferLike, byteOffset?: number, length?: number) => any {
  switch (type) {
    case 'f64': return Float64Array;
    case 'f32': return Float32Array;
    case 'i32': return Int32Array;
    case 'u32': return Uint32Array;
    case 'i16': return Int16Array;
    case 'u16': return Uint16Array;
    case 'i8': return Int8Array;
    case 'u8': case 'bool': return Uint8Array;
    default: throw new Error(`Unknown field type: ${String(type)}`);
  }
}