/**
 * ECSNodeCompiler test suite
 * ECSNodeCompiler测试套件
 *
 * Tests for ECS node compilation including entity operations, component
 * management, and query operations. Validates generated TypeScript code.
 * 测试ECS节点编译，包括实体操作、组件管理和查询操作。验证生成的TypeScript代码。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ECSNodeCompiler } from '../../../editor/src/compiler/nodes/ECSNodeCompiler';
import { TypeResolver } from '../../../editor/src/compiler/TypeResolver';
import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockECSNode extends BaseVisualNode {
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

describe('ECSNodeCompiler', () => {
  let compiler: ECSNodeCompiler;
  let typeResolver: TypeResolver;
  let graph: VisualGraph;

  beforeEach(() => {
    typeResolver = new TypeResolver();
    compiler = new ECSNodeCompiler(typeResolver);
    graph = new VisualGraph('test-graph');
  });

  describe('Entity Operations', () => {
    test('should compile createEntity node', async () => {
      const node = new MockECSNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('ctx.world.createEntity(true)');
      expect(code).toMatch(/const .+_create1 = ctx\.world\.createEntity\(true\);/);
    });

    test('should compile createEntity with connected input', async () => {
      const enabledNode = new MockECSNode('enabled1', 'math.constant', [['Value', false]], ['Value']);
      const createNode = new MockECSNode('create1', 'world.createEntity', [], ['Entity']);

      graph.addNode(enabledNode);
      graph.addNode(createNode);

      // Connect enabled value 连接enabled值
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'enabled1',
        fromPin: 'Value',
        toNodeId: 'create1',
        toPin: 'Enabled'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(createNode, graph, typeInfo);

      expect(code).toContain('ctx.world.createEntity');
      // Should use variable from connected node 应该使用来自连接节点的变量
      expect(code).toMatch(/ctx\.world\.createEntity\(.+_enabled1\)/);
    });

    test('should compile destroyEntity node', async () => {
      const node = new MockECSNode('destroy1', 'world.destroyEntity', [['Entity', 123]], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('ctx.world.destroyEntity(123)');
    });

    test('should handle destroyEntity without entity input', async () => {
      const node = new MockECSNode('destroy1', 'world.destroyEntity', [], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'DestroyEntity node requires Entity input'
      );
    });
  });

  describe('Component Operations', () => {
    test('should compile addComponent node', async () => {
      const node = new MockECSNode('addComp1', 'world.addComponent', [
        ['Entity', 123],
        ['Component Type', 'Transform'],
        ['Component Data', { x: 0, y: 0 }]
      ], []);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('ctx.world.addComponent(123, Transform, {"x":0,"y":0})');
    });

    test('should compile addComponent without component data', async () => {
      const node = new MockECSNode('addComp1', 'world.addComponent', [
        ['Entity', 123],
        ['Component Type', 'Transform']
      ], []);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('ctx.world.addComponent(123, Transform)');
      expect(code).not.toContain('undefined');
    });

    test('should compile removeComponent node', async () => {
      const node = new MockECSNode('removeComp1', 'world.removeComponent', [
        ['Entity', 456],
        ['Component Type', 'Velocity']
      ], []);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('ctx.world.removeComponent(456, Velocity)');
    });

    test('should compile getComponent node', async () => {
      const node = new MockECSNode('getComp1', 'world.getComponent', [
        ['Entity', 789],
        ['Component Type', 'Health']
      ], ['Component']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_getComp1 = ctx\.world\.getComponent\(789, Health\);/);
    });

    test('should compile hasComponent node', async () => {
      const node = new MockECSNode('hasComp1', 'world.hasComponent', [
        ['Entity', 101],
        ['Component Type', 'Sprite']
      ], ['Has Component']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_hasComp1 = ctx\.world\.hasComponent\(101, Sprite\);/);
    });
  });

  describe('Query Operations', () => {
    test('should compile query node with component types', async () => {
      const node = new MockECSNode('query1', 'world.query', [
        ['Component Types', ['Transform', 'Velocity']]
      ], ['Query']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_query1 = ctx\.world\.query\(Transform, Velocity\);/);
    });

    test('should compile query node with single component type', async () => {
      const node = new MockECSNode('query1', 'world.query', [
        ['Component Types', 'Transform']
      ], ['Query']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_query1 = ctx\.world\.query\(Transform\);/);
    });

    test('should handle query node without component types', async () => {
      const node = new MockECSNode('query1', 'world.query', [], ['Query']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'Query node requires Component Types input'
      );
    });

    test('should compile forEach node', async () => {
      const node = new MockECSNode('forEach1', 'query.forEach', [
        ['Query', 'someQuery']
      ], []);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toContain('someQuery.forEach((entity, ...components) => {');
      expect(code).toContain('// TODO: Handle forEach callback');
      expect(code).toContain('});');
    });

    test('should compile count node', async () => {
      const node = new MockECSNode('count1', 'query.count', [
        ['Query', 'myQuery']
      ], ['Count']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_count1 = myQuery\.count\(\);/);
    });

    test('should compile without node', async () => {
      const node = new MockECSNode('without1', 'query.without', [
        ['Query', 'baseQuery'],
        ['Exclude Types', ['Disabled', 'Dead']]
      ], ['Filtered Query']);

      graph.addNode(node);
      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const .+_without1 = baseQuery\.without\(Disabled, Dead\);/);
    });
  });

  describe('Required Imports', () => {
    test('should return empty imports for basic nodes', () => {
      const createNode = new MockECSNode('create1', 'world.createEntity', [], ['Entity']);
      const imports = compiler.getRequiredImports(createNode);

      // ECS nodes use SystemContext which is imported at higher level
      // ECS节点使用在更高级别导入的SystemContext
      expect(imports).toHaveLength(0);
    });

    test('should return Query import for query operations', () => {
      const forEachNode = new MockECSNode('forEach1', 'query.forEach', [], []);
      const imports = compiler.getRequiredImports(forEachNode);

      expect(imports).toContain("import type { Query } from '@esengine/nova-ecs';");
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unsupported node type', async () => {
      const node = new MockECSNode('unsupported1', 'world.unsupportedOperation', [], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'Unsupported ECS node type: world.unsupportedOperation'
      );
    });

    test('should handle missing required inputs gracefully', async () => {
      const node = new MockECSNode('addComp1', 'world.addComponent', [], []);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'AddComponent node requires Entity input'
      );
    });
  });

  describe('Connected Input Handling', () => {
    test('should use connected inputs over literal values', async () => {
      const entityNode = new MockECSNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      const addCompNode = new MockECSNode('addComp1', 'world.addComponent', [
        ['Component Type', 'Transform'],
        ['Component Data', { x: 5, y: 5 }]
      ], []);

      graph.addNode(entityNode);
      graph.addNode(addCompNode);

      // Connect entity output to addComponent input 连接实体输出到addComponent输入
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'create1',
        fromPin: 'Entity',
        toNodeId: 'addComp1',
        toPin: 'Entity'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const addCompCode = await compiler.compile(addCompNode, graph, typeInfo);

      // Should use variable from connected node rather than literal 应该使用来自连接节点的变量而不是字面值
      expect(addCompCode).toMatch(/ctx\.world\.addComponent\(.+_create1, Transform/);
    });

    test('should handle complex connection chains', async () => {
      const createNode = new MockECSNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      const getCompNode = new MockECSNode('getComp1', 'world.getComponent', [['Component Type', 'Transform']], ['Component']);
      const hasCompNode = new MockECSNode('hasComp1', 'world.hasComponent', [['Component Type', 'Health']], ['Has Component']);

      graph.addNode(createNode);
      graph.addNode(getCompNode);
      graph.addNode(hasCompNode);

      // Chain connections 链式连接
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'create1',
        fromPin: 'Entity',
        toNodeId: 'getComp1',
        toPin: 'Entity'
      });

      graph.addConnection({
        id: 'conn2',
        fromNodeId: 'create1',
        fromPin: 'Entity',
        toNodeId: 'hasComp1',
        toPin: 'Entity'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);

      const getCompCode = await compiler.compile(getCompNode, graph, typeInfo);
      const hasCompCode = await compiler.compile(hasCompNode, graph, typeInfo);

      // Both should use the same entity variable 两者都应该使用相同的实体变量
      expect(getCompCode).toMatch(/ctx\.world\.getComponent\(.+_create1, Transform\)/);
      expect(hasCompCode).toMatch(/ctx\.world\.hasComponent\(.+_create1, Health\)/);
    });
  });

  describe('Code Generation Quality', () => {
    test('should generate clean, readable code', async () => {
      const node = new MockECSNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Code should be clean and properly formatted 代码应该干净且格式正确
      expect(code).not.toContain('undefined');
      expect(code).not.toContain('null');
      expect(code.endsWith(';')).toBe(true);
      expect(code.split('\n')).toHaveLength(1); // Single line for simple operations 简单操作单行
    });

    test('should use consistent variable naming', async () => {
      const createNode = new MockECSNode('playerEntity', 'world.createEntity', [['Enabled', true]], ['Entity']);
      graph.addNode(createNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(createNode, graph, typeInfo);

      // Variable name should be based on output name and node ID 变量名应基于输出名和节点ID
      expect(code).toMatch(/const entity_playerEntity/);
    });
  });
});