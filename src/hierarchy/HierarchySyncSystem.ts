/**
 * Hierarchy synchronization system
 * 层级同步系统
 */

import { system } from "../core/System";
import { ChildrenIndex } from "./ChildrenIndex";
import { HierarchyPolicy } from "./HierarchyPolicy";
import { getCtorByTypeId } from "../core/ComponentRegistry";
import { getOrCreateResource } from "../utils/ResourceHelpers";
import type { Entity } from "../utils/Types";

// Parent component from Transform
import { Parent } from "../components/Transform";

/**
 * System that synchronizes ChildrenIndex with Parent component changes
 * 与Parent组件变化同步ChildrenIndex的系统
 */
export const HierarchySyncSystem = system('HierarchySync', (ctx) => {
  const { world } = ctx;

  // 资源准备
  const idx = getOrCreateResource(world, ChildrenIndex);
  const policy = getOrCreateResource(world, HierarchyPolicy);

  const added = world.getAddedChannel();
  const removed = world.getRemovedChannel();

  // 先处理 Removed(Parent) —— 从旧父解绑
  removed.drain(ev => {
    const Ctor = getCtorByTypeId(ev.typeId);
    if (Ctor !== Parent) return;
    const old = ev.old as Parent | undefined;
    if (!old) return;
    idx.link(ev.e, 0);
  });

  // 再处理 Added(Parent) —— 绑定新父（带防循环、无效父校验）
  added.drain(ev => {
    const Ctor = getCtorByTypeId(ev.typeId);
    if (Ctor !== Parent) return;
    const p = (ev.value as Parent).value;

    // 边界情况1：自指 - 实体不能成为自己的父级
    if (p === ev.e) {
      console.warn(`[HierarchySync] Entity ${ev.e} attempted to parent itself, setting to root`);
      const cmd = world.cmd();
      cmd.add(ev.e, Parent, { value: 0 });
      world.flush(cmd);
      idx.link(ev.e, 0);
      return;
    }

    // 边界情况2：无父或父死亡 → 绑定到根(0)
    if (!p || p === 0 || !world.isAlive(p)) {
      if (p && p !== 0 && !world.isAlive(p)) {
        console.warn(`[HierarchySync] Entity ${ev.e} parent ${p} is not alive, setting to root`);
      }
      idx.link(ev.e, 0);
      return;
    }

    // 边界情况：跨World检测（未来扩展）
    // TODO: 如果支持多World，在此处添加parent属于同一World的断言
    // if (parent.worldId !== ev.e.worldId) throw new Error('Cross-world parenting not supported');

    // 边界情况3：防循环
    if (idx.wouldCreateCycle(ev.e, p)) {
      console.warn(`[HierarchySync] Entity ${ev.e} parent ${p} would create cycle, setting to root`);
      const cmd = world.cmd();
      cmd.add(ev.e, Parent, { value: 0 });
      world.flush(cmd);
      idx.link(ev.e, 0);
      return;
    }

    // 正常情况：建立父子关系
    idx.link(ev.e, p);
  });

  // 快速处理"父被销毁"的情况：
  // 由于 destroyEntity(parent) 会发出 Removed(Parent of parent) 等，对孩子的 Parent 不会自动改，
  // 所以我们监听 "本帧死亡的父节点"：遍历 idx 的 children 即可 O(#children) 处理。
  // 这里选择在每帧做一次轻量同步：如果父不活跃则按照策略处理其直接孩子。
  // （也可以把父死亡事件单独发出来，这里选保守实现）
  const toDetach: Array<{ child: Entity }> = [];
  const toDestroy: Entity[] = [];

  // 扫描所有索引的 key（父），找出已死亡的父节点
  // 注意：Map 迭代量为"有孩子的父"的数量，通常远小于实体总数
  for (const parent of idx.getAllParents()) {
    if (!world.isAlive(parent)) {
      const children = idx.childrenOf(parent);
      if (policy.onParentDestroyed === 'detachToRoot') {
        for (const c of children) toDetach.push({ child: c });
      } else {
        for (const c of children) toDestroy.push(c);
      }
    }
  }

  if (toDetach.length || toDestroy.length) {
    const cmd = world.cmd();
    for (const { child } of toDetach) {
      cmd.add(child, Parent, { value: 0 });
      idx.link(child, 0); // 立即更新索引
    }
    for (const c of toDestroy) cmd.destroy(c);
    world.flush(cmd);
  }
}).stage('preUpdate').build();