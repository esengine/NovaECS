/**
 * Entity lifecycle manager - replaces the old Entity class
 * 实体生命周期管理器 - 替代旧的Entity类
 *
 * This manager handles the creation, destruction, and lifecycle of entities
 * using pure numeric handles with generation numbers for memory efficiency.
 * 此管理器使用带世代号的纯数字句柄处理实体的创建、销毁和生命周期，以实现内存效率。
 */

import { Entity, makeEntity, indexOf, genOf } from '../utils/Types';

/**
 * EntityManager manages entity lifecycle with generation-based handles
 * EntityManager使用基于世代的句柄管理实体生命周期
 */
export class EntityManager {
  private generations: Uint32Array;
  private alive: Uint8Array;
  private enabled: Uint8Array;
  private free: number[] = [];
  private nextIndex = 1;
  private _aliveCount = 0;

  /**
   * Create new EntityManager with initial capacity
   * 创建具有初始容量的新EntityManager
   */
  constructor(initialCapacity = 1024) {
    this.generations = new Uint32Array(initialCapacity);
    this.alive = new Uint8Array(initialCapacity);
    this.enabled = new Uint8Array(initialCapacity);
  }

  /**
   * Ensure arrays have capacity for the given index
   * 确保数组对给定索引有容量
   */
  private ensure(index: number): void {
    if (index < this.generations.length) return;

    let newSize = this.generations.length || 1;
    while (newSize <= index) {
      newSize <<= 1;
    }

    const newGenerations = new Uint32Array(newSize);
    newGenerations.set(this.generations);
    this.generations = newGenerations;

    const newAlive = new Uint8Array(newSize);
    newAlive.set(this.alive);
    this.alive = newAlive;

    const newEnabled = new Uint8Array(newSize);
    newEnabled.set(this.enabled);
    this.enabled = newEnabled;
  }

  /**
   * Create a new entity
   * 创建新实体
   */
  create(enabled = true): Entity {
    const index = this.free.length > 0 ? (this.free.pop() ?? this.nextIndex++) : this.nextIndex++;
    this.ensure(index);

    const generation = this.generations[index];
    this.alive[index] = 1;
    this.enabled[index] = enabled ? 1 : 0;
    this._aliveCount++;

    return makeEntity(index, generation);
  }

  /**
   * Destroy an entity
   * 销毁实体
   */
  destroy(entity: Entity): boolean {
    const index = indexOf(entity);
    if (index >= this.generations.length) return false;
    if (!this.alive[index]) return false;
    if (this.generations[index] !== genOf(entity)) return false;

    this.alive[index] = 0;
    this.enabled[index] = 0;
    this.generations[index] = (this.generations[index] + 1) >>> 0;
    this.free.push(index);
    this._aliveCount--;

    return true;
  }

  /**
   * Check if entity is alive
   * 检查实体是否存活
   */
  isAlive(entity: Entity): boolean {
    const index = indexOf(entity);
    return index < this.generations.length &&
           this.alive[index] === 1 &&
           this.generations[index] === genOf(entity);
  }

  /**
   * Check if entity is enabled
   * 检查实体是否启用
   */
  isEnabled(entity: Entity): boolean {
    return this.isAlive(entity) && this.enabled[indexOf(entity)] === 1;
  }

  /**
   * Set entity enabled state
   * 设置实体启用状态
   */
  setEnabled(entity: Entity, enabled: boolean): void {
    if (this.isAlive(entity)) {
      this.enabled[indexOf(entity)] = enabled ? 1 : 0;
    }
  }

  /**
   * Get count of alive entities
   * 获取存活实体数量
   */
  aliveCount(): number {
    return this._aliveCount;
  }

  /**
   * Get all alive entities
   * 获取所有存活实体
   */
  getAllAliveEntities(): Entity[] {
    const entities: Entity[] = [];
    for (let i = 0; i < this.nextIndex; i++) {
      if (this.alive[i] === 1) {
        entities.push(makeEntity(i, this.generations[i]));
      }
    }
    return entities;
  }

  /**
   * Get all enabled entities
   * 获取所有启用实体
   */
  getAllEnabledEntities(): Entity[] {
    const entities: Entity[] = [];
    for (let i = 0; i < this.nextIndex; i++) {
      if (this.alive[i] === 1 && this.enabled[i] === 1) {
        entities.push(makeEntity(i, this.generations[i]));
      }
    }
    return entities;
  }

  /**
   * Clear all entities
   * 清空所有实体
   */
  clear(): void {
    this.alive.fill(0);
    this.enabled.fill(0);
    this.generations.fill(0);
    this.free.length = 0;
    this.nextIndex = 0;
    this._aliveCount = 0;
  }

  /**
   * Get memory usage statistics
   * 获取内存使用统计
   */
  getStats(): {
    capacity: number;
    aliveCount: number;
    freeCount: number;
    memoryUsage: number;
  } {
    return {
      capacity: this.generations.length,
      aliveCount: this._aliveCount,
      freeCount: this.free.length,
      memoryUsage: (
        this.generations.byteLength +
        this.alive.byteLength +
        this.enabled.byteLength
      )
    };
  }
}