/**
 * CommandBuffer with full typeFromId/getCtorByTypeId support
 * 使用完整正反向注册的命令缓冲区
 *
 * Key points:
 * - add/remove internally only record typeId
 * - flush() uses typeFromId(id) to restore ComponentType
 * - For instantiation, uses getCtorByTypeId(id) to get real constructor
 * - Supports deduplication and application order: remove → add → enabled → destroy
 * - Same entity/component last write wins
 *
 * 要点：
 * - add/remove内部只记录typeId
 * - flush()时用typeFromId(id)还原ComponentType
 * - 实例化时用getCtorByTypeId(id)拿到真实构造函数
 * - 支持去重和应用顺序：remove → add → enabled → destroy
 * - 同一实体/组件最后写优先
 */

import { World } from './World';
import { Entity } from '../utils/Types';
import {
  ComponentCtor,
  getComponentType,
  getCtorByTypeId,
  typeFromId
} from './ComponentRegistry';
import type { Prefab } from '../prefab/Prefab';
import type { SpawnOptions } from '../prefab/SpawnOptions';

type TypeId = number;

/**
 * Spawn command for batch entity creation
 * 批量实体创建的spawn命令
 */
interface SpawnCommand {
  kind: 'spawn';
  prefab: Prefab;
  options: SpawnOptions;
}

/**
 * Pending operations for a single entity
 * 单个实体的挂起操作
 */
interface PendingPerEntity {
  /** If true, ignore other operations 若为true，忽略其它操作 */
  destroy?: boolean;
  /** Final enabled state (last write wins) 最终启用状态（最后写优先） */
  enable?: boolean;
  /** typeId -> component instance */
  adds?: Map<TypeId, unknown>;
  /** typeId set */
  removes?: Set<TypeId>;
}

/**
 * Command buffer for deferred entity and component operations
 * 延迟实体和组件操作的命令缓冲区
 */
export class CommandBuffer {
  private pending = new Map<Entity, PendingPerEntity>();
  private created: Entity[] = [];
  private spawns: SpawnCommand[] = [];

  constructor(private world: World) {}

  /**
   * Immediately request ID from EM; component and state changes still applied in flush()
   * 立即从EM申请ID；组件与状态变更仍在flush时统一应用
   */
  create(enabled = true): Entity {
    const entity = this.world.createEntity(enabled);
    this.created.push(entity);
    this.mut(entity).enable = enabled;
    return entity;
  }

  /**
   * Destroy entity (terminates all other operations on this entity)
   * 销毁实体（终止一切对该实体的其它操作）
   */
  destroy(entity: Entity): void {
    const pending = this.mut(entity);
    pending.destroy = true;
    delete pending.adds;
    delete pending.removes;
    // enable can be left or cleared, destroy will consume it anyway
    // enable留不留都无所谓，destroy时会吞掉
  }

  /**
   * Set enabled state (last write wins)
   * 设置启用状态（最后一次写生效）
   */
  setEnabled(entity: Entity, enabled: boolean): void {
    if (this.isDestroyed(entity)) return;
    this.mut(entity).enable = enabled;
  }

  /**
   * Add component by constructor (with optional partial data)
   * 通过构造函数添加（可选partial数据）
   */
  add<T>(entity: Entity, ctor: ComponentCtor<T>, partial?: Partial<T>): void {
    if (this.isDestroyed(entity)) return;
    const type = getComponentType(ctor);
    const instance = new ctor();
    if (partial) {
      Object.assign(instance as object, partial);
    }
    this.queueAdd(entity, type.id, instance);
  }

  /**
   * Add component using existing instance (derives typeId from instance.constructor)
   * 直接用现成实例添加（会从实例的constructor推导typeId）
   */
  addInstance<T>(entity: Entity, instance: T): void {
    if (this.isDestroyed(entity)) return;
    const ctor = (instance as { constructor: ComponentCtor<T> })?.constructor;
    const type = getComponentType(ctor);
    this.queueAdd(entity, type.id, instance);
  }

  /**
   * Add component by typeId (for network/editor data)
   * 通过typeId添加（如：网络/编辑器数据）
   * Will try to use constructor to instantiate and fill with init data
   * 会尝试用构造函数实例化并填充init数据
   */
  addByTypeId(entity: Entity, typeId: number, init?: Record<string, unknown>): void {
    if (this.isDestroyed(entity)) return;
    const Ctor = getCtorByTypeId(typeId);
    const instance = Ctor ? new Ctor() : {} as Record<string, unknown>;
    if (init) {
      Object.assign(instance as Record<string, unknown>, init);
    }
    this.queueAdd(entity, typeId, instance);
  }

  /**
   * Remove component by constructor
   * 通过构造函数移除组件
   */
  remove<T>(entity: Entity, ctor: ComponentCtor<T>): void {
    if (this.isDestroyed(entity)) return;
    const type = getComponentType(ctor);
    this.queueRemove(entity, type.id);
  }

  /**
   * Remove component by typeId
   * 通过typeId移除组件
   */
  removeByTypeId(entity: Entity, typeId: number): void {
    if (this.isDestroyed(entity)) return;
    this.queueRemove(entity, typeId);
  }

  /**
   * Spawn multiple entities from prefab (deferred until flush)
   * 从预制体批量生成实体（延迟到flush时执行）
   */
  spawn(prefab: Prefab, options: SpawnOptions = {}): void {
    this.spawns.push({
      kind: 'spawn',
      prefab,
      options
    });
  }

  /**
   * Apply all operations to world (recommended to call at frame end)
   * 应用到世界（建议帧末调用）
   */
  flush(): void {
    // Apply in order: spawns -> removes -> adds -> enable -> destroy
    // 应用顺序：spawns -> removes -> adds -> enable -> destroy

    // 0) Process spawns first to avoid structural changes during entity operations
    for (const spawnCmd of this.spawns) {
      this.world.spawn(spawnCmd.prefab, spawnCmd.options);
    }

    // 1) Process removals
    for (const [entity, pending] of this.pending) {
      if (pending.destroy) continue;
      if (pending.removes) {
        for (const typeId of pending.removes) {
          const type = typeFromId(typeId);
          this.world.removeComponentFromEntity(entity, type);
        }
      }
    }

    // 2) Process additions
    for (const [entity, pending] of this.pending) {
      if (pending.destroy) continue;
      if (pending.adds) {
        for (const [typeId, instance] of pending.adds) {
          const type = typeFromId(typeId);
          this.world.addComponentToEntity(entity, type, instance);
        }
      }
    }

    // 3) Process enable state changes
    for (const [entity, pending] of this.pending) {
      if (pending.destroy) continue;
      if (pending.enable !== undefined) {
        this.world.setEnabled(entity, pending.enable);
      }
    }

    // 4) Process destructions
    for (const [entity, pending] of this.pending) {
      if (pending.destroy) {
        this.world.destroyEntity(entity);
      }
    }

    // Clear all pending operations
    this.pending.clear();
    this.created = [];
    this.spawns = [];
  }

  /**
   * Internal utilities
   * 内部工具
   */
  private mut(entity: Entity): PendingPerEntity {
    let pending = this.pending.get(entity);
    if (!pending) {
      pending = {};
      this.pending.set(entity, pending);
    }
    return pending;
  }

  private isDestroyed(entity: Entity): boolean {
    return !!this.pending.get(entity)?.destroy;
  }

  private queueAdd(entity: Entity, typeId: number, instance: unknown): void {
    const pending = this.mut(entity);
    pending.removes?.delete(typeId);
    if (!pending.adds) {
      pending.adds = new Map();
    }
    pending.adds.set(typeId, instance);
  }

  private queueRemove(entity: Entity, typeId: number): void {
    const pending = this.mut(entity);
    pending.adds?.delete(typeId);
    if (!pending.removes) {
      pending.removes = new Set();
    }
    pending.removes.add(typeId);
  }
}