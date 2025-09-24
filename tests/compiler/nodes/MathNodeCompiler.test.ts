/**
 * MathNodeCompiler test suite
 * MathNodeCompiler测试套件
 *
 * Tests for mathematical operations compilation including arithmetic,
 * comparison, logical operations, and constant folding optimizations.
 * 测试数学运算编译，包括算术运算、比较运算、逻辑运算和常量折叠优化。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { MathNodeCompiler } from '../../../editor/src/compiler/nodes/MathNodeCompiler';
import { TypeResolver } from '../../../editor/src/compiler/TypeResolver';
import { VisualGraph } from '../../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockMathNode extends BaseVisualNode {
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

describe('MathNodeCompiler', () => {
  let compiler: MathNodeCompiler;
  let typeResolver: TypeResolver;
  let graph: VisualGraph;

  beforeEach(() => {
    typeResolver = new TypeResolver();
    compiler = new MathNodeCompiler(typeResolver);
    graph = new VisualGraph('test-graph');
  });

  describe('Arithmetic Operations', () => {
    test('should compile addition node', async () => {
      const node = new MockMathNode('add1', 'math.add', [['A', 5], ['B', 3]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_add1 = 5 \+ 3;/);
    });

    test('should compile subtraction node', async () => {
      const node = new MockMathNode('sub1', 'math.subtract', [['A', 10], ['B', 4]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_sub1 = 10 - 4;/);
    });

    test('should compile multiplication node', async () => {
      const node = new MockMathNode('mul1', 'math.multiply', [['A', 6], ['B', 7]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_mul1 = 6 \* 7;/);
    });

    test('should compile division node', async () => {
      const node = new MockMathNode('div1', 'math.divide', [['A', 15], ['B', 3]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_div1 = 15 \/ 3;/);
    });

    test('should compile modulo node', async () => {
      const node = new MockMathNode('mod1', 'math.modulo', [['A', 17], ['B', 5]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_mod1 = 17 % 5;/);
    });

    test('should compile power node', async () => {
      const node = new MockMathNode('pow1', 'math.power', [['A', 2], ['B', 8]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_pow1 = Math\.pow\(2, 8\);/);
    });
  });

  describe('Comparison Operations', () => {
    test('should compile equals node', async () => {
      const node = new MockMathNode('eq1', 'math.equals', [['A', 5], ['B', 5]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_eq1 = 5 === 5;/);
    });

    test('should compile not equals node', async () => {
      const node = new MockMathNode('neq1', 'math.notEquals', [['A', 3], ['B', 7]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_neq1 = 3 !== 7;/);
    });

    test('should compile greater than node', async () => {
      const node = new MockMathNode('gt1', 'math.greaterThan', [['A', 10], ['B', 5]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_gt1 = 10 > 5;/);
    });

    test('should compile less than node', async () => {
      const node = new MockMathNode('lt1', 'math.lessThan', [['A', 3], ['B', 8]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_lt1 = 3 < 8;/);
    });

    test('should compile greater than or equal node', async () => {
      const node = new MockMathNode('gte1', 'math.greaterThanOrEqual', [['A', 7], ['B', 7]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_gte1 = 7 >= 7;/);
    });

    test('should compile less than or equal node', async () => {
      const node = new MockMathNode('lte1', 'math.lessThanOrEqual', [['A', 4], ['B', 9]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_lte1 = 4 <= 9;/);
    });
  });

  describe('Logical Operations', () => {
    test('should compile logical AND node', async () => {
      const node = new MockMathNode('and1', 'math.and', [['A', true], ['B', false]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_and1 = true && false;/);
    });

    test('should compile logical OR node', async () => {
      const node = new MockMathNode('or1', 'math.or', [['A', false], ['B', true]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_or1 = false \|\| true;/);
    });

    test('should compile logical NOT node', async () => {
      const node = new MockMathNode('not1', 'math.not', [['A', true]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_not1 = !true;/);
    });
  });

  describe('Math Functions', () => {
    test('should compile sin function', async () => {
      const node = new MockMathNode('sin1', 'math.sin', [['X', 1.57]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_sin1 = Math\.sin\(1\.57\);/);
    });

    test('should compile cos function', async () => {
      const node = new MockMathNode('cos1', 'math.cos', [['X', 0]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_cos1 = Math\.cos\(0\);/);
    });

    test('should compile sqrt function', async () => {
      const node = new MockMathNode('sqrt1', 'math.sqrt', [['X', 16]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_sqrt1 = Math\.sqrt\(16\);/);
    });

    test('should compile abs function', async () => {
      const node = new MockMathNode('abs1', 'math.abs', [['X', -5]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_abs1 = Math\.abs\(-5\);/);
    });

    test('should compile floor function', async () => {
      const node = new MockMathNode('floor1', 'math.floor', [['X', 3.7]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_floor1 = Math\.floor\(3\.7\);/);
    });

    test('should compile ceil function', async () => {
      const node = new MockMathNode('ceil1', 'math.ceil', [['X', 2.1]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_ceil1 = Math\.ceil\(2\.1\);/);
    });

    test('should compile round function', async () => {
      const node = new MockMathNode('round1', 'math.round', [['X', 2.6]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_round1 = Math\.round\(2\.6\);/);
    });

    test('should compile min function', async () => {
      const node = new MockMathNode('min1', 'math.min', [['A', 5], ['B', 3]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_min1 = Math\.min\(5, 3\);/);
    });

    test('should compile max function', async () => {
      const node = new MockMathNode('max1', 'math.max', [['A', 2], ['B', 8]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const result_max1 = Math\.max\(2, 8\);/);
    });
  });

  describe('Constant and Variable Nodes', () => {
    test('should compile constant node', async () => {
      const node = new MockMathNode('const1', 'math.constant', [['Value', 42]], ['Value']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const value_const1 = 42;/);
    });

    test('should compile PI constant', async () => {
      const node = new MockMathNode('pi1', 'math.pi', [], ['Value']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const value_pi1 = Math\.PI;/);
    });

    test('should compile E constant', async () => {
      const node = new MockMathNode('e1', 'math.e', [], ['Value']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      expect(code).toMatch(/const value_e1 = Math\.E;/);
    });
  });

  describe('Connected Inputs', () => {
    test('should handle connected inputs in arithmetic operations', async () => {
      const const1 = new MockMathNode('const1', 'math.constant', [['Value', 10]], ['Value']);
      const const2 = new MockMathNode('const2', 'math.constant', [['Value', 5]], ['Value']);
      const addNode = new MockMathNode('add1', 'math.add', [], ['Result']);

      graph.addNode(const1);
      graph.addNode(const2);
      graph.addNode(addNode);

      // Connect constants to add inputs 连接常量到加法输入
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
      const code = await compiler.compile(addNode, graph, typeInfo);

      // Should use variables from connected nodes 应该使用来自连接节点的变量
      expect(code).toMatch(/const result_add1 = value_const1 \+ value_const2;/);
    });

    test('should handle mixed literal and connected inputs', async () => {
      const constNode = new MockMathNode('const1', 'math.constant', [['Value', 7]], ['Value']);
      const mulNode = new MockMathNode('mul1', 'math.multiply', [['B', 3]], ['Result']);

      graph.addNode(constNode);
      graph.addNode(mulNode);

      // Connect constant to A input, B has literal value 连接常量到A输入，B有字面值
      graph.addConnection({
        id: 'conn1',
        fromNodeId: 'const1',
        fromPin: 'Value',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(mulNode, graph, typeInfo);

      expect(code).toMatch(/const result_mul1 = value_const1 \* 3;/);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unsupported math operation', async () => {
      const node = new MockMathNode('invalid1', 'math.unsupportedOperation', [], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);

      await expect(compiler.compile(node, graph, typeInfo)).rejects.toThrow(
        'Unsupported math node type: math.unsupportedOperation'
      );
    });

    test('should handle missing required inputs', async () => {
      const node = new MockMathNode('add1', 'math.add', [['A', 5]], ['Result']); // Missing B input
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Should use default value for missing input 应该为缺失的输入使用默认值
      expect(code).toMatch(/const result_add1 = 5 \+ 0;/);
    });

    test('should handle null/undefined input values', async () => {
      const node = new MockMathNode('add1', 'math.add', [['A', null], ['B', undefined]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Should convert null/undefined to default values 应该将null/undefined转换为默认值
      expect(code).toMatch(/const result_add1 = 0 \+ 0;/);
    });
  });

  describe('Code Generation Quality', () => {
    test('should generate clean, readable code', async () => {
      const node = new MockMathNode('add1', 'math.add', [['A', 5], ['B', 3]], ['Result']);
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
      const resultNode = new MockMathNode('calculation', 'math.multiply', [['A', 4], ['B', 5]], ['Result']);
      const valueNode = new MockMathNode('myValue', 'math.constant', [['Value', 42]], ['Value']);

      graph.addNode(resultNode);
      graph.addNode(valueNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const resultCode = await compiler.compile(resultNode, graph, typeInfo);
      const valueCode = await compiler.compile(valueNode, graph, typeInfo);

      // Variable names should be based on output name and node ID 变量名应基于输出名和节点ID
      expect(resultCode).toMatch(/const result_calculation/);
      expect(valueCode).toMatch(/const value_myValue/);
    });

    test('should handle special characters in node IDs', async () => {
      const node = new MockMathNode('my-special_node.1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const code = await compiler.compile(node, graph, typeInfo);

      // Should generate valid identifier from node ID 应该从节点ID生成有效标识符
      expect(code).toMatch(/const result_myspecialnode1/);
    });
  });

  describe('Required Imports', () => {
    test('should return empty imports for basic math operations', () => {
      const addNode = new MockMathNode('add1', 'math.add', [], ['Result']);
      const imports = compiler.getRequiredImports(addNode);

      // Math operations use built-in JavaScript Math object 数学运算使用内置的JavaScript Math对象
      expect(imports).toHaveLength(0);
    });

    test('should return empty imports for comparison operations', () => {
      const eqNode = new MockMathNode('eq1', 'math.equals', [], ['Result']);
      const imports = compiler.getRequiredImports(eqNode);

      expect(imports).toHaveLength(0);
    });

    test('should return empty imports for logical operations', () => {
      const andNode = new MockMathNode('and1', 'math.and', [], ['Result']);
      const imports = compiler.getRequiredImports(andNode);

      expect(imports).toHaveLength(0);
    });
  });

  describe('Type Inference', () => {
    test('should correctly infer numeric result types', async () => {
      const addNode = new MockMathNode('add1', 'math.add', [['A', 5.5], ['B', 3.2]], ['Result']);
      graph.addNode(addNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const nodeType = typeInfo.nodeTypes.get('add1');

      expect(nodeType?.outputs.get('Result')?.typeName).toBe('number');
    });

    test('should correctly infer boolean result types', async () => {
      const eqNode = new MockMathNode('eq1', 'math.equals', [['A', 5], ['B', 5]], ['Result']);
      graph.addNode(eqNode);

      const typeInfo = await typeResolver.resolveTypes(graph);
      const nodeType = typeInfo.nodeTypes.get('eq1');

      expect(nodeType?.outputs.get('Result')?.typeName).toBe('boolean');
    });
  });
});