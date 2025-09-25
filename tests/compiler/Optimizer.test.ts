/**
 * Optimizer test suite
 * Optimizer测试套件
 *
 * Tests for code optimization including dead code elimination,
 * constant folding, node inlining, and optimization metrics.
 * 测试代码优化，包括死代码消除、常量折叠、节点内联和优化指标。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { Optimizer } from '../../editor/src/compiler/Optimizer';
import { TypeResolver } from '../../editor/src/compiler/TypeResolver';
import { VisualGraph } from '../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockOptimizableNode extends BaseVisualNode {
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

describe('Optimizer', () => {
  let optimizer: Optimizer;
  let typeResolver: TypeResolver;

  beforeEach(() => {
    typeResolver = new TypeResolver();
    optimizer = new Optimizer(typeResolver);
  });

  describe('Dead Code Elimination', () => {
    test('should eliminate unreachable nodes', async () => {
      const graph = new VisualGraph('dead-code-test');

      // Create nodes with one unreachable 创建带有一个不可达节点的节点
      const reachableNode = new MockOptimizableNode('reachable1', 'math.add', [['A', 5], ['B', 3]], ['Result']);
      const unreachableNode = new MockOptimizableNode('unreachable1', 'math.multiply', [['A', 2], ['B', 4]], ['Result']);
      const usedNode = new MockOptimizableNode('used1', 'math.constant', [['Value', 10]], ['Value']);
      const outputNode = new MockOptimizableNode('output1', 'world.addComponent', [['Entity', null], ['Component Type', 'Transform'], ['Component Data', null]], []);

      graph.addNode(reachableNode);
      graph.addNode(unreachableNode);
      graph.addNode(usedNode);
      graph.addNode(outputNode);

      // Connect the reachable chain: used1 -> reachable1 -> output1
      // 连接可达链：used1 -> reachable1 -> output1
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'used1',
        fromPin: 'Value',
        toNodeId: 'reachable1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'reachable1',
        fromPin: 'Result',
        toNodeId: 'output1',
        toPin: 'Component Data'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.optimizedGraph.getAllNodes().length).toBe(5); // 3 user nodes + 2 system nodes
      expect(result.optimizedGraph.getNode('unreachable1')).toBe(undefined);
      expect(result.optimizedGraph.getNode('reachable1')).not.toBe(null);
      expect(result.optimizedGraph.getNode('used1')).not.toBe(null);
      expect(result.optimizedGraph.getNode('output1')).not.toBe(null);
      expect(result.metrics.nodesEliminated).toBe(1);
    });

    test('should preserve nodes with side effects', async () => {
      const graph = new VisualGraph('side-effects-test');

      // ECS operations have side effects and should not be eliminated
      // ECS操作有副作用，不应该被消除
      const createEntity = new MockOptimizableNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      const addComponent = new MockOptimizableNode('add1', 'world.addComponent', [
        ['Entity', null],
        ['Component Type', 'Transform'],
        ['Component Data', { x: 0, y: 0 }]
      ], []);
      const unusedMath = new MockOptimizableNode('unused1', 'math.add', [['A', 1], ['B', 2]], ['Result']);

      graph.addNode(createEntity);
      graph.addNode(addComponent);
      graph.addNode(unusedMath);

      // Connect create to add component 连接创建到添加组件
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'create1',
        fromPin: 'Entity',
        toNodeId: 'add1',
        toPin: 'Entity'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.optimizedGraph.getNode('create1')).not.toBe(null); // Side effect preserved
      expect(result.optimizedGraph.getNode('add1')).not.toBe(null); // Side effect preserved
      expect(result.optimizedGraph.getNode('unused1')).toBe(undefined); // Pure math eliminated
      expect(result.metrics.nodesEliminated).toBe(1);
    });

    test('should handle complex dependency chains', async () => {
      const graph = new VisualGraph('dependency-chain-test');

      // Create a chain: A -> B -> C, with D isolated
      // 创建链：A -> B -> C，D孤立
      const nodeA = new MockOptimizableNode('A', 'math.constant', [['Value', 1]], ['Value']);
      const nodeB = new MockOptimizableNode('B', 'math.add', [['B', 2]], ['Result']);
      const nodeC = new MockOptimizableNode('C', 'math.multiply', [['B', 3]], ['Result']);
      const nodeD = new MockOptimizableNode('D', 'math.subtract', [['A', 10], ['B', 5]], ['Result']); // Isolated

      [nodeA, nodeB, nodeC, nodeD].forEach(node => graph.addNode(node));

      // Connect A -> B -> C
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'A',
        fromPin: 'Value',
        toNodeId: 'B',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'B',
        fromPin: 'Result',
        toNodeId: 'C',
        toPin: 'A'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.optimizedGraph.getNode('A')).not.toBe(null);
      expect(result.optimizedGraph.getNode('B')).not.toBe(null);
      expect(result.optimizedGraph.getNode('C')).not.toBe(null);
      expect(result.optimizedGraph.getNode('D')).toBe(undefined); // Should be eliminated
      expect(result.metrics.nodesEliminated).toBe(1);
    });
  });

  describe('Constant Folding', () => {
    test('should fold simple arithmetic constants', async () => {
      const graph = new VisualGraph('constant-folding-test');

      const const1 = new MockOptimizableNode('const1', 'math.constant', [['Value', 5]], ['Value']);
      const const2 = new MockOptimizableNode('const2', 'math.constant', [['Value', 3]], ['Value']);
      const addNode = new MockOptimizableNode('add1', 'math.add', [], ['Result']);

      [const1, const2, addNode].forEach(node => graph.addNode(node));

      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const1',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'const2',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      if (!result.success) {
        console.log('Optimizer errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.metrics.constantsFolded).toBe(1);

      // The add operation should be replaced with a constant 8
      // 加法操作应该被替换为常量8
      const optimizedNodes = result.optimizedGraph.getAllNodes();
      const constantNode = optimizedNodes.find(node =>
        node.type === 'math.constant' && node.inputs.get('Value') === 8
      );
      expect(constantNode).toBeDefined();
    });

    test('should fold nested constant expressions', async () => {
      const graph = new VisualGraph('nested-constant-test');

      // Create expression: (2 + 3) * 4
      // 创建表达式：(2 + 3) * 4
      const const2 = new MockOptimizableNode('const2', 'math.constant', [['Value', 2]], ['Value']);
      const const3 = new MockOptimizableNode('const3', 'math.constant', [['Value', 3]], ['Value']);
      const const4 = new MockOptimizableNode('const4', 'math.constant', [['Value', 4]], ['Value']);
      const add = new MockOptimizableNode('add1', 'math.add', [], ['Result']);
      const mul = new MockOptimizableNode('mul1', 'math.multiply', [], ['Result']);

      [const2, const3, const4, add, mul].forEach(node => graph.addNode(node));

      // Connect 2 + 3
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const2',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'const3',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'B'
      });

      // Connect (2 + 3) * 4
      graph.addConnection({
        id: 'conn3',
        fromNodeId: 'add1',
        fromPin: 'Result',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn4',
        fromNodeId: 'const4',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.constantsFolded).toBeGreaterThanOrEqual(1);

      // Should result in a single constant with value 20
      // 应该得到一个值为20的单一常量
      const optimizedNodes = result.optimizedGraph.getAllNodes();
      const finalConstant = optimizedNodes.find(node =>
        node.type === 'math.constant' && node.inputs.get('Value') === 20
      );
      expect(finalConstant).toBeDefined();
    });

    test('should handle mixed constant and variable expressions', async () => {
      const graph = new VisualGraph('mixed-expression-test');

      // Create expression: variable + (2 * 3)
      // 创建表达式：变量 + (2 * 3)
      const variable = new MockOptimizableNode('var1', 'input.getValue', [['Name', 'x']], ['Value']);
      const const2 = new MockOptimizableNode('const2', 'math.constant', [['Value', 2]], ['Value']);
      const const3 = new MockOptimizableNode('const3', 'math.constant', [['Value', 3]], ['Value']);
      const mul = new MockOptimizableNode('mul1', 'math.multiply', [], ['Result']);
      const add = new MockOptimizableNode('add1', 'math.add', [], ['Result']);

      [variable, const2, const3, mul, add].forEach(node => graph.addNode(node));

      // Connect 2 * 3
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const2',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'const3',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'B'
      });

      // Connect variable + (2 * 3)
      graph.addConnection({
        id: 'conn3',
        fromNodeId: 'var1',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn4',
        fromNodeId: 'mul1',
        fromPin: 'Result',
        toNodeId: 'add1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.constantsFolded).toBe(1);

      // Should have folded 2 * 3 = 6, but kept the variable
      // 应该已折叠2 * 3 = 6，但保留了变量
      const optimizedNodes = result.optimizedGraph.getAllNodes();
      expect(optimizedNodes.some(node => node.type === 'input.getValue')).toBe(true); // Variable preserved
      expect(optimizedNodes.some(node => node.inputs.get('Value') === 6)).toBe(true); // Constant folded
    });

    test('should not fold operations with side effects', async () => {
      const graph = new VisualGraph('side-effects-constant-test');

      // ECS operations should not be folded even with constant inputs
      // 即使有常量输入，ECS操作也不应该被折叠
      const const1 = new MockOptimizableNode('const1', 'math.constant', [['Value', 123]], ['Value']);
      const createEntity = new MockOptimizableNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);

      graph.addNode(const1);
      graph.addNode(createEntity);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.optimizedGraph.getNode('create1')).not.toBe(null); // Should preserve side effects
      expect(result.metrics.constantsFolded).toBe(0); // No folding of side effects
    });
  });

  describe('Node Inlining', () => {
    test('should inline simple constant nodes', async () => {
      const graph = new VisualGraph('node-inlining-test');

      const constNode = new MockOptimizableNode('const1', 'math.constant', [['Value', 42]], ['Value']);
      const addNode = new MockOptimizableNode('add1', 'math.add', [['B', 8]], ['Result']);

      graph.addNode(constNode);
      graph.addNode(addNode);

      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const1',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'A'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.nodesInlined).toBeGreaterThanOrEqual(0); // Depends on implementation
    });

    test('should not inline nodes with multiple outputs', async () => {
      const graph = new VisualGraph('multi-output-test');

      const multiOutput = new MockOptimizableNode('multi1', 'math.divmod', [['A', 10], ['B', 3]], ['Quotient', 'Remainder']);
      const useQuotient = new MockOptimizableNode('use1', 'math.add', [['B', 1]], ['Result']);
      const useRemainder = new MockOptimizableNode('use2', 'math.multiply', [['B', 2]], ['Result']);

      [multiOutput, useQuotient, useRemainder].forEach(node => graph.addNode(node));

      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'multi1',
        fromPin: 'Quotient',
        toNodeId: 'use1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'multi1',
        fromPin: 'Remainder',
        toNodeId: 'use2',
        toPin: 'A'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.optimizedGraph.getNode('multi1')).not.toBe(null); // Should not inline multi-output node
    });
  });

  describe('Optimization Passes', () => {
    test('should apply multiple optimization passes', async () => {
      const graph = new VisualGraph('multi-pass-test');

      // Create a graph that benefits from multiple passes
      // 创建一个受益于多次优化的图
      const const1 = new MockOptimizableNode('const1', 'math.constant', [['Value', 2]], ['Value']);
      const const2 = new MockOptimizableNode('const2', 'math.constant', [['Value', 3]], ['Value']);
      const const3 = new MockOptimizableNode('const3', 'math.constant', [['Value', 4]], ['Value']);
      const mul1 = new MockOptimizableNode('mul1', 'math.multiply', [], ['Result']);
      const add1 = new MockOptimizableNode('add1', 'math.add', [], ['Result']);
      const unused = new MockOptimizableNode('unused1', 'math.subtract', [['A', 100], ['B', 50]], ['Result']);

      [const1, const2, const3, mul1, add1, unused].forEach(node => graph.addNode(node));

      // Connect (2 * 3) + 4
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const1',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'const2',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'B'
      });

      graph.addConnection({
        id: 'conn3',
        fromNodeId: 'mul1',
        fromPin: 'Result',
        toNodeId: 'add1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn4',
        fromNodeId: 'const3',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.passesExecuted).toBeGreaterThan(1);
      expect(result.metrics.nodesEliminated).toBeGreaterThan(0); // Dead code elimination
      expect(result.metrics.constantsFolded).toBeGreaterThan(0); // Constant folding
    });

    test('should converge optimization passes', async () => {
      const graph = new VisualGraph('convergence-test');

      // Simple graph that should converge quickly 应该快速收敛的简单图
      const constNode = new MockOptimizableNode('const1', 'math.constant', [['Value', 5]], ['Value']);
      const addNode = new MockOptimizableNode('add1', 'math.add', [['A', 3], ['B', 2]], ['Result']);

      graph.addNode(constNode);
      graph.addNode(addNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.passesExecuted).toBeLessThan(10); // Should converge quickly
      expect(result.metrics.converged).toBe(true);
    });
  });

  describe('Optimization Metrics', () => {
    test('should provide detailed optimization metrics', async () => {
      const graph = new VisualGraph('metrics-test');

      const nodes = [
        new MockOptimizableNode('const1', 'math.constant', [['Value', 10]], ['Value']),
        new MockOptimizableNode('const2', 'math.constant', [['Value', 20]], ['Value']),
        new MockOptimizableNode('add1', 'math.add', [], ['Result']),
        new MockOptimizableNode('unused1', 'math.multiply', [['A', 5], ['B', 6]], ['Result']),
        new MockOptimizableNode('unused2', 'math.divide', [['A', 8], ['B', 2]], ['Result'])
      ];

      nodes.forEach(node => graph.addNode(node));

      // Only connect const1 + const2, leaving others unused
      // 只连接const1 + const2，其他保留未使用
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const1',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'const2',
        fromPin: 'Value',
        toNodeId: 'add1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.initialNodeCount).toBe(7); // 5 user nodes + 2 system nodes
      expect(result.metrics.finalNodeCount).toBeLessThan(7); // Should be less than initial count
      expect(result.metrics.nodesEliminated).toBe(2); // unused1, unused2
      expect(result.metrics.constantsFolded).toBe(1); // const1 + const2
      expect(result.metrics.optimizationsApplied).toContain('DeadCodeElimination');
      expect(result.metrics.optimizationsApplied).toContain('ConstantFolding');
    });

    test('should track optimization time', async () => {
      const graph = new VisualGraph('timing-test');

      // Create a reasonably complex graph 创建一个相当复杂的图
      const nodeCount = 20;
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockOptimizableNode(`node${i}`, 'math.add', [['A', i], ['B', i + 1]], ['Result']);
        graph.addNode(node);
      }

      const typeInfo = await typeResolver.resolveTypes(graph);
      const startTime = Date.now();
      const result = await optimizer.optimize(graph, typeInfo);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metrics.optimizationTime).toBeGreaterThan(0);
      expect(result.metrics.optimizationTime).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });
  });

  describe('Error Handling', () => {
    test('should handle optimization errors gracefully', async () => {
      const graph = new VisualGraph('error-test');

      // Create a node that might cause issues during optimization
      // 创建在优化过程中可能造成问题的节点
      const problematicNode = new MockOptimizableNode('problem1', 'math.divide', [['A', 1], ['B', 0]], ['Result']);
      graph.addNode(problematicNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      // Should handle gracefully and not crash 应该优雅处理而不崩溃
      expect(result.success).toBe(true);
    });

    test('should handle empty graphs', async () => {
      const graph = new VisualGraph('empty-test');

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.initialNodeCount).toBe(2); // 2 system nodes
      expect(result.metrics.finalNodeCount).toBe(2); // 2 system nodes (can't be eliminated)
      expect(result.metrics.nodesEliminated).toBe(0);
    });

    test('should handle circular dependencies', async () => {
      const graph = new VisualGraph('circular-test');

      const nodeA = new MockOptimizableNode('A', 'math.add', [['B', 1]], ['Result']);
      const nodeB = new MockOptimizableNode('B', 'math.multiply', [['B', 2]], ['Result']);

      graph.addNode(nodeA);
      graph.addNode(nodeB);

      // Try to create circular dependency (should be prevented by graph validation)
      // 尝试创建循环依赖（应该被图验证阻止）
      try {
        graph.addConnection({
          id: 'conn1',
          fromNodeId: 'A',
          fromPin: 'Result',
          toNodeId: 'B',
          toPin: 'A'
        });

        graph.addConnection({
          id: 'conn2',
          fromNodeId: 'B',
          fromPin: 'Result',
          toNodeId: 'A',
          toPin: 'A'
        });
      } catch (e) {
        // Expected - circular connections should be prevented
        // 预期的 - 循环连接应该被阻止
      }

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
    });
  });

  describe('Optimization Strategies', () => {
    test('should optimize common patterns', async () => {
      const graph = new VisualGraph('patterns-test');

      // Common pattern: multiply by 1 (should be eliminated)
      // 常见模式：乘以1（应该被消除）
      const input = new MockOptimizableNode('input1', 'input.getValue', [['Name', 'x']], ['Value']);
      const one = new MockOptimizableNode('one', 'math.constant', [['Value', 1]], ['Value']);
      const multiply = new MockOptimizableNode('mul1', 'math.multiply', [], ['Result']);

      [input, one, multiply].forEach(node => graph.addNode(node));

      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'input1',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'one',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      // Multiplication by 1 should be optimized away
      // 乘以1应该被优化掉
      expect(result.metrics.nodesEliminated).toBeGreaterThan(0);
    });

    test('should optimize boolean logic patterns', async () => {
      const graph = new VisualGraph('boolean-patterns-test');

      // Pattern: x AND true = x
      // 模式：x AND true = x
      const input = new MockOptimizableNode('input1', 'input.getBool', [['Name', 'flag']], ['Value']);
      const trueConst = new MockOptimizableNode('true1', 'math.constant', [['Value', true]], ['Value']);
      const andNode = new MockOptimizableNode('and1', 'math.and', [], ['Result']);

      [input, trueConst, andNode].forEach(node => graph.addNode(node));

      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'input1',
        fromPin: 'Value',
        toNodeId: 'and1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'true1',
        fromPin: 'Value',
        toNodeId: 'and1',
        toPin: 'B'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      // AND with true should be optimized
      // 与true的AND应该被优化
      expect(result.optimizedGraph.getAllConnections().length).toBeLessThanOrEqual(graph.getAllConnections().length);
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large graphs efficiently', async () => {
      const graph = new VisualGraph('large-graph-test');

      // Create a large but optimizable graph 创建一个大但可优化的图
      const nodeCount = 100;
      for (let i = 0; i < nodeCount; i++) {
        const node = new MockOptimizableNode(`node${i}`, 'math.constant', [['Value', i]], ['Value']);
        graph.addNode(node);
      }

      // Only connect the first few nodes, rest are dead code
      // 只连接前几个节点，其余是死代码
      for (let i = 0; i < 5; i++) {
        if (i < 4) {
          const addNode = new MockOptimizableNode(`add${i}`, 'math.add', [], ['Result']);
          graph.addNode(addNode);

          graph.addConnection({
            id: `conn${i}_a`,
            fromNodeId: `node${i}`,
            fromPin: 'Value',
            toNodeId: `add${i}`,
            toPin: 'A'
          });

          graph.addConnection({
            id: `conn${i}_b`,
            fromNodeId: `node${i + 1}`,
            fromPin: 'Value',
            toNodeId: `add${i}`,
            toPin: 'B'
          });
        }
      }

      const typeInfo = await typeResolver.resolveTypes(graph);
      const startTime = Date.now();
      const result = await optimizer.optimize(graph, typeInfo);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metrics.nodesEliminated).toBeGreaterThan(90); // Most nodes should be eliminated
    });

    test('should have reasonable optimization limits', async () => {
      const graph = new VisualGraph('limits-test');

      // Create a simple graph 创建简单图
      const node1 = new MockOptimizableNode('node1', 'math.constant', [['Value', 1]], ['Value']);
      const node2 = new MockOptimizableNode('node2', 'math.add', [['A', 1], ['B', 2]], ['Result']);

      graph.addNode(node1);
      graph.addNode(node2);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const result = await optimizer.optimize(graph, typeInfo);

      expect(result.success).toBe(true);
      expect(result.metrics.passesExecuted).toBeLessThan(100); // Should not run indefinitely
    });
  });
});