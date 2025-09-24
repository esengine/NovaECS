/**
 * ECS node compiler for visual graph compilation
 * ECS节点编译器，用于可视化图编译
 *
 * Handles compilation of Entity Component System related nodes including
 * entity creation, component operations, and query operations. Generates
 * optimized TypeScript code that integrates with NovaECS APIs.
 * 处理实体组件系统相关节点的编译，包括实体创建、组件操作和查询操作。
 * 生成与NovaECS API集成的优化TypeScript代码。
 */

import type { VisualNode } from '../../../../src/visual/types';
import type { VisualGraph } from '../../../../src/visual/core/VisualGraph';
import { BaseNodeCompiler, type NodeCompilationContext } from './BaseNodeCompiler';
import type { TypeResolver, TypeResolutionResult } from '../TypeResolver';

/**
 * Compiler for ECS-related visual nodes
 * ECS相关可视化节点的编译器
 */
export class ECSNodeCompiler extends BaseNodeCompiler {
  constructor(typeResolver: TypeResolver) {
    super(typeResolver);
  }

  /**
   * Compile ECS node to TypeScript code
   * 将ECS节点编译为TypeScript代码
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
      case 'world.createEntity':
        return this.compileCreateEntity(node, context);

      case 'world.destroyEntity':
        return this.compileDestroyEntity(node, context);

      case 'world.query':
        return this.compileQuery(node, context);

      case 'world.addComponent':
        return this.compileAddComponent(node, context);

      case 'world.removeComponent':
        return this.compileRemoveComponent(node, context);

      case 'world.getComponent':
        return this.compileGetComponent(node, context);

      case 'world.hasComponent':
        return this.compileHasComponent(node, context);

      case 'query.forEach':
        return this.compileQueryForEach(node, context);

      case 'query.count':
        return this.compileQueryCount(node, context);

      case 'query.without':
        return this.compileQueryWithout(node, context);

      default:
        throw new Error(`Unsupported ECS node type: ${node.type}`);
    }
  }

  /**
   * Get required imports for ECS nodes
   * 获取ECS节点所需的导入
   *
   * @param node Node to analyze 要分析的节点
   * @returns Array of import statements 导入语句数组
   */
  getRequiredImports(node: VisualNode): string[] {
    const imports: string[] = [];

    // Add basic ECS imports based on node type 根据节点类型添加基本ECS导入
    switch (node.type) {
      case 'world.createEntity':
      case 'world.destroyEntity':
      case 'world.query':
      case 'world.addComponent':
      case 'world.removeComponent':
      case 'world.getComponent':
      case 'world.hasComponent':
        // These use the world from SystemContext 这些使用SystemContext中的world
        break;

      case 'query.forEach':
      case 'query.count':
      case 'query.without':
        // These work with Query objects 这些与Query对象一起工作
        imports.push("import type { Query } from '@esengine/nova-ecs';");
        break;
    }

    return imports;
  }

  /**
   * Compile createEntity node
   * 编译createEntity节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileCreateEntity(node: VisualNode, context: NodeCompilationContext): string {
    const entityVar = this.getOutputVariable(node, 'Entity', context);

    // Check if 'enabled' input is connected or has a value 检查'enabled'输入是否连接或有值
    const enabledVar = this.getInputVariable(node, 'Enabled', context);
    const enabledLiteral = this.getLiteralValue(node, 'Enabled', context);

    let enabledValue = 'true'; // Default to true 默认为true
    if (enabledVar) {
      enabledValue = enabledVar;
    } else if (enabledLiteral !== null && enabledLiteral !== undefined) {
      enabledValue = this.formatLiteralValue(enabledLiteral);
    }

    return `const ${entityVar} = ctx.world.createEntity(${enabledValue});`;
  }

  /**
   * Compile destroyEntity node
   * 编译destroyEntity节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileDestroyEntity(node: VisualNode, context: NodeCompilationContext): string {
    const entityVar = this.getInputVariable(node, 'Entity', context);
    const entityLiteral = this.getLiteralValue(node, 'Entity', context);

    let entityValue: string;
    if (entityVar) {
      entityValue = entityVar;
    } else if (entityLiteral !== null && entityLiteral !== undefined) {
      entityValue = this.formatLiteralValue(entityLiteral);
    } else {
      throw new Error('DestroyEntity node requires Entity input');
    }

    return `ctx.world.destroyEntity(${entityValue});`;
  }

  /**
   * Compile query node
   * 编译query节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileQuery(node: VisualNode, context: NodeCompilationContext): string {
    const queryVar = this.getOutputVariable(node, 'Query', context);

    // Get component types from input 从输入获取组件类型
    const componentTypesVar = this.getInputVariable(node, 'Component Types', context);
    const componentTypesLiteral = this.getLiteralValue(node, 'Component Types', context);

    let componentTypes: string;
    if (componentTypesVar) {
      componentTypes = componentTypesVar;
    } else if (componentTypesLiteral !== null && componentTypesLiteral !== undefined) {
      // Assume it's an array of component constructor names 假设这是组件构造函数名的数组
      if (Array.isArray(componentTypesLiteral)) {
        componentTypes = componentTypesLiteral.join(', ');
      } else {
        componentTypes = String(componentTypesLiteral);
      }
    } else {
      throw new Error('Query node requires Component Types input');
    }

    return `const ${queryVar} = ctx.world.query(${componentTypes});`;
  }

  /**
   * Compile addComponent node
   * 编译addComponent节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileAddComponent(node: VisualNode, context: NodeCompilationContext): string {
    const entityVar = this.getInputVariable(node, 'Entity', context);
    const entityLiteral = this.getLiteralValue(node, 'Entity', context);

    const componentTypeVar = this.getInputVariable(node, 'Component Type', context);
    const componentTypeLiteral = this.getLiteralValue(node, 'Component Type', context);

    const componentDataVar = this.getInputVariable(node, 'Component Data', context);
    const componentDataLiteral = this.getLiteralValue(node, 'Component Data', context);

    // Resolve entity value 解析实体值
    let entityValue: string;
    if (entityVar) {
      entityValue = entityVar;
    } else if (entityLiteral !== null && entityLiteral !== undefined) {
      entityValue = this.formatLiteralValue(entityLiteral);
    } else {
      throw new Error('AddComponent node requires Entity input');
    }

    // Resolve component type 解析组件类型
    let componentTypeValue: string;
    if (componentTypeVar) {
      componentTypeValue = componentTypeVar;
    } else if (componentTypeLiteral !== null && componentTypeLiteral !== undefined) {
      componentTypeValue = String(componentTypeLiteral);
    } else {
      throw new Error('AddComponent node requires Component Type input');
    }

    // Resolve component data (optional) 解析组件数据（可选）
    let componentDataValue = '';
    if (componentDataVar) {
      componentDataValue = `, ${componentDataVar}`;
    } else if (componentDataLiteral !== null && componentDataLiteral !== undefined) {
      componentDataValue = `, ${this.formatLiteralValue(componentDataLiteral)}`;
    }

    return `ctx.world.addComponent(${entityValue}, ${componentTypeValue}${componentDataValue});`;
  }

  /**
   * Compile removeComponent node
   * 编译removeComponent节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileRemoveComponent(node: VisualNode, context: NodeCompilationContext): string {
    const entityVar = this.getInputVariable(node, 'Entity', context);
    const entityLiteral = this.getLiteralValue(node, 'Entity', context);

    const componentTypeVar = this.getInputVariable(node, 'Component Type', context);
    const componentTypeLiteral = this.getLiteralValue(node, 'Component Type', context);

    // Resolve entity value 解析实体值
    let entityValue: string;
    if (entityVar) {
      entityValue = entityVar;
    } else if (entityLiteral !== null && entityLiteral !== undefined) {
      entityValue = this.formatLiteralValue(entityLiteral);
    } else {
      throw new Error('RemoveComponent node requires Entity input');
    }

    // Resolve component type 解析组件类型
    let componentTypeValue: string;
    if (componentTypeVar) {
      componentTypeValue = componentTypeVar;
    } else if (componentTypeLiteral !== null && componentTypeLiteral !== undefined) {
      componentTypeValue = String(componentTypeLiteral);
    } else {
      throw new Error('RemoveComponent node requires Component Type input');
    }

    return `ctx.world.removeComponent(${entityValue}, ${componentTypeValue});`;
  }

  /**
   * Compile getComponent node
   * 编译getComponent节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileGetComponent(node: VisualNode, context: NodeCompilationContext): string {
    const componentVar = this.getOutputVariable(node, 'Component', context);

    const entityVar = this.getInputVariable(node, 'Entity', context);
    const entityLiteral = this.getLiteralValue(node, 'Entity', context);

    const componentTypeVar = this.getInputVariable(node, 'Component Type', context);
    const componentTypeLiteral = this.getLiteralValue(node, 'Component Type', context);

    // Resolve entity value 解析实体值
    let entityValue: string;
    if (entityVar) {
      entityValue = entityVar;
    } else if (entityLiteral !== null && entityLiteral !== undefined) {
      entityValue = this.formatLiteralValue(entityLiteral);
    } else {
      throw new Error('GetComponent node requires Entity input');
    }

    // Resolve component type 解析组件类型
    let componentTypeValue: string;
    if (componentTypeVar) {
      componentTypeValue = componentTypeVar;
    } else if (componentTypeLiteral !== null && componentTypeLiteral !== undefined) {
      componentTypeValue = String(componentTypeLiteral);
    } else {
      throw new Error('GetComponent node requires Component Type input');
    }

    return `const ${componentVar} = ctx.world.getComponent(${entityValue}, ${componentTypeValue});`;
  }

  /**
   * Compile hasComponent node
   * 编译hasComponent节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileHasComponent(node: VisualNode, context: NodeCompilationContext): string {
    const hasComponentVar = this.getOutputVariable(node, 'Has Component', context);

    const entityVar = this.getInputVariable(node, 'Entity', context);
    const entityLiteral = this.getLiteralValue(node, 'Entity', context);

    const componentTypeVar = this.getInputVariable(node, 'Component Type', context);
    const componentTypeLiteral = this.getLiteralValue(node, 'Component Type', context);

    // Resolve entity value 解析实体值
    let entityValue: string;
    if (entityVar) {
      entityValue = entityVar;
    } else if (entityLiteral !== null && entityLiteral !== undefined) {
      entityValue = this.formatLiteralValue(entityLiteral);
    } else {
      throw new Error('HasComponent node requires Entity input');
    }

    // Resolve component type 解析组件类型
    let componentTypeValue: string;
    if (componentTypeVar) {
      componentTypeValue = componentTypeVar;
    } else if (componentTypeLiteral !== null && componentTypeLiteral !== undefined) {
      componentTypeValue = String(componentTypeLiteral);
    } else {
      throw new Error('HasComponent node requires Component Type input');
    }

    return `const ${hasComponentVar} = ctx.world.hasComponent(${entityValue}, ${componentTypeValue});`;
  }

  /**
   * Compile query.forEach node
   * 编译query.forEach节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileQueryForEach(node: VisualNode, context: NodeCompilationContext): string {
    const queryVar = this.getInputVariable(node, 'Query', context);
    const queryLiteral = this.getLiteralValue(node, 'Query', context);

    // Resolve query value 解析查询值
    let queryValue: string;
    if (queryVar) {
      queryValue = queryVar;
    } else if (queryLiteral !== null && queryLiteral !== undefined) {
      // For query names, use them directly as variable names without quotes
      queryValue = String(queryLiteral);
    } else {
      throw new Error('QueryForEach node requires Query input');
    }

    // Generate forEach loop 生成forEach循环
    // This is a simplified version - in practice, we'd need to handle the callback
    // 这是简化版本 - 实际上，我们需要处理回调
    return `${queryValue}.forEach((entity, ...components) => {\n  // TODO: Handle forEach callback\n});`;
  }

  /**
   * Compile query.count node
   * 编译query.count节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileQueryCount(node: VisualNode, context: NodeCompilationContext): string {
    const countVar = this.getOutputVariable(node, 'Count', context);

    const queryVar = this.getInputVariable(node, 'Query', context);
    const queryLiteral = this.getLiteralValue(node, 'Query', context);

    // Resolve query value 解析查询值
    let queryValue: string;
    if (queryVar) {
      queryValue = queryVar;
    } else if (queryLiteral !== null && queryLiteral !== undefined) {
      // For query names, use them directly as variable names without quotes
      queryValue = String(queryLiteral);
    } else {
      throw new Error('QueryCount node requires Query input');
    }

    return `const ${countVar} = ${queryValue}.count();`;
  }

  /**
   * Compile query.without node
   * 编译query.without节点
   *
   * @param node Node to compile 要编译的节点
   * @param context Compilation context 编译上下文
   * @returns Generated code 生成的代码
   */
  private compileQueryWithout(node: VisualNode, context: NodeCompilationContext): string {
    const filteredQueryVar = this.getOutputVariable(node, 'Filtered Query', context);

    const queryVar = this.getInputVariable(node, 'Query', context);
    const queryLiteral = this.getLiteralValue(node, 'Query', context);

    const excludeTypesVar = this.getInputVariable(node, 'Exclude Types', context);
    const excludeTypesLiteral = this.getLiteralValue(node, 'Exclude Types', context);

    // Resolve query value 解析查询值
    let queryValue: string;
    if (queryVar) {
      queryValue = queryVar;
    } else if (queryLiteral !== null && queryLiteral !== undefined) {
      // For query names, use them directly as variable names without quotes
      queryValue = String(queryLiteral);
    } else {
      throw new Error('QueryWithout node requires Query input');
    }

    // Resolve exclude types 解析排除类型
    let excludeTypesValue: string;
    if (excludeTypesVar) {
      excludeTypesValue = excludeTypesVar;
    } else if (excludeTypesLiteral !== null && excludeTypesLiteral !== undefined) {
      if (Array.isArray(excludeTypesLiteral)) {
        excludeTypesValue = excludeTypesLiteral.join(', ');
      } else {
        excludeTypesValue = String(excludeTypesLiteral);
      }
    } else {
      throw new Error('QueryWithout node requires Exclude Types input');
    }

    return `const ${filteredQueryVar} = ${queryValue}.without(${excludeTypesValue});`;
  }
}