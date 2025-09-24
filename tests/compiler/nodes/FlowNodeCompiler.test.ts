/**
 * FlowNodeCompiler test suite
 * FlowNodeCompiler测试套件
 *
 * Tests for control flow compilation including conditionals, loops,
 * sequences, and execution flow management.
 * 测试控制流编译，包括条件语句、循环、序列和执行流管理。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { FlowNodeCompiler } from '../../../editor/src/compiler/nodes/FlowNodeCompiler';
import { TypeResolver } from '../../../editor/src/compiler/TypeResolver';
import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockFlowNode extends BaseVisualNode {
  constructor(id: string, type: string, inputs: [string, any][] = [], outputs: string[] = []) {
    super(id, type);

    inputs.forEach(([name, value]) => {
      this.inputs.set(name, value);
    });

    outputs.forEach(name => {
      this.outputs.set(name, undefined);
    });
  }

  execute(): void {}
  shouldExecute(): boolean { return true; }
}

describe('FlowNodeCompiler', () => {
  let compiler: FlowNodeCompiler;
  let typeResolver: TypeResolver;
  let graph: VisualGraph;

  beforeEach(() => {
    typeResolver = new TypeResolver();
    compiler = new FlowNodeCompiler(typeResolver);
    graph = new VisualGraph('test-graph');
  });

  describe('Basic Flow Control', () => {
    test('should compile start node', async () => {
      const node = new MockFlowNode('start1', 'flow.start', [], ['Execute']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toBe('// System execution starts here 系统执行从此开始');
    });

    test('should compile sequence node', async () => {
      const node = new MockFlowNode('seq1', 'flow.sequence', [['Execute', null]], ['Next']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('// Sequential execution 顺序执行');
    });
  });

  describe('Conditional Flow', () => {
    test('should compile if node with literal condition', async () => {
      const node = new MockFlowNode('if1', 'flow.if', [['Execute', null], ['Condition', true]], ['True', 'False']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('if (true) {');
      expect(code).toContain('// True branch execution 真分支执行');
      expect(code).toContain('} else {');
      expect(code).toContain('// False branch execution 假分支执行');
      expect(code).toContain('}');
    });

    test('should compile if node with connected condition', async () => {
      const conditionNode = new MockFlowNode('cond1', 'math.equals', [['A', 5], ['B', 3]], ['Result']);
      const ifNode = new MockFlowNode('if1', 'flow.if', [['Execute', null]], ['True', 'False']);

      graph.addNode(conditionNode);
      graph.addNode(ifNode);

      // Connect condition result to if condition 连接条件结果到if条件
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'cond1',
        fromPin: 'Result',
        toNodeId: 'if1',
        toPin: 'Condition'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);

      // Manually set up variable names for the connected condition node
      // 手动为连接的条件节点设置变量名
      const context = {
        graph,
        typeInfo,
        variableNames: new Map([
          ['cond1.Result', '_cond1']
        ]),
        outputVariables: new Map(),
        functionNames: new Map()
      };

      const code = await (compiler as any).compileIfNode(ifNode, context);

      expect(code).toMatch(/if \(_cond1\) \{/);
    });
  });

  describe('Loop Control', () => {
    test('should compile for loop node', async () => {
      const node = new MockFlowNode('for1', 'flow.for', [
        ['Execute', null],
        ['Start', 0],
        ['End', 10],
        ['Step', 1]
      ], ['Body', 'Complete']);

      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('for (let');
      expect(code).toContain('< 10;');
      expect(code).toContain('+= 1) {');
    });

    test('should compile while loop node', async () => {
      const node = new MockFlowNode('while1', 'flow.while', [
        ['Execute', null],
        ['Condition', true]
      ], ['Body', 'Complete']);

      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('while (true) {');
      expect(code).toContain('// While loop body execution while循环体执行');
    });

    test('should compile break node', async () => {
      const node = new MockFlowNode('break1', 'flow.break', [['Execute', null]], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toBe('break; // Exit current loop 退出当前循环');
    });

    test('should compile continue node', async () => {
      const node = new MockFlowNode('continue1', 'flow.continue', [['Execute', null]], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toBe('continue; // Continue to next iteration 继续下一次迭代');
    });
  });

  describe('Function Flow', () => {
    test('should compile return node', async () => {
      const node = new MockFlowNode('return1', 'flow.return', [['Execute', null], ['Value', 42]], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toBe('return 42; // Early return from system 从系统提前返回');
    });

    test('should compile return node without value', async () => {
      const node = new MockFlowNode('return1', 'flow.return', [['Execute', null]], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toBe('return; // Early return from system 从系统提前返回');
    });
  });

  describe('Connected Flow', () => {
    test('should handle connected execution flow', async () => {
      const startNode = new MockFlowNode('start1', 'flow.start', [], ['Execute']);
      const ifNode = new MockFlowNode('if1', 'flow.if', [['Condition', true]], ['True', 'False']);
      const sequenceNode = new MockFlowNode('seq1', 'flow.sequence', [], ['Next']);

      graph.addNode(startNode);
      graph.addNode(ifNode);
      graph.addNode(sequenceNode);

      // Connect execution flow 连接执行流
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'start1',
        fromPin: 'Execute',
        toNodeId: 'if1',
        toPin: 'Execute'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'if1',
        fromPin: 'True',
        toNodeId: 'seq1',
        toPin: 'Execute'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);

      const startCode = await compiler.compile(startNode, graph, typeInfo);
      const ifCode = await compiler.compile(ifNode, graph, typeInfo);
      const seqCode = await compiler.compile(sequenceNode, graph, typeInfo);

      expect(startCode).toBe('// System execution starts here 系统执行从此开始');
      expect(ifCode).toContain('if (true) {');
      expect(seqCode).toContain('// Sequential execution 顺序执行');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unsupported flow node type', async () => {
      const node = new MockFlowNode('invalid1', 'flow.unsupportedOperation', [], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'Unsupported flow control node type: flow.unsupportedOperation'
      );
    });

    test('should handle missing condition in if node', async () => {
      const node = new MockFlowNode('if1', 'flow.if', [['Execute', null]], ['True', 'False']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Should use default condition 应该使用默认条件
      expect(code).toContain('if (true) {');
    });

    test('should handle missing loop parameters', async () => {
      const node = new MockFlowNode('for1', 'flow.for', [['Execute', null]], ['Body', 'Complete']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Should use default values 应该使用默认值
      expect(code).toContain('for (let');
      expect(code).toContain('< 10;');
      expect(code).toContain('+= 1) {');
    });
  });

  describe('Code Generation Quality', () => {
    test('should generate properly indented code for nested structures', async () => {
      const node = new MockFlowNode('if1', 'flow.if', [['Execute', null], ['Condition', true]], ['True', 'False']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      const lines = code.split('\n');
      expect(lines[0]).toBe('if (true) {');
      expect(lines[1]).toBe('  // True branch execution 真分支执行');
      expect(lines[3]).toBe('} else {');
      expect(lines[4]).toBe('  // False branch execution 假分支执行');
      expect(lines[6]).toBe('}');
    });

    test('should properly handle return values', async () => {
      const node = new MockFlowNode('return1', 'flow.return', [
        ['Execute', null],
        ['Value', 'test value']
      ], []);

      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('return "test value";');
    });
  });

  describe('Required Imports', () => {
    test('should return empty imports for basic flow nodes', () => {
      const startNode = new MockFlowNode('start1', 'flow.start', [], ['Execute']);
      const imports = compiler.getRequiredImports(startNode);

      // Flow nodes use standard JavaScript control structures 流程节点使用标准JavaScript控制结构
      expect(imports).toHaveLength(0);
    });

    test('should return empty imports for control flow nodes', () => {
      const ifNode = new MockFlowNode('if1', 'flow.if', [], ['True', 'False']);
      const imports = compiler.getRequiredImports(ifNode);

      expect(imports).toHaveLength(0);
    });
  });

  describe('Complex Flow Scenarios', () => {
    test('should handle nested conditional structures', async () => {
      const outerIf = new MockFlowNode('if1', 'flow.if', [['Execute', null], ['Condition', true]], ['True', 'False']);
      const innerIf = new MockFlowNode('if2', 'flow.if', [['Condition', false]], ['True', 'False']);

      graph.addNode(outerIf);
      graph.addNode(innerIf);

      // Connect outer if true branch to inner if execute 连接外层if的true分支到内层if执行
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'if1',
        fromPin: 'True',
        toNodeId: 'if2',
        toPin: 'Execute'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);

      const outerCode = await compiler.compile(outerIf, graph, typeInfo);
      const innerCode = await compiler.compile(innerIf, graph, typeInfo);

      expect(outerCode).toContain('if (true) {');
      expect(innerCode).toContain('if (false) {');
    });

    test('should handle loop with break condition', async () => {
      const whileNode = new MockFlowNode('while1', 'flow.while', [
        ['Execute', null],
        ['Condition', true]
      ], ['Body', 'Complete']);

      const breakNode = new MockFlowNode('break1', 'flow.break', [['Execute', null]], []);

      graph.addNode(whileNode);
      graph.addNode(breakNode);

      const typeInfo = await typeResolver.resolveTypes(graph);

      const whileCode = await compiler.compile(whileNode, graph, typeInfo);
      const breakCode = await compiler.compile(breakNode, graph, typeInfo);

      expect(whileCode).toContain('while (true) {');
      expect(breakCode).toBe('break; // Exit current loop 退出当前循环');
    });
  });
});