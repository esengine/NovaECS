/**
 * Method call node implementation
 * 方法调用节点实现
 *
 * Represents a visual node that directly calls existing ECS methods.
 * This avoids reimplementing logic and ensures consistency with the core framework.
 * 表示直接调用现有ECS方法的可视化节点。
 * 这避免了重新实现逻辑，并确保与核心框架的一致性。
 */

import { BaseVisualNode } from './BaseVisualNode';
import type {
  VisualExecutionContext,
  VisualMethodMetadata
} from '../types';

/**
 * Node that calls methods on target objects (World, Query, etc.)
 * 调用目标对象（World、Query等）方法的节点
 */
export class MethodCallNode extends BaseVisualNode {
  /** Target object type ('world', 'query', 'commandBuffer', etc.) */
  private readonly targetType: string;

  /** Method name to call 要调用的方法名 */
  private readonly methodName: string;

  /** Method metadata for validation and execution 用于验证和执行的方法元数据 */
  private readonly methodMetadata: VisualMethodMetadata;

  constructor(
    id: string,
    targetType: string,
    methodName: string,
    metadata: VisualMethodMetadata
  ) {
    super(id, `${targetType}.${methodName}`);
    this.targetType = targetType;
    this.methodName = methodName;
    this.methodMetadata = metadata;

    // Initialize default input values
    // 初始化默认输入值
    this.initializeDefaults();
  }

  /**
   * Initialize input and output pins from metadata
   * 从元数据初始化输入输出端口
   */
  private initializeDefaults(): void {
    // Initialize all input pins
    // 初始化所有输入端口
    for (const input of this.methodMetadata.inputs || []) {
      const inputName = input.label || 'input';
      const defaultValue = input.defaultValue !== undefined ? input.defaultValue : null;
      this.setInput(inputName, defaultValue);
    }

    // Initialize all output pins
    // 初始化所有输出端口
    for (const output of this.methodMetadata.outputs || []) {
      const outputName = output.label || 'output';
      this.setOutput(outputName, null);
    }
  }

  /**
   * Get target object from execution context
   * 从执行上下文获取目标对象
   *
   * @param ctx Execution context 执行上下文
   * @returns Target object or undefined 目标对象或undefined
   */
  private getTargetObject(ctx: VisualExecutionContext): any {
    switch (this.targetType) {
      case 'world':
        return ctx.world;
      case 'commandBuffer':
        return ctx.commandBuffer;
      default:
        // For dynamic targets like queries, check variables
        // 对于动态目标如查询，检查变量
        return ctx.variables.get(this.targetType);
    }
  }

  /**
   * Prepare method arguments from input values
   * 从输入值准备方法参数
   *
   * @returns Array of method arguments 方法参数数组
   */
  private prepareArguments(): any[] {
    const args: any[] = [];

    for (const inputConfig of this.methodMetadata.inputs) {
      const inputName = inputConfig.label || 'input';
      const value = this.getInput(inputName);

      // Skip execute pins as they don't carry data
      // 跳过执行引脚，因为它们不携带数据
      if (inputConfig.type === 'execute') {
        continue;
      }

      // Use default value if input is not connected
      // 如果输入未连接则使用默认值
      if (value === undefined && inputConfig.defaultValue !== undefined) {
        args.push(inputConfig.defaultValue);
      } else {
        args.push(value);
      }
    }

    return args;
  }

  /**
   * Process method result and set output values
   * 处理方法结果并设置输出值
   *
   * @param result Method execution result 方法执行结果
   */
  private processResult(result: any): void {
    // Set primary output if defined
    // 如果定义了主要输出则设置
    const primaryOutput = this.methodMetadata.outputs.find(out => out.type !== 'execute');
    if (primaryOutput) {
      const outputName = primaryOutput.label || 'result';
      this.setOutput(outputName, result);
    }

    // Set execute output to trigger downstream nodes
    // 设置执行输出以触发下游节点
    const executeOutput = this.methodMetadata.outputs.find(out => out.type === 'execute');
    if (executeOutput) {
      const outputName = executeOutput.label || 'then';
      this.setOutput(outputName, true);
    }
  }

  /**
   * Execute the method call
   * 执行方法调用
   *
   * @param ctx Execution context 执行上下文
   */
  execute(ctx: VisualExecutionContext): void {
    // Get target object
    // 获取目标对象
    const target = this.getTargetObject(ctx);
    if (!target) {
      throw new Error(`Target object '${this.targetType}' not available in context`);
    }

    // Get method reference
    // 获取方法引用
    const method = target[this.methodName];
    if (typeof method !== 'function') {
      throw new Error(`Method '${this.methodName}' not found on target '${this.targetType}'`);
    }

    // Prepare arguments
    // 准备参数
    const args = this.prepareArguments();

    // Execute method
    // 执行方法
    try {
      const result = method.apply(target, args);
      this.processResult(result);
    } catch (error) {
      throw new Error(
        `Error executing ${this.targetType}.${this.methodName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate inputs before execution
   * 执行前验证输入
   *
   * @returns Validation result 验证结果
   */
  validate(): { valid: boolean; error?: string } {
    // Check required inputs
    // 检查必需输入
    for (const inputConfig of this.methodMetadata.inputs) {
      if (inputConfig.required) {
        const inputName = inputConfig.label || 'input';
        const value = this.getInput(inputName);

        if (value === undefined) {
          return {
            valid: false,
            error: `Required input '${inputName}' is missing`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check if node should execute
   * 检查节点是否应该执行
   *
   * @param _ctx Execution context 执行上下文
   * @returns True if should execute 如果应该执行则返回true
   */
  shouldExecute(_ctx: VisualExecutionContext): boolean {
    // Method call nodes execute when they have an execute input trigger
    // or when they are pure functions that need to compute outputs
    // 方法调用节点在有执行输入触发时执行，或者当它们是需要计算输出的纯函数时执行

    // Check for execute input
    // 检查执行输入
    const hasExecuteInput = this.methodMetadata.inputs.some(input => input.type === 'execute');
    if (hasExecuteInput) {
      const executeInputName = this.methodMetadata.inputs.find(input => input.type === 'execute')?.label || 'execute';
      return this.getInput(executeInputName) === true;
    }

    // For pure functions, execute if inputs have changed and not already executed
    // 对于纯函数，如果输入已更改且尚未执行则执行
    if (!this.methodMetadata.stateful) {
      return !this.executed;
    }

    return false;
  }

  /**
   * Get method metadata
   * 获取方法元数据
   *
   * @returns Method metadata 方法元数据
   */
  getMetadata(): VisualMethodMetadata {
    return this.methodMetadata;
  }

  /**
   * Create method call node from metadata
   * 从元数据创建方法调用节点
   *
   * @param id Node ID 节点ID
   * @param targetType Target object type 目标对象类型
   * @param metadata Method metadata 方法元数据
   * @returns Method call node 方法调用节点
   */
  static fromMetadata(
    id: string,
    targetType: string,
    metadata: VisualMethodMetadata
  ): MethodCallNode {
    return new MethodCallNode(id, targetType, metadata.name, metadata);
  }
}