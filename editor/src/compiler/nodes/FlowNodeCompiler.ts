/**
 * Flow control node compiler for visual graph compilation
 * 流程控制节点编译器，用于可视化图编译
 *
 * Handles compilation of flow control nodes including conditional execution,
 * loops, and execution flow management. Generates structured TypeScript code
 * that maintains proper control flow semantics.
 * 处理流程控制节点的编译，包括条件执行、循环和执行流管理。
 * 生成保持适当控制流语义的结构化TypeScript代码。
 */

import type { VisualNode } from '../../../../src/visual/types';
import type { VisualGraph } from '../../../../src/visual/core/VisualGraph';
import { BaseNodeCompiler, type NodeCompilationContext } from './BaseNodeCompiler';
import type { TypeResolver, TypeResolutionResult } from '../TypeResolver';

/**
 * Flow control node types
 * 流程控制节点类型
 */
type FlowNodeType = 'start' | 'if' | 'loop' | 'while' | 'for' | 'break' | 'continue' | 'return' | 'sequence' | 'parallel';

/**
 * Compiler for flow control visual nodes
 * 流程控制可视化节点的编译器
 */
export class FlowNodeCompiler extends BaseNodeCompiler {
  constructor(typeResolver: TypeResolver) {
    super(typeResolver);
  }

  /**
   * Compile flow control node to TypeScript code
   * 将流程控制节点编译为TypeScript代码
   *
   * @param node Node to compile 要编译的节点
   * @param graph Source graph 源图
   * @param typeInfo Type resolution result 类型解析结果
   * @returns Generated TypeScript code 生成的TypeScript代码
   */
  async compile(node: VisualNode, graph: VisualGraph, typeInfo: TypeResolutionResult): Promise<string> {
    // Create a compilation context 创建编译上下文
    const context: NodeCompilationContext = {
      graph,
      typeInfo,
      pass: 'main',
      variableNames: new Map(),
      outputVariables: new Map(),
      functionNames: new Map(),
      options: {
        optimize: true,
        includeDebugInfo: false
      }
    };

    // Generate variable names 生成变量名
    this.generateVariableNames(node, context);

    // Compile based on node type 根据节点类型编译
    switch (node.type) {
      case 'flow.start':
        return this.compileStartNode(node, context);

      case 'flow.if':
        return this.compileIfNode(node, context);

      case 'flow.loop':
        return this.compileLoopNode(node, context);

      case 'flow.while':
        return this.compileWhileNode(node, context);

      case 'flow.for':
        return this.compileForNode(node, context);

      case 'flow.break':
        return this.compileBreakNode(node, context);

      case 'flow.continue':
        return this.compileContinueNode(node, context);

      case 'flow.return':
        return this.compileReturnNode(node, context);

      case 'flow.sequence':
        return this.compileSequenceNode(node, context);

      case 'flow.parallel':
        return this.compileParallelNode(node, context);

      default:
        throw new Error(`Unsupported flow control node type: ${node.type}`);
    }
  }

  /**
   * Get required imports for flow control nodes
   * 获取流程控制节点所需的导入
   *
   * @param node Node to analyze 要分析的节点
   * @returns Array of import statements 导入语句数组
   */
  getRequiredImports(node: VisualNode): string[] {
    // Flow control nodes use built-in JavaScript/TypeScript control structures
    // No additional imports needed
    // 流程控制节点使用内置的JavaScript/TypeScript控制结构
    // 不需要额外导入
    return [];
  }

  /**
   * Compile start node (entry point)
   * 编译开始节点（入口点）
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileStartNode(node: VisualNode, context: NodeCompilationContext): string {
    // Start node is typically just a marker for execution flow
    // The actual execution starts from the connected nodes
    // 开始节点通常只是执行流的标记
    // 实际执行从连接的节点开始
    return '// System execution starts here 系统执行从此开始';
  }

  /**
   * Compile conditional if node
   * 编译条件if节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileIfNode(node: VisualNode, context: NodeCompilationContext): string {
    // Get condition input 获取条件输入
    const conditionVar = this.getInputVariable(node, 'Condition', context);
    const conditionLiteral = this.getLiteralValue(node, 'Condition', context);

    // Resolve condition 解析条件
    let condition: string;
    if (conditionVar) {
      condition = conditionVar;
    } else if (conditionLiteral !== null && conditionLiteral !== undefined) {
      condition = this.formatLiteralValue(conditionLiteral);
    } else {
      condition = 'true'; // Default to true 默认为true
    }

    // Note: In a full implementation, we would need to handle the connected
    // execution paths for the true and false branches
    // 注意：在完整实现中，我们需要处理真分支和假分支的连接执行路径
    const lines: string[] = [];
    lines.push(`if (${condition}) {`);
    lines.push('  // True branch execution 真分支执行');
    lines.push('  // TODO: Execute connected nodes in true branch');
    lines.push('} else {');
    lines.push('  // False branch execution 假分支执行');
    lines.push('  // TODO: Execute connected nodes in false branch');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Compile loop node (fixed iteration count)
   * 编译循环节点（固定迭代次数）
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileLoopNode(node: VisualNode, context: NodeCompilationContext): string {
    const indexVar = this.getOutputVariable(node, 'Index', context);

    // Get iteration count 获取迭代次数
    const countVar = this.getInputVariable(node, 'Count', context);
    const countLiteral = this.getLiteralValue(node, 'Count', context);

    // Resolve count 解析次数
    let count: string;
    if (countVar) {
      count = countVar;
    } else if (countLiteral !== null && countLiteral !== undefined) {
      count = this.formatLiteralValue(countLiteral);
    } else {
      count = '1'; // Default to 1 iteration 默认1次迭代
    }

    const lines: string[] = [];
    lines.push(`for (let ${indexVar} = 0; ${indexVar} < ${count}; ${indexVar}++) {`);
    lines.push('  // Loop body execution 循环体执行');
    lines.push('  // TODO: Execute connected nodes in loop body');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Compile while loop node
   * 编译while循环节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileWhileNode(node: VisualNode, context: NodeCompilationContext): string {
    // Get condition input 获取条件输入
    const conditionVar = this.getInputVariable(node, 'Condition', context);
    const conditionLiteral = this.getLiteralValue(node, 'Condition', context);

    // Resolve condition 解析条件
    let condition: string;
    if (conditionVar) {
      condition = conditionVar;
    } else if (conditionLiteral !== null && conditionLiteral !== undefined) {
      condition = this.formatLiteralValue(conditionLiteral);
    } else {
      condition = 'false'; // Default to false to prevent infinite loop 默认为false以防止无限循环
    }

    const lines: string[] = [];
    lines.push(`while (${condition}) {`);
    lines.push('  // While loop body execution while循环体执行');
    lines.push('  // TODO: Execute connected nodes in while loop body');
    lines.push('  // WARNING: Ensure loop condition eventually becomes false');
    lines.push('  // 警告：确保循环条件最终变为false');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Compile for loop node (with start, end, step)
   * 编译for循环节点（带开始、结束、步长）
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileForNode(node: VisualNode, context: NodeCompilationContext): string {
    // Create index variable name manually since it's used internally 手动创建索引变量名，因为它是内部使用的
    const indexVar = `index_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Get loop parameters 获取循环参数
    const startVar = this.getInputVariable(node, 'Start', context);
    const startLiteral = this.getLiteralValue(node, 'Start', context);

    const endVar = this.getInputVariable(node, 'End', context);
    const endLiteral = this.getLiteralValue(node, 'End', context);

    const stepVar = this.getInputVariable(node, 'Step', context);
    const stepLiteral = this.getLiteralValue(node, 'Step', context);

    // Resolve parameters 解析参数
    const start = startVar || (startLiteral !== null && startLiteral !== undefined ? this.formatLiteralValue(startLiteral) : '0');
    const end = endVar || (endLiteral !== null && endLiteral !== undefined ? this.formatLiteralValue(endLiteral) : '10');
    const step = stepVar || (stepLiteral !== null && stepLiteral !== undefined ? this.formatLiteralValue(stepLiteral) : '1');

    const lines: string[] = [];
    lines.push(`for (let ${indexVar} = ${start}; ${indexVar} < ${end}; ${indexVar} += ${step}) {`);
    lines.push('  // For loop body execution for循环体执行');
    lines.push('  // TODO: Execute connected nodes in for loop body');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Compile break node
   * 编译break节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileBreakNode(node: VisualNode, context: NodeCompilationContext): string {
    return 'break; // Exit current loop 退出当前循环';
  }

  /**
   * Compile continue node
   * 编译continue节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileContinueNode(node: VisualNode, context: NodeCompilationContext): string {
    return 'continue; // Continue to next iteration 继续下一次迭代';
  }

  /**
   * Compile return node
   * 编译return节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileReturnNode(node: VisualNode, context: NodeCompilationContext): string {
    // Get optional return value 获取可选返回值
    const valueVar = this.getInputVariable(node, 'Value', context);
    const valueLiteral = this.getLiteralValue(node, 'Value', context);

    let returnValue = '';
    if (valueVar) {
      returnValue = ` ${valueVar}`;
    } else if (valueLiteral !== null && valueLiteral !== undefined) {
      returnValue = ` ${this.formatLiteralValue(valueLiteral)}`;
    }

    return `return${returnValue}; // Early return from system 从系统提前返回`;
  }

  /**
   * Compile sequence node (execute nodes in order)
   * 编译序列节点（按顺序执行节点）
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileSequenceNode(node: VisualNode, context: NodeCompilationContext): string {
    const lines: string[] = [];
    lines.push('// Sequential execution 顺序执行');
    lines.push('// TODO: Execute connected nodes in sequence');
    lines.push('// Each node waits for the previous to complete');
    lines.push('// 每个节点等待前一个节点完成');

    // In a full implementation, we would analyze the connected output pins
    // and generate code to execute them in order
    // 在完整实现中，我们会分析连接的输出引脚并生成按顺序执行它们的代码

    return lines.join('\n');
  }

  /**
   * Compile parallel node (execute nodes concurrently)
   * 编译并行节点（并发执行节点）
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileParallelNode(node: VisualNode, context: NodeCompilationContext): string {
    const lines: string[] = [];
    lines.push('// Parallel execution 并行执行');
    lines.push('// NOTE: True parallelism requires async/await or Promise.all');
    lines.push('// 注意：真正的并行需要async/await或Promise.all');
    lines.push('// For ECS systems, this typically means independent operations');
    lines.push('// 对于ECS系统，这通常意味着独立操作');

    // In a game engine context, parallel execution might mean:
    // - Operations that don't depend on each other
    // - Different systems running in the same frame
    // - Batch operations on different entity sets
    // 在游戏引擎上下文中，并行执行可能意味着：
    // - 不相互依赖的操作
    // - 在同一帧中运行的不同系统
    // - 对不同实体集的批量操作

    lines.push('// TODO: Execute connected nodes independently');

    return lines.join('\n');
  }

  /**
   * Analyze flow connections to determine execution order
   * 分析流连接以确定执行顺序
   *
   * @param node Flow control node 流程控制节点
   * @param context Compilation context 编译上下文
   * @returns Connected execution paths 连接的执行路径
   */
  private analyzeFlowConnections(node: VisualNode, context: NodeCompilationContext): {
    trueOutput?: string[];
    falseOutput?: string[];
    loopBody?: string[];
    nextStep?: string[];
  } {
    const connections = context.graph.getAllConnections();
    const result: ReturnType<typeof this.analyzeFlowConnections> = {};

    // Find outgoing execution connections 查找传出执行连接
    const outgoingConnections = connections.filter(conn =>
      conn.fromNodeId === node.id
    );

    // Group by output pin type 按输出引脚类型分组
    for (const connection of outgoingConnections) {
      const outputPin = connection.fromPin;

      // Find the target nodes for each output type 为每种输出类型查找目标节点
      const targetNode = context.graph.getNode(connection.toNodeId);
      if (targetNode) {
        switch (outputPin) {
          case 'True':
            if (!result.trueOutput) result.trueOutput = [];
            result.trueOutput.push(targetNode.id);
            break;
          case 'False':
            if (!result.falseOutput) result.falseOutput = [];
            result.falseOutput.push(targetNode.id);
            break;
          case 'Loop Body':
            if (!result.loopBody) result.loopBody = [];
            result.loopBody.push(targetNode.id);
            break;
          case 'Then':
          case 'Next':
            if (!result.nextStep) result.nextStep = [];
            result.nextStep.push(targetNode.id);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Generate execution code for connected nodes
   * 为连接的节点生成执行代码
   *
   * @param nodeIds Node IDs to execute 要执行的节点ID
   * @param context Compilation context 编译上下文
   * @param indent Indentation level 缩进级别
   * @returns Generated execution code 生成的执行代码
   */
  private generateExecutionCode(nodeIds: string[], context: NodeCompilationContext, indent: number = 1): string {
    const lines: string[] = [];
    const indentStr = '  '.repeat(indent);

    for (const nodeId of nodeIds) {
      const node = context.graph.getNode(nodeId);
      if (node) {
        lines.push(`${indentStr}// Execute node: ${node.type} (${nodeId})`);
        lines.push(`${indentStr}// TODO: Generate execution code for ${node.type}`);
      }
    }

    return lines.join('\n');
  }
}