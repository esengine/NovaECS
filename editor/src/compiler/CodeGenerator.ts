/**
 * Code generator for visual graphs to TypeScript
 * 可视化图到TypeScript的代码生成器
 *
 * Converts VisualGraph instances into optimized TypeScript code that integrates
 * seamlessly with the NovaECS system architecture. Provides type-safe code generation
 * with performance optimizations and readable output.
 * 将VisualGraph实例转换为与NovaECS系统架构无缝集成的优化TypeScript代码。
 * 提供类型安全的代码生成，具有性能优化和可读输出。
 */

import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import type { VisualNode } from '../../../src/visual/types';
import { TypeResolver, type TypeResolutionResult } from './TypeResolver';
import { BaseNodeCompiler } from './nodes/BaseNodeCompiler';
import { ECSNodeCompiler } from './nodes/ECSNodeCompiler';
import { MathNodeCompiler } from './nodes/MathNodeCompiler';
import { FlowNodeCompiler } from './nodes/FlowNodeCompiler';
import { Optimizer } from './Optimizer';

/**
 * Code generation options
 * 代码生成选项
 */
export interface CodeGenerationOptions {
  /** System name for the generated code 生成代码的系统名称 */
  systemName: string;
  /** Target execution stage 目标执行阶段 */
  stage?: 'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup';
  /** System dependencies 系统依赖 */
  dependencies?: string[];
  /** Enable optimization passes 启用优化过程 */
  optimize?: boolean;
  /** Include debug information 包含调试信息 */
  includeDebugInfo?: boolean;
  /** Output formatting options 输出格式选项 */
  formatting?: {
    indentSize?: number;
    useTabs?: boolean;
    lineEnding?: 'lf' | 'crlf';
  };
}

/**
 * Code generation result
 * 代码生成结果
 */
export interface CodeGenerationResult {
  /** Whether generation was successful 生成是否成功 */
  success: boolean;
  /** Generated TypeScript code 生成的TypeScript代码 */
  code: string;
  /** Compilation errors 编译错误 */
  errors: string[];
  /** Compilation warnings 编译警告 */
  warnings: string[];
  /** Performance metrics 性能指标 */
  metrics: {
    nodeCount: number;
    connectionCount: number;
    linesOfCode: number;
    optimizationsApplied: string[];
    nodesEliminated: number;
    constantsFolded: number;
    compilationTime: number;
  };
}

/**
 * Visual graph to TypeScript code generator
 * 可视化图到TypeScript代码生成器
 */
export class CodeGenerator {
  private typeResolver: TypeResolver;
  private nodeCompilers: Map<string, BaseNodeCompiler> = new Map();
  private optimizer: Optimizer;

  constructor() {
    this.typeResolver = new TypeResolver();
    this.optimizer = new Optimizer(this.typeResolver);
    this.initializeNodeCompilers();
  }

  /**
   * Initialize node compilers for different node types
   * 初始化不同节点类型的编译器
   */
  private initializeNodeCompilers(): void {
    this.nodeCompilers = new Map();

    // Register ECS node compilers 注册ECS节点编译器
    const ecsCompiler = new ECSNodeCompiler(this.typeResolver);
    const ecsTypes = [
      'world.createEntity', 'world.destroyEntity', 'world.query',
      'world.addComponent', 'world.removeComponent', 'world.getComponent', 'world.hasComponent',
      'query.forEach', 'query.count', 'query.without'
    ];
    ecsTypes.forEach(type => this.nodeCompilers.set(type, ecsCompiler));

    // Register math node compilers 注册数学节点编译器
    const mathCompiler = new MathNodeCompiler(this.typeResolver);
    const mathTypes = [
      'math.add', 'math.subtract', 'math.multiply', 'math.divide', 'math.modulo', 'math.power',
      'math.equals', 'math.notEquals', 'math.greaterThan', 'math.lessThan', 'math.greaterThanOrEqual', 'math.lessThanOrEqual',
      'math.and', 'math.or', 'math.not',
      'math.sin', 'math.cos', 'math.sqrt', 'math.abs', 'math.floor', 'math.ceil', 'math.round', 'math.min', 'math.max',
      'math.constant', 'math.pi', 'math.e'
    ];
    mathTypes.forEach(type => this.nodeCompilers.set(type, mathCompiler));

    // Register flow control compilers 注册流程控制编译器
    const flowCompiler = new FlowNodeCompiler(this.typeResolver);
    const flowTypes = [
      'flow.start', 'flow.if', 'flow.loop', 'flow.while', 'flow.for', 'flow.break', 'flow.continue',
      'flow.return', 'flow.sequence', 'flow.parallel'
    ];
    flowTypes.forEach(type => this.nodeCompilers.set(type, flowCompiler));
  }

  /**
   * Generate TypeScript code from visual graph
   * 从可视化图生成TypeScript代码
   *
   * @param graph Visual graph to compile 要编译的可视化图
   * @param options Code generation options 代码生成选项
   * @returns Generated code result 生成的代码结果
   */
  async generateCode(graph: VisualGraph, options: CodeGenerationOptions): Promise<CodeGenerationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Validate graph 步骤1：验证图
      const validationResult = this.validateGraph(graph);
      if (!validationResult.valid) {
        return {
          success: false,
          code: '',
          errors: validationResult.errors,
          warnings: [],
          metrics: this.createEmptyMetrics(startTime)
        };
      }

      // Step 2: Resolve types 步骤2：解析类型
      const typeInfo = await this.typeResolver.resolveTypes(graph);
      warnings.push(...typeInfo.errors.filter(e => e.severity === 'warning').map(e => e.message));

      // Step 3: Apply optimizations if enabled 步骤3：如果启用则应用优化
      let optimizedGraph = graph;
      let optimizationMetrics: { optimizationsApplied: string[]; nodesEliminated: number; constantsFolded: number } = {
        optimizationsApplied: [],
        nodesEliminated: 0,
        constantsFolded: 0
      };

      if (options.optimize) {
        const optimizationResult = await this.optimizer.optimize(graph, typeInfo);
        if (optimizationResult.success) {
          optimizedGraph = optimizationResult.optimizedGraph;
          optimizationMetrics = {
            optimizationsApplied: optimizationResult.metrics.optimizationsApplied,
            nodesEliminated: optimizationResult.metrics.nodesEliminated,
            constantsFolded: optimizationResult.metrics.constantsFolded
          };
        }
      }

      // Step 4: Generate code 步骤4：生成代码
      const code = await this.generateSystemCode(optimizedGraph, typeInfo, options);

      // Step 5: Calculate metrics 步骤5：计算指标
      const endTime = Date.now();
      const metrics = {
        nodeCount: optimizedGraph.getAllNodes().length,
        connectionCount: optimizedGraph.getAllConnections().length,
        linesOfCode: code.split('\n').length,
        ...optimizationMetrics,
        compilationTime: endTime - startTime
      };

      return {
        success: true,
        code,
        errors,
        warnings,
        metrics
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        code: '',
        errors,
        warnings,
        metrics: this.createEmptyMetrics(startTime)
      };
    }
  }

  /**
   * Validate the visual graph for compilation
   * 验证可视化图以进行编译
   */
  private validateGraph(graph: VisualGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const nodes = graph.getAllNodes();

    // Check for empty graph 检查空图
    if (nodes.length === 0) {
      return { valid: true, errors: [] }; // Empty graph is valid, will generate empty system
    }

    // Check for unsupported node types 检查不支持的节点类型
    for (const node of nodes) {
      if (!this.nodeCompilers.has(node.type)) {
        errors.push(`No compiler found for node type: ${node.type}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate the complete system TypeScript code
   * 生成完整的系统TypeScript代码
   */
  private async generateSystemCode(graph: VisualGraph, typeInfo: TypeResolutionResult, options: CodeGenerationOptions): Promise<string> {
    const lines: string[] = [];

    // Add file header if debug info is enabled 如果启用调试信息则添加文件头
    if (options.includeDebugInfo) {
      lines.push(`// Generated from visual graph: ${graph.name}`);
      lines.push(`// Generated on: ${new Date().toISOString()}`);
      lines.push('');
    }

    // Add imports 添加导入
    const imports = this.generateImports(graph, typeInfo);
    lines.push(...imports);
    if (imports.length > 0) {
      lines.push('');
    }

    // Add system class 添加系统类
    const stage = options.stage || 'update';
    const stageDecorator = `@SystemStage.${stage}`;

    lines.push(stageDecorator);
    if (options.dependencies && options.dependencies.length > 0) {
      const deps = options.dependencies.map(dep => `'${dep}'`).join(', ');
      lines.push(`@SystemDependencies(${deps})`);
    }

    lines.push(`export class ${options.systemName} extends System {`);

    // Add system update method 添加系统更新方法
    const methodName = stage;
    lines.push(`  ${methodName}(ctx: SystemContext): void {`);

    // Create global compilation context 创建全局编译上下文
    const globalContext = {
      graph,
      typeInfo,
      pass: 'main' as const,
      variableNames: new Map<string, string>(),
      outputVariables: new Map<string, string>(),
      functionNames: new Map<string, string>(),
      options: {
        optimize: options.optimize !== false,
        includeDebugInfo: options.includeDebugInfo === true
      }
    };

    // Generate node execution code 生成节点执行代码
    const nodes = graph.getAllNodes();

    // Pre-generate variable names for all nodes 为所有节点预生成变量名
    for (const node of nodes) {
      for (const outputName of node.outputs.keys()) {
        const varName = this.generateUniqueVariableName(node.id, outputName, globalContext);
        const key = `${node.id}.${outputName}`;
        globalContext.variableNames.set(key, varName);
      }
    }

    if (nodes.length === 0) {
      lines.push('    // Empty system - no nodes to execute');
      lines.push('    // 空系统 - 没有要执行的节点');
    } else {
      for (const node of nodes) {
        if (options.includeDebugInfo) {
          lines.push(`    // Node: ${node.id} (${node.type})`);
        }

        try {
          const compiler = this.nodeCompilers.get(node.type);
          if (compiler && 'compileWithContext' in compiler && typeof compiler.compileWithContext === 'function') {
            // Use the new context-aware compilation method
            const result = await (compiler as any).compileWithContext(node, globalContext);
            const indentedCode = result.code.split('\n').map((line: string) =>
              line.trim() ? `    ${line}` : line
            ).join('\n');
            lines.push(indentedCode);
          } else if (compiler) {
            // Create individual context for legacy compilers with global variable names
            const individualContext = {
              ...globalContext,
              variableNames: new Map(globalContext.variableNames),
              outputVariables: new Map(globalContext.outputVariables),
              functionNames: new Map(globalContext.functionNames)
            };

            // Generate variable names for this node if not already done
            for (const outputName of node.outputs.keys()) {
              const key = `${node.id}.${outputName}`;
              if (!individualContext.variableNames.has(key)) {
                const varName = this.generateUniqueVariableName(node.id, outputName, individualContext);
                individualContext.variableNames.set(key, varName);
              }
            }

            const nodeCode = await compiler.compile(node, graph, typeInfo);
            const indentedCode = nodeCode.split('\n').map((line: string) =>
              line.trim() ? `    ${line}` : line
            ).join('\n');
            lines.push(indentedCode);
          }
        } catch (error) {
          lines.push(`    // Error compiling node ${node.id}: ${error}`);
        }

        lines.push('');
      }
    }

    lines.push('  }');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate required imports for the system
   * 生成系统所需的导入
   */
  private generateImports(graph: VisualGraph, typeInfo: TypeResolutionResult): string[] {
    const imports = new Set<string>();

    // Always add basic system imports 始终添加基本系统导入
    imports.add("import { System, SystemContext, SystemStage } from '@esengine/nova-ecs';");

    // Add dependencies decorator if needed 如果需要则添加依赖装饰器
    const nodes = graph.getAllNodes();
    const hasDependencies = nodes.some((node: VisualNode) => {
      const compiler = this.nodeCompilers.get(node.type);
      return compiler && compiler.getRequiredImports(node).length > 0;
    });

    if (hasDependencies) {
      imports.add("import { SystemDependencies } from '@esengine/nova-ecs';");
    }

    // Add type imports from nodes 添加来自节点的类型导入
    for (const node of nodes) {
      const compiler = this.nodeCompilers.get(node.type);
      if (compiler) {
        const nodeImports = compiler.getRequiredImports(node);
        nodeImports.forEach(imp => imports.add(imp));
      }
    }

    // Add type imports from type resolution 添加来自类型解析的类型导入
    Array.from(typeInfo.globalImports).forEach(imp => imports.add(imp));

    return Array.from(imports).sort();
  }

  /**
   * Create empty metrics structure
   * 创建空的指标结构
   */
  private createEmptyMetrics(startTime: number) {
    return {
      nodeCount: 0,
      connectionCount: 0,
      linesOfCode: 0,
      optimizationsApplied: [],
      nodesEliminated: 0,
      constantsFolded: 0,
      compilationTime: Date.now() - startTime
    };
  }

  /**
   * Generate unique variable name for node output
   * 为节点输出生成唯一变量名
   */
  private generateUniqueVariableName(nodeId: string, outputName: string, context: any): string {
    // Create base name from output pin name
    const baseName = outputName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

    // Use nodeId as suffix for uniqueness (matching test expectations)
    const nodePrefix = nodeId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let candidateName = `${baseName}_${nodePrefix}`;

    // Ensure uniqueness
    let counter = 0;
    while (Array.from(context.variableNames.values()).includes(candidateName)) {
      counter++;
      candidateName = `${baseName}_${nodePrefix}_${counter}`;
    }

    return candidateName;
  }

}

// Export alias for backward compatibility
export type GeneratedCode = CodeGenerationResult;