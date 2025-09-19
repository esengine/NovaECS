/**
 * Children index resource for efficient entity hierarchy management
 * 实体层级关系的高效索引资源
 */

import type { Entity } from "../utils/Types";

/**
 * Bidirectional index for parent-child relationships
 * 父子关系的双向索引
 */
export class ChildrenIndex {
  // 直接存 Entity（number）即可
  private map = new Map<Entity, Entity[]>();
  private parentOf = new Map<Entity, Entity>(); // 反查 child→parent（0 或 undefined 视为无父）

  constructor() {
    // 无参构造函数，方便资源系统使用
  }

  /**
   * Get all children of a parent entity
   * 获取父实体的所有子实体
   */
  childrenOf(p: Entity): readonly Entity[] {
    return this.map.get(p) ?? [];
  }

  /**
   * Get parent of an entity
   * 获取实体的父实体
   */
  parentOfEntity(e: Entity): Entity {
    return this.parentOf.get(e) ?? 0;
  }

  /**
   * Internal use only: write final state (does not trigger events)
   * 仅内部用：按照最终状态写入（不触发事件）
   */
  link(child: Entity, parent: Entity): void {
    // 先从旧父卸载
    const old = this.parentOf.get(child);
    if (old && old !== 0) {
      const arr = this.map.get(old);
      if (arr) {
        const i = arr.indexOf(child);
        if (i >= 0) arr.splice(i, 1);
        if (arr.length === 0) this.map.delete(old);
      }
    }

    // 写新父
    if (parent && parent !== 0) {
      let arr = this.map.get(parent);
      if (!arr) {
        arr = [];
        this.map.set(parent, arr);
      }
      arr.push(child);
      this.parentOf.set(child, parent);
    } else {
      this.parentOf.set(child, 0);
    }
  }

  /**
   * Fast retrieval of children when parent is destroyed
   * 父被销毁时快速拿到孩子
   */
  takeChildrenOf(p: Entity): Entity[] {
    const arr = this.map.get(p) ?? [];
    this.map.delete(p);
    for (const c of arr) {
      this.parentOf.set(c, 0);
    }
    return arr;
  }

  /**
   * Clear any records involving this entity
   * 清理任何涉及该实体的记录
   */
  clearEntity(e: Entity): void {
    // Remove from parent's children list
    // 从父级的子列表中移除
    const p = this.parentOf.get(e);
    if (p && p !== 0) {
      const arr = this.map.get(p);
      if (arr) {
        const i = arr.indexOf(e);
        if (i >= 0) arr.splice(i, 1);
        if (arr.length === 0) this.map.delete(p);
      }
    }
    this.parentOf.delete(e);

    // Orphan all children
    // 将所有子实体变为孤儿
    const children = this.map.get(e);
    if (children) {
      for (const c of children) {
        this.parentOf.set(c, 0);
      }
      this.map.delete(e);
    }
  }

  /**
   * Ancestor detection: check if child is an ancestor of newParent (prevents cycles)
   * 祖先检测：child 是否是 newParent 的祖先（用于防循环）
   */
  wouldCreateCycle(child: Entity, newParent: Entity): boolean {
    if (!newParent || newParent === 0) return false;
    if (child === newParent) return true;

    let cur: Entity | undefined = newParent;
    while (cur && cur !== 0) {
      if (cur === child) return true;
      cur = this.parentOf.get(cur) ?? 0;
    }
    return false;
  }

  /**
   * Get all entities that have children
   * 获取所有有子实体的实体
   */
  getAllParents(): Entity[] {
    return Array.from(this.map.keys());
  }

  /**
   * Get all entities that have a parent
   * 获取所有有父实体的实体
   */
  getAllChildren(): Entity[] {
    return Array.from(this.parentOf.keys()).filter(e => this.parentOf.get(e) !== 0);
  }

  /**
   * Get root entities (entities with no parent)
   * 获取根实体（无父实体的实体）
   */
  getRootEntities(): Entity[] {
    const allEntities = new Set<Entity>();

    // Collect all entities from parent map
    for (const parent of this.map.keys()) {
      allEntities.add(parent);
    }

    // Collect all entities from parentOf map
    for (const child of this.parentOf.keys()) {
      allEntities.add(child);
    }

    // Filter to only roots (no parent or parent is 0)
    return Array.from(allEntities).filter(e => {
      const parent = this.parentOf.get(e);
      return !parent || parent === 0;
    });
  }

  /**
   * Get depth of an entity in hierarchy (root = 0)
   * 获取实体在层级中的深度（根实体 = 0）
   */
  getDepth(e: Entity): number {
    let depth = 0;
    let current: Entity | undefined = e;

    while (current && current !== 0) {
      const parent = this.parentOf.get(current);
      if (!parent || parent === 0) break;
      depth++;
      current = parent;

      // Prevent infinite loops in malformed hierarchies
      if (depth > 1000) {
        throw new Error(`Hierarchy too deep or contains cycle for entity ${e}`);
      }
    }

    return depth;
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.)
   * 获取实体的所有后代（子、孙等）
   */
  getDescendants(e: Entity): Entity[] {
    const descendants: Entity[] = [];
    const stack = [...this.childrenOf(e)];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) break;
      descendants.push(current);
      stack.push(...this.childrenOf(current));
    }

    return descendants;
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.)
   * 获取实体的所有祖先（父、祖父等）
   */
  getAncestors(e: Entity): Entity[] {
    const ancestors: Entity[] = [];
    let current = this.parentOfEntity(e);

    while (current && current !== 0) {
      ancestors.push(current);
      current = this.parentOfEntity(current);

      // Prevent infinite loops
      if (ancestors.length > 1000) {
        throw new Error(`Hierarchy too deep or contains cycle for entity ${e}`);
      }
    }

    return ancestors;
  }

  /**
   * Clear all hierarchy data
   * 清除所有层级数据
   */
  clear(): void {
    this.map.clear();
    this.parentOf.clear();
  }

  /**
   * Get total number of parent-child relationships
   * 获取父子关系的总数
   */
  size(): number {
    return this.parentOf.size;
  }
}