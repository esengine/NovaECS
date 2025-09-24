/**
 * Code optimizer for visual graph compilation
 * 可视化图编译的代码优化器
 *
 * Performs various optimization passes on visual graphs before code generation
 * to improve performance, reduce code size, and eliminate redundant operations.
 * Includes dead code elimination, constant folding, and node inlining.
 * 在代码生成前对可视化图执行各种优化过程，以提高性能、减小代码大小并消除冗余操作。
 * 包括死代码消除、常量折叠和节点内联。
 */

import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import type { VisualNode } from '../../../src/visual/types';
import type { Connection } from '../../../src/visual/types';
import { TypeResolver, type TypeResolutionResult } from './TypeResolver';

/**
 * Algebraic optimization pattern definition
 * 代数优化模式定义
 */
interface AlgebraicPattern {
  /** Target node type 目标节点类型 */
  nodeType: string;
  /** Pattern name for logging 用于日志记录的模式名称 */
  name: string;
  /** Check if pattern matches 检查模式是否匹配 */
  matches(node: VisualNode, inputs: VisualNode[]): boolean;
  /** Apply the optimization 应用优化 */
  apply(node: VisualNode, inputs: VisualNode[]): {
    eliminate: string[];  // 要删除的节点ID
    redirect: string;     // 重定向到的节点ID
  };
}

/**
 * Optimization result
 * 优化结果
 */
export interface OptimizationResult {
  /** Whether optimization succeeded 优化是否成功 */
  success: boolean;
  /** Optimized graph 优化后的图 */
  optimizedGraph: VisualGraph;
  /** Optimization metrics 优化指标 */
  metrics: {
    initialNodeCount: number;
    finalNodeCount: number;
    nodesEliminated: number;
    constantsFolded: number;
    nodesInlined: number;
    optimizationsApplied: string[];
    passesExecuted: number;
    converged: boolean;
    optimizationTime: number;
  };
  /** Optimization errors 优化错误 */
  errors: string[];
}

/**
 * Optimization options
 * 优化选项
 */
export interface OptimizationOptions {
  /** Enable dead code elimination 启用死代码消除 */
  eliminateDeadCode?: boolean;
  /** Enable constant folding 启用常量折叠 */
  foldConstants?: boolean;
  /** Enable node inlining 启用节点内联 */
  inlineNodes?: boolean;
  /** Enable common subexpression elimination 启用公共子表达式消除 */
  eliminateCommonSubexpressions?: boolean;
  /** Maximum optimization passes 最大优化过程数 */
  maxPasses?: number;
  /** Aggressive optimization level 激进优化级别 */
  aggressive?: boolean;
}

/**
 * Node classification for optimization
 * 用于优化的节点分类
 */
interface NodeClassification {
  /** Pure nodes (no side effects) 纯节点（无副作用） */
  pure: Set<string>;
  /** Constant nodes 常量节点 */
  constant: Set<string>;
  /** Inlinable nodes 可内联节点 */
  inlinable: Set<string>;
  /** Dead nodes (unused outputs) 死节点（未使用的输出） */
  dead: Set<string>;
}

/**
 * Code optimizer for visual graphs
 * 可视化图的代码优化器
 */
export class Optimizer {
  private appliedOptimizations: string[] = [];

  /**
   * Predefined algebraic optimization patterns
   * 预定义的代数优化模式
   */
  private readonly ALGEBRAIC_PATTERNS: AlgebraicPattern[] = [
    // x * 1 = x (Multiplicative Identity 乘法恒等式)
    {
      nodeType: 'math.multiply',
      name: 'MultiplicativeIdentity',
      matches: (node, inputs) => inputs.some(n => n.type === 'math.constant' && n.inputs.get('Value') === 1),
      apply: (node, inputs) => {
        const identityNode = inputs.find(n => n.type === 'math.constant' && n.inputs.get('Value') === 1)!;
        const valueNode = inputs.find(n => n !== identityNode)!;
        return {
          eliminate: [node.id, identityNode.id],
          redirect: valueNode.id
        };
      }
    }
    // Future patterns can be easily added here:
    // x + 0 = x (Additive Identity)
    // x * 0 = 0 (Multiplicative Zero)
    // 等等
  ];
  private options: OptimizationOptions;
  private typeResolver: TypeResolver;
  private foldedConstantNodes: Set<string> = new Set(); // Track nodes created by constant folding

  constructor(typeResolver: TypeResolver, options: OptimizationOptions = {}) {
    this.typeResolver = typeResolver;
    this.options = {
      eliminateDeadCode: true,
      foldConstants: true,
      inlineNodes: true,
      eliminateCommonSubexpressions: true,
      maxPasses: 5,
      aggressive: false,
      ...options
    };
  }

  /**
   * Optimize a visual graph
   * 优化可视化图
   *
   * @param graph Graph to optimize 要优化的图
   * @param typeInfo Type resolution result 类型解析结果
   * @returns Optimization result 优化结果
   */
  async optimize(graph: VisualGraph, typeInfo: TypeResolutionResult): Promise<OptimizationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    this.appliedOptimizations = [];
    this.foldedConstantNodes.clear(); // Reset tracking for this optimization run

    try {
      // Create a copy of the graph for optimization 为优化创建图的副本
      const optimizedGraph = new VisualGraph(graph.name + '_optimized');
      const nodes = graph.getAllNodes();
      const connections = graph.getAllConnections();
      const initialNodeCount = nodes.length;

      // Copy nodes to optimized graph 将节点复制到优化图
      nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
      connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));


      let currentNodes = optimizedGraph.getAllNodes();
      let currentConnections = optimizedGraph.getAllConnections();
      let changed = true;
      let passCount = 0;
      let nodesEliminated = 0;
      let constantsFolded = 0;
      let nodesInlined = 0;

      // Apply optimization passes until no more changes or max passes reached
      // 应用优化过程直到没有更多变化或达到最大过程数
      while (changed && passCount < (this.options.maxPasses || 5)) {
        changed = false;
        passCount++;

        // Classify nodes for optimization 为优化分类节点
        const classification = this.classifyNodes(currentNodes, currentConnections, optimizedGraph);

        // Pass 1: Constant folding (before dead code elimination) 过程1：常量折叠（在死代码消除之前）
        if (this.options.foldConstants) {
          const result = this.foldConstants(currentNodes, currentConnections, classification);
          if (result.changed) {
            // Update the graph with optimized nodes 用优化的节点更新图
            const nodeIds = optimizedGraph.getAllNodes().map((n: VisualNode) => n.id);
            const connectionIds = optimizedGraph.getAllConnections().map((c: Connection) => c.id);
            nodeIds.forEach((id: string) => optimizedGraph.removeNode(id));
            connectionIds.forEach((id: string) => optimizedGraph.removeConnection(id));
            result.nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
            result.connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));

            currentNodes = optimizedGraph.getAllNodes();
            currentConnections = optimizedGraph.getAllConnections();
            changed = true;
            // Count the number of nodes that were actually folded 计算实际被折叠的节点数量
            constantsFolded += result.foldedCount;
            this.appliedOptimizations.push('ConstantFolding');
          }
        }

        // Pass 2: Algebraic optimizations (after constant folding) 过程2：代数优化（在常量折叠之后）
        if (this.options.foldConstants) { // Reuse the foldConstants flag for algebraic optimizations
          const result = this.optimizeAlgebraicPatterns(currentNodes, currentConnections);
          if (result.changed) {
            // Update the graph with optimized nodes 用优化的节点更新图
            const nodeIds = optimizedGraph.getAllNodes().map((n: VisualNode) => n.id);
            const connectionIds = optimizedGraph.getAllConnections().map((c: Connection) => c.id);
            nodeIds.forEach((id: string) => optimizedGraph.removeNode(id));
            connectionIds.forEach((id: string) => optimizedGraph.removeConnection(id));
            result.nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
            result.connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));

            currentNodes = optimizedGraph.getAllNodes();
            currentConnections = optimizedGraph.getAllConnections();
            changed = true;
            nodesEliminated += result.nodesEliminated;
            this.appliedOptimizations.push('AlgebraicOptimization');
          }
        }

        // Pass 3: Dead code elimination (after algebraic optimizations) 过程3：死代码消除（在代数优化之后）
        if (this.options.eliminateDeadCode) {
          // Re-classify nodes after constant folding 常量折叠后重新分类节点
          const deadClassification = this.classifyNodes(currentNodes, currentConnections, optimizedGraph);
          const result = this.eliminateDeadCode(currentNodes, currentConnections, deadClassification);
          if (result.changed) {
            // Update the graph with optimized nodes 用优化的节点更新图
            const nodeIds = optimizedGraph.getAllNodes().map((n: VisualNode) => n.id);
            const connectionIds = optimizedGraph.getAllConnections().map((c: Connection) => c.id);
            nodeIds.forEach((id: string) => optimizedGraph.removeNode(id));
            connectionIds.forEach((id: string) => optimizedGraph.removeConnection(id));
            result.nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
            result.connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));

            currentNodes = optimizedGraph.getAllNodes();
            currentConnections = optimizedGraph.getAllConnections();
            changed = true;
            nodesEliminated += deadClassification.dead.size;
            this.appliedOptimizations.push('DeadCodeElimination');
          }
        }

        // Pass 4: Node inlining 过程4：节点内联
        if (this.options.inlineNodes) {
          const result = this.inlineNodes(currentNodes, currentConnections, classification);
          if (result.changed) {
            // Update the graph with optimized nodes 用优化的节点更新图
            const nodeIds = optimizedGraph.getAllNodes().map((n: VisualNode) => n.id);
            const connectionIds = optimizedGraph.getAllConnections().map((c: Connection) => c.id);
            nodeIds.forEach((id: string) => optimizedGraph.removeNode(id));
            connectionIds.forEach((id: string) => optimizedGraph.removeConnection(id));
            result.nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
            result.connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));

            currentNodes = optimizedGraph.getAllNodes();
            currentConnections = optimizedGraph.getAllConnections();
            changed = true;
            nodesInlined += classification.inlinable.size;
            this.appliedOptimizations.push('Node Inlining');
          }
        }

        // Pass 5: Common subexpression elimination 过程5：公共子表达式消除
        if (this.options.eliminateCommonSubexpressions) {
          const result = this.eliminateCommonSubexpressions(currentNodes, currentConnections);
          if (result.changed) {
            // Update the graph with optimized nodes 用优化的节点更新图
            const nodeIds = optimizedGraph.getAllNodes().map((n: VisualNode) => n.id);
            const connectionIds = optimizedGraph.getAllConnections().map((c: Connection) => c.id);
            nodeIds.forEach((id: string) => optimizedGraph.removeNode(id));
            connectionIds.forEach((id: string) => optimizedGraph.removeConnection(id));
            result.nodes.forEach((node: VisualNode) => optimizedGraph.addNode(node));
            result.connections.forEach((conn: Connection) => optimizedGraph.addConnection(conn));

            currentNodes = optimizedGraph.getAllNodes();
            currentConnections = optimizedGraph.getAllConnections();
            changed = true;
            this.appliedOptimizations.push('Common Subexpression Elimination');
          }
        }
      }

      const finalNodeCount = currentNodes.length;
      const endTime = Date.now();

      return {
        success: true,
        optimizedGraph,
        metrics: {
          initialNodeCount,
          finalNodeCount,
          nodesEliminated,
          constantsFolded,
          nodesInlined,
          optimizationsApplied: [...this.appliedOptimizations],
          passesExecuted: passCount,
          converged: !changed,
          optimizationTime: Math.max(1, endTime - startTime)
        },
        errors
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        optimizedGraph: graph,
        metrics: {
          initialNodeCount: graph.getAllNodes().length,
          finalNodeCount: graph.getAllNodes().length,
          nodesEliminated: 0,
          constantsFolded: 0,
          nodesInlined: 0,
          optimizationsApplied: [],
          passesExecuted: 0,
          converged: false,
          optimizationTime: Math.max(1, Date.now() - startTime)
        },
        errors
      };
    }
  }

  /**
   * Classify nodes for optimization purposes
   * 为优化目的分类节点
   *
   * @param nodes Nodes to classify 要分类的节点
   * @param connections Node connections 节点连接
   * @param graph Graph instance for node lookup 用于节点查找的图实例
   * @returns Node classification 节点分类
   */
  private classifyNodes(nodes: VisualNode[], connections: Connection[], graph: VisualGraph): NodeClassification {
    const classification: NodeClassification = {
      pure: new Set(),
      constant: new Set(),
      inlinable: new Set(),
      dead: new Set()
    };

    for (const node of nodes) {
      const nodeId = node.id;

      // Classify as pure (no side effects) 分类为纯节点（无副作用）
      if (this.isPureNode(node)) {
        classification.pure.add(nodeId);
      }

      // Classify as constant 分类为常量
      if (this.isConstantNode(node, connections, graph)) {
        classification.constant.add(nodeId);
      }

      // Classify as inlinable 分类为可内联
      if (this.isInlinableNode(node, connections)) {
        classification.inlinable.add(nodeId);
      }

      // Classify as dead (no consumers) 分类为死节点（无消费者）
      if (this.isDeadNode(node, connections, nodes)) {
        classification.dead.add(nodeId);
      }
    }

    return classification;
  }

  /**
   * Check if node is pure (has no side effects)
   * 检查节点是否为纯节点（无副作用）
   *
   * @param node Node to check 要检查的节点
   * @returns Whether node is pure 节点是否为纯节点
   */
  private isPureNode(node: VisualNode): boolean {
    // Math operations are typically pure 数学运算通常是纯的
    if (node.type.startsWith('math.')) {
      return true;
    }

    // Some ECS operations are not pure (they modify world state) 一些ECS操作不是纯的（它们修改世界状态）
    const impureOperations = [
      'world.createEntity',
      'world.destroyEntity',
      'world.addComponent',
      'world.removeComponent'
    ];

    return !impureOperations.includes(node.type);
  }

  /**
   * Check if node produces constant output
   * 检查节点是否产生常量输出
   *
   * @param node Node to check 要检查的节点
   * @param connections Node connections 节点连接
   * @param graph Graph instance for node lookup 用于节点查找的图实例
   * @param visited Set of visited node IDs to prevent infinite recursion 已访问节点ID集合，防止无限递归
   * @returns Whether node is constant 节点是否为常量
   */
  private isConstantNode(node: VisualNode, connections: Connection[], graph: VisualGraph, visited: Set<string> = new Set()): boolean {
    // Prevent infinite recursion 防止无限递归
    if (visited.has(node.id)) {
      return false;
    }
    visited.add(node.id);

    // Constant nodes are inherently constant 常量节点本质上就是常量
    if (node.type === 'math.constant') {
      return true;
    }

    // Math operations with all constant inputs 具有所有常量输入的数学运算
    if (node.type.startsWith('math.') && this.isPureNode(node)) {
      const inputConnections = connections.filter(conn => conn.toNodeId === node.id);

      // If no input connections, check if all inputs have literal values 如果没有输入连接，检查所有输入是否有字面值
      if (inputConnections.length === 0) {
        const hasAllLiteralInputs = Array.from(node.inputs.entries()).every((entry: [string, any]) => {
          const [_, value] = entry;
          return value !== null && value !== undefined;
        });
        return hasAllLiteralInputs;
      }

      // All input connections must come from constant nodes 所有输入连接必须来自常量节点
      return inputConnections.every(conn => {
        const sourceNode = graph.getNode(conn.fromNodeId);
        if (!sourceNode) return false;

        // Recursively check if source node is constant 递归检查源节点是否为常量
        return this.isConstantNode(sourceNode, connections, graph, visited);
      });
    }

    return false;
  }

  /**
   * Check if node can be inlined
   * 检查节点是否可以内联
   *
   * @param node Node to check 要检查的节点
   * @param connections Node connections 节点连接
   * @returns Whether node is inlinable 节点是否可内联
   */
  private isInlinableNode(node: VisualNode, connections: Connection[]): boolean {
    // Simple math operations with single use 单次使用的简单数学运算
    if (!node.type.startsWith('math.')) {
      return false;
    }

    // Check if node has only one consumer 检查节点是否只有一个消费者
    const outputConnections = connections.filter(conn => conn.fromNodeId === node.id);
    return outputConnections.length === 1;
  }

  /**
   * Check if node is reachable from any root node (nodes with side effects)
   * 检查节点是否可以从任何根节点（具有副作用的节点）到达
   *
   * @param node Node to check 要检查的节点
   * @param connections All connections 所有连接
   * @param allNodes All nodes in graph 图中的所有节点
   * @returns Whether node is reachable 节点是否可达
   */
  private isNodeReachable(node: VisualNode, connections: Connection[], allNodes: VisualNode[]): boolean {
    // Root nodes (nodes with side effects) are always reachable 根节点（有副作用的节点）总是可达的
    if (!this.isPureNode(node)) {
      return true;
    }

    // Use BFS to check if this node is reachable from any root node
    // 使用BFS检查此节点是否可以从任何根节点到达
    const visited = new Set<string>();
    const queue: string[] = [];

    // Find all root nodes (nodes with side effects)
    // 找到所有根节点（有副作用的节点）
    const rootNodes = allNodes.filter(n => !this.isPureNode(n));

    // If there are no root nodes, use connected component analysis
    // 如果没有根节点，使用连通分量分析
    if (rootNodes.length === 0) {
      // Find all connected components and keep only nodes in the largest component
      // 查找所有连通分量，仅保留最大分量中的节点
      const components = this.findConnectedComponents(allNodes, connections);
      if (components.length === 0) {
        return false;
      }

      // Find the largest component 找到最大分量
      const largestComponent = components.reduce((max, current) =>
        current.length > max.length ? current : max
      );

      // Check if the current node is in the largest component
      // 检查当前节点是否在最大分量中
      return largestComponent.includes(node.id);
    } else {
      for (const rootNode of rootNodes) {
        queue.push(rootNode.id);
      }
    }

    // BFS from root nodes
    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;

      if (visited.has(currentNodeId)) {
        continue;
      }
      visited.add(currentNodeId);

      if (currentNodeId === node.id) {
        return true;
      }

      // Add all nodes that feed into current node
      // 添加所有输入到当前节点的节点
      const inputConnections = connections.filter(conn => conn.toNodeId === currentNodeId);
      for (const conn of inputConnections) {
        if (!visited.has(conn.fromNodeId)) {
          queue.push(conn.fromNodeId);
        }
      }
    }

    // If we reach here, the node is not reachable through normal graph traversal
    // For folded constants, check if they're in meaningful connected components
    // 如果到达这里，该节点无法通过正常图遍历到达
    // 对于折叠常量，检查它们是否在有意义的连通分量中
    if (this.foldedConstantNodes.has(node.id)) {
      // If there are no root nodes, use connected component analysis for folded constants too
      // 如果没有根节点，对折叠常量也使用连通分量分析
      if (rootNodes.length === 0) {
        const components = this.findConnectedComponents(allNodes, connections);
        if (components.length === 0) {
          return false;
        }
        const largestComponent = components.reduce((max, current) =>
          current.length > max.length ? current : max
        );
        return largestComponent.includes(node.id);
      }
      // If there are root nodes, folded constants should still be reachable if they have outputs
      // 如果有根节点，折叠常量如果有输出仍应该可达
      return connections.some(conn => conn.fromNodeId === node.id);
    }

    return false;
  }

  /**
   * Find connected components in the graph
   * 查找图中的连通分量
   *
   * @param nodes All nodes 所有节点
   * @param connections All connections 所有连接
   * @returns Array of components (each component is an array of node IDs) 分量数组（每个分量是节点ID数组）
   */
  private findConnectedComponents(nodes: VisualNode[], connections: Connection[]): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const component = this.dfsComponent(node.id, nodes, connections, visited);
        if (component.length > 0) {
          components.push(component);
        }
      }
    }

    return components;
  }

  /**
   * DFS to find all nodes in a connected component
   * 使用DFS查找连通分量中的所有节点
   *
   * @param startNodeId Starting node ID 起始节点ID
   * @param nodes All nodes 所有节点
   * @param connections All connections 所有连接
   * @param visited Set of visited nodes 已访问节点集合
   * @returns Array of node IDs in this component 此分量中的节点ID数组
   */
  private dfsComponent(startNodeId: string, nodes: VisualNode[], connections: Connection[], visited: Set<string>): string[] {
    const component: string[] = [];
    const stack: string[] = [startNodeId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);
      component.push(nodeId);

      // Add all connected nodes (both directions) 添加所有连接的节点（双向）
      const connectedNodes = connections
        .filter(conn => conn.fromNodeId === nodeId || conn.toNodeId === nodeId)
        .map(conn => conn.fromNodeId === nodeId ? conn.toNodeId : conn.fromNodeId)
        .filter(id => !visited.has(id));

      stack.push(...connectedNodes);
    }

    return component;
  }

  /**
   * Check if node is dead (outputs not used)
   * 检查节点是否为死节点（输出未被使用）
   *
   * @param node Node to check 要检查的节点
   * @param connections Node connections 节点连接
   * @param allNodes All nodes in graph 图中的所有节点
   * @returns Whether node is dead 节点是否为死节点
   */
  private isDeadNode(node: VisualNode, connections: Connection[], allNodes: VisualNode[]): boolean {
    // Check if node is reachable from root nodes 检查节点是否可以从根节点到达
    return !this.isNodeReachable(node, connections, allNodes);
  }

  /**
   * Eliminate dead code
   * 消除死代码
   *
   * @param nodes Input nodes 输入节点
   * @param connections Input connections 输入连接
   * @param classification Node classification 节点分类
   * @returns Optimization result 优化结果
   */
  private eliminateDeadCode(
    nodes: VisualNode[],
    connections: Connection[],
    classification: NodeClassification
  ): { nodes: VisualNode[]; connections: Connection[]; changed: boolean } {
    const deadNodes = classification.dead;

    if (deadNodes.size === 0) {
      return { nodes, connections, changed: false };
    }

    // Remove dead nodes 移除死节点
    const optimizedNodes = nodes.filter(node => !deadNodes.has(node.id));

    // Remove connections involving dead nodes 移除涉及死节点的连接
    const optimizedConnections = connections.filter(conn =>
      !deadNodes.has(conn.fromNodeId) && !deadNodes.has(conn.toNodeId)
    );


    return {
      nodes: optimizedNodes,
      connections: optimizedConnections,
      changed: true
    };
  }

  /**
   * Fold constant expressions
   * 折叠常量表达式
   *
   * @param nodes Input nodes 输入节点
   * @param connections Input connections 输入连接
   * @param classification Node classification 节点分类
   * @returns Optimization result 优化结果
   */
  private foldConstants(
    nodes: VisualNode[],
    connections: Connection[],
    classification: NodeClassification
  ): { nodes: VisualNode[]; connections: Connection[]; changed: boolean; foldedCount: number } {
    let changed = false;
    let foldedCount = 0;
    const optimizedNodes = [...nodes];

    // Find math nodes with constant inputs that can be folded 查找可以折叠的具有常量输入的数学节点
    for (let i = 0; i < optimizedNodes.length; i++) {
      const node = optimizedNodes[i];

      if (!node.type.startsWith('math.') || !this.isPureNode(node)) {
        continue;
      }

      // Check if node can be constant folded (but skip math.constant nodes as they're already constants)
      // 检查节点是否可以进行常量折叠（但跳过math.constant节点，因为它们已经是常量）
      if (classification.constant.has(node.id) && node.type !== 'math.constant') {
        // Only fold constants for reachable nodes 仅对可达节点进行常量折叠
        if (!this.isNodeReachable(node, connections, nodes)) {
          continue;
        }
        // Get input connections for this node 获取该节点的输入连接
        const inputConnections = connections.filter(conn => conn.toNodeId === node.id);

        // Collect constant values from connected nodes 收集来自连接节点的常量值
        const constantInputs = new Map<string, any>();
        let allInputsAreConstant = true;

        for (const conn of inputConnections) {
          const sourceNode = optimizedNodes.find(n => n.id === conn.fromNodeId);
          if (sourceNode && sourceNode.type === 'math.constant') {
            constantInputs.set(conn.toPin, sourceNode.inputs.get('Value'));
          } else {
            allInputsAreConstant = false;
            break;
          }
        }

        // Also check direct inputs on the node 同时检查节点的直接输入
        for (const [inputName, value] of node.inputs.entries()) {
          if (value !== null && value !== undefined) {
            constantInputs.set(inputName, value);
          }
        }

        if (allInputsAreConstant && constantInputs.size > 0) {
          // Calculate constant result 计算常量结果
          const result = this.evaluateConstantNode(node, constantInputs);
          if (result !== null) {
            // Replace node with constant node 用常量节点替换节点
            const constantNode = this.createConstantNode(node.id, result);
            optimizedNodes[i] = constantNode;
            changed = true;
            foldedCount += 1;
            // Track this node as being created by constant folding 跟踪这个节点是由常量折叠创建的
            this.foldedConstantNodes.add(node.id);
          }
        }
      }
    }

    return {
      nodes: optimizedNodes,
      connections,
      changed,
      foldedCount
    };
  }

  /**
   * Inline simple nodes
   * 内联简单节点
   *
   * @param nodes Input nodes 输入节点
   * @param connections Input connections 输入连接
   * @param classification Node classification 节点分类
   * @returns Optimization result 优化结果
   */
  private inlineNodes(
    nodes: VisualNode[],
    connections: Connection[],
    classification: NodeClassification
  ): { nodes: VisualNode[]; connections: Connection[]; changed: boolean } {
    const inlinableNodes = classification.inlinable;

    if (inlinableNodes.size === 0) {
      return { nodes, connections, changed: false };
    }

    // For now, this is a placeholder for node inlining logic
    // Full implementation would require modifying the consumer nodes
    // to include the inlined operation directly
    // 目前，这是节点内联逻辑的占位符
    // 完整实现需要修改消费者节点以直接包含内联操作


    return {
      nodes,
      connections,
      changed: false // Not implemented yet 尚未实现
    };
  }

  /**
   * Eliminate common subexpressions
   * 消除公共子表达式
   *
   * @param nodes Input nodes 输入节点
   * @param connections Input connections 输入连接
   * @returns Optimization result 优化结果
   */
  private eliminateCommonSubexpressions(
    nodes: VisualNode[],
    connections: Connection[]
  ): { nodes: VisualNode[]; connections: Connection[]; changed: boolean } {
    // Find nodes that compute the same expression 查找计算相同表达式的节点
    const expressionMap = new Map<string, VisualNode[]>();

    for (const node of nodes) {
      if (!this.isPureNode(node)) {
        continue;
      }

      // Create a signature for the node's computation 为节点的计算创建签名
      const signature = this.createNodeSignature(node, connections);
      if (!expressionMap.has(signature)) {
        expressionMap.set(signature, []);
      }
      expressionMap.get(signature)!.push(node);
    }

    // Find common subexpressions (multiple nodes with same signature) 查找公共子表达式（具有相同签名的多个节点）
    const commonExpressions = Array.from(expressionMap.entries())
      .filter(([_, nodeList]) => nodeList.length > 1);

    if (commonExpressions.length === 0) {
      return { nodes, connections, changed: false };
    }

    // For now, this is a placeholder for CSE logic 目前，这是CSE逻辑的占位符
    // Full implementation would merge duplicate computations 完整实现将合并重复计算

    return {
      nodes,
      connections,
      changed: false // Not implemented yet 尚未实现
    };
  }

  /**
   * Evaluate a constant node to compute its result
   * 评估常量节点以计算其结果
   *
   * @param node Node to evaluate 要评估的节点
   * @param constantInputs Optional constant inputs map 可选的常量输入映射
   * @returns Computed result or null if not evaluable 计算结果，如果无法评估则为null
   */
  private evaluateConstantNode(node: VisualNode, constantInputs?: Map<string, any>): any {
    // Use provided constant inputs or fall back to node inputs 使用提供的常量输入或回退到节点输入
    const inputs = constantInputs ? Array.from(constantInputs.entries()) : Array.from(node.inputs.entries());

    switch (node.type) {
      case 'math.constant':
        // For constant nodes, return their value directly 对于常量节点，直接返回其值
        if (constantInputs) {
          return constantInputs.get('Value');
        } else {
          return node.inputs.get('Value');
        }

      case 'math.add':
        if (inputs.length >= 2) {
          const aEntry = inputs.find((entry: [string, any]) => entry[0] === 'A') || ['', 0];
          const bEntry = inputs.find((entry: [string, any]) => entry[0] === 'B') || ['', 0];
          const [aName, aValue] = aEntry;
          const [bName, bValue] = bEntry;
          return Number(aValue) + Number(bValue);
        }
        break;

      case 'math.subtract':
        if (inputs.length >= 2) {
          const aEntry = inputs.find((entry: [string, any]) => entry[0] === 'A') || ['', 0];
          const bEntry = inputs.find((entry: [string, any]) => entry[0] === 'B') || ['', 0];
          const [aName, aValue] = aEntry;
          const [bName, bValue] = bEntry;
          return Number(aValue) - Number(bValue);
        }
        break;

      case 'math.multiply':
        if (inputs.length >= 2) {
          const aEntry = inputs.find((entry: [string, any]) => entry[0] === 'A') || ['', 0];
          const bEntry = inputs.find((entry: [string, any]) => entry[0] === 'B') || ['', 0];
          const [aName, aValue] = aEntry;
          const [bName, bValue] = bEntry;
          return Number(aValue) * Number(bValue);
        }
        break;

      case 'math.divide':
        if (inputs.length >= 2) {
          const aEntry = inputs.find((entry: [string, any]) => entry[0] === 'A') || ['', 0];
          const bEntry = inputs.find((entry: [string, any]) => entry[0] === 'B') || ['', 1];
          const [aName, aValue] = aEntry;
          const [bName, bValue] = bEntry;
          const divisor = Number(bValue);
          return divisor !== 0 ? Number(aValue) / divisor : NaN;
        }
        break;

      // Add more math operations as needed 根据需要添加更多数学运算
    }

    return null;
  }

  /**
   * Create a constant node with the given value
   * 创建具有给定值的常量节点
   *
   * @param nodeId Node ID to use 要使用的节点ID
   * @param value Constant value 常量值
   * @returns Constant node 常量节点
   */
  private createConstantNode(nodeId: string, value: any): VisualNode {
    // This is a simplified placeholder - would need proper node construction 这是简化的占位符 - 需要适当的节点构造
    return {
      id: nodeId,
      type: 'math.constant',
      inputs: new Map([['Value', value]]),
      outputs: new Map([['Value', value]]),
      execute: () => {},
      shouldExecute: () => false,
      setInput: () => {},
      setOutput: () => {},
      getInput: () => value,
      getOutput: () => value
    } as VisualNode;
  }

  /**
   * Create a signature for node's computation
   * 为节点的计算创建签名
   *
   * @param node Node to analyze 要分析的节点
   * @param connections Node connections 节点连接
   * @returns Computation signature 计算签名
   */
  private createNodeSignature(node: VisualNode, connections: Connection[]): string {
    // Create a signature based on node type and input values/connections 基于节点类型和输入值/连接创建签名
    const parts = [node.type];

    // Add input signatures 添加输入签名
    const inputConnections = connections.filter(conn => conn.toNodeId === node.id);

    for (const [inputName, value] of node.inputs.entries()) {
      const connection = inputConnections.find(conn => conn.toPin === inputName);
      if (connection) {
        // Input comes from another node 输入来自另一个节点
        parts.push(`${inputName}:${connection.fromNodeId}.${connection.fromPin}`);
      } else {
        // Input is a literal value 输入是字面值
        parts.push(`${inputName}:${JSON.stringify(value)}`);
      }
    }

    return parts.join('|');
  }


  /**
   * Get list of applied optimizations
   * 获取应用的优化列表
   *
   * @returns Applied optimizations 应用的优化
   */
  getAppliedOptimizations(): string[] {
    return [...this.appliedOptimizations];
  }

  /**
   * Optimize algebraic patterns (e.g., x * 1 = x, x + 0 = x)
   * 优化代数模式（例如，x * 1 = x，x + 0 = x）
   *
   * @param nodes Input nodes 输入节点
   * @param connections Input connections 输入连接
   * @returns Optimization result 优化结果
   */
  private optimizeAlgebraicPatterns(
    nodes: VisualNode[],
    connections: Connection[]
  ): { nodes: VisualNode[]; connections: Connection[]; changed: boolean; nodesEliminated: number } {
    let changed = false;
    let nodesEliminated = 0;
    let optimizedNodes = [...nodes];
    let optimizedConnections = [...connections];

    // Apply each algebraic pattern 应用每个代数模式
    for (const pattern of this.ALGEBRAIC_PATTERNS) {
      for (const node of optimizedNodes) {
        if (node.type !== pattern.nodeType) continue;

        // Get input nodes for this node 获取此节点的输入节点
        const inputConnections = optimizedConnections.filter(conn => conn.toNodeId === node.id);
        const inputNodes = inputConnections
          .map(conn => optimizedNodes.find(n => n.id === conn.fromNodeId))
          .filter((n): n is VisualNode => n !== undefined);

        // Check if pattern matches 检查模式是否匹配
        if (pattern.matches(node, inputNodes)) {
          const optimization = pattern.apply(node, inputNodes);

          // Remove eliminated nodes 删除被消除的节点
          optimizedNodes = optimizedNodes.filter(n => !optimization.eliminate.includes(n.id));

          // Remove connections involving eliminated nodes 删除涉及被消除节点的连接
          optimizedConnections = optimizedConnections.filter(conn =>
            !optimization.eliminate.includes(conn.fromNodeId) &&
            !optimization.eliminate.includes(conn.toNodeId)
          );

          // Redirect output connections 重定向输出连接
          const outputConnections = connections.filter(conn => conn.fromNodeId === node.id);
          for (const outputConn of outputConnections) {
            const newConnection: Connection = {
              id: `redirected_${outputConn.id}`,
              fromNodeId: optimization.redirect,
              fromPin: inputConnections.find(c => c.fromNodeId === optimization.redirect)?.fromPin || 'Value',
              toNodeId: outputConn.toNodeId,
              toPin: outputConn.toPin
            };
            optimizedConnections.push(newConnection);
          }

          changed = true;
          nodesEliminated += optimization.eliminate.length;
          break; // Process one pattern at a time per node 每个节点一次处理一个模式
        }
      }
    }

    return {
      nodes: optimizedNodes,
      connections: optimizedConnections,
      changed,
      nodesEliminated
    };
  }

  /**
   * Reset optimizer state
   * 重置优化器状态
   */
  reset(): void {
    this.appliedOptimizations = [];
  }
}