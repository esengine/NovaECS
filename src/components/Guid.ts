/**
 * GUID component for stable entity identification
 * GUID组件用于稳定的实体标识
 */
export class Guid {
  constructor(public value: string = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36)) {}
}