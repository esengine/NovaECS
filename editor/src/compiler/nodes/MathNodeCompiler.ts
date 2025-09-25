/**
 * Math node compiler for visual graph compilation
 * 数学节点编译器，用于可视化图编译
 *
 * Handles compilation of mathematical operation nodes including basic arithmetic,
 * comparison operations, and mathematical functions. Generates optimized TypeScript
 * code with proper type handling and constant folding where possible.
 * 处理数学运算节点的编译，包括基本算术、比较运算和数学函数。
 * 生成优化的TypeScript代码，具有适当的类型处理和可能的常量折叠。
 */

import type { VisualNode } from '../../../../src/visual/types';
import type { VisualGraph } from '../../../../src/visual/core/VisualGraph';
import { BaseNodeCompiler, type NodeCompilationContext, type NodeCompilationResult } from './BaseNodeCompiler';
import type { TypeResolver, TypeResolutionResult } from '../TypeResolver';

/**
 * Mathematical operation types
 * 数学运算类型
 */
type MathOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power';
type ComparisonOperation = 'equals' | 'notEquals' | 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual';
type UnaryOperation = 'negate' | 'absolute' | 'sqrt' | 'sin' | 'cos' | 'tan' | 'floor' | 'ceil' | 'round';

/**
 * Compiler for mathematical visual nodes
 * 数学可视化节点的编译器
 */
export class MathNodeCompiler extends BaseNodeCompiler {
  constructor(typeResolver: TypeResolver) {
    super(typeResolver);
  }

  /**
   * Compile math node to TypeScript code
   * 将数学节点编译为TypeScript代码
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
        optimize: false, // Disable optimization for unit testing
        includeDebugInfo: false
      }
    };

    // Generate variable names 生成变量名
    this.generateVariableNames(node, context);

    // Compile based on node type 根据节点类型编译
    switch (node.type) {
      case 'math.add':
        return this.compileBinaryOperation(node, context, 'add');

      case 'math.subtract':
        return this.compileBinaryOperation(node, context, 'subtract');

      case 'math.multiply':
        return this.compileBinaryOperation(node, context, 'multiply');

      case 'math.divide':
        return this.compileBinaryOperation(node, context, 'divide');

      case 'math.modulo':
        return this.compileBinaryOperation(node, context, 'modulo');

      case 'math.power':
        return this.compileBinaryOperation(node, context, 'power');

      case 'math.equals':
        return this.compileComparisonOperation(node, context, 'equals');

      case 'math.notEquals':
        return this.compileComparisonOperation(node, context, 'notEquals');

      case 'math.lessThan':
        return this.compileComparisonOperation(node, context, 'lessThan');

      case 'math.lessThanOrEqual':
        return this.compileComparisonOperation(node, context, 'lessThanOrEqual');

      case 'math.greaterThan':
        return this.compileComparisonOperation(node, context, 'greaterThan');

      case 'math.greaterThanOrEqual':
        return this.compileComparisonOperation(node, context, 'greaterThanOrEqual');

      case 'math.negate':
        return this.compileUnaryOperation(node, context, 'negate');

      case 'math.absolute':
        return this.compileUnaryOperation(node, context, 'absolute');

      case 'math.sqrt':
        return this.compileUnaryOperation(node, context, 'sqrt');

      case 'math.sin':
        return this.compileUnaryOperation(node, context, 'sin');

      case 'math.cos':
        return this.compileUnaryOperation(node, context, 'cos');

      case 'math.tan':
        return this.compileUnaryOperation(node, context, 'tan');

      case 'math.floor':
        return this.compileUnaryOperation(node, context, 'floor');

      case 'math.ceil':
        return this.compileUnaryOperation(node, context, 'ceil');

      case 'math.round':
        return this.compileUnaryOperation(node, context, 'round');

      case 'math.min':
        return this.compileMinMaxOperation(node, context, 'min');

      case 'math.max':
        return this.compileMinMaxOperation(node, context, 'max');

      case 'math.clamp':
        return this.compileClampOperation(node, context);

      case 'math.lerp':
        return this.compileLerpOperation(node, context);

      case 'math.random':
        return this.compileRandomOperation(node, context);

      case 'math.constant':
        return this.compileConstantOperation(node, context);

      // Logical operations 逻辑运算
      case 'math.and':
        return this.compileLogicalOperation(node, context, 'and');

      case 'math.or':
        return this.compileLogicalOperation(node, context, 'or');

      case 'math.not':
        return this.compileLogicalOperation(node, context, 'not');

      // Math constants 数学常量
      case 'math.pi':
        return this.compileMathConstant(node, context, 'pi');

      case 'math.e':
        return this.compileMathConstant(node, context, 'e');

      // Alias for absolute 绝对值别名
      case 'math.abs':
        return this.compileUnaryOperation(node, context, 'absolute');

      default:
        throw new Error(`Unsupported math node type: ${node.type}`);
    }
  }

  /**
   * Compile math node with full context information
   * 使用完整上下文信息编译数学节点
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
      // Use the context directly instead of creating a new one
      result.code = await this.compileWithGlobalContext(node, context);

      // Get required imports
      result.imports = this.getRequiredImports(node);

      // Analyze variable usage with the global context
      this.analyzeVariableUsage(node, context, result);

      // Add debug information if enabled
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
   * Compile math node using global context (preserves variable mappings)
   * 使用全局上下文编译数学节点（保留变量映射）
   */
  private async compileWithGlobalContext(node: VisualNode, context: NodeCompilationContext): Promise<string> {
    // Compile based on node type using the provided context
    switch (node.type) {
      // Constant nodes 常量节点
      case 'math.constant':
        return this.compileConstantOperation(node, context);

      // Binary arithmetic operations 二元算术运算
      case 'math.add':
        return this.compileBinaryOperation(node, context, 'add');

      case 'math.subtract':
        return this.compileBinaryOperation(node, context, 'subtract');

      case 'math.multiply':
        return this.compileBinaryOperation(node, context, 'multiply');

      case 'math.divide':
        return this.compileBinaryOperation(node, context, 'divide');

      case 'math.modulo':
        return this.compileBinaryOperation(node, context, 'modulo');

      case 'math.power':
        return this.compileBinaryOperation(node, context, 'power');

      // Comparison operations 比较运算
      case 'math.equals':
        return this.compileComparisonOperation(node, context, 'equals');

      case 'math.notEquals':
        return this.compileComparisonOperation(node, context, 'notEquals');

      case 'math.lessThan':
        return this.compileComparisonOperation(node, context, 'lessThan');

      case 'math.lessThanOrEqual':
        return this.compileComparisonOperation(node, context, 'lessThanOrEqual');

      case 'math.greaterThan':
        return this.compileComparisonOperation(node, context, 'greaterThan');

      case 'math.greaterThanOrEqual':
        return this.compileComparisonOperation(node, context, 'greaterThanOrEqual');

      case 'math.negate':
        return this.compileUnaryOperation(node, context, 'negate');

      case 'math.absolute':
        return this.compileUnaryOperation(node, context, 'absolute');

      case 'math.sqrt':
        return this.compileUnaryOperation(node, context, 'sqrt');

      case 'math.sin':
        return this.compileUnaryOperation(node, context, 'sin');

      case 'math.cos':
        return this.compileUnaryOperation(node, context, 'cos');

      case 'math.tan':
        return this.compileUnaryOperation(node, context, 'tan');

      case 'math.floor':
        return this.compileUnaryOperation(node, context, 'floor');

      case 'math.ceil':
        return this.compileUnaryOperation(node, context, 'ceil');

      case 'math.round':
        return this.compileUnaryOperation(node, context, 'round');

      case 'math.min':
        return this.compileMinMaxOperation(node, context, 'min');

      case 'math.max':
        return this.compileMinMaxOperation(node, context, 'max');

      case 'math.clamp':
        return this.compileClampOperation(node, context);

      case 'math.lerp':
        return this.compileLerpOperation(node, context);

      case 'math.random':
        return this.compileRandomOperation(node, context);

      // Logic operations 逻辑运算
      case 'math.and':
        return this.compileLogicalOperation(node, context, 'and');

      case 'math.or':
        return this.compileLogicalOperation(node, context, 'or');

      case 'math.not':
        return this.compileLogicalOperation(node, context, 'not');

      // Math constants 数学常量
      case 'math.pi':
        return this.compileMathConstant(node, context, 'pi');

      case 'math.e':
        return this.compileMathConstant(node, context, 'e');

      // Alias for absolute 绝对值别名
      case 'math.abs':
        return this.compileUnaryOperation(node, context, 'absolute');

      default:
        throw new Error(`Unsupported math node type: ${node.type}`);
    }
  }

  /**
   * Get required imports for math nodes
   * 获取数学节点所需的导入
   *
   * @param node Node to analyze 要分析的节点
   * @returns Array of import statements 导入语句数组
   */
  getRequiredImports(node: VisualNode): string[] {
    // Math operations use built-in JavaScript/TypeScript features
    // No additional imports needed for basic math operations
    // 数学运算使用内置的JavaScript/TypeScript功能
    // 基本数学运算不需要额外导入
    return [];
  }

  /**
   * Compile binary mathematical operation
   * 编译二元数学运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param operation Math operation type 数学运算类型
   * @returns Generated code 生成的代码
   */
  private compileBinaryOperation(node: VisualNode, context: NodeCompilationContext, operation: MathOperation): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input values 获取输入值
    const aVar = this.getInputVariable(node, 'A', context);
    const aLiteral = this.getLiteralValue(node, 'A', context);

    const bVar = this.getInputVariable(node, 'B', context);
    const bLiteral = this.getLiteralValue(node, 'B', context);

    // Resolve operand A 解析操作数A
    let operandA: string;
    if (aVar) {
      operandA = aVar;
    } else if (aLiteral !== null && aLiteral !== undefined) {
      operandA = this.formatLiteralValue(aLiteral);
    } else {
      operandA = '0'; // Default to 0 默认为0
    }

    // Resolve operand B 解析操作数B
    let operandB: string;
    if (bVar) {
      operandB = bVar;
    } else if (bLiteral !== null && bLiteral !== undefined) {
      operandB = this.formatLiteralValue(bLiteral);
    } else {
      operandB = '0'; // Default to 0 默认为0
    }

    // Check for constant folding optimization 检查常量折叠优化
    if (context.options.optimize && aLiteral !== null && bLiteral !== null &&
        typeof aLiteral === 'number' && typeof bLiteral === 'number') {
      const result = this.evaluateConstantOperation(aLiteral, bLiteral, operation);
      return `const ${resultVar} = ${result};`;
    }

    // Generate operation code 生成运算代码
    const operatorMap: Record<MathOperation, string> = {
      add: '+',
      subtract: '-',
      multiply: '*',
      divide: '/',
      modulo: '%',
      power: '**'
    };

    const operator = operatorMap[operation];
    if (!operator) {
      throw new Error(`Unknown binary operation: ${operation}`);
    }

    // Special handling for power operation 为power运算特殊处理
    if (operation === 'power') {
      return `const ${resultVar} = Math.pow(${operandA}, ${operandB});`;
    }

    // Add division by zero check for division operations 为除法运算添加除零检查
    if (operation === 'divide' && context.options.optimize) {
      return `const ${resultVar} = ${operandB} !== 0 ? ${operandA} ${operator} ${operandB} : NaN;`;
    }

    return `const ${resultVar} = ${operandA} ${operator} ${operandB};`;
  }

  /**
   * Compile comparison operation
   * 编译比较运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param operation Comparison operation type 比较运算类型
   * @returns Generated code 生成的代码
   */
  private compileComparisonOperation(node: VisualNode, context: NodeCompilationContext, operation: ComparisonOperation): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input values 获取输入值
    const aVar = this.getInputVariable(node, 'A', context);
    const aLiteral = this.getLiteralValue(node, 'A', context);

    const bVar = this.getInputVariable(node, 'B', context);
    const bLiteral = this.getLiteralValue(node, 'B', context);

    // Resolve operand A 解析操作数A
    let operandA: string;
    if (aVar) {
      operandA = aVar;
    } else if (aLiteral !== null && aLiteral !== undefined) {
      operandA = this.formatLiteralValue(aLiteral);
    } else {
      operandA = '0';
    }

    // Resolve operand B 解析操作数B
    let operandB: string;
    if (bVar) {
      operandB = bVar;
    } else if (bLiteral !== null && bLiteral !== undefined) {
      operandB = this.formatLiteralValue(bLiteral);
    } else {
      operandB = '0';
    }

    // Generate comparison code 生成比较代码
    const operatorMap: Record<ComparisonOperation, string> = {
      equals: '===',
      notEquals: '!==',
      lessThan: '<',
      lessThanOrEqual: '<=',
      greaterThan: '>',
      greaterThanOrEqual: '>='
    };

    const operator = operatorMap[operation];
    return `const ${resultVar} = ${operandA} ${operator} ${operandB};`;
  }

  /**
   * Compile unary mathematical operation
   * 编译一元数学运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param operation Unary operation type 一元运算类型
   * @returns Generated code 生成的代码
   */
  private compileUnaryOperation(node: VisualNode, context: NodeCompilationContext, operation: UnaryOperation): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input value 获取输入值 - try both 'X' and 'Input' parameter names
    let inputVar = this.getInputVariable(node, 'X', context);
    let inputLiteral = this.getLiteralValue(node, 'X', context);

    // Fallback to 'Input' if 'X' not found
    if (!inputVar && (inputLiteral === null || inputLiteral === undefined)) {
      inputVar = this.getInputVariable(node, 'Input', context);
      inputLiteral = this.getLiteralValue(node, 'Input', context);
    }

    // Resolve operand 解析操作数
    let operand: string;
    if (inputVar) {
      operand = inputVar;
    } else if (inputLiteral !== null && inputLiteral !== undefined) {
      operand = this.formatLiteralValue(inputLiteral);
    } else {
      operand = '0';
    }

    // Check for constant folding optimization 检查常量折叠优化
    if (context.options.optimize && inputLiteral !== null && typeof inputLiteral === 'number') {
      const result = this.evaluateConstantUnaryOperation(inputLiteral, operation);
      return `const ${resultVar} = ${result};`;
    }

    // Generate operation code 生成运算代码
    switch (operation) {
      case 'negate':
        return `const ${resultVar} = -${operand};`;

      case 'absolute':
        return `const ${resultVar} = Math.abs(${operand});`;

      case 'sqrt':
        return `const ${resultVar} = Math.sqrt(${operand});`;

      case 'sin':
        return `const ${resultVar} = Math.sin(${operand});`;

      case 'cos':
        return `const ${resultVar} = Math.cos(${operand});`;

      case 'tan':
        return `const ${resultVar} = Math.tan(${operand});`;

      case 'floor':
        return `const ${resultVar} = Math.floor(${operand});`;

      case 'ceil':
        return `const ${resultVar} = Math.ceil(${operand});`;

      case 'round':
        return `const ${resultVar} = Math.round(${operand});`;

      default:
        throw new Error(`Unknown unary operation: ${operation}`);
    }
  }

  /**
   * Compile min/max operation
   * 编译最小值/最大值运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param operation 'min' or 'max' 'min'或'max'
   * @returns Generated code 生成的代码
   */
  private compileMinMaxOperation(node: VisualNode, context: NodeCompilationContext, operation: 'min' | 'max'): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input values 获取输入值
    const aVar = this.getInputVariable(node, 'A', context);
    const aLiteral = this.getLiteralValue(node, 'A', context);

    const bVar = this.getInputVariable(node, 'B', context);
    const bLiteral = this.getLiteralValue(node, 'B', context);

    // Resolve operands 解析操作数
    const operands: string[] = [];

    if (aVar) {
      operands.push(aVar);
    } else if (aLiteral !== null && aLiteral !== undefined) {
      operands.push(this.formatLiteralValue(aLiteral));
    }

    if (bVar) {
      operands.push(bVar);
    } else if (bLiteral !== null && bLiteral !== undefined) {
      operands.push(this.formatLiteralValue(bLiteral));
    }

    if (operands.length === 0) {
      operands.push('0');
    }

    return `const ${resultVar} = Math.${operation}(${operands.join(', ')});`;
  }

  /**
   * Compile clamp operation
   * 编译夹紧运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileClampOperation(node: VisualNode, context: NodeCompilationContext): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input values 获取输入值
    const valueVar = this.getInputVariable(node, 'Value', context);
    const valueLiteral = this.getLiteralValue(node, 'Value', context);

    const minVar = this.getInputVariable(node, 'Min', context);
    const minLiteral = this.getLiteralValue(node, 'Min', context);

    const maxVar = this.getInputVariable(node, 'Max', context);
    const maxLiteral = this.getLiteralValue(node, 'Max', context);

    // Resolve values 解析值
    let value = valueVar || (valueLiteral !== null ? this.formatLiteralValue(valueLiteral) : '0');
    let minValue = minVar || (minLiteral !== null ? this.formatLiteralValue(minLiteral) : '0');
    let maxValue = maxVar || (maxLiteral !== null ? this.formatLiteralValue(maxLiteral) : '1');

    return `const ${resultVar} = Math.min(Math.max(${value}, ${minValue}), ${maxValue});`;
  }

  /**
   * Compile linear interpolation operation
   * 编译线性插值运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileLerpOperation(node: VisualNode, context: NodeCompilationContext): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get input values 获取输入值
    const aVar = this.getInputVariable(node, 'A', context);
    const aLiteral = this.getLiteralValue(node, 'A', context);

    const bVar = this.getInputVariable(node, 'B', context);
    const bLiteral = this.getLiteralValue(node, 'B', context);

    const tVar = this.getInputVariable(node, 'T', context);
    const tLiteral = this.getLiteralValue(node, 'T', context);

    // Resolve values 解析值
    let a = aVar || (aLiteral !== null ? this.formatLiteralValue(aLiteral) : '0');
    let b = bVar || (bLiteral !== null ? this.formatLiteralValue(bLiteral) : '1');
    let t = tVar || (tLiteral !== null ? this.formatLiteralValue(tLiteral) : '0.5');

    return `const ${resultVar} = ${a} + (${b} - ${a}) * ${t};`;
  }

  /**
   * Compile random number operation
   * 编译随机数运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileRandomOperation(node: VisualNode, context: NodeCompilationContext): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    // Get optional min/max values 获取可选的最小值/最大值
    const minVar = this.getInputVariable(node, 'Min', context);
    const minLiteral = this.getLiteralValue(node, 'Min', context);

    const maxVar = this.getInputVariable(node, 'Max', context);
    const maxLiteral = this.getLiteralValue(node, 'Max', context);

    // If no min/max specified, return 0-1 range 如果没有指定最小值/最大值，返回0-1范围
    if (!minVar && !maxVar && minLiteral === null && maxLiteral === null) {
      return `const ${resultVar} = Math.random();`;
    }

    // Calculate range 计算范围
    let minValue = minVar || (minLiteral !== null ? this.formatLiteralValue(minLiteral) : '0');
    let maxValue = maxVar || (maxLiteral !== null ? this.formatLiteralValue(maxLiteral) : '1');

    return `const ${resultVar} = ${minValue} + Math.random() * (${maxValue} - ${minValue});`;
  }

  /**
   * Compile constant value operation
   * 编译常量值运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileConstantOperation(node: VisualNode, context: NodeCompilationContext): string {
    const resultVar = this.getOutputVariable(node, 'Value', context);

    const valueLiteral = this.getLiteralValue(node, 'Value', context);
    const value = valueLiteral !== null ? this.formatLiteralValue(valueLiteral) : '0';

    return `const ${resultVar} = ${value};`;
  }

  /**
   * Evaluate constant binary operation for optimization
   * 为优化计算常量二元运算
   *
   * @param a First operand 第一个操作数
   * @param b Second operand 第二个操作数
   * @param operation Operation type 运算类型
   * @returns Computed result 计算结果
   */
  private evaluateConstantOperation(a: number, b: number, operation: MathOperation): number {
    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        return b !== 0 ? a / b : NaN;
      case 'modulo':
        return a % b;
      case 'power':
        return Math.pow(a, b);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Evaluate constant unary operation for optimization
   * 为优化计算常量一元运算
   *
   * @param input Input value 输入值
   * @param operation Operation type 运算类型
   * @returns Computed result 计算结果
   */
  private evaluateConstantUnaryOperation(input: number, operation: UnaryOperation): number {
    switch (operation) {
      case 'negate':
        return -input;
      case 'absolute':
        return Math.abs(input);
      case 'sqrt':
        return Math.sqrt(input);
      case 'sin':
        return Math.sin(input);
      case 'cos':
        return Math.cos(input);
      case 'tan':
        return Math.tan(input);
      case 'floor':
        return Math.floor(input);
      case 'ceil':
        return Math.ceil(input);
      case 'round':
        return Math.round(input);
      default:
        throw new Error(`Unknown unary operation: ${operation}`);
    }
  }

  /**
   * Compile logical operation
   * 编译逻辑运算
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param operation Logical operation type 逻辑运算类型
   * @returns Generated code 生成的代码
   */
  private compileLogicalOperation(node: VisualNode, context: NodeCompilationContext, operation: 'and' | 'or' | 'not'): string {
    const resultVar = this.getOutputVariable(node, 'Result', context);

    if (operation === 'not') {
      // Unary NOT operation 一元NOT运算 - try 'A' parameter first, then 'Input'
      let inputVar = this.getInputVariable(node, 'A', context);
      let inputLiteral = this.getLiteralValue(node, 'A', context);

      // Fallback to 'Input' if 'A' not found
      if (!inputVar && (inputLiteral === null || inputLiteral === undefined)) {
        inputVar = this.getInputVariable(node, 'Input', context);
        inputLiteral = this.getLiteralValue(node, 'Input', context);
      }

      let operand: string;
      if (inputVar) {
        operand = inputVar;
      } else if (inputLiteral !== null && inputLiteral !== undefined) {
        operand = this.formatLiteralValue(inputLiteral);
      } else {
        operand = 'false';
      }

      // Check for constant folding optimization 检查常量折叠优化
      if (context.options.optimize && inputLiteral !== null && typeof inputLiteral === 'boolean') {
        const result = !inputLiteral;
        return `const ${resultVar} = ${result};`;
      }

      return `const ${resultVar} = !${operand};`;
    } else {
      // Binary AND/OR operations 二元AND/OR运算
      const inputVarA = this.getInputVariable(node, 'A', context);
      const inputLiteralA = this.getLiteralValue(node, 'A', context);
      const inputVarB = this.getInputVariable(node, 'B', context);
      const inputLiteralB = this.getLiteralValue(node, 'B', context);

      // Resolve operands 解析操作数
      let operandA: string;
      let operandB: string;

      if (inputVarA) {
        operandA = inputVarA;
      } else if (inputLiteralA !== null && inputLiteralA !== undefined) {
        operandA = this.formatLiteralValue(inputLiteralA);
      } else {
        operandA = 'false';
      }

      if (inputVarB) {
        operandB = inputVarB;
      } else if (inputLiteralB !== null && inputLiteralB !== undefined) {
        operandB = this.formatLiteralValue(inputLiteralB);
      } else {
        operandB = 'false';
      }

      // Check for constant folding optimization 检查常量折叠优化
      if (context.options.optimize &&
          inputLiteralA !== null && typeof inputLiteralA === 'boolean' &&
          inputLiteralB !== null && typeof inputLiteralB === 'boolean') {
        const result = operation === 'and' ? (inputLiteralA && inputLiteralB) : (inputLiteralA || inputLiteralB);
        return `const ${resultVar} = ${result};`;
      }

      const operator = operation === 'and' ? '&&' : '||';
      return `const ${resultVar} = ${operandA} ${operator} ${operandB};`;
    }
  }

  /**
   * Compile math constant
   * 编译数学常量
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @param constant Constant type 常量类型
   * @returns Generated code 生成的代码
   */
  private compileMathConstant(node: VisualNode, context: NodeCompilationContext, constant: 'pi' | 'e'): string {
    const resultVar = this.getOutputVariable(node, 'Value', context);

    switch (constant) {
      case 'pi':
        return `const ${resultVar} = Math.PI;`;
      case 'e':
        return `const ${resultVar} = Math.E;`;
      default:
        throw new Error(`Unknown math constant: ${constant}`);
    }
  }
}