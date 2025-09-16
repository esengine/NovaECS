/**
 * Prefab system exports
 * 预制体系统导出
 */

export {
  definePrefab,
  getPrefab,
  hasPrefab,
  getAllPrefabIds,
  spawnBatch
} from './Prefab';

export {
  spawnBatchFast
} from './PrefabSpawn';

export type {
  PrefabId,
  Defaults,
  PrefabComp,
  Prefab,
  SpawnOverrides,
  SpawnOptions
} from './Prefab';

