/**
 * Archetype index for efficient archetype management and querying
 * 原型索引用于高效的原型管理和查询
 */

import { Archetype } from './Archetype';
import { Bitset } from '../signature/Bitset';

export class ArchetypeIndex {
  private map = new Map<string, Archetype>();
  private signatureCache = new Map<string, Bitset>(); // 缓存从key重构的签名
  private _version = 0; // archetype结构变化版本号

  /**
   * Get or create archetype for given signature
   * 获取或创建给定签名的原型
   */
  getOrCreate(sig: Bitset): Archetype {
    const key = sig.key();
    let a = this.map.get(key);

    if (!a) {
      const types: number[] = [];

      // 从签名位集中提取类型ID
      sig.words.forEach((w, wi) => {
        if (!w) return;
        for (let b = 0; b < 32; b++) {
          if (w & (1 << b)) {
            types.push((wi << 5) | b); // wi * 32 + b
          }
        }
      });

      types.sort((x, y) => x - y);
      a = new Archetype(key, types);
      this.map.set(key, a);

      // 缓存重构的签名
      this.signatureCache.set(key, sig.clone());

      // archetype结构发生变化，增加版本号
      this._version++;
    }

    return a;
  }

  /**
   * Find archetypes matching query requirements
   * 查找匹配查询要求的原型
   */
  *match(required: Bitset, without: Bitset | null = null): Generator<Archetype> {
    for (const [key, archetype] of this.map) {
      // 尝试从缓存获取签名，否则重构
      let bs = this.signatureCache.get(key);
      if (!bs) {
        bs = this.reconstructSignature(archetype);
        this.signatureCache.set(key, bs);
      }

      // 检查是否满足必需组件
      if (!bs.containsAll(required)) continue;

      // 检查是否包含禁用组件
      if (without && bs.intersects(without)) continue;

      yield archetype;
    }
  }

  /**
   * Get archetype by signature key
   * 通过签名键获取原型
   */
  get(key: string): Archetype | undefined {
    return this.map.get(key);
  }

  /**
   * Get all archetypes
   * 获取所有原型
   */
  getAll(): Archetype[] {
    return Array.from(this.map.values());
  }

  /**
   * Remove empty archetypes
   * 移除空原型
   */
  cleanup(): void {
    const toDelete: string[] = [];

    for (const [key, archetype] of this.map) {
      if (archetype.isEmpty()) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.map.delete(key);
      this.signatureCache.delete(key);
    }

    if (toDelete.length > 0) {
      // archetype结构发生变化，增加版本号
      this._version++;
    }
  }

  /**
   * Get archetype count
   * 获取原型数量
   */
  size(): number {
    return this.map.size;
  }

  /**
   * Get total entity count across all archetypes
   * 获取所有原型中的实体总数
   */
  totalEntities(): number {
    let total = 0;
    for (const archetype of this.map.values()) {
      total += archetype.size();
    }
    return total;
  }

  /**
   * Find archetype containing specific entity
   * 查找包含特定实体的原型
   */
  findArchetypeWithEntity(entity: number): Archetype | undefined {
    for (const archetype of this.map.values()) {
      if (archetype.hasEntity(entity)) {
        return archetype;
      }
    }
    return undefined;
  }

  /**
   * Reconstruct signature from archetype types
   * 从原型类型重构签名
   */
  private reconstructSignature(archetype: Archetype): Bitset {
    const maxType = archetype.types.length > 0 ? archetype.types[archetype.types.length - 1] : 0;
    const wordsNeeded = Math.ceil((maxType + 1) / 32) || 1;
    const bs = new Bitset(wordsNeeded);

    for (const t of archetype.types) {
      bs.set(t);
    }

    return bs;
  }

  /**
   * Get statistics about archetype usage
   * 获取原型使用统计
   */
  getStats(): {
    archetypeCount: number;
    totalEntities: number;
    averageEntitiesPerArchetype: number;
    largestArchetypeSize: number;
    emptyArchetypes: number;
  } {
    const archetypes = Array.from(this.map.values());
    const sizes = archetypes.map(a => a.size());
    const totalEntities = sizes.reduce((sum, size) => sum + size, 0);
    const emptyCount = sizes.filter(size => size === 0).length;

    return {
      archetypeCount: archetypes.length,
      totalEntities,
      averageEntitiesPerArchetype: archetypes.length > 0 ? totalEntities / archetypes.length : 0,
      largestArchetypeSize: sizes.length > 0 ? Math.max(...sizes) : 0,
      emptyArchetypes: emptyCount
    };
  }

  /**
   * Clear all archetypes
   * 清空所有原型
   */
  clear(): void {
    this.map.clear();
    this.signatureCache.clear();
    this._version++;
  }

  /**
   * Get current archetype structure version
   * 获取当前archetype结构版本
   */
  version(): number {
    return this._version;
  }

  /**
   * Debug utility to print archetype information
   * 调试工具：打印原型信息
   */
  debug(): void {
    console.log('=== Archetype Index Debug ===');
    console.log(`Total archetypes: ${this.map.size}`);

    for (const [key, archetype] of this.map) {
      console.log(`Archetype ${key}:`);
      console.log(`  Types: [${archetype.types.join(', ')}]`);
      console.log(`  Entities: ${archetype.size()}`);
      console.log(`  Entity IDs: [${archetype.getEntities().join(', ')}]`);
    }
  }
}