/**
 * Inspector for capturing World state snapshots (no UI, data only)
 * 用于捕获World状态快照的检查器（无UI，仅数据）
 */

import type { World } from './World';
import { getCtorByTypeId } from './ComponentRegistry';
import { Profiler } from './Profiler';

/**
 * Component information with type and size data
 * 包含类型和大小数据的组件信息
 */
export interface ComponentInfo {
  /** Component type ID 组件类型ID */
  typeId: number;
  /** Component class name 组件类名 */
  name: string;
  /** Number of entities with this component 拥有此组件的实体数量 */
  size: number;
}

/**
 * Complete world state snapshot for debugging and profiling
 * 用于调试和性能分析的完整世界状态快照
 */
export interface InspectorSnapshot {
  /** Current frame number 当前帧号 */
  frame: number;
  /** Number of alive entities 存活实体数量 */
  entitiesAlive: number;
  /** Component usage statistics (sorted by size desc) 组件使用统计（按大小降序） */
  components: ComponentInfo[];
  /** System profiling data 系统性能分析数据 */
  systems: ReturnType<Profiler['getAll']>;
}

/**
 * Capture a complete snapshot of the world state
 * 捕获世界状态的完整快照
 */
export function snapshot(world: World): InspectorSnapshot {
  const prof = world.getResource(Profiler);

  const comps = world.debugListStores()
    .map(s => ({
      typeId: s.typeId,
      name: getCtorByTypeId(s.typeId)?.name ?? `Type#${s.typeId}`,
      size: s.size,
    }))
    .sort((a, b) => b.size - a.size);

  return {
    frame: world.frame,
    entitiesAlive: world.aliveCount(),
    components: comps,
    systems: prof ? prof.getAll() : [],
  };
}

/**
 * Pretty print snapshot data to console
 * 将快照数据美观地打印到控制台
 */
export function printSnapshot(snapshot: InspectorSnapshot): void {
  console.group(`🔍 Inspector Snapshot - Frame ${snapshot.frame}`);

  console.log(`📊 Entities: ${snapshot.entitiesAlive} alive`);

  if (snapshot.components.length > 0) {
    console.group('🧩 Components:');
    snapshot.components.forEach(comp => {
      console.log(`  ${comp.name}: ${comp.size} entities`);
    });
    console.groupEnd();
  }

  if (snapshot.systems.length > 0) {
    console.group('⚙️  Top Systems by Avg Time:');
    snapshot.systems
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 5)
      .forEach(sys => {
        console.log(`  ${sys.name} (${sys.stage}): ${sys.avgMs.toFixed(2)}ms avg, ${sys.calls} calls`);
      });
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Export snapshot data as JSON string
 * 将快照数据导出为JSON字符串
 */
export function exportSnapshot(snapshot: InspectorSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Get component usage summary
 * 获取组件使用摘要
 */
export function getComponentSummary(snapshot: InspectorSnapshot): {
  totalComponents: number;
  totalInstances: number;
  topComponents: ComponentInfo[];
} {
  const totalInstances = snapshot.components.reduce((sum, comp) => sum + comp.size, 0);

  return {
    totalComponents: snapshot.components.length,
    totalInstances,
    topComponents: snapshot.components.slice(0, 10), // Top 10
  };
}

/**
 * Get system performance summary
 * 获取系统性能摘要
 */
export function getSystemSummary(snapshot: InspectorSnapshot): {
  totalSystems: number;
  slowestSystems: ReturnType<Profiler['getAll']>;
  totalCalls: number;
} {
  const totalCalls = snapshot.systems.reduce((sum, sys) => sum + sys.calls, 0);
  const slowestSystems = [...snapshot.systems]
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  return {
    totalSystems: snapshot.systems.length,
    slowestSystems,
    totalCalls,
  };
}