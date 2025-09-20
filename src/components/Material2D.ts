/**
 * 2D Physics Material Component
 * 2D物理材质组件
 *
 * Defines surface properties for collision response including friction coefficients,
 * restitution, and bounce thresholds. Materials can be attached to entities or shapes
 * for fine-grained control over contact behavior.
 * 定义碰撞响应的表面属性，包括摩擦系数、恢复系数和反弹阈值。
 * 材质可以附加到实体或形状上，以精细控制接触行为。
 */

import type { FX } from '../math/fixed';
import { f } from '../math/fixed';

/**
 * 2D Physics Material Component
 * 2D物理材质组件
 *
 * Controls surface interaction properties for physics simulation.
 * 控制物理仿真中的表面交互属性。
 */
export class Material2D {
  /**
   * Material identifier for lookup rules and debugging
   * 材质标识符，用于查找规则和调试
   */
  id: string = 'default';

  /**
   * Static friction coefficient (0.0 = no friction, >1.0 = high friction)
   * 静摩擦系数（0.0 = 无摩擦，>1.0 = 高摩擦）
   * Typical range: 0.0 - 1.5
   */
  muS: FX = f(0.8);

  /**
   * Dynamic (kinetic) friction coefficient
   * 动摩擦系数（动力学摩擦）
   * Should typically be less than static friction
   */
  muD: FX = f(0.6);

  /**
   * Coefficient of restitution (0.0 = perfectly inelastic, 1.0 = perfectly elastic)
   * 恢复系数（0.0 = 完全非弹性，1.0 = 完全弹性）
   */
  restitution: FX = f(0.0);

  /**
   * Bounce velocity threshold in m/s (fixed-point)
   * 反弹速度阈值，单位：m/s（固定点表示）
   *
   * Objects with relative velocity below this threshold will not bounce,
   * preventing micro-bouncing and improving stability for resting contacts.
   * 相对速度低于此阈值的物体不会反弹，防止微反弹并改善静止接触的稳定性。
   */
  bounceThreshold: FX = f(0.5);

  constructor(
    id: string = 'default',
    muS: FX = f(0.8),
    muD: FX = f(0.6),
    restitution: FX = f(0.0),
    bounceThreshold: FX = f(0.5)
  ) {
    this.id = id;
    this.muS = muS;
    this.muD = muD;
    this.restitution = restitution;
    this.bounceThreshold = bounceThreshold;
  }
}

/**
 * Create a default material with balanced properties
 * 创建具有平衡属性的默认材质
 */
export function createDefaultMaterial(): Material2D {
  return new Material2D('default', f(0.8), f(0.6), f(0.0), f(0.5));
}

/**
 * Create a high-friction material (like rubber)
 * 创建高摩擦材质（如橡胶）
 */
export function createRubberMaterial(): Material2D {
  return new Material2D('rubber', f(1.2), f(1.0), f(0.7), f(0.2));
}

/**
 * Create a low-friction material (like ice)
 * 创建低摩擦材质（如冰）
 */
export function createIceMaterial(): Material2D {
  return new Material2D('ice', f(0.1), f(0.05), f(0.1), f(0.1));
}

/**
 * Create a bouncy material (like a ball)
 * 创建弹性材质（如球）
 */
export function createBouncyMaterial(): Material2D {
  return new Material2D('bouncy', f(0.5), f(0.4), f(0.9), f(1.0));
}

/**
 * Create a metal material with moderate properties
 * 创建具有中等属性的金属材质
 */
export function createMetalMaterial(): Material2D {
  return new Material2D('metal', f(0.6), f(0.5), f(0.2), f(0.8));
}

/**
 * Create a stone material with high friction, low restitution
 * 创建具有高摩擦、低恢复系数的石头材质
 */
export function createStoneMaterial(): Material2D {
  return new Material2D('stone', f(0.9), f(0.7), f(0.1), f(0.3));
}

/**
 * Create a wood material with moderate friction and restitution
 * 创建具有中等摩擦和恢复系数的木头材质
 */
export function createWoodMaterial(): Material2D {
  return new Material2D('wood', f(0.7), f(0.5), f(0.3), f(0.4));
}