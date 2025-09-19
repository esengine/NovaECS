/**
 * World Space Hull Cache Component for 2D Physics
 * 2D物理引擎的世界空间凸包缓存组件
 *
 * Pre-computes world vertices and edge normals for convex hulls
 * to optimize narrow-phase collision detection performance.
 * 为凸包预计算世界顶点和边法线，以优化窄相碰撞检测性能。
 */

import type { FX } from '../math/fixed';

/**
 * World space hull cache with transformed vertices and edge normals
 * 带变换顶点和边法线的世界空间凸包缓存
 */
export class HullWorld2D {
  /**
   * World space vertices in the same order as hull vertices
   * Array stores as [wx0, wy0, wx1, wy1, ...]
   * 与凸包顶点相同顺序的世界空间顶点
   * 数组存储为 [wx0, wy0, wx1, wy1, ...]
   */
  wverts: FX[] = [];

  /**
   * Outward-facing edge normals in world space
   * Array stores as [nx0, ny0, nx1, ny1, ...]
   * Each normal corresponds to edge i -> (i+1)%count
   * 世界空间中向外的边法线
   * 数组存储为 [nx0, ny0, nx1, ny1, ...]
   * 每个法线对应边 i -> (i+1)%count
   */
  normals: FX[] = [];

  /**
   * Number of vertices/edges in the cached hull
   * 缓存凸包中的顶点/边数量
   */
  count = 0;

  /**
   * Frame/epoch when this cache was last updated
   * Used for change detection and cache invalidation
   * 此缓存最后更新的帧/时期号
   * 用于变更检测和缓存失效
   */
  epoch = 0;

  constructor() {
    this.wverts = [];
    this.normals = [];
    this.count = 0;
    this.epoch = 0;
  }

  /**
   * Get world vertex at specified index
   * 获取指定索引的世界顶点
   */
  getWorldVertex(index: number): readonly [FX, FX] {
    if (index < 0 || index >= this.count) {
      throw new Error(`World vertex index ${index} out of range [0, ${this.count})`);
    }

    const i = index * 2;
    return [this.wverts[i], this.wverts[i + 1]];
  }

  /**
   * Get edge normal at specified index
   * 获取指定索引的边法线
   */
  getEdgeNormal(index: number): readonly [FX, FX] {
    if (index < 0 || index >= this.count) {
      throw new Error(`Edge normal index ${index} out of range [0, ${this.count})`);
    }

    const i = index * 2;
    return [this.normals[i], this.normals[i + 1]];
  }

  /**
   * Reserve space for specified number of vertices
   * 为指定数量的顶点预留空间
   */
  reserve(vertexCount: number): void {
    const requiredSize = vertexCount * 2;

    if (this.wverts.length < requiredSize) {
      this.wverts = new Array(requiredSize);
      this.normals = new Array(requiredSize);
    }

    this.count = vertexCount;
  }
}