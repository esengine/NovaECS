/**
 * Transform hierarchy systems with dirty marking and topological update
 * 带脏标记和拓扑更新的变换层级系统
 */

import { system } from '../core/System';
import { getCtorByTypeId, getComponentType } from '../core/ComponentRegistry';
import { Parent, LocalTransform, WorldTransform, DirtyTransform } from '../components/Transform';
import { mul, fromLocal } from '../math/Mat3';
import type { Entity } from '../utils/Types';
import { ChildrenIndex } from "../hierarchy/ChildrenIndex";
import { getOrCreateResource } from "../utils/ResourceHelpers";

/**
 * System that marks transforms as dirty when structural changes occur
 * 当结构变化发生时标记变换为脏的系统
 */
export const TransformMarkDirtySystem = system('TransformMarkDirty', (ctx) => {
  const { world } = ctx;

  const added = world.getAddedChannel();
  const removed = world.getRemovedChannel();

  // Mark dirty when Parent or LocalTransform components are added or removed
  // 当Parent或LocalTransform组件被添加或移除时标记为脏
  added.drain(ev => {
    const Ctor = getCtorByTypeId(ev.typeId);
    if (Ctor === Parent || Ctor === LocalTransform) {
      const cmd = world.cmd();
      cmd.add(ev.e, DirtyTransform);
      world.flush(cmd);
    }
  });

  removed.drain(ev => {
    const Ctor = getCtorByTypeId(ev.typeId);
    if (Ctor === Parent || Ctor === LocalTransform) {
      const cmd = world.cmd();
      cmd.add(ev.e, DirtyTransform);
      world.flush(cmd);
    }
  });
}).stage('preUpdate').build();

/**
 * System that updates WorldTransform components in a top-down manner
 * 自上而下更新WorldTransform组件的系统
 * Only processes branches that contain dirty transforms for efficiency
 * 为了效率只处理包含脏变换的分支
 */
export const TransformUpdateSystem = system('TransformUpdate', (ctx) => {
  const { world } = ctx;

  const cmd = world.cmd();
  const idx = getOrCreateResource(world, ChildrenIndex);

  // Find root entities: those without Parent or with dead Parent
  // 找到根实体：没有Parent或Parent已死的实体
  const roots: Entity[] = [];
  world.query(LocalTransform).forEach((e) => {
    const parent = world.getComponent(e, Parent);
    if (!parent || !world.isAlive(parent.value)) {
      roots.push(e);
    }
  });

  const ensureWorld = (e: Entity): WorldTransform => {
    const t = world.getEntityComponent(e, getComponentType(WorldTransform));
    if (t) return t;
    cmd.add(e, WorldTransform);
    world.flush(cmd);
    return world.getEntityComponent(e, getComponentType(WorldTransform))!;
  };

  const visit = (e: Entity, parentMat: number[] | null, parentDirty: boolean): void => {
    const hasDirty = world.entityHasComponent(e, getComponentType(DirtyTransform));
    const lt = world.getEntityComponent(e, getComponentType(LocalTransform))!;
    const matLocal = fromLocal(lt.x, lt.y, lt.rot, lt.sx, lt.sy);
    const mat = parentMat ? mul(parentMat, matLocal) : matLocal;

    const shouldMarkDirty = parentDirty || hasDirty;

    if (shouldMarkDirty) {
      ensureWorld(e).m = mat;
      world.markChanged(e, WorldTransform);
      if (hasDirty) {
        cmd.remove(e, DirtyTransform);
      }
    }

    // 直接用索引拿孩子（O(#children)）
    const children = idx.childrenOf(e);
    for (let i = 0; i < children.length; i++) {
      visit(children[i], mat, shouldMarkDirty);
    }
  };

  for (const r of roots) {
    visit(r, null, true);
  }
  world.flush(cmd);
}).stage('update').after('HierarchySync').build();

/**
 * Convenience function to set local transform values
 * 设置本地变换值的便利函数
 */
export function setLocalTransform(
  world: any,
  entity: Entity,
  x?: number,
  y?: number,
  rot?: number,
  sx?: number,
  sy?: number
): void {
  const localTransform = world.getComponent(entity, LocalTransform);
  if (localTransform) {
    if (x !== undefined) localTransform.x = x;
    if (y !== undefined) localTransform.y = y;
    if (rot !== undefined) localTransform.rot = rot;
    if (sx !== undefined) localTransform.sx = sx;
    if (sy !== undefined) localTransform.sy = sy;

    // Mark as dirty and changed
    // 标记为脏和已更改
    world.markChanged(entity, LocalTransform);
    const cmd = world.cmd();
    cmd.add(entity, DirtyTransform);
    world.flush(cmd);
  }
}

/**
 * Convenience function to set parent relationship
 * 设置父子关系的便利函数
 */
export function setParent(world: any, child: Entity, parent: Entity | null): void {
  if (parent === null || parent === 0) {
    // Remove parent
    // 移除父级
    if (world.hasComponent(child, Parent)) {
      world.removeComponent(child, Parent);
    }
  } else {
    // Set or change parent
    // 设置或更改父级
    const parentComp = world.getComponent(child, Parent);
    if (parentComp) {
      parentComp.value = parent;
      world.markChanged(child, Parent);
    } else {
      world.addComponent(child, Parent, { value: parent });
    }
  }
}