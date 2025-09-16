/**
 * Prefab system for batch entity creation with templates
 * 预制体系统，用于批量模板化实体创建
 */

import type { ComponentCtor, ComponentType } from '../core/ComponentRegistry';
import { getComponentType } from '../core/ComponentRegistry';
import type { World } from '../core/World';
import type { Entity } from '../utils/Types';
import { PRNG } from '../determinism/PRNG';

export interface SpawnOverrides {
  shared?: Record<string, any>;
  perEntity?: Array<Record<string, any>> | ((i: number) => Record<string, any>);
}

export interface SpawnOptions {
  count?: number;
  seed?: number;
  tags?: string[];
  epoch?: number;
  overrides?: SpawnOverrides;
  withGuid?: boolean;
}

export type PrefabId = string;
export type Defaults<T> = Partial<T> | (() => T);

/**
 * Component fragment: constructor + defaults (object or factory)
 * 组件片段：构造函数 + 默认值（对象或工厂）
 */
export interface PrefabComp<T = any> {
  ctor: ComponentCtor<T>;
  defaults: Defaults<T>;
}

/**
 * Prefab definition
 * 预制体定义
 */
export interface Prefab {
  id: PrefabId;
  comps: PrefabComp[];
  tags?: string[];
  /** Optional per-entity initialization (can use RNG/index/overrides for variations) */
  init?: (w: World, e: Entity, i: number, rng: PRNG) => void;
  /** Precompiled type info (filled after compilation) */
  _types?: {
    sorted: ComponentType<any>[];
    typeIds: number[];
  };
}

const registry = new Map<PrefabId, Prefab>();

/**
 * Define and register a prefab
 * 定义并注册预制体
 */
export function definePrefab(id: PrefabId, spec: Omit<Prefab, 'id'>): Prefab {
  const p: Prefab = { id, ...spec };

  // Precompile type table, sorted by typeId (fast archetype matching)
  // 预编译类型表，按 typeId 升序（命中 archetype 快）
  const types = p.comps.map(c => getComponentType(c.ctor)).sort((a, b) => a.id - b.id);
  p._types = {
    sorted: types,
    typeIds: types.map(t => t.id)
  };

  registry.set(id, p);
  return p;
}

/**
 * Get registered prefab by ID
 * 通过ID获取已注册的预制体
 */
export function getPrefab(id: PrefabId): Prefab {
  const p = registry.get(id);
  if (!p) throw new Error(`Prefab not found: ${id}`);
  return p;
}

/**
 * Check if prefab exists
 * 检查预制体是否存在
 */
export function hasPrefab(id: PrefabId): boolean {
  return registry.has(id);
}

/**
 * Get all registered prefab IDs
 * 获取所有已注册的预制体ID
 */
export function getAllPrefabIds(): PrefabId[] {
  return Array.from(registry.keys());
}

/**
 * Create batch of entities from prefab (optimized for performance)
 * 从预制体批量创建实体（性能优化）
 */
export function spawnBatch(
  world: World,
  prefabId: PrefabId,
  count: number,
  seed = 0x2F6E2B1
): Entity[] {
  const prefab = getPrefab(prefabId);
  const rng = new PRNG(seed);
  const entities: Entity[] = [];

  // Batch entity creation
  // 批量实体创建
  for (let i = 0; i < count; i++) {
    entities.push(world.createEntity());
  }

  // Batch component addition by type for better archetype performance
  // 按类型批量添加组件，以获得更好的archetype性能
  for (const comp of prefab.comps) {
    for (let i = 0; i < count; i++) {
      const defaults = typeof comp.defaults === 'function'
        ? (comp.defaults as () => any)()
        : { ...comp.defaults };

      world.addComponent(entities[i], comp.ctor, defaults);
    }
  }

  // Add tags in batch
  // 批量添加标签
  if (prefab.tags) {
    for (const tag of prefab.tags) {
      for (const entity of entities) {
        world.addTag(entity, tag);
      }
    }
  }

  // Run initialization hooks
  // 运行初始化钩子
  if (prefab.init) {
    for (let i = 0; i < count; i++) {
      prefab.init(world, entities[i], i, rng);
    }
  }

  return entities;
}