/**
 * Archetype adapter for Query system
 * Query系统的原型适配器
 */

import { Bitset } from '../signature/Bitset';
import type { World } from './World';
import type { ComponentCtor } from './ComponentRegistry';
import { getComponentType } from './ComponentRegistry';

/**
 * Execute callback for entities matching component requirements using archetype storage
 * 使用原型存储对匹配组件要求的实体执行回调
 */
export function forEachArchetype(
  world: World,
  requiredCtors: ComponentCtor<any>[],
  withoutCtors: ComponentCtor<any>[],
  cb: (e: any, ...comps: any[]) => void
): void {
  const toMask = (ctors: ComponentCtor<any>[]): Bitset => {
    const bs = new Bitset(64);
    for (const c of ctors) {
      const type = getComponentType(c);
      bs.set(type.id);
    }
    return bs;
  };

  const reqMask = toMask(requiredCtors);
  const woutMask = withoutCtors.length ? toMask(withoutCtors) : null;

  // Get archetype index from World
  const archetypeIndex = world.getArchetypeIndex();

  for (const arch of archetypeIndex.match(reqMask, woutMask)) {
    // 构造列引用（避免内层重复 Map 查找）
    const cols = requiredCtors.map(c => {
      const type = getComponentType(c);
      return arch.getColView(type.id);
    });

    for (let row = 0; row < arch.entities.length; row++) {
      const e = arch.entities[row];

      // 检查实体是否存活和启用
      if (!world.isAlive(e) || !world.isEnabled(e)) {
        continue;
      }

      // 构造组件参数
      const args = cols.map(col => col ? col.readToObject(row) : undefined);
      cb(e, ...args);
    }
  }
}

/**
 * Count entities matching component requirements using archetype storage
 * 使用原型存储统计匹配组件要求的实体数量
 */
export function countArchetype(
  world: World,
  requiredCtors: ComponentCtor<any>[],
  withoutCtors: ComponentCtor<any>[]
): number {
  const toMask = (ctors: ComponentCtor<any>[]): Bitset => {
    const bs = new Bitset(64);
    for (const c of ctors) {
      const type = getComponentType(c);
      bs.set(type.id);
    }
    return bs;
  };

  const reqMask = toMask(requiredCtors);
  const woutMask = withoutCtors.length ? toMask(withoutCtors) : null;

  const archetypeIndex = world.getArchetypeIndex();
  let count = 0;

  for (const arch of archetypeIndex.match(reqMask, woutMask)) {
    // Count only alive and enabled entities
    for (let row = 0; row < arch.entities.length; row++) {
      const e = arch.entities[row];
      if (world.isAlive(e) && world.isEnabled(e)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Get all entities matching component requirements using archetype storage
 * 使用原型存储获取所有匹配组件要求的实体
 */
export function getEntitiesArchetype(
  world: World,
  requiredCtors: ComponentCtor<any>[],
  withoutCtors: ComponentCtor<any>[]
): any[] {
  const toMask = (ctors: ComponentCtor<any>[]): Bitset => {
    const bs = new Bitset(64);
    for (const c of ctors) {
      const type = getComponentType(c);
      bs.set(type.id);
    }
    return bs;
  };

  const reqMask = toMask(requiredCtors);
  const woutMask = withoutCtors.length ? toMask(withoutCtors) : null;

  const archetypeIndex = world.getArchetypeIndex();
  const entities: any[] = [];

  for (const arch of archetypeIndex.match(reqMask, woutMask)) {
    for (let row = 0; row < arch.entities.length; row++) {
      const e = arch.entities[row];
      if (world.isAlive(e) && world.isEnabled(e)) {
        entities.push(e);
      }
    }
  }

  return entities;
}