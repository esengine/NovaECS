/**
 * Visual graph implementation
 * 可视化图实现
 *
 * Manages nodes and connections in a visual programming graph.
 * Provides execution planning, topological sorting, and graph validation.
 * 管理可视化编程图中的节点和连接。
 * 提供执行计划、拓扑排序和图验证。
 */

import type {
  VisualNode,
  Connection,
  VisualGraphData,
  VisualExecutionContext,
  NodeExecutionResult
} from '../types';
import { BaseVisualNode } from './BaseVisualNode';
import { NodeGenerator } from './NodeGenerator';

/**
 * Visual programming graph
 * 可视化编程图
 */
export class VisualGraph {
  /** Graph name 图名称 */
  public readonly name: string;

  /** Graph description 图描述 */
  public description?: string;

  /** Nodes in the graph 图中的节点 */
  private nodes = new Map<string, VisualNode>();

  /** Connections between nodes 节点间的连接 */
  private connections = new Map<string, Connection>();

  /** Cached execution order 缓存的执行顺序 */
  private executionOrder: VisualNode[] | null = null;

  /** Graph metadata 图元数据 */
  private metadata = {
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    version: '1.0.0'
  };

  constructor(name: string, description?: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Add node to the graph
   * 向图中添加节点
   *
   * @param node Node to add 要添加的节点
   */
  addNode(node: VisualNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with ID '${node.id}' already exists in graph`);
    }

    this.nodes.set(node.id, node);
    this.invalidateExecutionOrder();
    this.updateModified();
  }

  /**
   * Remove node from the graph
   * 从图中移除节点
   *
   * @param nodeId Node ID to remove 要移除的节点ID
   */
  removeNode(nodeId: string): void {
    // Remove all connections involving this node
    // 移除涉及此节点的所有连接
    const connectionsToRemove = Array.from(this.connections.values())
      .filter(conn => conn.fromNodeId === nodeId || conn.toNodeId === nodeId);

    for (const connection of connectionsToRemove) {
      this.removeConnection(connection.id);
    }

    // Remove the node
    // 移除节点
    this.nodes.delete(nodeId);
    this.invalidateExecutionOrder();
    this.updateModified();
  }

  /**
   * Get node by ID
   * 按ID获取节点
   *
   * @param nodeId Node ID 节点ID
   * @returns Node or undefined 节点或undefined
   */
  getNode(nodeId: string): VisualNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes in the graph
   * 获取图中的所有节点
   *
   * @returns Array of nodes 节点数组
   */
  getAllNodes(): VisualNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Add connection between nodes
   * 在节点间添加连接
   *
   * @param connection Connection to add 要添加的连接
   */
  addConnection(connection: Connection): void {
    // Validate connection
    // 验证连接
    const validation = this.validateConnection(connection);
    if (!validation.valid) {
      throw new Error(`Invalid connection: ${validation.error}`);
    }

    this.connections.set(connection.id, connection);

    // Update target node input
    // 更新目标节点输入
    const targetNode = this.getNode(connection.toNodeId);
    const sourceNode = this.getNode(connection.fromNodeId);

    if (targetNode && sourceNode) {
      const outputValue = sourceNode.getOutput(connection.fromPin);
      targetNode.setInput(connection.toPin, outputValue);
    }

    this.invalidateExecutionOrder();
    this.updateModified();
  }

  /**
   * Remove connection from the graph
   * 从图中移除连接
   *
   * @param connectionId Connection ID 连接ID
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Clear target node input
      // 清除目标节点输入
      const targetNode = this.getNode(connection.toNodeId);
      if (targetNode) {
        targetNode.setInput(connection.toPin, undefined);
      }

      this.connections.delete(connectionId);
      this.invalidateExecutionOrder();
      this.updateModified();
    }
  }

  /**
   * Get connection by ID
   * 按ID获取连接
   *
   * @param connectionId Connection ID 连接ID
   * @returns Connection or undefined 连接或undefined
   */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections in the graph
   * 获取图中的所有连接
   *
   * @returns Array of connections 连接数组
   */
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Validate a connection between nodes
   * 验证节点间的连接
   *
   * @param connection Connection to validate 要验证的连接
   * @returns Validation result 验证结果
   */
  validateConnection(connection: Connection): { valid: boolean; error?: string } {
    const sourceNode = this.getNode(connection.fromNodeId);
    const targetNode = this.getNode(connection.toNodeId);

    if (!sourceNode) {
      return { valid: false, error: `Source node '${connection.fromNodeId}' not found` };
    }

    if (!targetNode) {
      return { valid: false, error: `Target node '${connection.toNodeId}' not found` };
    }

    // Check for cycles
    // 检查循环
    if (this.wouldCreateCycle(connection)) {
      return { valid: false, error: 'Connection would create a cycle' };
    }

    // Check if target input is already connected
    // 检查目标输入是否已连接
    const existingConnection = this.findConnectionToInput(connection.toNodeId, connection.toPin);
    if (existingConnection && existingConnection.id !== connection.id) {
      return { valid: false, error: 'Target input is already connected' };
    }

    return { valid: true };
  }

  /**
   * Check if connection would create a cycle
   * 检查连接是否会创建循环
   *
   * @param connection Connection to check 要检查的连接
   * @returns True if would create cycle 如果会创建循环则返回true
   */
  private wouldCreateCycle(connection: Connection): boolean {
    // Temporarily add connection to check for cycles
    // 临时添加连接以检查循环
    const tempConnections = new Map(this.connections);
    tempConnections.set(connection.id, connection);

    return this.hasCycle(tempConnections);
  }

  /**
   * Check if graph has cycles
   * 检查图是否有循环
   *
   * @param connections Connections to check 要检查的连接
   * @returns True if has cycle 如果有循环则返回true
   */
  private hasCycle(connections: Map<string, Connection>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      if (this.hasCycleDFS(nodeId, connections, visited, recursionStack)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Depth-first search for cycle detection
   * 用于循环检测的深度优先搜索
   */
  private hasCycleDFS(
    nodeId: string,
    connections: Map<string, Connection>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Get all outgoing connections from this node
    // 获取此节点的所有出边连接
    const outgoingConnections = Array.from(connections.values())
      .filter(conn => conn.fromNodeId === nodeId);

    for (const connection of outgoingConnections) {
      const targetNodeId = connection.toNodeId;

      if (!visited.has(targetNodeId)) {
        if (this.hasCycleDFS(targetNodeId, connections, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(targetNodeId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Find connection to specific input
   * 查找到特定输入的连接
   */
  private findConnectionToInput(nodeId: string, pinName: string): Connection | undefined {
    return Array.from(this.connections.values())
      .find(conn => conn.toNodeId === nodeId && conn.toPin === pinName);
  }

  /**
   * Get execution order using topological sort
   * 使用拓扑排序获取执行顺序
   *
   * @returns Ordered array of nodes 有序的节点数组
   */
  getExecutionOrder(): VisualNode[] {
    if (this.executionOrder) {
      return this.executionOrder;
    }

    this.executionOrder = this.topologicalSort();
    return this.executionOrder;
  }

  /**
   * Perform topological sort on the graph
   * 对图执行拓扑排序
   *
   * @returns Topologically sorted nodes 拓扑排序的节点
   */
  private topologicalSort(): VisualNode[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    // 初始化
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
      adjList.set(nodeId, []);
    }

    // Build adjacency list and calculate in-degrees
    // 构建邻接表并计算入度
    for (const connection of this.connections.values()) {
      const from = connection.fromNodeId;
      const to = connection.toNodeId;

      adjList.get(from)?.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }

    // Kahn's algorithm
    // Kahn算法
    const queue: string[] = [];
    const result: VisualNode[] = [];

    // Find nodes with no incoming edges
    // 查找没有入边的节点
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId) continue;

      const node = this.nodes.get(nodeId);
      if (node) {
        result.push(node);
      }

      // Process neighbors
      // 处理邻居节点
      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const currentDegree = inDegree.get(neighbor);
        if (currentDegree !== undefined) {
          inDegree.set(neighbor, currentDegree - 1);
          if (inDegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // Check for cycles
    // 检查循环
    if (result.length !== this.nodes.size) {
      throw new Error('Graph contains cycles and cannot be executed');
    }

    return result;
  }

  /**
   * Execute the entire graph
   * 执行整个图
   *
   * @param ctx Execution context 执行上下文
   * @returns Execution results for all nodes 所有节点的执行结果
   */
  execute(ctx: VisualExecutionContext): Map<string, NodeExecutionResult> {
    const results = new Map<string, NodeExecutionResult>();

    // Reset all nodes
    // 重置所有节点
    for (const node of this.nodes.values()) {
      if (node instanceof BaseVisualNode) {
        node.reset();
      }
    }

    // Execute nodes in topological order
    // 按拓扑顺序执行节点
    const executionOrder = this.getExecutionOrder();

    for (const node of executionOrder) {
      if (node.shouldExecute(ctx)) {
        if (node instanceof BaseVisualNode) {
          const result = node.executeWithResult(ctx);
          results.set(node.id, result);

          // Propagate outputs to connected nodes
          // 将输出传播到连接的节点
          this.propagateOutputs(node);
        } else {
          // Fallback for non-BaseVisualNode implementations
          // 非BaseVisualNode实现的回退
          try {
            node.execute(ctx);
            results.set(node.id, {
              success: true,
              executionTime: 0,
              outputs: new Map()
            });
          } catch (error) {
            results.set(node.id, {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime: 0,
              outputs: new Map()
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Propagate node outputs to connected inputs
   * 将节点输出传播到连接的输入
   *
   * @param sourceNode Source node 源节点
   */
  private propagateOutputs(sourceNode: VisualNode): void {
    const outgoingConnections = Array.from(this.connections.values())
      .filter(conn => conn.fromNodeId === sourceNode.id);

    for (const connection of outgoingConnections) {
      const targetNode = this.getNode(connection.toNodeId);
      if (targetNode) {
        const outputValue = sourceNode.getOutput(connection.fromPin);
        targetNode.setInput(connection.toPin, outputValue);
      }
    }
  }

  /**
   * Invalidate cached execution order
   * 使缓存的执行顺序无效
   */
  private invalidateExecutionOrder(): void {
    this.executionOrder = null;
  }

  /**
   * Update modification timestamp
   * 更新修改时间戳
   */
  private updateModified(): void {
    this.metadata.modified = new Date().toISOString();
  }

  /**
   * Serialize graph to JSON
   * 将图序列化为JSON
   *
   * @returns Serialized graph data 序列化的图数据
   */
  serialize(): VisualGraphData {
    return {
      name: this.name,
      description: this.description,
      version: this.metadata.version,
      nodes: Array.from(this.nodes.values()),
      connections: Array.from(this.connections.values()),
      metadata: { ...this.metadata }
    };
  }

  /**
   * Load graph from serialized data
   * 从序列化数据加载图
   *
   * @param data Serialized graph data 序列化的图数据
   */
  static deserialize(data: VisualGraphData): VisualGraph {
    const graph = new VisualGraph(data.name, data.description);
    graph.metadata = {
      ...data.metadata,
      version: data.version
    };

    // Reconstruct nodes using NodeGenerator
    // 使用NodeGenerator重新构建节点
    for (const nodeData of data.nodes) {
      try {
        // Attempt to recreate the node by its type
        // 尝试按类型重新创建节点
        const node = NodeGenerator.createNode(nodeData.type, nodeData.id);

        // Restore input values
        // 恢复输入值
        if (nodeData.inputs) {
          if (nodeData.inputs instanceof Map || Array.isArray(nodeData.inputs)) {
            // Handle Map or array format (e.g., from direct node serialization)
            for (const [inputName, value] of nodeData.inputs) {
              node.setInput(inputName, value);
            }
          } else {
            // Handle plain object format (e.g., from JSON serialization)
            for (const [inputName, value] of Object.entries(nodeData.inputs)) {
              node.setInput(inputName, value);
            }
          }
        }

        // Restore output values
        // 恢复输出值
        if (nodeData.outputs) {
          if (nodeData.outputs instanceof Map || Array.isArray(nodeData.outputs)) {
            // Handle Map or array format (e.g., from direct node serialization)
            for (const [outputName, value] of nodeData.outputs) {
              node.setOutput(outputName, value);
            }
          } else {
            // Handle plain object format (e.g., from JSON serialization)
            for (const [outputName, value] of Object.entries(nodeData.outputs)) {
              node.setOutput(outputName, value);
            }
          }
        }

        graph.addNode(node);
      } catch (error) {
        console.warn(`Failed to reconstruct node ${nodeData.id} of type ${nodeData.type}:`, error);
        // Continue with other nodes even if one fails
        // 即使一个节点失败也继续处理其他节点
      }
    }

    for (const connectionData of data.connections) {
      graph.connections.set(connectionData.id, connectionData);
    }

    return graph;
  }
}