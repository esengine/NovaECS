/**
 * Base node compiler interface
 * 基础节点编译器接口
 *
 * Provides the foundation for all node-specific compilers in the visual graph
 * to TypeScript compilation system. Each node type implements this interface
 * to generate appropriate TypeScript code.
 * 为可视化图到TypeScript编译系统中所有节点特定编译器提供基础。
 * 每种节点类型实现此接口以生成适当的TypeScript代码。
 */

import type { VisualNode } from '../../../../src/visual/types';
import type { VisualGraph } from '../../../../src/visual/core/VisualGraph';
import type { TypeResolver, TypeResolutionResult } from '../TypeResolver';

/**
 * Node compilation context
 * 节点编译上下文
 */
export interface NodeCompilationContext {
  /** Source visual graph 源可视化图 */
  graph: VisualGraph;
  /** Type resolution information 类型解析信息 */
  typeInfo: TypeResolutionResult;
  /** Current compilation pass 当前编译阶段 */
  pass: 'main' | 'cleanup' | 'optimization';
  /** Generated variable names 生成的变量名 */
  variableNames: Map<string, string>;
  /** Output variable mappings 输出变量映射 */
  outputVariables: Map<string, string>;
  /** Function name mappings 函数名映射 */
  functionNames: Map<string, string>;
  /** Compilation options 编译选项 */
  options: {
    optimize: boolean;
    includeDebugInfo: boolean;
  };
}

/**
 * Node compilation result
 * 节点编译结果
 */
export interface NodeCompilationResult {
  /** Generated TypeScript code 生成的TypeScript代码 */
  code: string;
  /** Variables this node declares 此节点声明的变量 */
  declaredVariables: string[];
  /** Variables this node uses 此节点使用的变量 */
  usedVariables: string[];
  /** Additional imports needed 需要的额外导入 */
  imports: string[];
  /** Compilation warnings 编译警告 */
  warnings: string[];
}

/**
 * Base class for node compilers
 * 节点编译器基类
 */
export abstract class BaseNodeCompiler {
  protected typeResolver: TypeResolver;

  constructor(typeResolver: TypeResolver) {
    this.typeResolver = typeResolver;
  }

  /**
   * Compile a visual node to TypeScript code
   * 将可视化节点编译为TypeScript代码
   *
   * @param node Node to compile 要编译的节点
   * @param graph Source graph 源图
   * @param typeInfo Type resolution result 类型解析结果
   * @returns Generated TypeScript code 生成的TypeScript代码
   */
  abstract compile(node: VisualNode, graph: VisualGraph, typeInfo: TypeResolutionResult): Promise<string>;

  /**
   * Get required imports for this node type
   * 获取此节点类型所需的导入
   *
   * @param node Node to analyze 要分析的节点
   * @returns Array of import statements 导入语句数组
   */
  abstract getRequiredImports(node: VisualNode): string[];

  /**
   * Compile node with full context information
   * 使用完整上下文信息编译节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Compilation result 编译结果
   */
  async compileWithContext(node: VisualNode, context: NodeCompilationContext): Promise<NodeCompilationResult> {
    const result: NodeCompilationResult = {
      code: '',
      declaredVariables: [],
      usedVariables: [],
      imports: [],
      warnings: []
    };

    try {
      // Generate variable names 生成变量名
      this.generateVariableNames(node, context);

      // Compile node code 编译节点代码
      result.code = await this.compile(node, context.graph, context.typeInfo);

      // Get required imports 获取所需导入
      result.imports = this.getRequiredImports(node);

      // Analyze variable usage 分析变量使用
      this.analyzeVariableUsage(node, context, result);

      // Add debug information if enabled 如果启用则添加调试信息
      if (context.options.includeDebugInfo) {
        result.code = this.addDebugInformation(node, result.code);
      }

    } catch (error) {
      result.warnings.push(`Failed to compile node ${node.id}: ${error}`);
      result.code = `// ERROR: Failed to compile node ${node.id}`;
    }

    return result;
  }

  /**
   * Generate variable names for node inputs/outputs
   * 为节点输入/输出生成变量名
   *
   * @param node Node to process 要处理的节点
   * @param context Compilation context 编译上下文
   */
  protected generateVariableNames(node: VisualNode, context: NodeCompilationContext): void {
    // Generate unique variable names for outputs 为输出生成唯一变量名
    for (const outputName of node.outputs.keys()) {
      const varName = this.generateUniqueVariableName(node.id, outputName, context);
      const key = `${node.id}.${outputName}`;
      context.variableNames.set(key, varName);
    }
  }

  /**
   * Generate unique variable name
   * 生成唯一变量名
   *
   * @param nodeId Node ID 节点ID
   * @param pinName Pin name 引脚名
   * @param context Compilation context 编译上下文
   * @returns Unique variable name 唯一变量名
   */
  protected generateUniqueVariableName(nodeId: string, pinName: string, context: NodeCompilationContext): string {
    // Create base name from pin 从引脚创建基础名称
    const baseName = pinName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

    // Add node prefix for uniqueness 添加节点前缀以确保唯一性
    const nodePrefix = nodeId.replace(/[^a-zA-Z0-9]/g, '');
    let candidateName = `${baseName}_${nodePrefix}`;

    // Ensure uniqueness 确保唯一性
    let counter = 0;
    while (Array.from(context.variableNames.values()).includes(candidateName)) {
      counter++;
      candidateName = `${baseName}_${nodePrefix}_${counter}`;
    }

    return candidateName;
  }

  /**
   * Convert string to camelCase
   * 将字符串转换为camelCase
   *
   * @param str String to convert 要转换的字符串
   * @returns camelCase string camelCase字符串
   */
  protected camelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  }

  /**
   * Analyze variable usage in the node
   * 分析节点中的变量使用
   *
   * @param node Node to analyze 要分析的节点
   * @param context Compilation context 编译上下文
   * @param result Compilation result to update 要更新的编译结果
   */
  protected analyzeVariableUsage(
    node: VisualNode,
    context: NodeCompilationContext,
    result: NodeCompilationResult
  ): void {
    // Find input connections to determine used variables 查找输入连接以确定使用的变量
    const connections = context.graph.getAllConnections();
    const inputConnections = connections.filter(conn => conn.toNodeId === node.id);

    for (const connection of inputConnections) {
      const sourceVarKey = `${connection.fromNodeId}.${connection.fromPin}`;
      const sourceVar = context.variableNames.get(sourceVarKey);
      if (sourceVar) {
        result.usedVariables.push(sourceVar);
      }
    }

    // Add declared variables 添加声明的变量
    for (const outputName of node.outputs.keys()) {
      const varKey = `${node.id}.${outputName}`;
      const varName = context.variableNames.get(varKey);
      if (varName) {
        result.declaredVariables.push(varName);
      }
    }
  }

  /**
   * Add debug information to generated code
   * 为生成的代码添加调试信息
   *
   * @param node Source node 源节点
   * @param code Generated code 生成的代码
   * @returns Code with debug information 带调试信息的代码
   */
  protected addDebugInformation(node: VisualNode, code: string): string {
    const debugComment = `// Node: ${node.type} (${node.id})`;
    return `${debugComment}\n${code}`;
  }

  /**
   * Get input variable name for a node
   * 获取节点的输入变量名
   *
   * @param node Target node 目标节点
   * @param inputName Input pin name 输入引脚名
   * @param context Compilation context 编译上下文
   * @returns Variable name or null 变量名或null
   */
  protected getInputVariable(node: VisualNode, inputName: string, context: NodeCompilationContext): string | null {
    const connections = context.graph.getAllConnections();
    const inputConnection = connections.find(
      conn => conn.toNodeId === node.id && conn.toPin === inputName
    );

    if (!inputConnection) {
      return null;
    }

    const sourceVarKey = `${inputConnection.fromNodeId}.${inputConnection.fromPin}`;
    let varName = context.variableNames.get(sourceVarKey);

    // If not found, generate it on demand
    if (!varName) {
      const sourceNode = context.graph.getNode(inputConnection.fromNodeId);
      if (sourceNode) {
        varName = this.generateUniqueVariableName(inputConnection.fromNodeId, inputConnection.fromPin, context);
        context.variableNames.set(sourceVarKey, varName);
      }
    }

    return varName || null;
  }

  /**
   * Get output variable name for a node
   * 获取节点的输出变量名
   *
   * @param node Source node 源节点
   * @param outputName Output pin name 输出引脚名
   * @param context Compilation context 编译上下文
   * @returns Variable name 变量名
   */
  protected getOutputVariable(node: VisualNode, outputName: string, context: NodeCompilationContext): string {
    const varKey = `${node.id}.${outputName}`;
    const varName = context.variableNames.get(varKey);

    if (!varName) {
      throw new Error(`No variable name generated for output ${outputName} of node ${node.id}`);
    }

    return varName;
  }

  /**
   * Get literal value for input (if not connected)
   * 获取输入的字面值（如果未连接）
   *
   * @param node Node to check 要检查的节点
   * @param inputName Input pin name 输入引脚名
   * @param context Compilation context 编译上下文
   * @returns Literal value or null 字面值或null
   */
  protected getLiteralValue(node: VisualNode, inputName: string, context: NodeCompilationContext): any {
    const connections = context.graph.getAllConnections();
    const hasConnection = connections.some(
      conn => conn.toNodeId === node.id && conn.toPin === inputName
    );

    if (hasConnection) {
      return null; // Connected, no literal value 已连接，没有字面值
    }

    return node.inputs.get(inputName);
  }

  /**
   * Format TypeScript literal value
   * 格式化TypeScript字面值
   *
   * @param value Value to format 要格式化的值
   * @returns Formatted TypeScript literal 格式化的TypeScript字面值
   */
  protected formatLiteralValue(value: any): string {
    if (value === null || value === undefined) {
      return 'undefined';
    }

    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(v => this.formatLiteralValue(v)).join(', ')}]`;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Check if node has connected input
   * 检查节点是否有连接的输入
   *
   * @param node Node to check 要检查的节点
   * @param inputName Input pin name 输入引脚名
   * @param context Compilation context 编译上下文
   * @returns Whether input is connected 输入是否已连接
   */
  protected isInputConnected(node: VisualNode, inputName: string, context: NodeCompilationContext): boolean {
    const connections = context.graph.getAllConnections();
    return connections.some(conn => conn.toNodeId === node.id && conn.toPin === inputName);
  }

  /**
   * Validate node can be compiled
   * 验证节点可以被编译
   *
   * @param node Node to validate 要验证的节点
   * @param context Compilation context 编译上下文
   * @returns Validation result 验证结果
   */
  protected validateNode(node: VisualNode, context: NodeCompilationContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if node type is supported 检查节点类型是否支持
    // This is handled at a higher level, but we can add node-specific validation here
    // 这在更高级别处理，但我们可以在此处添加节点特定验证

    return {
      valid: errors.length === 0,
      errors
    };
  }
}