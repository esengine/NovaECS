/**
 * Material Mixing Rules and Pair Table for 2D Physics
 * 2D物理材质混合规则和配对表
 *
 * Provides configurable mixing rules for different material combinations
 * with support for custom functions and fallback defaults.
 * 为不同材质组合提供可配置的混合规则，支持自定义函数和默认回退。
 */

import type { FX } from '../math/fixed';
import { f, min, max, mul, add, div, sqrt } from '../math/fixed';
import { Material2D } from '../components/Material2D';

/**
 * Material mixing rule types
 * 材质混合规则类型
 */
export type MixRule = 'min' | 'max' | 'avg' | 'mul' | 'geo' | 'a' | 'b';

/**
 * Pair-specific mixing rules for material combinations
 * 材质组合的特定混合规则
 */
export interface PairRule {
  /**
   * Friction coefficient mixing rule
   * 摩擦系数混合规则
   */
  frictionRule?: MixRule;

  /**
   * Restitution coefficient mixing rule
   * 恢复系数混合规则
   */
  restitutionRule?: MixRule;

  /**
   * Bounce threshold mixing rule
   * 反弹阈值混合规则
   */
  thresholdRule?: MixRule;

  /**
   * Custom friction calculation function
   * 自定义摩擦计算函数
   *
   * If provided, overrides frictionRule for this material pair
   * 如果提供，将覆盖此材质对的摩擦规则
   */
  customFriction?: (a: Material2D, b: Material2D) => { muS: FX; muD: FX };

  /**
   * Custom restitution calculation function
   * 自定义恢复系数计算函数
   *
   * If provided, overrides restitutionRule for this material pair
   * 如果提供，将覆盖此材质对的恢复系数规则
   */
  customRestitution?: (a: Material2D, b: Material2D) => FX;

  /**
   * Custom bounce threshold calculation function
   * 自定义反弹阈值计算函数
   *
   * If provided, overrides thresholdRule for this material pair
   * 如果提供，将覆盖此材质对的反弹阈值规则
   */
  customThreshold?: (a: Material2D, b: Material2D) => FX;
}

/**
 * Create deterministic pair key for material combination
 * 为材质组合创建确定性配对键
 *
 * Ensures consistent ordering regardless of parameter order
 * 确保无论参数顺序如何都有一致的排序
 */
function pairKey(aId: string, bId: string): string {
  return aId <= bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

/**
 * Material mixing table for 2D physics
 * 2D物理材质混合表
 *
 * Manages material interaction rules and provides fallback defaults.
 * Default mixing rules:
 * - Friction: 'min' (not pulled up by slippery surfaces)
 * - Restitution: 'max' (more bouncy material dominates)
 * - Threshold: 'max' (low-speed jitter more easily suppressed)
 *
 * 管理材质交互规则并提供默认回退。
 * 默认混合规则：
 * - 摩擦：'min'（不被光滑表面"拉高"）
 * - 恢复：'max'（更弹的材质主导）
 * - 阈值：'max'（低速抖动更容易被抑制）
 */
export class MaterialTable2D {
  /**
   * Material pair-specific rules
   * 材质对特定规则
   */
  private rules = new Map<string, PairRule>();

  /**
   * Default mixing rules for unspecified material pairs
   * 未指定材质对的默认混合规则
   */
  public defaults: PairRule = {
    frictionRule: 'min',
    restitutionRule: 'max',
    thresholdRule: 'max'
  };

  /**
   * Set mixing rule for a specific material pair
   * 为特定材质对设置混合规则
   */
  set(aId: string, bId: string, rule: PairRule): void {
    this.rules.set(pairKey(aId, bId), rule);
  }

  /**
   * Get mixing rule for a material pair
   * 获取材质对的混合规则
   *
   * Returns pair-specific rule if exists, otherwise returns defaults
   * 如果存在特定规则则返回，否则返回默认规则
   */
  getRule(a: Material2D, b: Material2D): PairRule {
    return this.rules.get(pairKey(a.id, b.id)) ?? this.defaults;
  }

  /**
   * Check if specific rule exists for material pair
   * 检查材质对是否存在特定规则
   */
  hasRule(a: Material2D, b: Material2D): boolean {
    return this.rules.has(pairKey(a.id, b.id));
  }

  /**
   * Remove rule for specific material pair (falls back to defaults)
   * 移除特定材质对的规则（回退到默认值）
   */
  removeRule(aId: string, bId: string): boolean {
    return this.rules.delete(pairKey(aId, bId));
  }

  /**
   * Clear all pair-specific rules
   * 清除所有特定配对规则
   */
  clear(): void {
    this.rules.clear();
  }

  /**
   * Get all defined material pair keys
   * 获取所有已定义的材质配对键
   */
  getAllPairs(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Get number of defined material pair rules
   * 获取已定义材质配对规则的数量
   */
  size(): number {
    return this.rules.size;
  }
}

/**
 * Universal mixing function for two values
 * 两个值的通用混合函数
 *
 * Applies the specified mixing rule to combine two fixed-point values
 * 应用指定的混合规则来组合两个定点数值
 */
export function mix(x: FX, y: FX, rule: MixRule): FX {
  switch (rule) {
    case 'min':
      return min(x, y);

    case 'max':
      return max(x, y);

    case 'avg':
      return div(add(x, y), f(2));

    case 'mul':
      return mul(x, y);

    case 'geo':
      // Geometric mean: sqrt(x * y)
      // 几何平均：sqrt(x * y)
      return sqrt(mul(x, y));

    case 'a':
      return x;

    case 'b':
      return y;

    default:
      // Fallback to minimum for safety
      // 安全回退到最小值
      return min(x, y);
  }
}

/**
 * Resolve friction coefficients for material pair
 * 解析材质对的摩擦系数
 */
export function resolveFriction(
  a: Material2D,
  b: Material2D,
  rule: PairRule
): { muS: FX; muD: FX } {
  // Use custom function if provided
  // 如果提供自定义函数则使用
  if (rule.customFriction) {
    return rule.customFriction(a, b);
  }

  // Use standard mixing rule
  // 使用标准混合规则
  const frictionRule = rule.frictionRule ?? 'min';
  return {
    muS: mix(a.muS, b.muS, frictionRule),
    muD: mix(a.muD, b.muD, frictionRule)
  };
}

/**
 * Resolve restitution coefficient for material pair
 * 解析材质对的恢复系数
 */
export function resolveRestitution(
  a: Material2D,
  b: Material2D,
  rule: PairRule
): FX {
  // Use custom function if provided
  // 如果提供自定义函数则使用
  if (rule.customRestitution) {
    return rule.customRestitution(a, b);
  }

  // Use standard mixing rule
  // 使用标准混合规则
  const restitutionRule = rule.restitutionRule ?? 'max';
  return mix(a.restitution, b.restitution, restitutionRule);
}

/**
 * Resolve bounce threshold for material pair
 * 解析材质对的反弹阈值
 */
export function resolveBounceThreshold(
  a: Material2D,
  b: Material2D,
  rule: PairRule
): FX {
  // Use custom function if provided
  // 如果提供自定义函数则使用
  if (rule.customThreshold) {
    return rule.customThreshold(a, b);
  }

  // Use standard mixing rule
  // 使用标准混合规则
  const thresholdRule = rule.thresholdRule ?? 'max';
  return mix(a.bounceThreshold, b.bounceThreshold, thresholdRule);
}