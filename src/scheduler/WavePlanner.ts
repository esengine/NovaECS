/**
 * Wave planner for system-level parallel execution with conflict detection
 * 系统级并行执行的波次规划器，支持冲突检测
 */

import { SystemMeta, SystemHandle, TypeId, ResourceId, AccessMode, ComponentAccess } from './SystemMeta';

/**
 * Conflict type enumeration
 * 冲突类型枚举
 */
export enum ConflictType {
  /** Write-Write conflict on same component 相同组件的写-写冲突 */
  WriteWrite = 'write-write',
  /** Write-Read conflict on same component 相同组件的写-读冲突 */
  WriteRead = 'write-read',
  /** Exclusive resource conflict 独占资源冲突 */
  ExclusiveResource = 'exclusive-resource',
  /** Explicit dependency 显式依赖 */
  ExplicitDependency = 'explicit-dependency'
}

/**
 * Conflict descriptor
 * 冲突描述符
 */
export interface SystemConflict {
  /** Type of conflict 冲突类型 */
  type: ConflictType;
  /** First system involved in conflict 冲突中涉及的第一个系统 */
  systemA: SystemHandle;
  /** Second system involved in conflict 冲突中涉及的第二个系统 */
  systemB: SystemHandle;
  /** Component or resource causing conflict 导致冲突的组件或资源 */
  target: TypeId | ResourceId;
  /** Additional description 附加描述 */
  description?: string;
}

/**
 * Execution wave containing non-conflicting systems
 * 包含无冲突系统的执行波次
 */
export interface ExecutionWave {
  /** Wave number (0-based) 波次编号（从0开始） */
  wave: number;
  /** Systems in this wave 此波次中的系统 */
  systems: SystemHandle[];
  /** Estimated parallel execution time 预估并行执行时间 */
  estimatedTime?: number;
  /** Dependencies satisfied by previous waves 被前面波次满足的依赖 */
  satisfiedDependencies: SystemHandle[];
}

/**
 * Wave planning result
 * 波次规划结果
 */
export interface WavePlan {
  /** Execution waves in order 按顺序的执行波次 */
  waves: ExecutionWave[];
  /** Total estimated execution time 总预估执行时间 */
  totalEstimatedTime: number;
  /** Systems that could not be scheduled 无法调度的系统 */
  unscheduled: SystemHandle[];
  /** Detected conflicts 检测到的冲突 */
  conflicts: SystemConflict[];
  /** Parallelization efficiency (0-1) 并行化效率（0-1） */
  efficiency: number;
}

/**
 * Wave planner with conflict detection and topological sorting
 * 带冲突检测和拓扑排序的波次规划器
 */
export class WavePlanner {
  private systems = new Map<SystemHandle, SystemMeta>();

  /**
   * Add system metadata for planning
   * 添加系统元数据用于规划
   */
  addSystem(meta: SystemMeta): void {
    this.systems.set(meta.handle, meta);
  }

  /**
   * Remove system from planning
   * 从规划中移除系统
   */
  removeSystem(handle: SystemHandle): boolean {
    return this.systems.delete(handle);
  }

  /**
   * Clear all systems
   * 清除所有系统
   */
  clear(): void {
    this.systems.clear();
  }

  /**
   * Plan execution waves for all registered systems
   * 为所有已注册系统规划执行波次
   */
  planWaves(): WavePlan {
    const allSystems = Array.from(this.systems.values());
    const conflicts = this.detectAllConflicts(allSystems);

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(allSystems, conflicts);

    // Perform topological sorting with wave assignment
    const waves = this.assignSystemsToWaves(allSystems, dependencyGraph);

    // Calculate timing and efficiency
    const totalEstimatedTime = this.calculateTotalTime(waves);
    const efficiency = this.calculateEfficiency(allSystems, waves);

    // Find unscheduled systems
    const scheduledSystems = new Set<SystemHandle>();
    for (const wave of waves) {
      for (const system of wave.systems) {
        scheduledSystems.add(system);
      }
    }

    const unscheduled = allSystems
      .map(meta => meta.handle)
      .filter(handle => !scheduledSystems.has(handle));

    return {
      waves,
      totalEstimatedTime,
      unscheduled,
      conflicts,
      efficiency
    };
  }

  /**
   * Detect all conflicts between systems
   * 检测系统间的所有冲突
   */
  private detectAllConflicts(systems: SystemMeta[]): SystemConflict[] {
    const conflicts: SystemConflict[] = [];

    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const systemA = systems[i];
        const systemB = systems[j];

        conflicts.push(...this.detectConflictsBetweenSystems(systemA, systemB));
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts between two systems
   * 检测两个系统间的冲突
   */
  private detectConflictsBetweenSystems(systemA: SystemMeta, systemB: SystemMeta): SystemConflict[] {
    const conflicts: SystemConflict[] = [];

    // Check explicit dependencies
    if (systemA.dependencies.includes(systemB.handle) || systemB.dependencies.includes(systemA.handle)) {
      conflicts.push({
        type: ConflictType.ExplicitDependency,
        systemA: systemA.handle,
        systemB: systemB.handle,
        target: systemA.dependencies.includes(systemB.handle) ? systemB.handle : systemA.handle,
        description: `Explicit dependency between systems`
      });
    }

    // Check component conflicts
    conflicts.push(...this.detectComponentConflicts(systemA, systemB));

    // Check resource conflicts
    conflicts.push(...this.detectResourceConflicts(systemA, systemB));

    return conflicts;
  }

  /**
   * Detect component access conflicts
   * 检测组件访问冲突
   */
  private detectComponentConflicts(systemA: SystemMeta, systemB: SystemMeta): SystemConflict[] {
    const conflicts: SystemConflict[] = [];

    for (const compA of systemA.components) {
      for (const compB of systemB.components) {
        if (compA.typeId === compB.typeId) {
          const conflict = this.analyzeComponentAccessConflict(systemA, systemB, compA, compB);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyze component access conflict between two systems
   * 分析两个系统间的组件访问冲突
   */
  private analyzeComponentAccessConflict(
    systemA: SystemMeta,
    systemB: SystemMeta,
    accessA: ComponentAccess,
    accessB: ComponentAccess
  ): SystemConflict | null {
    const hasWriteA = accessA.mode === AccessMode.Write || accessA.mode === AccessMode.ReadWrite;
    const hasWriteB = accessB.mode === AccessMode.Write || accessB.mode === AccessMode.ReadWrite;

    if (hasWriteA && hasWriteB) {
      return {
        type: ConflictType.WriteWrite,
        systemA: systemA.handle,
        systemB: systemB.handle,
        target: accessA.typeId,
        description: `Both systems write to component ${String(accessA.typeId)}`
      };
    }

    if (hasWriteA || hasWriteB) {
      return {
        type: ConflictType.WriteRead,
        systemA: systemA.handle,
        systemB: systemB.handle,
        target: accessA.typeId,
        description: `Write-read conflict on component ${String(accessA.typeId)}`
      };
    }

    return null;
  }

  /**
   * Detect resource access conflicts
   * 检测资源访问冲突
   */
  private detectResourceConflicts(systemA: SystemMeta, systemB: SystemMeta): SystemConflict[] {
    const conflicts: SystemConflict[] = [];

    for (const resA of systemA.resources) {
      for (const resB of systemB.resources) {
        if (resA.resourceId === resB.resourceId && (resA.exclusive || resB.exclusive)) {
          conflicts.push({
            type: ConflictType.ExclusiveResource,
            systemA: systemA.handle,
            systemB: systemB.handle,
            target: resA.resourceId,
            description: `Exclusive resource conflict: ${String(resA.resourceId)}`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Build dependency graph from systems and conflicts
   * 从系统和冲突构建依赖图
   */
  private buildDependencyGraph(systems: SystemMeta[], conflicts: SystemConflict[]): Map<SystemHandle, Set<SystemHandle>> {
    const graph = new Map<SystemHandle, Set<SystemHandle>>();

    // Initialize graph
    for (const system of systems) {
      graph.set(system.handle, new Set());
    }

    // Add explicit dependencies
    for (const system of systems) {
      const deps = graph.get(system.handle);
      if (!deps) throw new Error(`No dependency set found for system ${String(system.handle)}`);
      for (const dep of system.dependencies) {
        deps.add(dep);
      }
    }

    // Add conflict-based dependencies (convert conflicts to ordering constraints)
    for (const conflict of conflicts) {
      if (conflict.type === ConflictType.ExplicitDependency) {
        continue; // Already handled above
      }

      // For conflicts, we need to impose ordering - use priority or handle comparison
      const systemA = this.systems.get(conflict.systemA);
      const systemB = this.systems.get(conflict.systemB);
      if (!systemA) throw new Error(`System ${String(conflict.systemA)} not found`);
      if (!systemB) throw new Error(`System ${String(conflict.systemB)} not found`);

      if (this.shouldRunFirst(systemA, systemB)) {
        const depsB = graph.get(conflict.systemB);
        if (!depsB) throw new Error(`No dependency set found for system ${String(conflict.systemB)}`);
        depsB.add(conflict.systemA);
      } else {
        const depsA = graph.get(conflict.systemA);
        if (!depsA) throw new Error(`No dependency set found for system ${String(conflict.systemA)}`);
        depsA.add(conflict.systemB);
      }
    }

    return graph;
  }

  /**
   * Determine which system should run first in case of conflict
   * 在冲突情况下确定哪个系统应该先运行
   */
  private shouldRunFirst(systemA: SystemMeta, systemB: SystemMeta): boolean {
    // Priority-based ordering (higher priority first)
    if (systemA.priority !== undefined && systemB.priority !== undefined) {
      if (systemA.priority !== systemB.priority) {
        return systemA.priority > systemB.priority;
      }
    } else if (systemA.priority !== undefined) {
      return true;
    } else if (systemB.priority !== undefined) {
      return false;
    }

    // Deterministic ordering based on handle string representation
    return String(systemA.handle) < String(systemB.handle);
  }

  /**
   * Assign systems to execution waves using topological sorting
   * 使用拓扑排序将系统分配到执行波次
   */
  private assignSystemsToWaves(
    systems: SystemMeta[],
    dependencyGraph: Map<SystemHandle, Set<SystemHandle>>
  ): ExecutionWave[] {
    const waves: ExecutionWave[] = [];
    const remaining = new Set(systems.map(s => s.handle));
    const inDegree = new Map<SystemHandle, number>();

    // Calculate in-degrees
    for (const handle of remaining) {
      inDegree.set(handle, 0);
    }

    for (const [system, deps] of dependencyGraph) {
      for (const dep of deps) {
        if (remaining.has(dep)) {
          inDegree.set(system, (inDegree.get(system) || 0) + 1);
        }
      }
    }

    let waveNumber = 0;
    const satisfiedDependencies: SystemHandle[] = [];

    while (remaining.size > 0) {
      // Find systems with no dependencies
      const readySystems: SystemHandle[] = [];
      for (const handle of remaining) {
        if ((inDegree.get(handle) || 0) === 0) {
          readySystems.push(handle);
        }
      }

      if (readySystems.length === 0) {
        // Circular dependency detected - break it by selecting highest priority system
        const remainingSystems = Array.from(remaining).map(h => {
          const system = this.systems.get(h);
          if (!system) throw new Error(`System ${String(h)} not found`);
          return system;
        });
        remainingSystems.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        readySystems.push(remainingSystems[0].handle);
      }

      // Create wave
      const estimatedTime = this.calculateWaveTime(readySystems);
      const wave: ExecutionWave = {
        wave: waveNumber++,
        systems: readySystems,
        estimatedTime,
        satisfiedDependencies: [...satisfiedDependencies]
      };
      waves.push(wave);

      // Remove processed systems and update in-degrees
      for (const handle of readySystems) {
        remaining.delete(handle);
        satisfiedDependencies.push(handle);

        // Update in-degrees for dependent systems
        for (const [system, deps] of dependencyGraph) {
          if (deps.has(handle)) {
            inDegree.set(system, (inDegree.get(system) || 0) - 1);
          }
        }
      }
    }

    return waves;
  }

  /**
   * Calculate estimated execution time for a wave
   * 计算波次的预估执行时间
   */
  private calculateWaveTime(systemHandles: SystemHandle[]): number {
    let maxTime = 0;
    for (const handle of systemHandles) {
      const system = this.systems.get(handle);
      if (system?.estimatedTime) {
        maxTime = Math.max(maxTime, system.estimatedTime);
      }
    }
    return maxTime;
  }

  /**
   * Calculate total execution time across all waves
   * 计算所有波次的总执行时间
   */
  private calculateTotalTime(waves: ExecutionWave[]): number {
    return waves.reduce((total, wave) => total + (wave.estimatedTime || 0), 0);
  }

  /**
   * Calculate parallelization efficiency
   * 计算并行化效率
   */
  private calculateEfficiency(systems: SystemMeta[], waves: ExecutionWave[]): number {
    const totalSequentialTime = systems.reduce((sum, system) => sum + (system.estimatedTime || 0), 0);
    const totalParallelTime = this.calculateTotalTime(waves);

    if (totalSequentialTime === 0 || totalParallelTime === 0) {
      return 0;
    }

    return Math.min(1, totalSequentialTime / totalParallelTime);
  }

  /**
   * Get systems that are ready to run (no unfulfilled dependencies)
   * 获取准备运行的系统（无未满足的依赖）
   */
  getReadySystems(completedSystems: Set<SystemHandle>): SystemHandle[] {
    const ready: SystemHandle[] = [];

    for (const [handle, meta] of this.systems) {
      if (completedSystems.has(handle)) {
        continue; // Already completed
      }

      const allDependenciesSatisfied = meta.dependencies.every(dep =>
        completedSystems.has(dep)
      );

      if (allDependenciesSatisfied) {
        ready.push(handle);
      }
    }

    return ready;
  }

  /**
   * Validate wave plan for correctness
   * 验证波次规划的正确性
   */
  validateWavePlan(plan: WavePlan): boolean {
    const allScheduled = new Set<SystemHandle>();
    const completedInPreviousWaves = new Set<SystemHandle>();

    for (const wave of plan.waves) {
      // Check for duplicates within wave
      const waveSet = new Set(wave.systems);
      if (waveSet.size !== wave.systems.length) {
        console.error('Duplicate systems found in wave', wave.wave);
        return false;
      }

      // Check for systems already scheduled
      for (const systemHandle of wave.systems) {
        if (allScheduled.has(systemHandle)) {
          console.error(`System ${String(systemHandle)} scheduled in multiple waves`);
          return false;
        }
        allScheduled.add(systemHandle);
      }

      // Check dependencies are satisfied
      for (const systemHandle of wave.systems) {
        const system = this.systems.get(systemHandle);
        if (!system) continue;

        for (const dep of system.dependencies) {
          if (!completedInPreviousWaves.has(dep)) {
            console.error(`System ${String(systemHandle)} depends on ${String(dep)} which hasn't completed`);
            return false;
          }
        }
      }

      // Add completed systems
      for (const systemHandle of wave.systems) {
        completedInPreviousWaves.add(systemHandle);
      }
    }

    return true;
  }
}