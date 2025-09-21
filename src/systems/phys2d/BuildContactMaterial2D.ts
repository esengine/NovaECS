/**
 * Contact Material Builder System
 * 接触材质构建系统
 *
 * Calculates material properties for each contact manifold after narrowphase
 * and before warm start. Computes friction coefficients, restitution, and
 * effective restitution based on relative velocity threshold.
 * 在窄相之后、warm start之前为每个接触流形计算材质属性。
 * 计算摩擦系数、恢复系数，以及基于相对速度阈值的有效恢复系数。
 */

import { system, SystemContext } from '../../core/System';
import type { Entity } from '../../utils/Types';
import type { FX } from '../../math/fixed';
import { add, sub, mul, dot, f, neg } from '../../math/fixed';
import { Material2D, createDefaultMaterial } from '../../components/Material2D';
import { MaterialTable2D, resolveFriction, resolveRestitution, resolveBounceThreshold } from '../../resources/MaterialTable2D';
import { Body2D } from '../../components/Body2D';
import { Contacts2D, type Contact1 } from '../../resources/Contacts2D';
import type { World } from '../../core/World';

/**
 * Extended contact point with effective restitution
 * 带有效恢复系数的扩展接触点
 */
export interface ContactWithMaterial extends Contact1 {
  /**
   * Effective restitution coefficient for this contact point
   * Only non-zero if relative normal velocity exceeds bounce threshold
   * 此接触点的有效恢复系数
   * 仅当相对法向速度超过反弹阈值时才非零
   */
  effRest: FX;

  /**
   * Static friction coefficient for this contact
   * 此接触的静摩擦系数
   */
  muS: FX;

  /**
   * Dynamic friction coefficient for this contact
   * 此接触的动摩擦系数
   */
  muD: FX;
}

/**
 * Get material for an entity, with fallback hierarchy:
 * 1. Entity-specific Material2D component
 * 2. World default Material2D resource
 * 3. Built-in default material
 * 获取实体的材质，回退层次：
 * 1. 实体特定的Material2D组件
 * 2. 世界默认Material2D资源
 * 3. 内置默认材质
 */
function getMaterial(world: World, entity: Entity): Material2D {
  // Try entity-specific material first
  let material = world.getComponent(entity, Material2D);
  if (material) return material;

  // Fall back to world default material
  material = world.getResource(Material2D);
  if (material) return material;

  // Use built-in default as last resort
  return createDefaultMaterial();
}

/**
 * Calculate relative velocity at contact point
 * 计算接触点的相对速度
 */
function calculateRelativeVelocity(
  bodyA: Body2D,
  bodyB: Body2D,
  contactX: FX,
  contactY: FX
): { vx: FX; vy: FX } {
  // Calculate position vectors from center of mass to contact point
  // rA = contact - bodyA.position
  const rAx = sub(contactX, bodyA.px);
  const rAy = sub(contactY, bodyA.py);

  // rB = contact - bodyB.position
  const rBx = sub(contactX, bodyB.px);
  const rBy = sub(contactY, bodyB.py);

  // Velocity at contact point: v + ω × r
  // For 2D: ω × r = ω * (-ry, rx)
  const vAx = add(bodyA.vx, mul(neg(bodyA.w), rAy));
  const vAy = add(bodyA.vy, mul(bodyA.w, rAx));

  const vBx = add(bodyB.vx, mul(neg(bodyB.w), rBy));
  const vBy = add(bodyB.vy, mul(bodyB.w, rBx));

  // Relative velocity: vB - vA
  return {
    vx: sub(vBx, vAx),
    vy: sub(vBy, vAy)
  };
}

/**
 * Contact Material Builder System
 * 接触材质构建系统
 *
 * Takes contact manifolds from narrowphase and computes material properties
 * for each contact based on entity materials and mixing rules.
 * 接收窄相的接触流形，并基于实体材质和混合规则计算每个接触的材质属性。
 */
export const BuildContactMaterial2D = system(
  'phys.contacts.buildMaterial',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get contacts resource
    // 获取接触资源
    const contacts = world.getResource(Contacts2D);
    if (!contacts || contacts.list.length === 0) {
      return; // No contacts to process
    }

    // Get or create material table
    // 获取或创建材质表
    let materialTable = world.getResource(MaterialTable2D);
    if (!materialTable) {
      materialTable = new MaterialTable2D();
      world.setResource(MaterialTable2D, materialTable);
    }

    // Process each contact
    // 处理每个接触
    for (const contact of contacts.list) {
      // Get materials for both entities
      // 获取两个实体的材质
      const materialA = getMaterial(world, contact.a);
      const materialB = getMaterial(world, contact.b);

      // Get mixing rule for this material pair
      // 获取此材质对的混合规则
      const rule = materialTable.getRule(materialA, materialB);

      // Resolve material properties using mixing rules
      // 使用混合规则解析材质属性
      const friction = resolveFriction(materialA, materialB, rule);
      const restitution = resolveRestitution(materialA, materialB, rule);
      const bounceThreshold = resolveBounceThreshold(materialA, materialB, rule);

      // Extend contact with material properties
      // 使用材质属性扩展接触
      const extendedContact = contact as ContactWithMaterial;
      extendedContact.muS = friction.muS;
      extendedContact.muD = friction.muD;

      // Calculate effective restitution based on relative velocity
      // 基于相对速度计算有效恢复系数
      const bodyA = world.getComponent(contact.a, Body2D);
      const bodyB = world.getComponent(contact.b, Body2D);

      if (bodyA && bodyB) {
        // Calculate relative velocity at contact point
        // 计算接触点的相对速度
        const relVel = calculateRelativeVelocity(bodyA, bodyB, contact.px, contact.py);

        // Project relative velocity onto contact normal
        // 将相对速度投影到接触法线上
        const relativeNormalVelocity = dot(relVel.vx, relVel.vy, contact.nx, contact.ny);

        // Only enable restitution if objects are approaching fast enough
        // (negative normal velocity means approaching)
        // 仅当物体接近速度足够快时启用恢复系数（负法向速度表示接近）
        extendedContact.effRest = relativeNormalVelocity < neg(bounceThreshold) ? restitution : f(0);
      } else {
        // If either body is missing, disable restitution
        // 如果任一物体缺失，禁用恢复系数
        extendedContact.effRest = f(0);
      }
    }
  }
)
  .stage('update')
  .after('phys.narrow.circle')     // After narrowphase generates contacts
  .before('phys.contacts.warmStart') // Before warm start applies cached impulses
  .inSet('physics')
  .build();