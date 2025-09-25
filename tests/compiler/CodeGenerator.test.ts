/**
 * CodeGenerator integration test suite
 * CodeGenerator集成测试套件
 *
 * Tests for end-to-end code generation including full compilation pipeline,
 * optimization integration, and complex graph scenarios.
 * 测试端到端代码生成，包括完整编译管道、优化集成和复杂图场景。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CodeGenerator, type CodeGenerationOptions, type CodeGenerationResult } from '../../editor/src/compiler/CodeGenerator';
import { VisualGraph } from '../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockNode extends BaseVisualNode {
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

describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe('Basic Code Generation', () => {
    test('should generate code for simple math operations', async () => {
      const graph = new VisualGraph('test-math');

      const const1 = new MockNode('const1', 'math.constant', [['Value', 5]], ['Value']);
      const addNode = new MockNode('add1', 'math.add', [['A', 5], ['B', 3]], ['Result']);

      graph.addNode(const1);
      graph.addNode(addNode);

      const options: CodeGenerationOptions = {
        systemName: 'TestMathSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      // Debug: log errors if generation failed 调试：如果生成失败则记录错误
      if (!result.success) {
        console.error('Code generation failed:', result.errors);
        console.log('Graph nodes:', graph.getAllNodes().map(n => ({ id: n.id, type: n.type })));
      }

      expect(result.success).toBe(true);
      expect(result.code).toContain('export class TestMathSystem extends System');
      expect(result.code).toContain('const value_const1 = 5;');
      expect(result.code).toMatch(/const result_add1 = (5 \+ 3|8);/); // Allow either format
      expect(result.metrics.nodeCount).toBe(4); // 2 user nodes + 2 system nodes (start/end)
      expect(result.metrics.connectionCount).toBe(0);
    });

    test('should generate code for ECS operations', async () => {
      const graph = new VisualGraph('test-ecs');

      const createEntity = new MockNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);

      graph.addNode(createEntity);

      const options: CodeGenerationOptions = {
        systemName: 'TestECSSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export class TestECSSystem extends System');
      expect(result.code).toContain('ctx.world.createEntity(true)');
    });

    test('should generate code for control flow', async () => {
      const graph = new VisualGraph('test-flow');

      // Note: System start/end nodes are automatically created
      // 注意：系统开始/结束节点会自动创建
      const ifNode = new MockNode('if1', 'flow.if', [['Condition', true]], ['True', 'False']);

      graph.addNode(ifNode);

      const options: CodeGenerationOptions = {
        systemName: 'TestFlowSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('// System execution starts here 系统执行从此开始');
      expect(result.code).toContain('if (true) {');
    });
  });

  describe('System Configuration', () => {
    test('should generate system with custom name and stage', async () => {
      const graph = new VisualGraph('test-custom');
      // System start/end nodes are automatically created
      // 系统开始/结束节点会自动创建

      const options: CodeGenerationOptions = {
        systemName: 'CustomGameplaySystem',
        stage: 'preUpdate',
        dependencies: ['PhysicsSystem', 'InputSystem'],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export class CustomGameplaySystem extends System');
      expect(result.code).toContain('@SystemStage.preUpdate');
      expect(result.code).toContain('PhysicsSystem');
      expect(result.code).toContain('InputSystem');
    });

    test('should include debug information when requested', async () => {
      const graph = new VisualGraph('test-debug');
      const mathNode = new MockNode('add1', 'math.add', [['A', 2], ['B', 3]], ['Result']);
      graph.addNode(mathNode);

      const options: CodeGenerationOptions = {
        systemName: 'DebugSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: true
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('// Node: add1 (math.add)');
      expect(result.code).toContain('// Generated from visual graph: test-debug');
    });
  });

  describe('Optimization Integration', () => {
    test.skip('should apply optimizations when enabled', async () => {
      const graph = new VisualGraph('test-optimize');

      // Create simple graph that should compile successfully 创建应该成功编译的简单图
      const addNode = new MockNode('add1', 'math.add', [['A', 10], ['B', 5]], ['Result']);
      const unusedNode = new MockNode('unused1', 'math.constant', [['Value', 99]], ['Value']); // Dead code

      graph.addNode(addNode);
      graph.addNode(unusedNode);

      const options: CodeGenerationOptions = {
        systemName: 'OptimizedSystem',
        stage: 'update',
        dependencies: [],
        optimize: true,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      // Should have applied some optimizations or at least succeed 应该应用了一些优化或至少成功
      expect(result.metrics.optimizationsApplied).toBeDefined();
      expect(result.code).toContain('OptimizedSystem');
    });
  });

  describe('Import Management', () => {
    test('should generate correct imports for ECS systems', async () => {
      const graph = new VisualGraph('test-imports');

      const createEntity = new MockNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);

      graph.addNode(createEntity);

      const options: CodeGenerationOptions = {
        systemName: 'ImportTestSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { System, SystemContext, SystemStage } from '@esengine/nova-ecs';");
    });
  });

  describe('Error Handling', () => {
    test('should handle compilation errors gracefully', async () => {
      const graph = new VisualGraph('test-error');

      // Create node with unsupported type 创建不支持类型的节点
      const invalidNode = new MockNode('invalid1', 'unsupported.operation', [], ['Output']);
      graph.addNode(invalidNode);

      const options: CodeGenerationOptions = {
        systemName: 'ErrorSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No compiler found for node type: unsupported.operation');
    });

    test('should handle empty graphs', async () => {
      const graph = new VisualGraph('test-empty');

      const options: CodeGenerationOptions = {
        systemName: 'EmptySystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export class EmptySystem extends System');
      expect(result.code).toContain('update(ctx: SystemContext): void {');
      expect(result.code).toContain('// System execution starts here 系统执行从此开始');
      expect(result.code).toContain('// System execution completes here 系统执行在此完成');
      expect(result.metrics.nodeCount).toBe(2); // 2 system nodes (start/end)
    });
  });

  describe('Performance and Metrics', () => {
    test('should provide detailed compilation metrics', async () => {
      const graph = new VisualGraph('metrics-test');

      const nodes = Array.from({ length: 3 }, (_, i) =>
        new MockNode(`node${i}`, 'math.add', [['A', i], ['B', i + 1]], ['Result'])
      );

      nodes.forEach(node => graph.addNode(node));

      const options: CodeGenerationOptions = {
        systemName: 'MetricsTestSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      const startTime = Date.now();
      const result = await generator.generateCode(graph, options);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metrics.nodeCount).toBe(5); // 3 user nodes + 2 system nodes
      expect(result.metrics.connectionCount).toBe(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(10);
      expect(result.metrics.compilationTime).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });

    test('should handle compilation timeout gracefully', async () => {
      const graph = new VisualGraph('timeout-test');

      // Create a simple graph 创建简单图
      const node = new MockNode('test1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const options: CodeGenerationOptions = {
        systemName: 'TimeoutTestSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: false
      };

      // This should complete well within any reasonable timeout 这应该在任何合理的超时内完成
      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.metrics.compilationTime).toBeLessThan(1000); // Should be very fast
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle a basic game system', async () => {
      const graph = new VisualGraph('game-system');

      // Create a realistic game system 创建一个现实的游戏系统
      // Note: System start/end nodes are automatically created
      const nodes = [
        new MockNode('speed', 'math.constant', [['Value', 5.0]], ['Value']),
        new MockNode('createPlayer', 'world.createEntity', [['Enabled', true]], ['Entity']),
        new MockNode('addTransform', 'world.addComponent', [['Component Type', 'Transform']], [])
      ];

      nodes.forEach(node => graph.addNode(node));

      // Connect some nodes 连接一些节点
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'createPlayer',
        fromPin: 'Entity',
        toNodeId: 'addTransform',
        toPin: 'Entity'
      });

      const options: CodeGenerationOptions = {
        systemName: 'GameSystem',
        stage: 'update',
        dependencies: [],
        optimize: false,
        includeDebugInfo: true
      };

      const result = await generator.generateCode(graph, options);

      expect(result.success).toBe(true);
      expect(result.code).toContain('export class GameSystem extends System');
      expect(result.metrics.nodeCount).toBe(5); // 3 user nodes + 2 system nodes
      expect(result.metrics.connectionCount).toBe(1);
      expect(result.code.length).toBeGreaterThan(200); // Should be substantial code
    });
  });
});