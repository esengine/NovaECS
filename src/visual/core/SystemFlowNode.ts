/**
 * System flow nodes for automatic visual graph management
 * 自动可视化图管理的系统流程节点
 *
 * These special nodes are automatically created and managed by the VisualGraph
 * to provide consistent entry and exit points for all visual scripts.
 * 这些特殊节点由VisualGraph自动创建和管理，为所有可视化脚本提供一致的入口和出口点。
 */

import { BaseVisualNode } from './BaseVisualNode';
import type { VisualExecutionContext, NodeExecutionResult } from '../types';

/**
 * System node type definitions
 * 系统节点类型定义
 */
export type SystemNodeType = 'system.start' | 'system.end';

/**
 * System flow node that cannot be deleted by users
 * 用户无法删除的系统流程节点
 */
export class SystemFlowNode extends BaseVisualNode {
  /** Whether this is a system-managed node 是否为系统管理的节点 */
  public readonly isSystemNode = true;

  /** System node type 系统节点类型 */
  public readonly systemType: SystemNodeType;

  constructor(id: string, systemType: SystemNodeType) {
    // Initialize with appropriate type name
    const nodeType = systemType === 'system.start' ? 'flow.start' : 'flow.end';
    super(id, nodeType);

    this.systemType = systemType;

    // Configure inputs and outputs based on system type
    this.setupSystemNode();
  }

  /**
   * Setup system node inputs and outputs
   * 设置系统节点的输入和输出
   */
  private setupSystemNode(): void {
    if (this.systemType === 'system.start') {
      // Start node has no inputs, one execution output
      // 开始节点没有输入，只有一个执行输出
      this.outputs.set('Execute', undefined);
    } else {
      // End node has one execution input, no outputs
      // 结束节点有一个执行输入，没有输出
      this.inputs.set('Execute', undefined);
    }
  }

  /**
   * Execute system flow node
   * 执行系统流程节点
   *
   * @param _context Execution context 执行上下文
   * @returns Execution result 执行结果
   */
  async execute(_context: VisualExecutionContext): Promise<NodeExecutionResult> {
    if (this.systemType === 'system.start') {
      // Start node just initiates execution flow
      // 开始节点只是启动执行流程
      return {
        success: true,
        outputs: new Map([['Execute', true]]),
        executionTime: 0
      };
    } else {
      // End node marks completion of execution
      // 结束节点标记执行完成
      return {
        success: true,
        outputs: new Map(),
        executionTime: 0
      };
    }
  }

  /**
   * System nodes should always execute
   * 系统节点应该始终执行
   */
  shouldExecute(): boolean {
    return true;
  }

  /**
   * Prevent deletion of system nodes
   * 防止删除系统节点
   */
  canDelete(): boolean {
    return false;
  }

  /**
   * Get system node display name
   * 获取系统节点显示名称
   */
  getDisplayName(): string {
    if (this.systemType === 'system.start') {
      return 'System Start';
    } else {
      return 'System End';
    }
  }

  /**
   * Get system node description
   * 获取系统节点描述
   */
  getDescription(): string {
    if (this.systemType === 'system.start') {
      return 'System execution entry point - automatically created';
    } else {
      return 'System execution exit point - automatically created';
    }
  }
}

/**
 * System node ID constants
 * 系统节点ID常量
 */
export const SYSTEM_NODE_IDS = {
  START: '__system_start__',
  END: '__system_end__'
} as const;

/**
 * Create system start node
 * 创建系统开始节点
 */
export function createSystemStartNode(): SystemFlowNode {
  const startNode = new SystemFlowNode(SYSTEM_NODE_IDS.START, 'system.start');

  // Set position for start node - left side
  // 设置开始节点位置 - 左侧
  startNode.position = { x: 50, y: 200 };

  // Set visual properties for start node - green color
  // 设置开始节点视觉属性 - 绿色
  if (!startNode.metadata) {
    startNode.metadata = {};
  }
  startNode.metadata.style = {
    backgroundColor: '#10B981', // Green color 绿色
    borderColor: '#059669',
    textColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 8,
    ...startNode.metadata.style
  };

  return startNode;
}

/**
 * Create system end node
 * 创建系统结束节点
 */
export function createSystemEndNode(): SystemFlowNode {
  const endNode = new SystemFlowNode(SYSTEM_NODE_IDS.END, 'system.end');

  // Set position for end node - right side
  // 设置结束节点位置 - 右侧
  endNode.position = { x: 600, y: 200 };

  // Set visual properties for end node - red color
  // 设置结束节点视觉属性 - 红色
  if (!endNode.metadata) {
    endNode.metadata = {};
  }
  endNode.metadata.style = {
    backgroundColor: '#EF4444', // Red color 红色
    borderColor: '#DC2626',
    textColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 8,
    ...endNode.metadata.style
  };

  return endNode;
}