import type { System } from './System';
import { AccessType } from '../utils/AccessType';

/**
 * System dependency graph node
 * 系统依赖图节点
 */
interface SystemNode {
  system: System;
  dependencies: Set<SystemNode>;
  dependents: Set<SystemNode>;
  level: number;
}

/**
 * Parallel execution group
 * 并行执行组
 */
export interface ExecutionGroup {
  systems: System[];
  level: number;
}

/**
 * Parallel scheduler for systems
 * 系统并行调度器
 */
export class ParallelScheduler {
  private systemNodes = new Map<System, SystemNode>();
  private executionGroups: ExecutionGroup[] = [];

  constructor() {
    // Constructor simplified - maxConcurrency can be added later if needed
  }

  /**
   * Add system to scheduler
   * 向调度器添加系统
   */
  addSystem(system: System): void {
    const node: SystemNode = {
      system,
      dependencies: new Set(),
      dependents: new Set(),
      level: 0
    };
    this.systemNodes.set(system, node);
    this.rebuildDependencyGraph();
  }

  /**
   * Remove system from scheduler
   * 从调度器移除系统
   */
  removeSystem(system: System): void {
    const node = this.systemNodes.get(system);
    if (!node) return;

    // Remove dependencies
    for (const dep of node.dependencies) {
      dep.dependents.delete(node);
    }
    
    // Remove dependents
    for (const dependent of node.dependents) {
      dependent.dependencies.delete(node);
    }

    this.systemNodes.delete(system);
    this.rebuildDependencyGraph();
  }

  /**
   * Get execution groups for parallel execution
   * 获取并行执行组
   */
  getExecutionGroups(): ExecutionGroup[] {
    return this.executionGroups;
  }

  /**
   * Rebuild dependency graph based on component access patterns
   * 基于组件访问模式重建依赖图
   */
  private rebuildDependencyGraph(): void {
    // Clear existing dependencies
    for (const node of this.systemNodes.values()) {
      node.dependencies.clear();
      node.dependents.clear();
      node.level = 0;
    }

    // Build dependencies based on component access conflicts
    const systems = Array.from(this.systemNodes.keys());
    
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const system1 = systems[i];
        const system2 = systems[j];
        
        const conflict = this.hasAccessConflict(system1, system2);
        if (conflict) {
          // Higher priority system executes first
          const node1 = this.systemNodes.get(system1);
          const node2 = this.systemNodes.get(system2);
          
          if (!node1 || !node2) continue;
          
          if (system1.priority > system2.priority) {
            node2.dependencies.add(node1);
            node1.dependents.add(node2);
          } else if (system2.priority > system1.priority) {
            node1.dependencies.add(node2);
            node2.dependents.add(node1);
          } else {
            // Same priority, use deterministic ordering
            if (systems.indexOf(system1) < systems.indexOf(system2)) {
              node2.dependencies.add(node1);
              node1.dependents.add(node2);
            } else {
              node1.dependencies.add(node2);
              node2.dependents.add(node1);
            }
          }
        }
      }
    }

    this.calculateLevels();
    this.buildExecutionGroups();
  }

  /**
   * Check if two systems have component access conflicts
   * 检查两个系统是否有组件访问冲突
   */
  private hasAccessConflict(system1: System, system2: System): boolean {
    const access1 = this.getSystemComponentAccess(system1);
    const access2 = this.getSystemComponentAccess(system2);

    for (const [component1, accessType1] of access1) {
      const accessType2 = access2.get(component1);
      if (accessType2 === undefined) continue;

      // Conflict if either system writes to the same component
      if (accessType1 === AccessType.Write || 
          accessType1 === AccessType.ReadWrite ||
          accessType2 === AccessType.Write || 
          accessType2 === AccessType.ReadWrite) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get system component access map
   * 获取系统组件访问映射
   */
  private getSystemComponentAccess(system: System): Map<new (...args: unknown[]) => unknown, AccessType> {
    const accessMap = new Map<new (...args: unknown[]) => unknown, AccessType>();

    // Use explicit component access if defined
    if (system.componentAccess && system.componentAccess.length > 0) {
      for (const access of system.componentAccess) {
        accessMap.set(access.componentType, access.accessType);
      }
    } else {
      // Default behavior: assume write access to required components
      for (const componentType of system.requiredComponents) {
        accessMap.set(componentType, AccessType.ReadWrite);
      }
    }

    return accessMap;
  }

  /**
   * Calculate execution levels using topological sort
   * 使用拓扑排序计算执行层级
   */
  private calculateLevels(): void {
    const visited = new Set<SystemNode>();
    const temp = new Set<SystemNode>();

    const visit = (node: SystemNode): number => {
      if (temp.has(node)) {
        throw new Error('Circular dependency detected in systems');
      }
      if (visited.has(node)) {
        return node.level;
      }

      temp.add(node);
      
      let maxDepLevel = -1;
      for (const dep of node.dependencies) {
        maxDepLevel = Math.max(maxDepLevel, visit(dep));
      }
      
      node.level = maxDepLevel + 1;
      temp.delete(node);
      visited.add(node);
      
      return node.level;
    };

    for (const node of this.systemNodes.values()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }
  }

  /**
   * Build execution groups by level
   * 按层级构建执行组
   */
  private buildExecutionGroups(): void {
    const levelMap = new Map<number, System[]>();

    for (const node of this.systemNodes.values()) {
      if (!levelMap.has(node.level)) {
        levelMap.set(node.level, []);
      }
      const systems = levelMap.get(node.level);
      if (systems) {
        systems.push(node.system);
      }
    }

    this.executionGroups = Array.from(levelMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, systems]) => ({ level, systems }));
  }
}