/**
 * CLI tool test suite
 * CLI工具测试套件
 *
 * Tests for the visual graph compilation CLI tool including file processing,
 * command-line argument handling, and batch compilation scenarios.
 * 测试可视化图编译CLI工具，包括文件处理、命令行参数处理和批量编译场景。
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { VisualCompilerCLI } from '../../tools/compile-visual';
import { VisualGraph } from '../../src/visual/core/VisualGraph';
import { BaseVisualNode } from '../../src/visual/core/BaseVisualNode';

// Mock visual node for testing 测试用的模拟可视化节点
class MockCLINode extends BaseVisualNode {
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

// Mock file system operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    }
  };
});

// Mock glob
vi.mock('glob', () => ({
  default: {
    sync: vi.fn(),
    hasMagic: vi.fn()
  }
}));

// Mock chokidar for watch functionality
vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(() => Promise.resolve())
  }))
}));

describe('VisualCompilerCLI', () => {
  let cli: VisualCompilerCLI;
  let mockReadFile: any;
  let mockWriteFile: any;
  let mockMkdir: any;

  beforeEach(() => {
    cli = new VisualCompilerCLI();
    mockReadFile = vi.mocked(fs.promises.readFile);
    mockWriteFile = vi.mocked(fs.promises.writeFile);
    mockMkdir = vi.mocked(fs.promises.mkdir);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Compilation', () => {
    test('should compile simple visual graph file', async () => {
      // Create test graph data 创建测试图数据
      const graph = new VisualGraph('test-system');
      const startNode = new MockCLINode('start1', 'flow.start', [], ['Execute']);
      const mathNode = new MockCLINode('add1', 'math.add', [['A', 5], ['B', 3]], ['Result']);

      graph.addNode(startNode);
      graph.addNode(mathNode);

      const graphData = graph.serialize();
      const mockFileContent = JSON.stringify(graphData);

      // Mock file system operations 模拟文件系统操作
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['test-input.json'],
        output: 'test-output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('test-input.json', 'test-output.ts', config);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('test-input.json');
      expect(result.outputPath).toBe('test-output.ts');
      expect(mockReadFile).toHaveBeenCalledWith('test-input.json', 'utf-8');
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockMkdir).toHaveBeenCalled();
    });

    test('should handle invalid JSON files', async () => {
      const invalidJson = '{ invalid json content';

      mockReadFile.mockResolvedValue(invalidJson);

      const config = {
        input: ['invalid.json'],
        output: 'output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('invalid.json', 'output.ts', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse JSON');
    });

    test('should handle file read errors', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const config = {
        input: ['nonexistent.json'],
        output: 'output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('nonexistent.json', 'output.ts', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    test('should generate system name from filename', async () => {
      const graph = new VisualGraph('test-graph');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['my-game-logic.json'],
        output: 'output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('my-game-logic.json', 'output.ts', config);

      expect(result.success).toBe(true);

      // Check that generated code uses proper system name 检查生成的代码使用了正确的系统名
      const writeCall = mockWriteFile.mock.calls[0];
      const generatedCode = writeCall[1];
      expect(generatedCode).toContain('class mygamelogic extends System');
    });

    test('should use custom system name when provided', async () => {
      const graph = new VisualGraph('test-graph');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['input.json'],
        output: 'output.ts',
        systemName: 'CustomGameplaySystem',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('input.json', 'output.ts', config);

      expect(result.success).toBe(true);

      const writeCall = mockWriteFile.mock.calls[0];
      const generatedCode = writeCall[1];
      expect(generatedCode).toContain('class CustomGameplaySystem extends System');
    });
  });

  describe('Batch Compilation', () => {
    test('should compile multiple files', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      // Mock glob to return multiple files 模拟glob返回多个文件
      mockGlob.sync.mockReturnValue(['file1.json', 'file2.json', 'file3.json']);
      mockGlob.hasMagic.mockReturnValue(true);

      // Create test graph for each file 为每个文件创建测试图
      const graph1 = new VisualGraph('system1');
      const graph2 = new VisualGraph('system2');
      const graph3 = new VisualGraph('system3');

      [graph1, graph2, graph3].forEach(graph => {
        const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
        graph.addNode(node);
      });

      // Mock file reads 模拟文件读取
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(graph1.serialize()))
        .mockResolvedValueOnce(JSON.stringify(graph2.serialize()))
        .mockResolvedValueOnce(JSON.stringify(graph3.serialize()));

      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['*.json'],
        output: './dist/',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledTimes(3);
    });

    test('should handle empty file list', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      mockGlob.sync.mockReturnValue([]);
      mockGlob.hasMagic.mockReturnValue(true);

      const config = {
        input: ['nonexistent/*.json'],
        output: './dist/',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(0);
    });

    test('should handle mixed success and failure results', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      mockGlob.sync.mockReturnValue(['good.json', 'bad.json']);
      mockGlob.hasMagic.mockReturnValue(true);

      // Mock successful and failed file reads 模拟成功和失败的文件读取
      const goodGraph = new VisualGraph('good-system');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      goodGraph.addNode(node);

      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(goodGraph.serialize()))
        .mockRejectedValueOnce(new Error('File read error'));

      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['*.json'],
        output: './dist/',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('File read error');
    });
  });

  describe('Configuration Options', () => {
    test('should apply optimization settings', async () => {
      const graph = new VisualGraph('optimization-test');

      // Create graph with optimization opportunities 创建有优化机会的图
      const const1 = new MockCLINode('const1', 'math.constant', [['Value', 10]], ['Value']);
      const const2 = new MockCLINode('const2', 'math.constant', [['Value', 5]], ['Value']);
      const addNode = new MockCLINode('add1', 'math.add', [], ['Result']);
      const unusedNode = new MockCLINode('unused1', 'math.multiply', [['A', 2], ['B', 3]], ['Result']);

      [const1, const2, addNode, unusedNode].forEach(node => graph.addNode(node));

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

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['optimizable.json'],
        output: 'optimized.ts',
        optimize: true,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('optimizable.json', 'optimized.ts', config);

      expect(result.success).toBe(true);
      expect(result.metrics?.optimizations).toBeGreaterThan(0);
    });

    test('should apply debug settings', async () => {
      const graph = new VisualGraph('debug-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['debug.json'],
        output: 'debug.ts',
        optimize: false,
        debug: true,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('debug.json', 'debug.ts', config);

      expect(result.success).toBe(true);

      const writeCall = mockWriteFile.mock.calls[0];
      const generatedCode = writeCall[1];
      expect(generatedCode).toContain('// Generated from visual graph: debug-test');
      expect(generatedCode).toContain('// Node: node1 (math.add)');
    });

    test('should apply formatting settings', async () => {
      const graph = new VisualGraph('format-test');
      const node = new MockCLINode('node1', 'flow.if', [['Condition', true]], ['True', 'False']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['format.json'],
        output: 'format.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 4,
          useTabs: false,
          lineEnding: 'crlf' as const
        }
      };

      const result = await cli.compileFile('format.json', 'format.ts', config);

      expect(result.success).toBe(true);

      const writeCall = mockWriteFile.mock.calls[0];
      const generatedCode = writeCall[1];

      // Check for 4-space indentation in conditional 检查条件语句中的4个空格缩进
      expect(generatedCode).toMatch(/^    /m); // Should have lines with 4-space indent
    });

    test('should apply system configuration', async () => {
      const graph = new VisualGraph('config-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['config.json'],
        output: 'config.ts',
        systemName: 'ConfigurableSystem',
        stage: 'preUpdate' as const,
        dependencies: ['PhysicsSystem', 'InputSystem'],
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('config.json', 'config.ts', config);

      expect(result.success).toBe(true);

      const writeCall = mockWriteFile.mock.calls[0];
      const generatedCode = writeCall[1];
      expect(generatedCode).toContain('class ConfigurableSystem extends System');
      expect(generatedCode).toContain('@SystemStage.preUpdate');
      expect(generatedCode).toContain('PhysicsSystem');
      expect(generatedCode).toContain('InputSystem');
    });
  });

  describe('Output Path Generation', () => {
    test('should generate output paths for directory output', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      mockGlob.sync.mockReturnValue(['scenes/level1.json', 'scenes/level2.json']);
      mockGlob.hasMagic.mockReturnValue(true);

      // Create test graphs 创建测试图
      const graph1 = new VisualGraph('level1');
      const graph2 = new VisualGraph('level2');
      [graph1, graph2].forEach(graph => {
        const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
        graph.addNode(node);
      });

      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(graph1.serialize()))
        .mockResolvedValueOnce(JSON.stringify(graph2.serialize()));

      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['scenes/*.json'],
        output: './dist/', // Directory output 目录输出
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(2);
      expect(results[0].outputPath).toMatch(/dist[\/\\]level1\.ts$/);
      expect(results[1].outputPath).toMatch(/dist[\/\\]level2\.ts$/);
    });

    test('should use single output file when specified', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      mockGlob.sync.mockReturnValue(['input.json']);
      mockGlob.hasMagic.mockReturnValue(false);

      const graph = new VisualGraph('single-output-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      mockReadFile.mockResolvedValue(JSON.stringify(graph.serialize()));
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['input.json'],
        output: 'specific-output.ts', // Specific file output 特定文件输出
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(1);
      expect(results[0].outputPath).toBe('specific-output.ts');
    });
  });

  describe('Compilation Metrics', () => {
    test('should provide compilation metrics', async () => {
      const graph = new VisualGraph('metrics-test');

      // Create graph with multiple nodes and connections 创建包含多个节点和连接的图
      const nodes = [
        new MockCLINode('const1', 'math.constant', [['Value', 5]], ['Value']),
        new MockCLINode('const2', 'math.constant', [['Value', 3]], ['Value']),
        new MockCLINode('add1', 'math.add', [], ['Result']),
        new MockCLINode('mul1', 'math.multiply', [['B', 2]], ['Result']),
        new MockCLINode('output1', 'world.addComponent', [['Entity', null], ['Component Type', 'Transform'], ['Component Data', null]], [])
      ];

      nodes.forEach(node => graph.addNode(node));

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

      graph.addConnection({
        id: 'conn3',
        fromNodeId: 'add1',
        fromPin: 'Result',
        toNodeId: 'mul1',
        toPin: 'A'
      });

      graph.addConnection({
        id: 'conn4',
        fromNodeId: 'mul1',
        fromPin: 'Result',
        toNodeId: 'output1',
        toPin: 'Component Data'
      });

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['metrics.json'],
        output: 'metrics.ts',
        optimize: true,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('metrics.json', 'metrics.ts', config);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.nodeCount).toBe(5); // 5 nodes now with output1
      expect(result.metrics!.connectionCount).toBe(4); // 4 connections now
      expect(result.metrics!.compilationTime).toBeGreaterThan(0);
      expect(typeof result.metrics!.optimizations).toBe('number');
    });

    test('should track compilation time', async () => {
      const graph = new VisualGraph('timing-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['timing.json'],
        output: 'timing.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const startTime = Date.now();
      const result = await cli.compileFile('timing.json', 'timing.ts', config);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metrics!.compilationTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics!.compilationTime).toBeLessThanOrEqual(endTime - startTime + 100); // Allow some margin
    });
  });

  describe('Error Recovery', () => {
    test('should continue batch compilation after individual failures', async () => {
      const { default: glob } = await import('glob');
      const mockGlob = vi.mocked(glob);

      mockGlob.sync.mockReturnValue(['good1.json', 'bad.json', 'good2.json']);
      mockGlob.hasMagic.mockReturnValue(true);

      // Create good graphs 创建良好的图
      const graph1 = new VisualGraph('good1');
      const graph2 = new VisualGraph('good2');
      [graph1, graph2].forEach(graph => {
        const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
        graph.addNode(node);
      });

      // Mock file reads with one failure 模拟文件读取，其中一个失败
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(graph1.serialize()))
        .mockRejectedValueOnce(new Error('Corrupted file'))
        .mockResolvedValueOnce(JSON.stringify(graph2.serialize()));

      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['*.json'],
        output: './dist/',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const results = await cli.compileFiles(config);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(results[1].error).toContain('Corrupted file');
    });

    test('should handle write permission errors', async () => {
      const graph = new VisualGraph('permission-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockRejectedValue(new Error('Permission denied'));
      mockMkdir.mockResolvedValue(undefined);

      const config = {
        input: ['input.json'],
        output: '/readonly/output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('input.json', '/readonly/output.ts', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    test('should handle directory creation errors', async () => {
      const graph = new VisualGraph('mkdir-test');
      const node = new MockCLINode('node1', 'math.add', [['A', 1], ['B', 2]], ['Result']);
      graph.addNode(node);

      const mockFileContent = JSON.stringify(graph.serialize());
      mockReadFile.mockResolvedValue(mockFileContent);
      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockRejectedValue(new Error('Cannot create directory'));

      const config = {
        input: ['input.json'],
        output: './nested/deep/output.ts',
        optimize: false,
        debug: false,
        watch: false,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      const result = await cli.compileFile('input.json', './nested/deep/output.ts', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot create directory');
    });
  });

  describe('Watch Mode', () => {
    test('should set up file watchers', async () => {
      const chokidar = await import('chokidar');
      const mockWatch = vi.mocked(chokidar.watch);
      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined)
      };
      mockWatch.mockReturnValue(mockWatcher as any);

      const config = {
        input: ['*.json'],
        output: './dist/',
        optimize: false,
        debug: false,
        watch: true,
        format: {
          indentSize: 2,
          useTabs: false,
          lineEnding: 'lf' as const
        }
      };

      // Start watch mode (but don't wait for it to complete)
      // 启动监视模式（但不等待其完成）
      const watchPromise = cli.watchFiles(config);

      // Give it a moment to set up watchers
      // 给它一点时间来设置监视器
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWatch).toHaveBeenCalledWith(
        '*.json',
        expect.objectContaining({
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true
        })
      );

      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Cleanup - don't wait for the full watch process
      // 清理 - 不等待完整的监视过程
      mockWatcher.close();
    });
  });
});