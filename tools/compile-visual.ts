#!/usr/bin/env node

/**
 * CLI tool for compiling visual graphs to TypeScript
 * 将可视化图编译为TypeScript的CLI工具
 *
 * Provides command-line interface for batch compilation of visual graphs,
 * with support for various output formats, optimization levels, and
 * integration with build systems.
 * 提供批量编译可视化图的命令行界面，支持各种输出格式、优化级别和构建系统集成。
 */

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import glob from 'glob';
import { VisualGraph } from '../src/visual/core/VisualGraph';
import { CodeGenerator, type CodeGenerationOptions } from '../editor/src/compiler/CodeGenerator';

/**
 * CLI configuration interface
 * CLI配置接口
 */
interface CLIConfig {
  input: string[];
  output: string;
  systemName?: string;
  stage?: 'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup';
  dependencies?: string[];
  optimize: boolean;
  debug: boolean;
  watch: boolean;
  format: {
    indentSize: number;
    useTabs: boolean;
    lineEnding: 'lf' | 'crlf';
  };
}

/**
 * Compilation result
 * 编译结果
 */
interface CompilationResult {
  filePath: string;
  outputPath: string;
  success: boolean;
  error?: string;
  metrics?: {
    nodeCount: number;
    connectionCount: number;
    optimizations: number;
    compilationTime: number;
  };
}

/**
 * Main CLI class
 * 主要CLI类
 */
class VisualCompilerCLI {
  private codeGenerator: CodeGenerator;

  constructor() {
    this.codeGenerator = new CodeGenerator();
  }

  /**
   * Compile a single visual graph file
   * 编译单个可视化图文件
   *
   * @param inputPath Path to input file 输入文件路径
   * @param outputPath Path to output file 输出文件路径
   * @param config CLI configuration CLI配置
   * @returns Compilation result 编译结果
   */
  async compileFile(inputPath: string, outputPath: string, config: CLIConfig): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Read and parse the graph file 读取并解析图文件
      console.log(chalk.blue(`📖 Reading graph: ${path.relative(process.cwd(), inputPath)}`));

      const fileContent = await fs.promises.readFile(inputPath, 'utf-8');
      let graphData;

      try {
        graphData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON: ${parseError}`);
      }

      // Deserialize the graph 反序列化图
      const graph = VisualGraph.deserialize(graphData);

      // Generate system name from filename if not provided 如果未提供则从文件名生成系统名称
      const systemName = config.systemName ||
        path.basename(inputPath, path.extname(inputPath))
          .replace(/[^a-zA-Z0-9]/g, '')
          .replace(/^\d/, '_$&'); // Ensure valid identifier 确保有效标识符

      // Prepare compilation options 准备编译选项
      const options: CodeGenerationOptions = {
        systemName,
        stage: config.stage || 'update',
        dependencies: config.dependencies || [],
        optimize: config.optimize,
        includeDebugInfo: config.debug,
        formatting: config.format
      };

      // Compile the graph 编译图
      console.log(chalk.yellow(`⚙️  Compiling: ${systemName}`));
      const result = await this.codeGenerator.generateCode(graph, options);

      // Ensure output directory exists 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Write the generated code 写入生成的代码
      await fs.promises.writeFile(outputPath, result.code, 'utf-8');

      const compilationTime = Date.now() - startTime;

      console.log(chalk.green(`✅ Compiled successfully: ${path.relative(process.cwd(), outputPath)}`));
      console.log(chalk.gray(`   └── ${result.metrics.nodeCount} nodes, ${result.metrics.connectionCount} connections, ${compilationTime}ms`));

      return {
        filePath: inputPath,
        outputPath,
        success: true,
        metrics: {
          nodeCount: result.metrics.nodeCount,
          connectionCount: result.metrics.connectionCount,
          optimizations: result.metrics.optimizationsApplied.length,
          compilationTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`❌ Failed to compile: ${path.relative(process.cwd(), inputPath)}`));
      console.log(chalk.red(`   └── ${errorMessage}`));

      return {
        filePath: inputPath,
        outputPath,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Compile multiple files
   * 编译多个文件
   *
   * @param config CLI configuration CLI配置
   * @returns Array of compilation results 编译结果数组
   */
  async compileFiles(config: CLIConfig): Promise<CompilationResult[]> {
    const startTime = Date.now();
    const results: CompilationResult[] = [];

    // Expand glob patterns 扩展glob模式
    const inputFiles = new Set<string>();
    for (const pattern of config.input) {
      if (glob.hasMagic(pattern)) {
        const matches = glob.sync(pattern, { absolute: true });
        matches.forEach(file => inputFiles.add(file));
      } else {
        inputFiles.add(path.resolve(pattern));
      }
    }

    const files = Array.from(inputFiles);

    if (files.length === 0) {
      console.log(chalk.yellow('⚠️  No input files found'));
      return results;
    }

    console.log(chalk.blue(`🚀 Starting compilation of ${files.length} file(s)...`));
    console.log('');

    // Compile each file 编译每个文件
    for (const inputFile of files) {
      const relativePath = path.relative(process.cwd(), inputFile);

      // Generate output path 生成输出路径
      let outputPath: string;
      if (path.extname(config.output) === '.ts') {
        // Single output file specified 指定了单个输出文件
        outputPath = config.output;
      } else {
        // Output directory specified 指定了输出目录
        const baseName = path.basename(inputFile, path.extname(inputFile));
        outputPath = path.join(config.output, `${baseName}.ts`);
      }

      const result = await this.compileFile(inputFile, outputPath, config);
      results.push(result);
    }

    // Print summary 打印摘要
    console.log('');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTime = Date.now() - startTime;

    console.log(chalk.blue('📊 Compilation Summary:'));
    console.log(chalk.green(`   ✅ Successful: ${successful}`));
    if (failed > 0) {
      console.log(chalk.red(`   ❌ Failed: ${failed}`));
    }
    console.log(chalk.gray(`   ⏱️  Total time: ${totalTime}ms`));

    // Print optimization statistics 打印优化统计
    if (config.optimize) {
      const totalOptimizations = results
        .filter(r => r.success && r.metrics)
        .reduce((sum, r) => sum + (r.metrics?.optimizations || 0), 0);

      if (totalOptimizations > 0) {
        console.log(chalk.cyan(`   🔧 Optimizations applied: ${totalOptimizations}`));
      }
    }

    return results;
  }

  /**
   * Watch for file changes and recompile
   * 监听文件变化并重新编译
   *
   * @param config CLI configuration CLI配置
   */
  async watchFiles(config: CLIConfig): Promise<void> {
    console.log(chalk.blue('👁️  Watching for changes...'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    console.log('');

    const chokidar = await import('chokidar');
    const patterns = config.input.length === 1 ? config.input[0] : config.input;

    const watcher = chokidar.watch(patterns, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    let compiling = false;

    const handleChange = async (filePath: string) => {
      if (compiling) return;

      compiling = true;
      console.log(chalk.yellow(`📝 File changed: ${path.relative(process.cwd(), filePath)}`));

      try {
        await this.compileFiles(config);
      } catch (error) {
        console.log(chalk.red(`❌ Compilation failed: ${error}`));
      }

      compiling = false;
      console.log(chalk.gray('👁️  Watching for changes...'));
    };

    watcher
      .on('change', handleChange)
      .on('add', handleChange)
      .on('error', error => {
        console.log(chalk.red(`❌ Watcher error: ${error}`));
      });

    // Initial compilation 初始编译
    await this.compileFiles(config);

    // Keep the process alive 保持进程运行
    return new Promise((resolve, reject) => {
      process.on('SIGINT', () => {
        console.log('\n' + chalk.blue('👋 Stopping watcher...'));
        watcher.close().then(() => resolve());
      });
    });
  }
}

/**
 * Main program entry point
 * 主程序入口点
 */
async function main(): Promise<void> {
  program
    .name('compile-visual')
    .description('Compile visual graphs to TypeScript code')
    .version('1.0.0');

  program
    .argument('<input...>', 'Input visual graph files (supports glob patterns)')
    .option('-o, --output <path>', 'Output directory or file', './dist')
    .option('-s, --system-name <name>', 'System name (defaults to filename)')
    .option('--stage <stage>', 'Execution stage', 'update')
    .option('-d, --dependencies <deps>', 'System dependencies (comma-separated)')
    .option('--no-optimize', 'Disable optimizations')
    .option('--debug', 'Include debug information')
    .option('-w, --watch', 'Watch for changes and recompile')
    .option('--indent-size <size>', 'Indentation size', '2')
    .option('--use-tabs', 'Use tabs for indentation')
    .option('--line-ending <ending>', 'Line ending style (lf/crlf)', 'lf')
    .action(async (input: string[], options) => {
      try {
        const config: CLIConfig = {
          input,
          output: options.output,
          systemName: options.systemName,
          stage: options.stage as any,
          dependencies: options.dependencies ? options.dependencies.split(',').map((s: string) => s.trim()) : undefined,
          optimize: options.optimize !== false,
          debug: options.debug === true,
          watch: options.watch === true,
          format: {
            indentSize: parseInt(options.indentSize),
            useTabs: options.useTabs === true,
            lineEnding: options.lineEnding as 'lf' | 'crlf'
          }
        };

        const cli = new VisualCompilerCLI();

        if (config.watch) {
          await cli.watchFiles(config);
        } else {
          const results = await cli.compileFiles(config);
          const failed = results.filter(r => !r.success).length;
          process.exit(failed > 0 ? 1 : 0);
        }
      } catch (error) {
        console.error(chalk.red('❌ Fatal error:'), error);
        process.exit(1);
      }
    });

  // Add help examples 添加帮助示例
  program.addHelpText('after', `
Examples:
  compile-visual scene.json                           # Compile single file
  compile-visual "scenes/*.json" -o dist/             # Compile all scenes
  compile-visual game-logic.json -s GameLogic        # Custom system name
  compile-visual "**/*.json" -o systems/ --watch     # Watch mode
  compile-visual scene.json --no-optimize --debug    # Debug build
`);

  await program.parseAsync();
}

// Run the CLI tool 运行CLI工具
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unhandled error:'), error);
    process.exit(1);
  });
}

export { VisualCompilerCLI };