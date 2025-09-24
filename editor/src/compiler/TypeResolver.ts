/**
 * Type resolver for visual graph compilation
 * 可视化图编译的类型解析器
 *
 * Performs static type analysis on visual graphs to ensure type safety
 * in generated TypeScript code. Resolves pin types, validates connections,
 * and generates appropriate type annotations.
 * 对可视化图执行静态类型分析，确保生成的TypeScript代码类型安全。
 * 解析引脚类型、验证连接，并生成适当的类型注解。
 */

import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import type { VisualNode } from '../../../src/visual/types';
import type { Connection } from '../../../src/visual/types';

/**
 * Type information for a node pin
 * 节点引脚的类型信息
 */
export interface PinTypeInfo {
  /** TypeScript type name TypeScript类型名 */
  typeName: string;
  /** Whether type is nullable 类型是否可为空 */
  nullable: boolean;
  /** Array element type (for array types) 数组元素类型（用于数组类型） */
  elementType?: string;
  /** Generic type parameters 泛型类型参数 */
  generics?: string[];
  /** Type import source 类型导入源 */
  importSource?: string;
}

/**
 * Node type information
 * 节点类型信息
 */
export interface NodeTypeInfo {
  /** Input pin types 输入引脚类型 */
  inputs: Map<string, PinTypeInfo>;
  /** Output pin types 输出引脚类型 */
  outputs: Map<string, PinTypeInfo>;
  /** Required imports for this node 此节点所需的导入 */
  requiredImports: Set<string>;
}

/**
 * Graph type resolution result
 * 图类型解析结果
 */
export interface TypeResolutionResult {
  /** Node type information 节点类型信息 */
  nodeTypes: Map<string, NodeTypeInfo>;
  /** Connection type validation results 连接类型验证结果 */
  connectionValidation: Map<string, boolean>;
  /** Generated type definitions 生成的类型定义 */
  generatedTypes: string[];
  /** Global imports needed 需要的全局导入 */
  globalImports: Set<string>;
  /** Type errors found 发现的类型错误 */
  errors: TypeError[];
}

/**
 * Type error information
 * 类型错误信息
 */
export interface TypeError {
  /** Error message 错误消息 */
  message: string;
  /** Node ID where error occurred 发生错误的节点ID */
  nodeId?: string;
  /** Connection ID where error occurred 发生错误的连接ID */
  connectionId?: string;
  /** Error severity 错误严重程度 */
  severity: 'error' | 'warning';
}

/**
 * Type resolver for visual graphs
 * 可视化图的类型解析器
 */
export class TypeResolver {
  /** Built-in type mappings 内置类型映射 */
  private readonly builtInTypes: Map<string, PinTypeInfo>;

  /** ECS-specific type mappings ECS特定类型映射 */
  private readonly ecsTypes: Map<string, PinTypeInfo>;

  constructor() {
    this.builtInTypes = new Map();
    this.ecsTypes = new Map();
    this.initializeBuiltInTypes();
    this.initializeECSTypes();
  }

  /**
   * Initialize built-in type mappings
   * 初始化内置类型映射
   */
  private initializeBuiltInTypes(): void {
    // Primitive types 基本类型
    this.builtInTypes.set('any', {
      typeName: 'any',
      nullable: false
    });

    this.builtInTypes.set('number', {
      typeName: 'number',
      nullable: false
    });

    this.builtInTypes.set('string', {
      typeName: 'string',
      nullable: false
    });

    this.builtInTypes.set('boolean', {
      typeName: 'boolean',
      nullable: false
    });

    this.builtInTypes.set('void', {
      typeName: 'void',
      nullable: false
    });

    // Execution flow type 执行流类型
    this.builtInTypes.set('execute', {
      typeName: 'void',
      nullable: false
    });
  }

  /**
   * Initialize ECS-specific type mappings
   * 初始化ECS特定类型映射
   */
  private initializeECSTypes(): void {
    // Entity type 实体类型
    this.ecsTypes.set('entity', {
      typeName: 'Entity',
      nullable: false,
      importSource: '@esengine/nova-ecs'
    });

    // Component type 组件类型
    this.ecsTypes.set('component', {
      typeName: 'any', // Will be resolved to specific component type
      nullable: false
    });

    // Component data type 组件数据类型
    this.ecsTypes.set('component-data', {
      typeName: 'any', // Will be resolved to specific component data type
      nullable: false
    });

    // Query type 查询类型
    this.ecsTypes.set('query', {
      typeName: 'Query<any[]>',
      nullable: false,
      importSource: '@esengine/nova-ecs'
    });

    // Component type constructor 组件类型构造函数
    this.ecsTypes.set('component-type', {
      typeName: 'ComponentConstructor<any>',
      nullable: false,
      importSource: '@esengine/nova-ecs'
    });
  }

  /**
   * Resolve types for entire visual graph
   * 解析整个可视化图的类型
   *
   * @param graph Visual graph to analyze 要分析的可视化图
   * @returns Type resolution result 类型解析结果
   */
  async resolveTypes(graph: VisualGraph): Promise<TypeResolutionResult> {
    const result: TypeResolutionResult = {
      nodeTypes: new Map(),
      connectionValidation: new Map(),
      generatedTypes: [],
      globalImports: new Set(),
      errors: []
    };

    try {
      // Step 1: Resolve node types 步骤1：解析节点类型
      await this.resolveNodeTypes(graph, result);

      // Step 2: Validate connections 步骤2：验证连接
      this.validateConnections(graph, result);

      // Step 3: Infer types from connections 步骤3：从连接推断类型
      this.inferTypesFromConnections(graph, result);

      // Step 4: Generate type definitions 步骤4：生成类型定义
      this.generateTypeDefinitions(result);

    } catch (error) {
      result.errors.push({
        message: error instanceof Error ? error.message : String(error),
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Resolve types for all nodes in the graph
   * 解析图中所有节点的类型
   *
   * @param graph Visual graph 可视化图
   * @param result Type resolution result 类型解析结果
   */
  private async resolveNodeTypes(graph: VisualGraph, result: TypeResolutionResult): Promise<void> {
    const nodes = graph.getAllNodes();

    for (const node of nodes) {
      try {
        const nodeTypeInfo = await this.resolveNodeType(node);
        result.nodeTypes.set(node.id, nodeTypeInfo);

        // Add required imports 添加所需导入
        nodeTypeInfo.requiredImports.forEach(imp => result.globalImports.add(imp));

      } catch (error) {
        result.errors.push({
          message: `Failed to resolve type for node ${node.id}: ${error}`,
          nodeId: node.id,
          severity: 'error'
        });

        // Still add a fallback node type 仍然添加回退节点类型
        const fallbackNodeType: NodeTypeInfo = {
          inputs: new Map(),
          outputs: new Map(),
          requiredImports: new Set()
        };

        // Add fallback types for inputs and outputs
        for (const [inputName] of node.inputs.entries()) {
          fallbackNodeType.inputs.set(inputName, this.builtInTypes.get('any')!);
        }
        for (const outputName of node.outputs.keys()) {
          fallbackNodeType.outputs.set(outputName, this.builtInTypes.get('any')!);
        }

        result.nodeTypes.set(node.id, fallbackNodeType);
      }
    }
  }

  /**
   * Resolve type information for a single node
   * 解析单个节点的类型信息
   *
   * @param node Visual node to analyze 要分析的可视化节点
   * @returns Node type information 节点类型信息
   */
  private async resolveNodeType(node: VisualNode): Promise<NodeTypeInfo> {
    const nodeTypeInfo: NodeTypeInfo = {
      inputs: new Map(),
      outputs: new Map(),
      requiredImports: new Set()
    };

    // Get node metadata if available 如果可用，获取节点元数据
    let metadata: any;
    if ((node as any).getMetadata && typeof (node as any).getMetadata === 'function') {
      metadata = (node as any).getMetadata();
    }

    // Resolve input types 解析输入类型
    for (const [inputName, _value] of node.inputs.entries()) {
      const inputType = this.resolveInputType(node, inputName, metadata);
      nodeTypeInfo.inputs.set(inputName, inputType);

      if (inputType.importSource) {
        nodeTypeInfo.requiredImports.add(`import { ${inputType.typeName} } from '${inputType.importSource}';`);
      }
    }

    // Resolve output types 解析输出类型
    for (const outputName of node.outputs.keys()) {
      const outputType = this.resolveOutputType(node, outputName, metadata);
      nodeTypeInfo.outputs.set(outputName, outputType);

      if (outputType.importSource) {
        nodeTypeInfo.requiredImports.add(`import { ${outputType.typeName} } from '${outputType.importSource}';`);
      }
    }

    return nodeTypeInfo;
  }

  /**
   * Resolve type for node input pin
   * 解析节点输入引脚的类型
   *
   * @param node Visual node 可视化节点
   * @param inputName Input pin name 输入引脚名称
   * @param metadata Node metadata 节点元数据
   * @returns Pin type information 引脚类型信息
   */
  private resolveInputType(node: VisualNode, inputName: string, metadata?: any): PinTypeInfo {
    // Try to get type from metadata first 首先尝试从元数据获取类型
    if (metadata?.inputs) {
      const inputConfig = metadata.inputs.find((inp: any) => inp.label === inputName);
      if (inputConfig?.type) {
        return this.mapTypeString(inputConfig.type);
      }
    }

    // Check for node-specific type mappings 检查节点特定类型映射
    const nodeTypeMapping = this.getNodeSpecificTypeMapping(node.type, inputName, 'input');
    if (nodeTypeMapping) {
      return nodeTypeMapping;
    }

    // Fallback to 'any' type 回退到'any'类型
    return this.builtInTypes.get('any')!;
  }

  /**
   * Resolve type for node output pin
   * 解析节点输出引脚的类型
   *
   * @param node Visual node 可视化节点
   * @param outputName Output pin name 输出引脚名称
   * @param metadata Node metadata 节点元数据
   * @returns Pin type information 引脚类型信息
   */
  private resolveOutputType(node: VisualNode, outputName: string, metadata?: any): PinTypeInfo {
    // Try to get type from metadata first 首先尝试从元数据获取类型
    if (metadata?.outputs) {
      const outputConfig = metadata.outputs.find((out: any) => out.label === outputName);
      if (outputConfig?.type) {
        return this.mapTypeString(outputConfig.type);
      }
    }

    // Check for node-specific type mappings 检查节点特定类型映射
    const nodeTypeMapping = this.getNodeSpecificTypeMapping(node.type, outputName, 'output');
    if (nodeTypeMapping) {
      return nodeTypeMapping;
    }

    // Fallback to 'any' type 回退到'any'类型
    return this.builtInTypes.get('any')!;
  }

  /**
   * Get node-specific type mapping
   * 获取节点特定类型映射
   *
   * @param nodeType Node type 节点类型
   * @param pinName Pin name 引脚名称
   * @param pinType Pin type (input/output) 引脚类型（输入/输出）
   * @returns Pin type information or null 引脚类型信息或null
   */
  private getNodeSpecificTypeMapping(nodeType: string, pinName: string, pinType: 'input' | 'output'): PinTypeInfo | null {
    // ECS node type mappings ECS节点类型映射
    switch (nodeType) {
      case 'world.createEntity':
        if (pinType === 'output' && pinName === 'Entity') {
          return this.ecsTypes.get('entity')!;
        }
        break;

      case 'world.query':
        if (pinType === 'output' && pinName === 'Query') {
          return this.ecsTypes.get('query')!;
        }
        break;

      case 'world.addComponent':
        if (pinType === 'input' && pinName === 'Entity') {
          return this.ecsTypes.get('entity')!;
        }
        if (pinType === 'input' && pinName === 'Component Type') {
          return this.ecsTypes.get('component-type')!;
        }
        break;

      // Math node type mappings 数学节点类型映射
      case 'math.add':
      case 'math.subtract':
      case 'math.multiply':
      case 'math.divide':
        if (pinName === 'A' || pinName === 'B' || pinName === 'Result') {
          return this.builtInTypes.get('number')!;
        }
        break;

      // Math comparison operations 数学比较运算
      case 'math.equals':
      case 'math.notEquals':
      case 'math.greaterThan':
      case 'math.lessThan':
      case 'math.greaterOrEqual':
      case 'math.lessOrEqual':
        if (pinName === 'A' || pinName === 'B') {
          return this.builtInTypes.get('number')!;
        }
        if (pinName === 'Result') {
          return this.builtInTypes.get('boolean')!;
        }
        break;

      // Flow control nodes 流程控制节点
      case 'flow.start':
      case 'flow.sequence':
      case 'flow.branch':
        if (pinType === 'output' && pinName === 'Execute') {
          return this.builtInTypes.get('execute')!;
        }
        break;
    }

    return null;
  }

  /**
   * Map type string to PinTypeInfo
   * 将类型字符串映射到PinTypeInfo
   *
   * @param typeString Type string to map 要映射的类型字符串
   * @returns Pin type information 引脚类型信息
   */
  private mapTypeString(typeString: string): PinTypeInfo {
    // Check built-in types first 首先检查内置类型
    if (this.builtInTypes.has(typeString)) {
      return this.builtInTypes.get(typeString)!;
    }

    // Check ECS types 检查ECS类型
    if (this.ecsTypes.has(typeString)) {
      return this.ecsTypes.get(typeString)!;
    }

    // Handle complex types 处理复杂类型
    if (typeString.includes('[]')) {
      const baseType = typeString.replace('[]', '');
      return {
        typeName: `${baseType}[]`,
        nullable: false,
        elementType: baseType
      };
    }

    // Default to the type string as-is 默认按原样使用类型字符串
    return {
      typeName: typeString,
      nullable: false
    };
  }

  /**
   * Validate all connections in the graph
   * 验证图中的所有连接
   *
   * @param graph Visual graph 可视化图
   * @param result Type resolution result 类型解析结果
   */
  private validateConnections(graph: VisualGraph, result: TypeResolutionResult): void {
    const connections = graph.getAllConnections();

    for (const connection of connections) {
      try {
        const isValid = this.validateConnection(connection, result);
        result.connectionValidation.set(connection.id, isValid);

        if (!isValid) {
          result.errors.push({
            message: `Type mismatch in connection ${connection.id}`,
            connectionId: connection.id,
            severity: 'error'
          });
        }
      } catch (error) {
        result.errors.push({
          message: `Failed to validate connection ${connection.id}: ${error}`,
          connectionId: connection.id,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate a single connection
   * 验证单个连接
   *
   * @param connection Connection to validate 要验证的连接
   * @param result Type resolution result 类型解析结果
   * @returns Whether connection is valid 连接是否有效
   */
  private validateConnection(connection: Connection, result: TypeResolutionResult): boolean {
    const fromNodeType = result.nodeTypes.get(connection.fromNodeId);
    const toNodeType = result.nodeTypes.get(connection.toNodeId);

    if (!fromNodeType || !toNodeType) {
      return false;
    }

    const outputType = fromNodeType.outputs.get(connection.fromPin);
    const inputType = toNodeType.inputs.get(connection.toPin);

    if (!outputType || !inputType) {
      return false;
    }

    // Check type compatibility 检查类型兼容性
    return this.areTypesCompatible(outputType, inputType);
  }

  /**
   * Check if two types are compatible
   * 检查两种类型是否兼容
   *
   * @param fromType Source type 源类型
   * @param toType Target type 目标类型
   * @returns Whether types are compatible 类型是否兼容
   */
  private areTypesCompatible(fromType: PinTypeInfo, toType: PinTypeInfo): boolean {
    // Any type is compatible with everything 任何类型与所有类型兼容
    if (fromType.typeName === 'any' || toType.typeName === 'any') {
      return true;
    }

    // Exact type match 精确类型匹配
    if (fromType.typeName === toType.typeName) {
      return true;
    }

    // Void type (execution flow) is only compatible with void void类型（执行流）只与void兼容
    if (fromType.typeName === 'void' || toType.typeName === 'void') {
      return fromType.typeName === toType.typeName;
    }

    // Number compatibility 数字兼容性
    if (fromType.typeName === 'number' && toType.typeName === 'number') {
      return true;
    }

    // TODO: Add more sophisticated type compatibility rules
    // TODO: 添加更复杂的类型兼容性规则

    return false;
  }

  /**
   * Infer types from connections
   * 从连接推断类型
   *
   * @param graph Visual graph 可视化图
   * @param result Type resolution result 类型解析结果
   */
  private inferTypesFromConnections(graph: VisualGraph, result: TypeResolutionResult): void {
    // This could be expanded to perform more sophisticated type inference
    // For now, we rely on the explicit type mappings
    // 这可以扩展以执行更复杂的类型推断
    // 目前，我们依赖显式类型映射
  }

  /**
   * Generate type definitions
   * 生成类型定义
   *
   * @param result Type resolution result 类型解析结果
   */
  private generateTypeDefinitions(result: TypeResolutionResult): void {
    // Generate custom type definitions if needed
    // For now, we rely on imported types from NovaECS
    // 如果需要，生成自定义类型定义
    // 目前，我们依赖从NovaECS导入的类型
  }
}