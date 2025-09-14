/**
 * Query system for component-based entity filtering and iteration
 * 基于组件的实体过滤和遍历查询系统
 */

import { World } from './World';
import { ComponentType, ComponentCtor, getComponentType } from './ComponentRegistry';
import { Entity } from '../utils/Types';
// import type { IComponentStore } from './SparseSetStore';


/**
 * Query builder for component-based entity iteration
 * 基于组件的实体遍历查询构建器
 */
export class Query<ReqTuple extends unknown[] = unknown[]> {
  private required: ComponentType<unknown>[];
  private withoutTypes: ComponentType<unknown>[] = [];
  private requireTags: string[] = [];
  private forbidTags: string[] = [];

  constructor(private world: World, required: ComponentType<unknown>[]) {
    this.required = required;
  }

  /**
   * Filter: exclude entities that have these components
   * 过滤：排除含有这些组件的实体
   */
  without<T>(...ctors: ComponentCtor<T>[]): Query<ReqTuple> {
    this.withoutTypes.push(...ctors.map(getComponentType));
    return this;
  }

  /**
   * Filter by tags: require all specified tags and forbid any of the forbidden tags
   * 标签过滤：要求所有指定标签并禁止任何被禁止的标签
   */
  where(requireAll: string[] = [], forbidAny: string[] = []): Query<ReqTuple> {
    this.requireTags = requireAll;
    this.forbidTags = forbidAny;
    return this;
  }

  /**
   * Iterate over matching entities with their components
   * 遍历匹配的实体及其组件
   */
  forEach(callback: (entity: Entity, ...components: ReqTuple) => void): void {
    if (this.required.length === 0) return;

    // Select smallest store as anchor point for optimization
    // 选择最小存储作为锚点进行优化
    let anchorType = this.required[0];
    let anchorStore = this.world.getStore(anchorType);
    let anchorSize = anchorStore?.size() ?? 0;

    for (let i = 1; i < this.required.length; i++) {
      const store = this.world.getStore(this.required[i]);
      const size = store?.size() ?? 0;
      if (size < anchorSize) {
        anchorType = this.required[i];
        anchorStore = store;
        anchorSize = size;
      }
    }

    if (!anchorStore || anchorStore.size() === 0) return;

    this.world._enterIteration();
    try {
      anchorStore.forEach((entity, _anchorValue) => {
        // Check required components and collect instances
        // 检查必需组件并收集实例
        const values: unknown[] = new Array(this.required.length);
        for (let i = 0; i < this.required.length; i++) {
          const type = this.required[i];
          const store = this.world.getStore(type);
          if (!store) return;
          const value = store.get(entity);
          if (value === undefined) return; // Missing required component, skip
          values[i] = value;
        }

        // Apply without filter
        // 应用排除过滤器
        for (let i = 0; i < this.withoutTypes.length; i++) {
          const type = this.withoutTypes[i];
          const store = this.world.getStore(type);
          if (store && store.has(entity)) return; // Excluded by without filter
        }

        // Apply tag filters
        // 应用标签过滤器
        const okReq = this.requireTags.every(n => this.world.hasTag(entity, n));
        if (!okReq) return;
        const bad = this.forbidTags.some(n => this.world.hasTag(entity, n));
        if (bad) return;

        callback(entity, ...values as unknown as ReqTuple);
      });
    } finally {
      this.world._leaveIteration();
    }
  }
}