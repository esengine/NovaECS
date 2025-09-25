/**
 * Type definitions for the visual node framework
 * 可视化节点框架的类型定义
 */

import type { Entity } from '../../utils/Types';
import type { ComponentCtor } from '../../core/ComponentRegistry';
import type { World } from '../../core/World';
import type { Query } from '../../core/Query';
import type { CommandBuffer } from '../../core/CommandBuffer';
import type { SystemContext } from '../../core/System';
import type { I18nKey } from '../i18n/types';

// Types used in type definitions below
// 以下类型定义中使用的类型
export type { Entity, ComponentCtor, World, Query, CommandBuffer, SystemContext };

/**
 * Pin type definitions for visual connections
 * 可视化连接的引脚类型定义
 */
export type PinType =
  | 'execute'           // Execution flow 执行流
  | 'entity'            // Entity handle 实体句柄
  | 'component-type'    // Component constructor 组件构造函数
  | 'component-data'    // Component instance data 组件实例数据
  | 'query'             // Entity query 实体查询
  | 'boolean'           // Boolean value 布尔值
  | 'number'            // Numeric value 数值
  | 'string'            // String value 字符串值
  | 'vector2'           // 2D vector 二维向量
  | 'vector3'           // 3D vector 三维向量
  | 'any';              // Any type 任意类型

/**
 * Input pin configuration
 * 输入引脚配置
 */
export interface InputPinConfig {
  /** Pin data type 引脚数据类型 */
  type: PinType;
  /** Display label (legacy, use labelKey for i18n) 显示标签（传统方式，使用labelKey进行国际化） */
  label?: string;
  /** I18n key for display label 显示标签的国际化键 */
  labelKey?: I18nKey;
  /** Default value 默认值 */
  defaultValue?: any;
  /** Whether input is required 是否为必需输入 */
  required?: boolean;
  /** Custom validator function 自定义验证函数 */
  validator?: (value: any) => boolean;
  /** Additional constraints 额外约束 */
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
  /** Dynamic type based on another pin 基于其他引脚的动态类型 */
  dynamicType?: string;
  /** Description for tooltip (legacy, use descriptionKey for i18n) 提示说明（传统方式，使用descriptionKey进行国际化） */
  description?: string;
  /** I18n key for description 描述的国际化键 */
  descriptionKey?: I18nKey;
}

/**
 * Output pin configuration
 * 输出引脚配置
 */
export interface OutputPinConfig {
  /** Pin data type 引脚数据类型 */
  type: PinType;
  /** Display label (legacy, use labelKey for i18n) 显示标签（传统方式，使用labelKey进行国际化） */
  label?: string;
  /** I18n key for display label 显示标签的国际化键 */
  labelKey?: I18nKey;
  /** Description for tooltip (legacy, use descriptionKey for i18n) 提示说明（传统方式，使用descriptionKey进行国际化） */
  description?: string;
  /** I18n key for description 描述的国际化键 */
  descriptionKey?: I18nKey;
}

/**
 * Visual method configuration
 * 可视化方法配置
 */
export interface VisualMethodConfig {
  /** Display title in node (legacy, use titleKey for i18n) 节点显示标题（传统方式，使用titleKey进行国际化） */
  title?: string;
  /** I18n key for display title 显示标题的国际化键 */
  titleKey?: I18nKey;
  /** Node category for organization (legacy, use categoryKey for i18n) 节点分类（传统方式，使用categoryKey进行国际化） */
  category?: string;
  /** I18n key for node category 节点分类的国际化键 */
  categoryKey?: I18nKey;
  /** Description for tooltip (legacy, use descriptionKey for i18n) 提示说明（传统方式，使用descriptionKey进行国际化） */
  description?: string;
  /** I18n key for description 描述的国际化键 */
  descriptionKey?: I18nKey;
  /** Node color 节点颜色 */
  color?: string;
  /** Icon identifier 图标标识 */
  icon?: string;
  /** Input pin definitions 输入引脚定义 */
  inputs?: InputPinConfig[];
  /** Output pin definitions 输出引脚定义 */
  outputs?: OutputPinConfig[];
  /** Whether method modifies world state 方法是否修改世界状态 */
  stateful?: boolean;
  /** Execution order hint 执行顺序提示 */
  executionOrder?: number;
}

/**
 * Collected metadata for a visual method
 * 可视化方法的收集元数据
 */
export interface VisualMethodMetadata {
  /** Method name 方法名 */
  name: string;
  /** Display title (legacy) 显示标题（传统方式） */
  title?: string;
  /** I18n key for title 标题的国际化键 */
  titleKey?: I18nKey;
  /** Category (legacy) 分类（传统方式） */
  category?: string;
  /** I18n key for category 分类的国际化键 */
  categoryKey?: I18nKey;
  /** Description (legacy) 描述（传统方式） */
  description?: string;
  /** I18n key for description 描述的国际化键 */
  descriptionKey?: I18nKey;
  /** Color 颜色 */
  color?: string;
  /** Icon 图标 */
  icon?: string;
  /** Input pins 输入引脚 */
  inputs: InputPinConfig[];
  /** Output pins 输出引脚 */
  outputs: OutputPinConfig[];
  /** Original method reference 原始方法引用 */
  originalMethod: Function;
  /** Whether method is stateful 方法是否有状态 */
  stateful: boolean;
  /** Execution order 执行顺序 */
  executionOrder: number;
}

/**
 * Class metadata collection
 * 类元数据集合
 */
export interface ClassMetadata {
  /** Class constructor 类构造函数 */
  constructor: Function;
  /** Map of method name to metadata 方法名到元数据的映射 */
  methods: Map<string, VisualMethodMetadata>;
}

/**
 * Visual execution context for running nodes
 * 运行节点的可视化执行上下文
 */
export interface VisualExecutionContext {
  /** ECS world instance ECS世界实例 */
  world: World;
  /** Command buffer for deferred operations 延迟操作的命令缓冲 */
  commandBuffer: CommandBuffer;
  /** Current frame number 当前帧号 */
  frame: number;
  /** Delta time in seconds 增量时间（秒） */
  deltaTime: number;
  /** Variable storage for graph execution 图执行的变量存储 */
  variables: Map<string, any>;
  /** Current execution stack 当前执行栈 */
  executionStack: string[];
}

/**
 * Visual node instance for graph execution
 * 图执行的可视化节点实例
 */
export interface VisualNode {
  /** Unique node identifier 唯一节点标识符 */
  id: string;
  /** Node type name 节点类型名 */
  type: string;
  /** Input values 输入值 */
  inputs: Map<string, any>;
  /** Output values 输出值 */
  outputs: Map<string, any>;
  /** Node position in visual editor 节点在可视化编辑器中的位置 */
  position?: { x: number; y: number };
  /** Additional metadata for the node 节点的附加元数据 */
  metadata?: any;
  /** Execute node logic 执行节点逻辑 */
  execute(ctx: VisualExecutionContext): void;
  /** Check if node should execute 检查节点是否应该执行 */
  shouldExecute(ctx: VisualExecutionContext): boolean;
  /** Set input value 设置输入值 */
  setInput(name: string, value: any): void;
  /** Get output value 获取输出值 */
  getOutput(name: string): any;
  /** Set output value 设置输出值 */
  setOutput(name: string, value: any): void;
  /** Get node metadata if available 获取节点元数据（如果可用）*/
  getMetadata?(): VisualMethodMetadata;
}

/**
 * Connection between visual nodes
 * 可视化节点间的连接
 */
export interface Connection {
  /** Unique connection identifier 唯一连接标识符 */
  id: string;
  /** Source node ID 源节点ID */
  fromNodeId: string;
  /** Source pin name 源引脚名 */
  fromPin: string;
  /** Target node ID 目标节点ID */
  toNodeId: string;
  /** Target pin name 目标引脚名 */
  toPin: string;
}

/**
 * Visual graph containing nodes and connections
 * 包含节点和连接的可视化图
 */
export interface VisualGraphData {
  /** Graph name 图名称 */
  name: string;
  /** Description 描述 */
  description?: string;
  /** Version 版本 */
  version: string;
  /** Nodes in the graph 图中的节点 */
  nodes: VisualNode[];
  /** Connections between nodes 节点间的连接 */
  connections: Connection[];
  /** Graph metadata 图元数据 */
  metadata: {
    created: string;
    modified: string;
    author?: string;
    tags?: string[];
  };
}

/**
 * Node execution result
 * 节点执行结果
 */
export interface NodeExecutionResult {
  /** Whether execution was successful 执行是否成功 */
  success: boolean;
  /** Error message if failed 失败时的错误信息 */
  error?: string;
  /** Execution time in milliseconds 执行时间（毫秒） */
  executionTime: number;
  /** Output values 输出值 */
  outputs: Map<string, any>;
}

/**
 * Visual system configuration
 * 可视化系统配置
 */
export interface VisualSystemConfig {
  /** System name 系统名称 */
  name: string;
  /** Associated visual graph 关联的可视化图 */
  graph: VisualGraphData;
  /** System stage 系统阶段 */
  stage?: 'startup' | 'preUpdate' | 'update' | 'postUpdate' | 'cleanup';
  /** Dependencies 依赖项 */
  dependencies?: string[];
  /** Whether to run conditionally 是否条件运行 */
  runIf?: (world: World) => boolean;
}