/**
 * High-performance batch prefab spawning with optimizations
 * 高性能批量预制体生成及优化
 */

import type { PrefabId, Prefab } from './Prefab';
import { getPrefab } from './Prefab';
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

/**
 * High-performance batch spawning with fast path and fallback
 * 高性能批量生成，支持快速路径和回退
 */
export function spawnBatchFast(world: World, prefabId: PrefabId, opts: SpawnOptions = {}): Entity[] {
  const prefab: Prefab = getPrefab(prefabId);
  const n = Math.max(1, opts.count ?? 1);
  const epoch = (opts.epoch ?? world.frame) >>> 0;
  const rng = new PRNG(opts.seed ?? 0x2F6E2B1);

  const shared = opts.overrides?.shared ?? {};
  const per = opts.overrides?.perEntity;
  const getOv = (i: number) =>
    typeof per === 'function' ? per(i) :
    Array.isArray(per) ? (per[i] ?? {}) : {};

  return spawnBatch(world, prefab, n, epoch, rng, shared, getOv, opts);
}


/**
 * Batch spawn implementation
 * 批量生成实现
 */
function spawnBatch(
  world: World,
  prefab: Prefab,
  n: number,
  epoch: number,
  rng: PRNG,
  shared: Record<string, any>,
  getOv: (i: number) => Record<string, any>,
  opts: SpawnOptions
): Entity[] {
  const entities: Entity[] = new Array(n);

  // Create entities first
  for (let i = 0; i < n; i++) {
    entities[i] = world.createEntity();
  }

  // Add components with overrides
  for (const comp of prefab.comps) {
    const key = (comp.ctor as any).name;
    for (let i = 0; i < n; i++) {
      const base = typeof comp.defaults === 'function'
        ? (comp.defaults as Function)()
        : comp.defaults;
      const ov = { ...(shared[key] ?? {}), ...(getOv(i)[key] ?? {}) };
      const value = { ...base, ...ov };

      world.addComponent(entities[i], comp.ctor, value);

      // Set component with custom epoch for change tracking
      // 使用自定义epoch设置组件用于变更追踪
      world.replaceComponentWithEpoch(entities[i], comp.ctor, value, epoch);
    }
  }

  // Add tags in batch
  // 批量添加标签
  const allTags = [...new Set([...(prefab.tags ?? []), ...(opts.tags ?? [])])];

  if (allTags.length) {
    for (const entity of entities) {
      world.addTags(entity, allTags);
    }
  }

  // Run per-entity initialization
  if (prefab.init) {
    for (let i = 0; i < n; i++) {
      prefab.init(world, entities[i], i, rng);
    }
  }

  return entities;
}