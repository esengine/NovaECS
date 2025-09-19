/**
 * Component serialization system
 * 组件序列化系统
 */

import type { ComponentCtor } from "../core/ComponentRegistry";

/**
 * Serialization interface for components
 * 组件序列化接口
 */
export interface Serde<T> {
  toJSON(v: T): any;
  fromJSON(data: any): T;
}

const serdes = new Map<Function, Serde<any>>();

/**
 * Register custom serializer for component type
 * 为组件类型注册自定义序列化器
 */
export function registerSerde<T>(ctor: ComponentCtor<T>, serde: Serde<T>): void {
  serdes.set(ctor, serde);
}

/**
 * Get serializer for component type, returns default if not registered
 * 获取组件类型的序列化器，未注册则返回默认实现
 */
export function getSerde<T>(ctor: ComponentCtor<T>): Serde<T> {
  return serdes.get(ctor) ?? {
    toJSON: (v: any) => ({ ...v }),                    // 默认浅拷贝
    fromJSON: (d: any) => Object.assign(new (ctor as any)(), d),
  };
}