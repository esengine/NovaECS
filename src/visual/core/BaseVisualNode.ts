/**
 * Base visual node implementation
 * 基础可视化节点实现
 *
 * Provides the foundation for all visual nodes in the framework.
 * Handles input/output management, validation, and execution flow.
 * 为框架中所有可视化节点提供基础。
 * 处理输入/输出管理、验证和执行流程。
 */

import type {
  VisualNode,
  VisualExecutionContext,
  NodeExecutionResult
} from '../types';

/**
 * Base implementation for visual nodes
 * 可视化节点的基础实现
 */
export abstract class BaseVisualNode implements VisualNode {
  /** Unique node identifier 唯一节点标识符 */
  public readonly id: string;

  /** Node type name 节点类型名 */
  public readonly type: string;

  /** Input values storage 输入值存储 */
  public inputs = new Map<string, any>();

  /** Output values storage 输出值存储 */
  public outputs = new Map<string, any>();

  /** Whether node has been executed this frame 节点是否在此帧已执行 */
  protected executed = false;

  /** Last execution result 上次执行结果 */
  protected lastResult?: NodeExecutionResult;

  constructor(id: string, type: string) {
    this.id = id;
    this.type = type;
  }

  /**
   * Set input value for the node
   * 为节点设置输入值
   *
   * @param name Input pin name 输入引脚名
   * @param value Input value 输入值
   */
  setInput(name: string, value: any): void {
    this.inputs.set(name, value);
    this.executed = false; // Mark as needing re-execution
  }

  /**
   * Get input value by name
   * 按名称获取输入值
   *
   * @param name Input pin name 输入引脚名
   * @returns Input value or undefined 输入值或undefined
   */
  getInput(name: string): any {
    return this.inputs.get(name);
  }

  /**
   * Check if input has a value
   * 检查输入是否有值
   *
   * @param name Input pin name 输入引脚名
   * @returns True if input has value 如果输入有值则返回true
   */
  hasInput(name: string): boolean {
    return this.inputs.has(name);
  }

  /**
   * Get output value by name
   * 按名称获取输出值
   *
   * @param name Output pin name 输出引脚名
   * @returns Output value or undefined 输出值或undefined
   */
  getOutput(name: string): any {
    return this.outputs.get(name);
  }

  /**
   * Set output value for the node
   * 为节点设置输出值
   *
   * @param name Output pin name 输出引脚名
   * @param value Output value 输出值
   */
  setOutput(name: string, value: any): void {
    this.outputs.set(name, value);
  }

  /**
   * Clear all outputs
   * 清除所有输出
   */
  clearOutputs(): void {
    this.outputs.clear();
  }

  /**
   * Check if node should execute based on current state
   * 基于当前状态检查节点是否应该执行
   *
   * Default implementation checks if node has not been executed this frame.
   * Override for custom execution conditions.
   * 默认实现检查节点是否在此帧尚未执行。
   * 重写以实现自定义执行条件。
   *
   * @param _ctx Execution context 执行上下文
   * @returns True if node should execute 如果节点应该执行则返回true
   */
  shouldExecute(_ctx: VisualExecutionContext): boolean {
    return !this.executed;
  }

  /**
   * Execute the node logic
   * 执行节点逻辑
   *
   * This method must be implemented by concrete node classes.
   * It should read from inputs, perform the node's operation,
   * and write to outputs.
   * 此方法必须由具体节点类实现。
   * 它应该从输入读取，执行节点操作，并写入输出。
   *
   * @param ctx Execution context 执行上下文
   */
  abstract execute(ctx: VisualExecutionContext): void;

  /**
   * Execute node with error handling and performance tracking
   * 执行节点并处理错误和性能跟踪
   *
   * @param ctx Execution context 执行上下文
   * @returns Execution result 执行结果
   */
  executeWithResult(ctx: VisualExecutionContext): NodeExecutionResult {
    const startTime = performance.now();

    try {
      this.execute(ctx);
      this.executed = true;

      const result: NodeExecutionResult = {
        success: true,
        executionTime: performance.now() - startTime,
        outputs: new Map(this.outputs)
      };

      this.lastResult = result;
      return result;
    } catch (error) {
      const result: NodeExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: performance.now() - startTime,
        outputs: new Map()
      };

      this.lastResult = result;
      return result;
    }
  }

  /**
   * Reset node state for new execution cycle
   * 为新执行周期重置节点状态
   */
  reset(): void {
    this.executed = false;
    this.clearOutputs();
  }

  /**
   * Validate node inputs before execution
   * 执行前验证节点输入
   *
   * Override in concrete classes to implement custom validation.
   * 在具体类中重写以实现自定义验证。
   *
   * @returns Validation result with error message if invalid 验证结果，如果无效则包含错误信息
   */
  validate(): { valid: boolean; error?: string } {
    return { valid: true };
  }

  /**
   * Get node execution statistics
   * 获取节点执行统计
   *
   * @returns Execution statistics 执行统计
   */
  getStats(): {
    executed: boolean;
    lastExecutionTime?: number;
    lastError?: string;
  } {
    const stats: {
      executed: boolean;
      lastExecutionTime?: number;
      lastError?: string;
    } = { executed: this.executed };

    if (this.lastResult?.executionTime !== undefined) {
      stats.lastExecutionTime = this.lastResult.executionTime;
    }
    if (this.lastResult?.error !== undefined) {
      stats.lastError = this.lastResult.error;
    }

    return stats;
  }

  /**
   * Create a copy of the node with new ID
   * 创建具有新ID的节点副本
   *
   * @param newId New node ID 新节点ID
   * @returns Cloned node 克隆的节点
   */
  clone(newId: string): BaseVisualNode {
    const cloned = Object.create(Object.getPrototypeOf(this));
    cloned.id = newId;
    cloned.type = this.type;
    cloned.inputs = new Map(this.inputs);
    cloned.outputs = new Map(this.outputs);
    cloned.executed = false;
    cloned.lastResult = undefined;
    return cloned;
  }

  /**
   * Serialize node state to JSON
   * 将节点状态序列化为JSON
   *
   * @returns Serialized node data 序列化的节点数据
   */
  serialize(): any {
    return {
      id: this.id,
      type: this.type,
      inputs: Object.fromEntries(this.inputs),
      outputs: Object.fromEntries(this.outputs)
    };
  }

  /**
   * Deserialize node state from JSON
   * 从JSON反序列化节点状态
   *
   * @param data Serialized node data 序列化的节点数据
   */
  deserialize(data: any): void {
    if (data.inputs) {
      this.inputs = new Map(Object.entries(data.inputs));
    }
    if (data.outputs) {
      this.outputs = new Map(Object.entries(data.outputs));
    }
  }
}