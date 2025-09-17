/**
 * World state hashing for deterministic replay verification
 * 世界状态哈希，用于确定性重放验证
 */

import type { World } from '../core/World';
import { getComponentType, getCtorByTypeId, ComponentCtor } from '../core/ComponentRegistry';
import { PRNG } from '../determinism/PRNG';
import { Guid } from '../components/Guid';
import type { Archetype } from '../archetype/Archetype';

// FNV-1a 32-bit
const FNV_OFF = 0x811c9dc5 >>> 0;
const FNV_PRM = 0x01000193 >>> 0;

function hU32(h: number, v: number) { h ^= (v >>> 0); return (h * FNV_PRM) >>> 0; }
function hI32(h: number, v: number) { return hU32(h, v | 0); }
function hStr(h: number, s: string) {
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * FNV_PRM) >>> 0; }
  return h;
}

/**
 * Normalize numeric values: handle -0 / quantize / handle NaN & Infinity
 * 规范化数值：去-0/量化/处理NaN和无穷大
 */
function canonNum(n: number, scale = 1000): number {
  if (!Number.isFinite(n)) return 0x7f800000;        // ±Inf → 常量
  if (Number.isNaN(n)) return 0x7fc00000;           // NaN → 常量
  if (Object.is(n, -0)) n = 0;
  return (Math.round(n * scale) | 0);               // 量化到千分位
}

/**
 * Generic object hash for plain objects and arrays with cycle detection
 * 通用对象哈希（仅枚举可枚举自有属性，按key排序，递归数组/对象，支持循环检测）
 */
function hAny(h: number, v: any, seen = new WeakSet()): number {
  if (v == null) return hU32(h, 0);
  const t = typeof v;
  if (t === 'number') return hI32(h, canonNum(v));
  if (t === 'string') return hStr(h, v);
  if (t === 'boolean') return hU32(h, v ? 1 : 0);
  if (Array.isArray(v)) {
    if (seen.has(v)) return hU32(h, 0xC1C1E); // circular array
    seen.add(v);
    h = hU32(h, 0xA11CE); // array tag
    for (let i = 0; i < v.length; i++) h = hAny(h, v[i], seen);
    seen.delete(v);
    return h;
  }
  // TypedArray 快路
  if (ArrayBuffer.isView(v) && typeof (v as any).BYTES_PER_ELEMENT === 'number') {
    const ta = v as unknown as { length: number; [i: number]: number };
    h = hU32(h, 0x7A); // typed array tag
    for (let i = 0; i < ta.length; i++) h = hI32(h, canonNum(ta[i]));
    return h;
  }
  // Plain object：按 key 排序
  if (typeof v === 'object' && v !== null) {
    if (seen.has(v)) return hU32(h, 0xC1C1E); // circular object
    seen.add(v);
    const keys = Object.keys(v).sort();
    h = hU32(h, 0x0B1E); // object tag
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      h = hStr(h, k);
      h = hAny(h, v[k], seen);
    }
    seen.delete(v);
    return h;
  }
  return h;
}

/**
 * Stable entity key type
 * 稳定实体键类型
 */
type Key = { isGuid: boolean; u32: number; str?: string };

/**
 * Build entity key map for the current hashing cycle
 * 为当前哈希周期构建实体键映射
 */
function buildKeyMap(world: World): Map<number, Key> {
  const map = new Map<number, Key>();
  // 查询一次 Guid，预填所有有 Guid 的实体
  world.query(Guid).forEach((e, g: any) => {
    // Handle both proper Guid instances and plain objects from serialization
    // 处理真正的Guid实例和序列化产生的普通对象
    const guidStr = g?.value ?? g?._originalValue ?? '';
    map.set(e as unknown as number, { isGuid: true, u32: 0, str: String(guidStr) });
  });
  return map;
}

/**
 * Get stable entity key from cache
 * 从缓存获取稳定实体键
 */
function keyOf(map: Map<number, Key>, ent: number): Key {
  return map.get(ent) ?? { isGuid: false, u32: ent >>> 0 };
}


/**
 * Component-specific hasher function type
 * 组件专用哈希函数类型
 */
type ComponentHasher<T> = (h: number, c: T) => number;
const customHashers = new Map<Function, ComponentHasher<any>>();

/**
 * Register component-specific hasher for optimized hashing
 * 注册组件专用哈希器用于优化哈希
 */
export function registerComponentHasher<T>(ctor: ComponentCtor<T>, fn: ComponentHasher<T>) {
  customHashers.set(ctor, fn);
}

/**
 * Fast component hash: use custom hasher if available, otherwise generic
 * 快速组件哈希：优先用专用哈希，否则走通用
 */
function hComponent(h: number, comp: any, seen: WeakSet<object>): number {
  const ctor = comp?.constructor;
  const hasher = customHashers.get(ctor);
  return hasher ? hasher(h, comp) : hAny(h, comp, seen);
}

/**
 * Iterator for archetype component data in stable key order
 * 按稳定键顺序遍历原型组件数据的迭代器
 */
interface ArchetypeIterator {
  archetype: Archetype;
  typeId: number;
  index: number;
  sortedIndices: number[];
}

/**
 * Get sorted indices for archetype, cached within current hash cycle
 * 获取原型的排序索引，在当前哈希周期内缓存
 */
function getSortedIndicesForArch(arch: Archetype, keyMap: Map<number, Key>, archSortCache: Map<Archetype, number[]>): number[] {
  let arr = archSortCache.get(arch);
  if (arr) return arr;

  arr = Array.from({ length: arch.entities.length }, (_, i) => i);
  arr.sort((ia, ib) => {
    const ka = keyOf(keyMap, arch.entities[ia]);
    const kb = keyOf(keyMap, arch.entities[ib]);
    return compareStableKeys(ka, kb);
  });
  archSortCache.set(arch, arr);
  return arr;
}

/**
 * Create sorted iterator for an archetype's component data
 * 为原型的组件数据创建排序迭代器
 */
function createArchetypeIterator(_world: World, archetype: Archetype, typeId: number, keyMap: Map<number, Key>, archSortCache: Map<Archetype, number[]>): ArchetypeIterator | null {
  const col = archetype.cols.get(typeId);
  if (!col || archetype.entities.length === 0) return null;

  return {
    archetype,
    typeId,
    index: 0,
    sortedIndices: getSortedIndicesForArch(archetype, keyMap, archSortCache)
  };
}


/**
 * String comparison by UTF-16 code units for deterministic ordering
 * 按UTF-16码位比较字符串，确保确定性排序
 */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : (a > b ? 1 : 0);
}

/**
 * Compare two stable keys for ordering
 * 比较两个稳定键的顺序
 */
function compareStableKeys(a: Key, b: Key): number {
  if (a.isGuid && b.isGuid) return cmpStr(a.str!, b.str!);
  if (a.isGuid) return -1;
  if (b.isGuid) return 1;
  return a.u32 - b.u32;
}

/**
 * Heap item for k-way merge optimization
 * k路归并优化的堆项
 */
type HeapItem = { it: ArchetypeIterator; entity: number; comp: any; key: Key };

/**
 * Minimal binary min-heap for k-way merge
 * k路归并的极简二叉小顶堆
 */
class MinHeap {
  arr: HeapItem[] = [];

  static less(a: HeapItem, b: HeapItem): boolean {
    return compareStableKeys(a.key, b.key) < 0;
  }

  push(x: HeapItem): void {
    const a = this.arr;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!MinHeap.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.arr;
    if (a.length === 0) return;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < a.length && MinHeap.less(a[l], a[s])) s = l;
        if (r < a.length && MinHeap.less(a[r], a[s])) s = r;
        if (s === i) break;
        [a[i], a[s]] = [a[s], a[i]];
        i = s;
      }
    }
    return top;
  }
}

/**
 * Get heap item from iterator for k-way merge
 * 从迭代器获取堆项用于k路归并
 */
function heapPeekItem(_world: World, it: ArchetypeIterator, keyMap: Map<number, Key>): HeapItem | null {
  if (it.index >= it.sortedIndices.length) return null;
  const row = it.sortedIndices[it.index];
  const ent = it.archetype.entities[row];
  const comp = it.archetype.getComponentSnapshot(ent, it.typeId);
  return { it, entity: ent, comp, key: keyOf(keyMap, ent) };
}

/**
 * Hash world state for specific component types only
 * 对给定组件集合进行哈希（推荐用于回归测试）
 */
export function worldHashForComponents(world: World, ctors: ComponentCtor<any>[]): number {
  let h = FNV_OFF;

  // 构建键映射，本次哈希周期内复用
  const keyMap = buildKeyMap(world);

  // 原型排序缓存，本次哈希周期内复用
  const archSortCache = new Map<Archetype, number[]>();

  // 稳定顺序：按 typeId 升序处理类型
  const types = ctors
    .map(c => getComponentType(c))
    .sort((a, b) => a.id - b.id);

  for (const t of types) {
    h = hU32(h, 0xC0DE);        // type tag
    h = hU32(h, t.id);

    // k路归并优化：使用原型数据结构避免收集和排序
    const iterators: ArchetypeIterator[] = [];

    // 收集所有包含此组件类型的原型迭代器
    for (const archetype of world.getArchetypeIndex().getAll()) {
      if (archetype.types.includes(t.id)) {
        const iter = createArchetypeIterator(world, archetype, t.id, keyMap, archSortCache);
        if (iter) iterators.push(iter);
      }
    }

    // k路归并：用二叉小顶堆优化
    const heap = new MinHeap();
    for (const it of iterators) {
      const item = heapPeekItem(world, it, keyMap);
      if (item) heap.push(item);
    }

    const seen = new WeakSet<object>();
    let count = 0;
    while (heap.arr.length) {
      const { it, comp, key } = heap.pop()!;
      h = key.isGuid ? hStr(h, key.str!) : hU32(h, key.u32);
      h = hComponent(h, comp, seen);
      count++;

      it.index++;
      const next = heapPeekItem(world, it, keyMap);
      if (next) heap.push(next);
    }

    // 附带数量，快速粗校验
    h = hU32(h, count);
  }

  return h >>> 0;
}

/**
 * Global hash: get all registered/existing component types by default
 * 全局哈希：默认取所有已注册/存在的组件类型
 */
export function worldHash(world: World): number {
  // 优先走存储清单（更快）
  const typeIds = world.getActiveComponentTypes();
  if (typeIds.length > 0) {
    const ctors: ComponentCtor<any>[] = [];
    for (const typeId of typeIds) {
      const C = getCtorByTypeId(typeId);
      if (C) ctors.push(C);
    }
    return worldHashForComponents(world, ctors);
  }

  // 回退：保留原来的逻辑（但尽量用 Query 来枚举，少拿 components 全表）
  const existingTypes = new Set<ComponentCtor<any>>();
  const entities = world.getAllAliveEntities();
  for (const entity of entities) {
    const components = world.getEntityComponents(entity);
    for (const comp of components) {
      const ctor = comp?.constructor as ComponentCtor<any>;
      if (ctor) {
        existingTypes.add(ctor);
      }
    }
  }
  return worldHashForComponents(world, Array.from(existingTypes));
}

/**
 * Compare two world states for equality
 * 比较两个世界状态是否相等
 */
export function compareWorldStates(world1: World, world2: World): boolean {
  return worldHash(world1) === worldHash(world2);
}

/**
 * Hash frame data including frame number and PRNG seed
 * 把帧号与PRNG种子也纳入哈希
 */
export function frameHash(world: World, includeRng = true): number {
  let h = worldHash(world);
  h = hU32(h, world.frame >>> 0);

  if (includeRng) {
    try {
      const rng = world.getResource(PRNG);
      if (rng) {
        const seed = rng.getState();
        h = hU32(h, seed >>> 0);
      }
    } catch {
      // PRNG not available
    }
  }
  return h >>> 0;
}