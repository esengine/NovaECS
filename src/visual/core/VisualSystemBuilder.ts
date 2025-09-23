/**
 * Visual system builder for creating systems from visual graphs
 * 用于从可视化图创建系统的可视化系统构建器
 *
 * Provides a fluent API for building systems that execute visual programming graphs.
 * Integrates seamlessly with the existing SystemBuilder API.
 * 提供用于构建执行可视化编程图的系统的流畅API。
 * 与现有SystemBuilder API无缝集成。
 */

import { SystemBuilder, SystemContext, SystemStage, system } from '../../core/System';
import { World } from '../../core/World';
import { VisualGraph } from '../core/VisualGraph';
import { ExecutionEngine, ExecutionEngineOptions } from '../core/ExecutionEngine';
import { NodeGenerator } from '../core/NodeGenerator';
import type { VisualSystemConfig } from '../types';

/**
 * Builder for creating systems from visual graphs
 * 从可视化图创建系统的构建器
 */
export class VisualSystemBuilder {
  private config: Partial<VisualSystemConfig> = {};
  private graph?: VisualGraph;
  private engineOptions: ExecutionEngineOptions = {};
  private stage: SystemStage = 'update';
  private dependencies: string[] = [];
  private runCondition?: (world: World) => boolean;

  constructor(name: string) {
    this.config.name = name;
  }

  /**
   * Set the visual graph for this system
   * 为此系统设置可视化图
   *
   * @param graph Visual graph to execute 要执行的可视化图
   * @returns This builder for chaining 用于链接的此构建器
   */
  withGraph(graph: VisualGraph): VisualSystemBuilder {
    this.graph = graph;
    this.config.graph = graph.serialize();
    return this;
  }

  /**
   * Load graph from serialized data
   * 从序列化数据加载图
   *
   * @param graphData Serialized graph data 序列化的图数据
   * @returns This builder for chaining 用于链接的此构建器
   */
  fromGraphData(graphData: any): VisualSystemBuilder {
    this.config.graph = graphData;
    // Note: Graph would be reconstructed during build()
    // 注意：图将在build()期间重构
    return this;
  }

  /**
   * Set execution stage
   * 设置执行阶段
   *
   * @param stage System execution stage 系统执行阶段
   * @returns This builder for chaining 用于链接的此构建器
   */
  setStage(stage: SystemStage): VisualSystemBuilder {
    this.stage = stage;
    this.config.stage = stage;
    return this;
  }

  /**
   * Add system dependency
   * 添加系统依赖
   *
   * @param dependency Dependency name 依赖名称
   * @returns This builder for chaining 用于链接的此构建器
   */
  after(dependency: string): VisualSystemBuilder {
    this.dependencies.push(dependency);
    this.config.dependencies = [...this.dependencies];
    return this;
  }

  /**
   * Add multiple system dependencies
   * 添加多个系统依赖
   *
   * @param dependencies Array of dependency names 依赖名称数组
   * @returns This builder for chaining 用于链接的此构建器
   */
  afterAll(dependencies: string[]): VisualSystemBuilder {
    this.dependencies.push(...dependencies);
    this.config.dependencies = [...this.dependencies];
    return this;
  }

  /**
   * Set conditional execution
   * 设置条件执行
   *
   * @param condition Condition function 条件函数
   * @returns This builder for chaining 用于链接的此构建器
   */
  runIf(condition: (world: World) => boolean): VisualSystemBuilder {
    this.runCondition = condition;
    this.config.runIf = condition;
    return this;
  }

  /**
   * Configure execution engine options
   * 配置执行引擎选项
   *
   * @param options Engine configuration options 引擎配置选项
   * @returns This builder for chaining 用于链接的此构建器
   */
  withEngineOptions(options: ExecutionEngineOptions): VisualSystemBuilder {
    this.engineOptions = { ...this.engineOptions, ...options };
    return this;
  }

  /**
   * Enable debug mode for the execution engine
   * 为执行引擎启用调试模式
   *
   * @param enabled Whether debug mode should be enabled 是否应启用调试模式
   * @returns This builder for chaining 用于链接的此构建器
   */
  debug(enabled: boolean = true): VisualSystemBuilder {
    this.engineOptions.debugMode = enabled;
    return this;
  }

  /**
   * Set error handler for the execution engine
   * 为执行引擎设置错误处理器
   *
   * @param handler Error handler function 错误处理函数
   * @returns This builder for chaining 用于链接的此构建器
   */
  onError(handler: (error: Error, nodeId: string) => void): VisualSystemBuilder {
    this.engineOptions.errorHandler = handler;
    return this;
  }

  /**
   * Build the visual system
   * 构建可视化系统
   *
   * @returns SystemBuilder for further configuration 用于进一步配置的SystemBuilder
   */
  build(): SystemBuilder {
    if (!this.config.name) {
      throw new Error('System name is required');
    }

    if (!this.config.graph && !this.graph) {
      throw new Error('Visual graph is required');
    }

    // Create execution engine
    // 创建执行引擎
    const engine = new ExecutionEngine(this.engineOptions);

    // Create system function
    // 创建系统函数
    const systemFunction = (ctx: SystemContext): void => {
      let graph = this.graph;

      // Reconstruct graph from serialized data if needed
      // 如果需要，从序列化数据重构图
      if (!graph && this.config.graph) {
        graph = this.reconstructGraph(this.config.graph);
      }

      if (!graph) {
        throw new Error('No visual graph available for execution');
      }

      // Execute the graph
      // 执行图
      engine.executeGraph(graph, ctx);
    };

    // Create SystemBuilder using imported system function
    // 使用导入的system函数创建SystemBuilder
    let builder = system(this.config.name, systemFunction);

    // Apply stage
    // 应用阶段
    builder = builder.stage(this.stage);

    // Apply dependencies
    // 应用依赖项
    for (const dep of this.dependencies) {
      builder = builder.after(dep);
    }

    // Apply run condition
    // 应用运行条件
    if (this.runCondition) {
      builder = builder.runIf(this.runCondition);
    }

    return builder;
  }

  /**
   * Reconstruct visual graph from serialized data
   * 从序列化数据重构可视化图
   *
   * @param graphData Serialized graph data 序列化的图数据
   * @returns Reconstructed visual graph 重构的可视化图
   */
  private reconstructGraph(graphData: any): VisualGraph {
    const graph = new VisualGraph(graphData.name, graphData.description);

    // Reconstruct nodes using NodeGenerator
    // 使用NodeGenerator重构节点
    for (const nodeData of graphData.nodes) {
      try {
        const node = NodeGenerator.createNode(nodeData.type, nodeData.id);

        // Restore node inputs
        // 恢复节点输入
        if (nodeData.inputs) {
          for (const [inputName, inputValue] of Object.entries(nodeData.inputs)) {
            node.setInput(inputName, inputValue);
          }
        }

        graph.addNode(node);
      } catch (error) {
        console.warn(`Failed to reconstruct node ${nodeData.id} of type ${nodeData.type}:`, error);
      }
    }

    // Reconstruct connections
    // 重构连接
    for (const connectionData of graphData.connections) {
      try {
        graph.addConnection(connectionData);
      } catch (error) {
        console.warn(`Failed to reconstruct connection ${connectionData.id}:`, error);
      }
    }

    return graph;
  }

  /**
   * Create a visual system builder from existing graph
   * 从现有图创建可视化系统构建器
   *
   * @param name System name 系统名称
   * @param graph Visual graph 可视化图
   * @returns New visual system builder 新的可视化系统构建器
   */
  static fromGraph(name: string, graph: VisualGraph): VisualSystemBuilder {
    return new VisualSystemBuilder(name).withGraph(graph);
  }

  /**
   * Create a visual system builder from serialized graph data
   * 从序列化图数据创建可视化系统构建器
   *
   * @param name System name 系统名称
   * @param graphData Serialized graph data 序列化图数据
   * @returns New visual system builder 新的可视化系统构建器
   */
  static fromGraphData(name: string, graphData: any): VisualSystemBuilder {
    return new VisualSystemBuilder(name).fromGraphData(graphData);
  }

  /**
   * Create a movement system using predefined visual graph
   * 使用预定义可视化图创建移动系统
   *
   * @param name System name (optional) 系统名称（可选）
   * @returns Configured visual system builder 配置的可视化系统构建器
   */
  static createMovementSystem(name: string = 'VisualMovement'): VisualSystemBuilder {
    // Create a basic movement graph
    // 创建基础移动图
    const graph = new VisualGraph(name, 'Basic movement using Position and Velocity');

    // Add nodes programmatically
    // 以编程方式添加节点
    const queryNode = NodeGenerator.createNode('world.query', 'query_entities');
    const forEachNode = NodeGenerator.createNode('query.forEach', 'for_each');

    graph.addNode(queryNode);
    graph.addNode(forEachNode);

    // Add connection
    // 添加连接
    graph.addConnection({
      id: 'query_to_foreach',
      fromNodeId: 'query_entities',
      fromPin: 'Query',
      toNodeId: 'for_each',
      toPin: 'Query'
    });

    return new VisualSystemBuilder(name)
      .withGraph(graph)
      .setStage('update');
  }

  /**
   * Create a rendering system using predefined visual graph
   * 使用预定义可视化图创建渲染系统
   *
   * @param name System name (optional) 系统名称（可选）
   * @returns Configured visual system builder 配置的可视化系统构建器
   */
  static createRenderingSystem(name: string = 'VisualRenderer'): VisualSystemBuilder {
    const graph = new VisualGraph(name, 'Basic rendering for sprites and transforms');

    // This would be populated with actual rendering nodes
    // 这将填充实际的渲染节点

    return new VisualSystemBuilder(name)
      .withGraph(graph)
      .setStage('postUpdate')
      .after('Movement');
  }
}

/**
 * Convenience function to create a visual system builder
 * 创建可视化系统构建器的便利函数
 *
 * @param name System name 系统名称
 * @returns New visual system builder 新的可视化系统构建器
 */
export function visualSystemBuilder(name: string): VisualSystemBuilder {
  return new VisualSystemBuilder(name);
}

/**
 * Create a system that executes a visual graph
 * 创建执行可视化图的系统
 *
 * @param name System name 系统名称
 * @param graph Visual graph to execute 要执行的可视化图
 * @returns System builder 系统构建器
 */
export function createVisualSystem(name: string, graph: VisualGraph): SystemBuilder {
  return VisualSystemBuilder.fromGraph(name, graph).build();
}