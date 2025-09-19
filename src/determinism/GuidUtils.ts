/**
 * GUID Utility Functions
 * GUID工具函数
 *
 * Provides utility functions for GUID assignment, comparison, and string conversion.
 * Handles both GUID-enabled and non-GUID entities uniformly through StableKey abstraction.
 * 提供GUID分配、比较和字符串转换的工具函数。
 * 通过StableKey抽象统一处理有GUID和无GUID的实体。
 */

import type { Entity } from '../utils/Types';
import { Guid } from '../components/Guid';
import type { World } from '../core/World';
import { getGuidAllocator } from './GuidAllocator';

/**
 * Ensure entity has a GUID, assigning one if it doesn't exist
 * 确保实体有GUID，如果不存在则分配一个
 */
export function ensureGuid(world: World, e: Entity): void {
  if (!world.hasComponent(e, Guid)) {
    const { hi, lo } = getGuidAllocator(world).issue();
    const guid = new Guid(hi, lo);
    world.addComponent(e, Guid, guid);
  }
}

/**
 * Stable key for deterministic entity sorting
 * 用于确定性实体排序的稳定键
 *
 * Provides a unified representation for entities with or without GUIDs.
 * GUID entities get priority in sorting order.
 * 为有GUID和无GUID的实体提供统一表示。
 * GUID实体在排序中具有优先级。
 */
export type StableKey =
  | { kind: 'guid'; hi: number; lo: number }
  | { kind: 'id';   id: number };

/**
 * Get stable key for entity, prioritizing GUID over entity ID
 * 获取实体的稳定键，GUID优先于实体ID
 */
export function stableEntityKey(world: World, e: Entity): StableKey {
  try {
    const g = world.getComponent(e, Guid);
    if (g && (g.hi !== 0 || g.lo !== 0)) {
      return { kind: 'guid', hi: g.hi >>> 0, lo: g.lo >>> 0 };
    }
  } catch {
    // GUID component not found, fall back to entity ID
    // 未找到GUID组件，回退到实体ID
  }
  return { kind: 'id', id: (e) >>> 0 };
}

/**
 * Compare two stable keys for deterministic ordering
 * 比较两个稳定键以进行确定性排序
 *
 * GUID keys always sort before ID keys.
 * Within same key type, comparison is done numerically.
 * GUID键总是排在ID键之前。
 * 在相同键类型内，进行数值比较。
 */
export function cmpStable(a: StableKey, b: StableKey): number {
  if (a.kind === 'guid' && b.kind === 'guid') {
    // Compare high 32 bits first, then low 32 bits
    // 先比较高32位，再比较低32位
    const hiDiff = (a.hi >>> 0) - (b.hi >>> 0);
    if (hiDiff !== 0) {
      return hiDiff;
    }
    return (a.lo >>> 0) - (b.lo >>> 0);
  }
  if (a.kind === 'guid') return -1; // GUID has priority
  if (b.kind === 'guid') return  1; // GUID has priority
  // Both are entity IDs
  return ((a.id >>> 0) - (b.id >>> 0)) | 0;
}

/**
 * Convert GUID to readable string representation (base 36)
 * 将GUID转换为可读字符串表示（36进制）
 *
 * Only use for display/logging purposes, not for comparison or storage.
 * Base 36 provides compact representation using digits and letters.
 * 仅用于显示/日志目的，不用于比较或存储。
 * 36进制使用数字和字母提供紧凑表示。
 */
export function guidToString(g: Guid): string {
  // Simple approach: convert to hex string for readability
  // 简单方法：转换为十六进制字符串以便阅读
  const hiHex = (g.hi >>> 0).toString(16).padStart(8, '0');
  const loHex = (g.lo >>> 0).toString(16).padStart(8, '0');
  return `${hiHex}-${loHex}`;
}

/**
 * Parse string back to GUID (inverse of guidToString)
 * 将字符串解析回GUID（guidToString的逆操作）
 */
export function stringToGuid(s: string): Guid {
  // Parse hex format: "xxxxxxxx-xxxxxxxx"
  // 解析十六进制格式："xxxxxxxx-xxxxxxxx"
  const parts = s.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid GUID string format: ${s}`);
  }
  const hi = parseInt(parts[0], 16) >>> 0;
  const lo = parseInt(parts[1], 16) >>> 0;
  return new Guid(hi, lo);
}

/**
 * Check if entity has a GUID component
 * 检查实体是否有GUID组件
 */
export function hasGuid(world: World, e: Entity): boolean {
  return world.hasComponent(e, Guid);
}

/**
 * Get GUID from entity, returns undefined if not present
 * 从实体获取GUID，不存在时返回undefined
 */
export function getGuid(world: World, e: Entity): Guid | undefined {
  try {
    return world.getComponent(e, Guid);
  } catch {
    return undefined;
  }
}