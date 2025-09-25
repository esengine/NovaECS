/**
 * TypeResolver test suite
 * TypeResolver测试套件
 *
 * Tests for the type resolution system used in visual graph compilation.
 * Covers type inference, validation, and error handling.
 * 测试可视化图编译中使用的类型解析系统。
 * 涵盖类型推断、验证和错误处理。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TypeResolver } from '../../editor/src/compiler/TypeResolver';
import { VisualGraph } from '../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockVisualNode extends BaseVisualNode {
  constructor(id: string, type: string, inputs: [string, any][] = [], outputs: string[] = []) {
    super(id, type);

    // Set inputs 设置输入
    inputs.forEach(([name, value]) => {
      this.inputs.set(name, value);
    });

    // Set outputs 设置输出
    outputs.forEach(name => {
      this.outputs.set(name, undefined);
    });
  }

  execute(): void {
    // Mock implementation
  }

  shouldExecute(): boolean {
    return true;
  }
}

describe('TypeResolver', () => {
  let typeResolver: TypeResolver;
  let graph: VisualGraph;

  beforeEach(() => {
    typeResolver = new TypeResolver();
    graph = new VisualGraph('test-graph');
  });

  describe('Built-in Type Mappings', () => {
    test('should recognize primitive types', async () => {
      const node = new MockVisualNode('node1', 'math.add', [['A', 5], ['B', 3]], ['Result']);
      graph.addNode(node);

      const result = await typeResolver.resolveTypes(graph);

      expect(result.errors).toHaveLength(0);
      expect(result.nodeTypes.has('node1')).toBe(true);

      const nodeType = result.nodeTypes.get('node1');
      expect(nodeType?.inputs.get('A')?.typeName).toBe('number');
      expect(nodeType?.inputs.get('B')?.typeName).toBe('number');
      expect(nodeType?.outputs.get('Result')?.typeName).toBe('number');
    });

    test('should recognize ECS types', async () => {
      const createNode = new MockVisualNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      graph.addNode(createNode);

      const result = await typeResolver.resolveTypes(graph);

      const nodeType = result.nodeTypes.get('create1');
      expect(nodeType?.outputs.get('Entity')?.typeName).toBe('Entity');
      expect(nodeType?.outputs.get('Entity')?.importSource).toBe('@esengine/nova-ecs');
    });

    test('should handle execution flow types', async () => {
      const startNode = new MockVisualNode('start1', 'flow.start', [], ['Execute']);
      graph.addNode(startNode);

      const result = await typeResolver.resolveTypes(graph);

      const nodeType = result.nodeTypes.get('start1');
      expect(nodeType?.outputs.get('Execute')?.typeName).toBe('void');
    });
  });

  describe('Connection Validation', () => {
    test('should validate compatible type connections', async () => {
      const mathNode1 = new MockVisualNode('math1', 'math.add', [['A', 5], ['B', 3]], ['Result']);
      const mathNode2 = new MockVisualNode('math2', 'math.multiply', [['A', 0], ['B', 2]], ['Result']);

      graph.addNode(mathNode1);
      graph.addNode(mathNode2);

      // Connect math1.Result to math2.A 连接math1.Result到math2.A
      const connection = {
        id: 'conn1',
        fromNodeId: 'math1',
        fromPin: 'Result',
        toNodeId: 'math2',
        toPin: 'A'
      };
      graph.addConnection(connection);

      const result = await typeResolver.resolveTypes(graph);

      expect(result.connectionValidation.get('conn1')).toBe(true);
      expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should detect type mismatches', async () => {
      const createNode = new MockVisualNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']);
      const mathNode = new MockVisualNode('math1', 'math.add', [['A', 0], ['B', 0]], ['Result']);

      graph.addNode(createNode);
      graph.addNode(mathNode);

      // Invalid connection: Entity to number 无效连接：Entity到number
      const connection = {
        id: 'conn1',
        fromNodeId: 'create1',
        fromPin: 'Entity',
        toNodeId: 'math1',
        toPin: 'A'
      };
      graph.addConnection(connection);

      const result = await typeResolver.resolveTypes(graph);

      expect(result.connectionValidation.get('conn1')).toBe(false);
      expect(result.errors.some(e => e.connectionId === 'conn1')).toBe(true);
    });

    test('should allow any type connections', async () => {
      const anyNode = new MockVisualNode('any1', 'test.any', [], ['Output']);
      const mathNode = new MockVisualNode('math1', 'math.add', [['A', 0], ['B', 0]], ['Result']);

      // Set output type to 'any' 设置输出类型为'any'
      anyNode.outputs.set('Output', undefined);

      graph.addNode(anyNode);
      graph.addNode(mathNode);

      const connection = {
        id: 'conn1',
        fromNodeId: 'any1',
        fromPin: 'Output',
        toNodeId: 'math1',
        toPin: 'A'
      };
      graph.addConnection(connection);

      const result = await typeResolver.resolveTypes(graph);

      // 'any' should be compatible with everything 'any'应该与所有类型兼容
      expect(result.connectionValidation.get('conn1')).toBe(true);
    });
  });

  describe('Node-Specific Type Resolution', () => {
    test('should resolve ECS node types correctly', async () => {
      const queryNode = new MockVisualNode('query1', 'world.query', [['Component Types', []]], ['Query']);
      const addCompNode = new MockVisualNode('addComp1', 'world.addComponent',
        [['Entity', null], ['Component Type', null], ['Component Data', null]], []);

      graph.addNode(queryNode);
      graph.addNode(addCompNode);

      const result = await typeResolver.resolveTypes(graph);

      const queryType = result.nodeTypes.get('query1');
      expect(queryType?.outputs.get('Query')?.typeName).toBe('Query<any[]>');

      const addCompType = result.nodeTypes.get('addComp1');
      expect(addCompType?.inputs.get('Entity')?.typeName).toBe('Entity');
      expect(addCompType?.inputs.get('Component Type')?.typeName).toBe('ComponentConstructor<any>');
    });

    test('should resolve math node types with operator-specific behavior', async () => {
      const addNode = new MockVisualNode('add1', 'math.add', [['A', 5], ['B', 3.14]], ['Result']);
      const compareNode = new MockVisualNode('cmp1', 'math.equals', [['A', 5], ['B', 5]], ['Result']);

      graph.addNode(addNode);
      graph.addNode(compareNode);

      const result = await typeResolver.resolveTypes(graph);

      const addType = result.nodeTypes.get('add1');
      expect(addType?.outputs.get('Result')?.typeName).toBe('number');

      const compareType = result.nodeTypes.get('cmp1');
      expect(compareType?.outputs.get('Result')?.typeName).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid node metadata gracefully', async () => {
      // Create node with metadata method that throws 创建带有抛出异常的元数据方法的节点
      const node = new MockVisualNode('error1', 'test.invalid', [], ['Output']);
      (node as any).getMetadata = () => {
        throw new Error('Invalid metadata');
      };

      graph.addNode(node);

      const result = await typeResolver.resolveTypes(graph);

      // Should not crash and provide fallback types 不应崩溃并提供回退类型
      expect(result.nodeTypes.has('error1')).toBe(true);
      expect(result.errors.some(e => e.nodeId === 'error1')).toBe(true);
    });

    test('should handle missing nodes in connections', async () => {
      const connection = {
        id: 'conn1',
        fromNodeId: 'nonexistent1',
        fromPin: 'Output',
        toNodeId: 'nonexistent2',
        toPin: 'Input'
      };

      // Add connection without nodes 添加没有节点的连接
      (graph as any).connections.set('conn1', connection);

      const result = await typeResolver.resolveTypes(graph);

      expect(result.connectionValidation.get('conn1')).toBe(false);
      expect(result.errors.some(e => e.connectionId === 'conn1')).toBe(true);
    });
  });

  describe('Global Imports', () => {
    test('should collect required imports', async () => {
      const entityNode = new MockVisualNode('entity1', 'world.createEntity', [], ['Entity']);
      const queryNode = new MockVisualNode('query1', 'world.query', [], ['Query']);

      graph.addNode(entityNode);
      graph.addNode(queryNode);

      const result = await typeResolver.resolveTypes(graph);

      expect(result.globalImports.size).toBeGreaterThan(0);
      expect(Array.from(result.globalImports).some(imp =>
        imp.includes('Entity') && imp.includes('@esengine/nova-ecs')
      )).toBe(true);
    });

    test('should avoid duplicate imports', async () => {
      const entity1 = new MockVisualNode('entity1', 'world.createEntity', [], ['Entity']);
      const entity2 = new MockVisualNode('entity2', 'world.createEntity', [], ['Entity']);

      graph.addNode(entity1);
      graph.addNode(entity2);

      const result = await typeResolver.resolveTypes(graph);

      const entityImports = Array.from(result.globalImports).filter(imp =>
        imp.includes('Entity')
      );
      expect(entityImports.length).toBe(1);
    });
  });

  describe('Type String Mapping', () => {
    test('should handle array types', async () => {
      const node = new MockVisualNode('array1', 'test.array', [], ['Items']);

      // Mock metadata with array type 使用数组类型的模拟元数据
      (node as any).getMetadata = () => ({
        outputs: [{ label: 'Items', type: 'string[]' }]
      });

      graph.addNode(node);

      const result = await typeResolver.resolveTypes(graph);

      const nodeType = result.nodeTypes.get('array1');
      expect(nodeType?.outputs.get('Items')?.typeName).toBe('string[]');
      expect(nodeType?.outputs.get('Items')?.elementType).toBe('string');
    });

    test('should handle generic types', async () => {
      const node = new MockVisualNode('generic1', 'test.generic', [], ['Collection']);

      (node as any).getMetadata = () => ({
        outputs: [{ label: 'Collection', type: 'Map<string, number>' }]
      });

      graph.addNode(node);

      const result = await typeResolver.resolveTypes(graph);

      const nodeType = result.nodeTypes.get('generic1');
      expect(nodeType?.outputs.get('Collection')?.typeName).toBe('Map<string, number>');
    });
  });

  describe('Complex Graph Scenarios', () => {
    test('should handle large graphs with multiple node types', async () => {
      // Create a complex graph with mixed node types 创建包含混合节点类型的复杂图
      const nodes = [
        new MockVisualNode('start1', 'flow.start', [], ['Execute']),
        new MockVisualNode('create1', 'world.createEntity', [['Enabled', true]], ['Entity']),
        new MockVisualNode('math1', 'math.add', [['A', 5], ['B', 3]], ['Result']),
        new MockVisualNode('math2', 'math.multiply', [['A', 0], ['B', 2]], ['Result']),
        new MockVisualNode('query1', 'world.query', [['Component Types', []]], ['Query']),
      ];

      nodes.forEach(node => graph.addNode(node));

      // Add connections 添加连接
      const connections = [
        { id: 'c1', fromNodeId: 'math1', fromPin: 'Result', toNodeId: 'math2', toPin: 'A' },
        { id: 'c2', fromNodeId: 'start1', fromPin: 'Execute', toNodeId: 'create1', toPin: 'Execute' }
      ];

      connections.forEach(conn => {
        try {
          graph.addConnection(conn);
        } catch (e) {
          // Some connections might be invalid - that's OK for testing
          // 一些连接可能无效 - 这在测试中是可以的
        }
      });

      const result = await typeResolver.resolveTypes(graph);

      expect(result.nodeTypes.size).toBe(7); // 5 user nodes + 2 system nodes
      expect(result.errors.filter(e => e.severity === 'error').length).toBeLessThan(3);
    });

    test('should handle circular references gracefully', async () => {
      const node1 = new MockVisualNode('loop1', 'math.add', [['A', 0], ['B', 0]], ['Result']);
      const node2 = new MockVisualNode('loop2', 'math.multiply', [['A', 0], ['B', 0]], ['Result']);

      graph.addNode(node1);
      graph.addNode(node2);

      // Create circular connection (which should be prevented by graph validation)
      // 创建循环连接（应该被图验证阻止）
      try {
        graph.addConnection({
          id: 'c1',
          fromNodeId: 'loop1',
          fromPin: 'Result',
          toNodeId: 'loop2',
          toPin: 'A'
        });

        graph.addConnection({
          id: 'c2',
          fromNodeId: 'loop2',
          fromPin: 'Result',
          toNodeId: 'loop1',
          toPin: 'B'
        });
      } catch (e) {
        // Expected - circular connections should be prevented
        // 预期的 - 循环连接应该被阻止
      }

      const result = await typeResolver.resolveTypes(graph);

      // Should complete without infinite loops 应该完成而不会无限循环
      expect(result.nodeTypes.size).toBe(4); // 2 user nodes + 2 system nodes
    });
  });
});