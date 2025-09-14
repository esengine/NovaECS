/**
 * System scheduler with stage management and dependency resolution
 * 具有阶段管理和依赖解析的系统调度器
 *
 * Key points:
 * - Supports stages: startup (runs once), preUpdate, update, postUpdate, cleanup
 * - before/after dependencies (target can be system name or set name)
 * - Topological sorting (cycle detection)
 * - Command buffer flush strategy: afterEach (default) or afterStage
 * - tick(world, dt) automatically runs startup on first frame
 *
 * 要点：
 * - 支持阶段：startup（只跑一次）、preUpdate、update、postUpdate、cleanup
 * - before/after依赖（目标可以是系统名或集合名）
 * - 拓扑排序（检测环路）
 * - 命令缓冲flush策略：afterEach（默认）或afterStage
 * - tick(world, dt)会自动在第一帧跑startup
 */

import type { World } from './World';
import { CommandBuffer } from './CommandBuffer';
import type { SystemStage, SystemConfig, SystemContext } from './System';
import { system, SystemBuilder } from './System';
import { Profiler } from './Profiler';

const DEFAULT_ORDER: SystemStage[] = ['startup', 'preUpdate', 'update', 'postUpdate', 'cleanup'];

type NodeId = string;
const SET_PREFIX = 'set:';

/**
 * Dependency graph node for topological sorting
 * 用于拓扑排序的依赖图节点
 */
interface Node {
  /** Node identifier 节点标识符 */
  id: NodeId;
  /** Whether this is a virtual set node 是否为虚拟集合节点 */
  isSet: boolean;
  /** System config (only for system nodes) 系统配置（仅系统节点） */
  sys?: SystemConfig;
  /** Incoming dependency edges 入边依赖 */
  inEdges: Set<NodeId>;
  /** Outgoing dependency edges 出边依赖 */
  outEdges: Set<NodeId>;
}

export class Scheduler {
  /** Systems grouped by execution stage 按执行阶段分组的系统 */
  private stages: Record<SystemStage, SystemConfig[]> = {
    startup: [],
    preUpdate: [],
    update: [],
    postUpdate: [],
    cleanup: [],
  };
  /** Cached topologically sorted system order 缓存的拓扑排序结果 */
  private builtOrder: Record<SystemStage, SystemConfig[]> | null = null;
  /** Whether startup stage has been executed 是否已执行startup阶段 */
  private ranStartup = false;

  /**
   * Add system or system builder to scheduler
   * 添加系统或系统构建器到调度器
   */
  add(sysOrBuilder: SystemConfig | SystemBuilder): this {
    const sys = sysOrBuilder instanceof SystemBuilder ? sysOrBuilder.build() : sysOrBuilder;
    const stage = sys.stage ?? 'update';
    this.stages[stage].push(sys);
    this.builtOrder = null;
    return this;
  }

  /**
   * Execute one tick of all systems
   * 执行一次所有系统的tick
   */
  tick(world: World, dt: number, order: SystemStage[] = DEFAULT_ORDER): void {
    world.beginFrame();

    const plan = this.ensureBuilt(order);

    for (const stage of order) {
      if (stage === 'startup') {
        if (this.ranStartup) continue;
        this.ranStartup = true;
      }
      const systems = plan[stage];
      if (!systems || systems.length === 0) continue;

      let stageCmds: CommandBuffer[] | null = null;
      for (const sys of systems) {
        if (sys.stage === 'startup' && this.ranStartup !== true) {
          continue;
        }
        if (sys.runIf && !safeRunIf(sys.runIf, world)) continue;

        const cmd = new CommandBuffer(world);
        const ctx: SystemContext = {
          world,
          commandBuffer: cmd,
          frame: world.frame,
          deltaTime: dt
        };

        // Profile system execution if profiler is available
        const prof = world.getResource(Profiler);
        const t0 = performance.now();
        sys.fn(ctx);
        const t1 = performance.now();

        if (prof) {
          prof.record(sys.name, sys.stage ?? 'update', t1 - t0);
        }

        if (sys.flushPolicy === 'afterEach' || sys.flushPolicy == null) {
          cmd.flush();
        } else {
          stageCmds ??= [];
          stageCmds.push(cmd);
        }
      }

      if (stageCmds && stageCmds.length > 0) {
        for (const cmd of stageCmds) {
          cmd.flush();
        }
      }
    }
  }

  /**
   * Build topological order for all stages
   * 为所有阶段构建拓扑顺序
   */
  private ensureBuilt(order: SystemStage[]): Record<SystemStage, SystemConfig[]> {
    if (this.builtOrder) return this.builtOrder;

    const out: Record<SystemStage, SystemConfig[]> = {
      startup: [],
      preUpdate: [],
      update: [],
      postUpdate: [],
      cleanup: [],
    };

    for (const stage of order) {
      const sysList = this.stages[stage];
      if (sysList.length === 0) continue;

      const nodes = new Map<NodeId, Node>();
      /** Get or create dependency graph node 获取或创建依赖图节点 */
      const getNode = (id: NodeId, isSet = false): Node => {
        let n = nodes.get(id);
        if (!n) {
          n = { id, isSet, inEdges: new Set(), outEdges: new Set() };
          nodes.set(id, n);
        }
        return n;
      };

      for (const s of sysList) {
        const sid = s.name;
        const sn = getNode(sid, false);
        sn.sys = s;

        for (const set of (s.sets ?? [])) {
          getNode(SET_PREFIX + set, true);
        }
      }

      /** Create dependency edge between nodes 在节点间创建依赖边 */
      const link = (from: NodeId, to: NodeId): void => {
        if (from === to) return;
        const a = getNode(from);
        const b = getNode(to);
        a.outEdges.add(to);
        b.inEdges.add(from);
      };

      for (const s of sysList) {
        const sid = s.name;

        for (const set of (s.sets ?? [])) {
          const setId = SET_PREFIX + set;
          link(setId, sid);
        }

        for (const b of s.before) {
          const target = this.resolveTargetId(b);
          link(sid, target);
        }
        for (const a of s.after) {
          const target = this.resolveTargetId(a);
          link(target, sid);
        }
      }

      const orderList: Node[] = [];
      const q: Node[] = [];
      for (const n of nodes.values()) {
        if (n.inEdges.size === 0) q.push(n);
      }

      while (q.length) {
        const n = q.shift();
        if (!n) break;
        orderList.push(n);
        for (const to of n.outEdges) {
          const t = nodes.get(to);
          if (!t) continue;
          t.inEdges.delete(n.id);
          if (t.inEdges.size === 0) q.push(t);
        }
      }

      const remains = [...nodes.values()].filter(n => n.inEdges.size > 0);
      if (remains.length > 0) {
        const cycleNames = remains.map(n => n.id).join(', ');
        throw new Error(`[Scheduler] 拓扑存在环：${cycleNames}`);
      }

      out[stage] = orderList.filter(n => !n.isSet && n.sys).map(n => n.sys) as SystemConfig[];
    }

    this.builtOrder = out;
    return out;
  }

  /**
   * Resolve dependency target to node ID
   * 解析依赖目标为节点ID
   */
  private resolveTargetId(nameOrSet: string): NodeId {
    return nameOrSet.startsWith('set:') ? nameOrSet : nameOrSet;
  }
}

/**
 * Safely execute system condition predicate
 * 安全执行系统条件谓词
 */
function safeRunIf(pred: (world: World) => boolean, world: World): boolean {
  try {
    return pred(world);
  } catch {
    return false;
  }
}

export { system, SystemBuilder };