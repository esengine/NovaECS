/**
 * Tag storage system using bitsets for efficient entity tagging
 * 使用位集的高效实体标签存储系统
 */

import type { Entity } from "../utils/Types";

/**
 * Tag store using simplified bitset approach
 * 使用简化位集方法的标签存储
 */
export class TagStore {
  // entityIndex -> bitset(32位分块)
  private bits: Map<number, Set<number>> = new Map(); // 简化：每 32 个 tag 一块

  /**
   * Add tag to entity
   * 为实体添加标签
   */
  add(e: Entity, tag: number): void {
    const idx = (e as unknown as number) & 0x0fffffff;
    const block = tag >>> 5;
    const bit = tag & 31;

    let set = this.bits.get(idx);
    if (!set) {
      set = new Set();
      this.bits.set(idx, set);
    }
    set.add((block << 5) | bit);
  }

  /**
   * Remove tag from entity
   * 从实体移除标签
   */
  remove(e: Entity, tag: number): void {
    const idx = (e as unknown as number) & 0x0fffffff;
    const set = this.bits.get(idx);
    if (!set) return;

    const block = tag >>> 5;
    const bit = tag & 31;
    set.delete((block << 5) | bit);

    if (set.size === 0) {
      this.bits.delete(idx);
    }
  }

  /**
   * Check if entity has tag
   * 检查实体是否具有标签
   */
  has(e: Entity, tag: number): boolean {
    const idx = (e as unknown as number) & 0x0fffffff;
    const set = this.bits.get(idx);
    if (!set) return false;

    const block = tag >>> 5;
    const bit = tag & 31;
    return set.has((block << 5) | bit);
  }

  /**
   * Get all tags for an entity
   * 获取实体的所有标签
   */
  getEntityTags(e: Entity): number[] {
    const idx = (e as unknown as number) & 0x0fffffff;
    const set = this.bits.get(idx);
    if (!set) return [];

    return Array.from(set);
  }

  /**
   * Remove all tags from entity
   * 移除实体的所有标签
   */
  clearEntity(e: Entity): void {
    const idx = (e as unknown as number) & 0x0fffffff;
    this.bits.delete(idx);
  }

  /**
   * Get entities that have specific tag
   * 获取具有特定标签的实体
   */
  getEntitiesWithTag(tag: number): Entity[] {
    const entities: Entity[] = [];
    const block = tag >>> 5;
    const bit = tag & 31;
    const tagBit = (block << 5) | bit;

    for (const [entityIdx, set] of this.bits) {
      if (set.has(tagBit)) {
        entities.push(entityIdx);
      }
    }

    return entities;
  }

  /**
   * Get total number of tagged entities
   * 获取已标记实体的总数
   */
  size(): number {
    return this.bits.size;
  }

  /**
   * Clear all tags
   * 清除所有标签
   */
  clear(): void {
    this.bits.clear();
  }
}