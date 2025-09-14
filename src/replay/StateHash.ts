/**
 * World state hashing for deterministic replay verification
 * 世界状态哈希，用于确定性重放验证
 */

import type { World } from '../core/World';
import { getCtorByName } from '../core/ComponentRegistry';

/**
 * Compute stable hash of world state based on key components
 * 基于关键组件计算世界状态的稳定哈希
 */
export function worldHash(world: World): number {
  // FNV-1a hash algorithm
  let h = 2166136261 >>> 0;

  // Collect all component instances grouped by type
  const componentsByType = new Map<string, any[]>();

  const entities = world.getAllAliveEntities();
  for (const entity of entities) {
    const components = world.getEntityComponents(entity);

    for (const comp of components) {
      const ctor = (comp as any).constructor;
      const typeName = ctor.name;

      if (!componentsByType.has(typeName)) {
        componentsByType.set(typeName, []);
      }
      componentsByType.get(typeName)!.push(comp);
    }
  }

  // Process component types in sorted order
  const sortedTypeNames = Array.from(componentsByType.keys()).sort();

  for (const typeName of sortedTypeNames) {
    const components = componentsByType.get(typeName)!;

    // Sort components within type for deterministic ordering
    const sortedComponents = [...components].sort((a, b) => {
      // Sort by serialized representation for stable ordering
      const aStr = getComponentSortKey(a, typeName);
      const bStr = getComponentSortKey(b, typeName);
      return aStr.localeCompare(bStr);
    });

    // Hash type name
    h = hashString(h, typeName);

    // Hash sorted component data
    for (const comp of sortedComponents) {
      h = hashComponent(h, comp, typeName);
    }
  }

  return h >>> 0;
}

/**
 * Get sort key for component to ensure deterministic ordering
 * 获取组件排序键以确保确定性排序
 */
function getComponentSortKey(comp: any, typeName: string): string {
  switch (typeName) {
    case 'Position':
      return `${comp.x || 0}_${comp.y || 0}`;
    case 'Velocity':
      return `${comp.dx || 0}_${comp.dy || 0}`;
    case 'Health':
      return `${comp.hp || 0}`;
    case 'Guid':
      return comp.value || '';
    default:
      try {
        return JSON.stringify(comp, Object.keys(comp).sort());
      } catch {
        return typeName;
      }
  }
}

/**
 * Hash specific component types with stable serialization
 * 使用稳定序列化对特定组件类型进行哈希
 */
function hashComponent(h: number, comp: any, typeName: string): number {
  switch (typeName) {
    case 'Position':
      if (comp.x !== undefined && comp.y !== undefined) {
        h ^= (comp.x * 1000 | 0);
        h = (h * 16777619) >>> 0;
        h ^= (comp.y * 1000 | 0);
        h = (h * 16777619) >>> 0;
      }
      break;

    case 'Velocity':
      if (comp.dx !== undefined && comp.dy !== undefined) {
        h ^= (comp.dx * 1000 | 0);
        h = (h * 16777619) >>> 0;
        h ^= (comp.dy * 1000 | 0);
        h = (h * 16777619) >>> 0;
      }
      break;

    case 'Health':
      if (comp.hp !== undefined) {
        h ^= (comp.hp | 0);
        h = (h * 16777619) >>> 0;
      }
      break;

    case 'Guid':
      if (comp.value !== undefined) {
        h = hashString(h, comp.value);
      }
      break;

    default:
      // Generic hash for unknown component types
      h = hashObject(h, comp);
      break;
  }

  return h;
}

/**
 * Hash string data using FNV-1a
 * 使用FNV-1a算法哈希字符串数据
 */
function hashString(h: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/**
 * Generic object hash using JSON serialization
 * 使用JSON序列化的通用对象哈希
 */
function hashObject(h: number, obj: any): number {
  try {
    const json = JSON.stringify(obj, Object.keys(obj).sort());
    return hashString(h, json);
  } catch {
    // Fallback for non-serializable objects
    return h;
  }
}

/**
 * Hash world state for specific component types only
 * 仅对特定组件类型的世界状态进行哈希
 */
export function worldHashForComponents(world: World, componentNames: string[]): number {
  let h = 2166136261 >>> 0;

  for (const componentName of componentNames.sort()) {
    const ComponentCtor = getCtorByName(componentName);
    if (!ComponentCtor) continue;

    // Get all entities with this component type
    const entities = world.getAllAliveEntities()
      .filter(e => world.hasComponent(e, ComponentCtor))
      .sort((a, b) => a - b);

    for (const entity of entities) {
      h ^= entity;
      h = (h * 16777619) >>> 0;

      const comp = world.getComponent(entity, ComponentCtor);
      if (comp) {
        h = hashComponent(h, comp, componentName);
      }
    }
  }

  return h >>> 0;
}

/**
 * Compare two world states for equality
 * 比较两个世界状态是否相等
 */
export function compareWorldStates(world1: World, world2: World): boolean {
  return worldHash(world1) === worldHash(world2);
}

/**
 * Hash frame data including RNG state
 * 包含RNG状态的帧数据哈希
 */
export function frameHash(world: World, includeRng = true): number {
  let h = worldHash(world);

  // Include frame number
  h ^= world.frame;
  h = (h * 16777619) >>> 0;

  // Include RNG state if available
  if (includeRng) {
    try {
      const PRNGCtor = getCtorByName('PRNG');
      if (PRNGCtor) {
        const rng = world.getResource(PRNGCtor);
        if (rng && (rng as any).s !== undefined) {
          h ^= (rng as any).s;
          h = (h * 16777619) >>> 0;
        }
      }
    } catch {
      // PRNG not available or accessible
    }
  }

  return h >>> 0;
}