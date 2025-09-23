/**
 * Node generator for automatic visual node creation
 * 自动可视化节点创建的节点生成器
 *
 * Automatically generates visual nodes from decorated methods in ECS classes.
 * This allows existing methods to be used in the visual editor without reimplementation.
 * 自动从ECS类中的装饰方法生成可视化节点。
 * 这允许现有方法在可视化编辑器中使用而无需重新实现。
 */

import type {
  VisualMethodMetadata
} from '../types';
import {
  getMethodMetadata,
  getClassVisualMethods
} from '../decorators';
import { MethodCallNode } from './MethodCallNode';
import { World } from '../../core/World';
import { Query } from '../../core/Query';
import { CommandBuffer } from '../../core/CommandBuffer';
import { t } from '../i18n/I18nManager';

/**
 * Node factory for creating visual nodes from metadata
 * 从元数据创建可视化节点的节点工厂
 */
export class NodeGenerator {
  /** Registry of available node types 可用节点类型的注册表 */
  private static nodeTypes = new Map<string, NodeTypeInfo>();

  /** Counter for generating unique node IDs 生成唯一节点ID的计数器 */
  private static nodeIdCounter = 0;

  /**
   * Register all visual methods from decorated ECS classes
   * 注册所有来自装饰ECS类的可视化方法
   */
  static registerECSMethods(): void {
    // Register World methods
    // 注册World方法
    this.registerClassMethods('world', World);

    // Register Query methods
    // 注册Query方法
    this.registerClassMethods('query', Query);

    // Register CommandBuffer methods
    // 注册CommandBuffer方法
    this.registerClassMethods('commandBuffer', CommandBuffer);
  }

  /**
   * Register visual methods from a specific class
   * 注册特定类的可视化方法
   *
   * @param targetType Target object type ('world', 'query', etc.)
   * @param constructor Class constructor
   */
  private static registerClassMethods(targetType: string, constructor: Function): void {
    const methods = getClassVisualMethods(constructor);

    for (const method of methods) {
      const nodeTypeName = `${targetType}.${method.name}`;

      this.nodeTypes.set(nodeTypeName, {
        name: nodeTypeName,
        targetType,
        metadata: method,
        factory: (id: string) => new MethodCallNode(id, targetType, method.name, method)
      });
    }
  }

  /**
   * Get all available node types
   * 获取所有可用的节点类型
   *
   * @returns Array of node type information 节点类型信息数组
   */
  static getAvailableNodeTypes(): NodeTypeInfo[] {
    return Array.from(this.nodeTypes.values());
  }

  /**
   * Get node types by category
   * 按分类获取节点类型
   *
   * @param category Category filter 分类过滤器
   * @returns Filtered node types 过滤的节点类型
   */
  static getNodeTypesByCategory(category: string): NodeTypeInfo[] {
    return this.getAvailableNodeTypes()
      .filter(nodeType => nodeType.metadata.category === category);
  }

  /**
   * Get all categories
   * 获取所有分类
   *
   * @returns Array of category names 分类名称数组
   */
  static getCategories(): string[] {
    const categories = new Set<string>();

    for (const nodeType of this.nodeTypes.values()) {
      // Resolve category at runtime
      // 在运行时解析分类
      const resolvedMetadata = this.resolveI18nMetadata(nodeType.metadata);
      if (resolvedMetadata.category) {
        categories.add(resolvedMetadata.category);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Create node instance by type name
   * 按类型名称创建节点实例
   *
   * @param typeName Node type name 节点类型名称
   * @param id Optional custom ID 可选的自定义ID
   * @returns Created node instance 创建的节点实例
   */
  static createNode(typeName: string, id?: string): MethodCallNode {
    const nodeType = this.nodeTypes.get(typeName);
    if (!nodeType) {
      throw new Error(`Unknown node type: ${typeName}`);
    }

    const nodeId = id || this.generateNodeId();
    return nodeType.factory(nodeId);
  }

  /**
   * Create node from method metadata
   * 从方法元数据创建节点
   *
   * @param targetType Target object type 目标对象类型
   * @param metadata Method metadata 方法元数据
   * @param id Optional custom ID 可选的自定义ID
   * @returns Created node instance 创建的节点实例
   */
  static createNodeFromMetadata(
    targetType: string,
    metadata: VisualMethodMetadata,
    id?: string
  ): MethodCallNode {
    const nodeId = id || this.generateNodeId();

    // Resolve i18n metadata at runtime
    // 在运行时解析i18n元数据
    const resolvedMetadata = this.resolveI18nMetadata(metadata);

    return new MethodCallNode(nodeId, targetType, metadata.name, resolvedMetadata);
  }

  /**
   * Resolve i18n keys in metadata to actual text
   * 将元数据中的i18n键解析为实际文本
   *
   * @param metadata Original metadata with i18n keys 包含i18n键的原始元数据
   * @returns Resolved metadata with translated text 包含翻译文本的解析元数据
   */
  private static resolveI18nMetadata(metadata: VisualMethodMetadata): VisualMethodMetadata {
    const resolved: VisualMethodMetadata = {
      ...metadata,
      // Resolve title: prefer i18n key, fallback to legacy string
      // 解析标题：优先使用i18n键，回退到传统字符串
      title: metadata.titleKey ? t(metadata.titleKey) : metadata.title,
      // Resolve category: prefer i18n key, fallback to legacy string
      // 解析分类：优先使用i18n键，回退到传统字符串
      category: metadata.categoryKey ? t(metadata.categoryKey) : metadata.category,
      // Resolve description: prefer i18n key, fallback to legacy string
      // 解析描述：优先使用i18n键，回退到传统字符串
      description: metadata.descriptionKey ? t(metadata.descriptionKey) : metadata.description,
      // Resolve input pin labels and descriptions
      // 解析输入引脚标签和描述
      inputs: metadata.inputs.map(input => ({
        ...input,
        label: input.labelKey ? t(input.labelKey) : input.label,
        description: input.descriptionKey ? t(input.descriptionKey) : input.description
      })),
      // Resolve output pin labels and descriptions
      // 解析输出引脚标签和描述
      outputs: metadata.outputs.map(output => ({
        ...output,
        label: output.labelKey ? t(output.labelKey) : output.label,
        description: output.descriptionKey ? t(output.descriptionKey) : output.description
      }))
    };

    return resolved;
  }

  /**
   * Generate unique node ID
   * 生成唯一节点ID
   *
   * @returns Unique node ID 唯一节点ID
   */
  static generateNodeId(): string {
    return `node_${++this.nodeIdCounter}`;
  }

  /**
   * Search node types by title or category
   * 按标题或分类搜索节点类型
   *
   * @param searchTerm Search term 搜索词
   * @returns Matching node types 匹配的节点类型
   */
  static searchNodeTypes(searchTerm: string): NodeTypeInfo[] {
    const term = searchTerm.toLowerCase();

    return this.getAvailableNodeTypes().filter(nodeType => {
      // Resolve metadata for search
      // 为搜索解析元数据
      const resolvedMetadata = this.resolveI18nMetadata(nodeType.metadata);

      return (
        (resolvedMetadata.title && resolvedMetadata.title.toLowerCase().includes(term)) ||
        (resolvedMetadata.category && resolvedMetadata.category.toLowerCase().includes(term)) ||
        (resolvedMetadata.description && resolvedMetadata.description.toLowerCase().includes(term))
      );
    });
  }

  /**
   * Get method metadata for a specific class and method
   * 获取特定类和方法的方法元数据
   *
   * @param constructor Class constructor 类构造函数
   * @param methodName Method name 方法名
   * @returns Method metadata or undefined 方法元数据或undefined
   */
  static getMethodMetadata(
    constructor: Function,
    methodName: string
  ): VisualMethodMetadata | undefined {
    return getMethodMetadata(constructor, methodName);
  }

  /**
   * Create node palette data for UI
   * 为UI创建节点面板数据
   *
   * @returns Organized node palette data 组织的节点面板数据
   */
  static createNodePalette(): NodePaletteData {
    const categories = new Map<string, NodeTypeInfo[]>();

    for (const nodeType of this.getAvailableNodeTypes()) {
      // Resolve category at runtime
      // 在运行时解析分类
      const resolvedMetadata = this.resolveI18nMetadata(nodeType.metadata);
      const category = resolvedMetadata.category || 'Unknown';

      if (!categories.has(category)) {
        categories.set(category, []);
      }

      const categoryNodes = categories.get(category);
      if (categoryNodes) {
        // Create node type with resolved metadata for palette
        // 为面板创建包含解析元数据的节点类型
        const resolvedNodeType: NodeTypeInfo = {
          ...nodeType,
          metadata: resolvedMetadata
        };
        categoryNodes.push(resolvedNodeType);
      }
    }

    // Sort categories and nodes
    // 排序分类和节点
    const sortedCategories = Array.from(categories.keys()).sort();
    const palette: NodePaletteData = { categories: {} };

    for (const category of sortedCategories) {
      const nodes = categories.get(category);
      if (nodes) {
        nodes.sort((a, b) => (a.metadata.title || '').localeCompare(b.metadata.title || ''));
        palette.categories[category] = nodes;
      }
    }

    return palette;
  }

  /**
   * Validate node type registration
   * 验证节点类型注册
   *
   * @returns Validation results 验证结果
   */
  static validateRegistration(): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [typeName, nodeType] of this.nodeTypes) {
      const validation = this.validateNodeType(nodeType);
      results.push({
        typeName,
        valid: validation.valid,
        errors: validation.errors
      });
    }

    return results;
  }

  /**
   * Validate individual node type
   * 验证单个节点类型
   */
  private static validateNodeType(nodeType: NodeTypeInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Resolve i18n metadata for validation
    // 为验证解析i18n元数据
    const resolvedMetadata = this.resolveI18nMetadata(nodeType.metadata);

    // Check required metadata fields
    // 检查必需的元数据字段
    if (!resolvedMetadata.title) {
      errors.push('Missing title');
    }

    if (!resolvedMetadata.category) {
      errors.push('Missing category');
    }

    // Validate input/output configurations
    // 验证输入/输出配置
    for (const input of resolvedMetadata.inputs) {
      if (!input.type) {
        errors.push(`Input missing type: ${input.label || 'unnamed'}`);
      }
    }

    for (const output of resolvedMetadata.outputs) {
      if (!output.type) {
        errors.push(`Output missing type: ${output.label || 'unnamed'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset node ID counter (for testing)
   * 重置节点ID计数器（用于测试）
   */
  static resetNodeIdCounter(): void {
    this.nodeIdCounter = 0;
  }
}

/**
 * Node type information
 * 节点类型信息
 */
export interface NodeTypeInfo {
  /** Unique type name 唯一类型名称 */
  name: string;
  /** Target object type 目标对象类型 */
  targetType: string;
  /** Method metadata 方法元数据 */
  metadata: VisualMethodMetadata;
  /** Factory function to create node instances 创建节点实例的工厂函数 */
  factory: (id: string) => MethodCallNode;
}

/**
 * Node palette data for UI
 * UI的节点面板数据
 */
export interface NodePaletteData {
  /** Categories mapped to their node types 分类映射到其节点类型 */
  categories: Record<string, NodeTypeInfo[]>;
}

/**
 * Validation result for node type registration
 * 节点类型注册的验证结果
 */
export interface ValidationResult {
  /** Node type name 节点类型名称 */
  typeName: string;
  /** Whether validation passed 验证是否通过 */
  valid: boolean;
  /** Validation errors if any 验证错误（如果有） */
  errors?: string[];
}

// Auto-register ECS methods when module loads
// 模块加载时自动注册ECS方法
try {
  NodeGenerator.registerECSMethods();
} catch (error) {
  console.warn('Failed to register ECS methods for visual nodes:', error);
}