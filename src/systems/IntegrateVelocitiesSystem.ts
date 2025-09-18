/**
 * Velocity Integration System for 2D Physics
 * 2D物理引擎的速度积分系统
 *
 * Integrates linear and angular velocities using semi-implicit Euler method
 * with fixed-point arithmetic for deterministic simulation.
 * 使用半隐式欧拉方法和定点数运算进行线性和角速度积分，确保确定性仿真。
 */

import { system, SystemContext } from '../core/System';
import { Body2D } from '../components/Body2D';
import { madd, FP } from '../math/fixed';
import type { FX } from '../math/fixed';
import type { World } from '../core/World';

/**
 * Integrate velocities for all active 2D rigid bodies
 * 为所有活跃的2D刚体积分速度
 *
 * Integration steps:
 * 积分步骤：
 * 1. Update linear position: position += velocity * dt
 * 1. 更新线性位置：position += velocity * dt
 * 2. Update angular position: angle += angularVelocity * dt
 * 2. 更新角位置：angle += angularVelocity * dt
 * 3. Skip sleeping bodies for performance
 * 3. 跳过休眠物体以提升性能
 */
export const IntegrateVelocitiesSystem = system(
  'phys.integrateVelocities',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get fixed-point timestep from world
    // 从world获取定点时间步长
    const dtFX = getFixedDt(world);

    // Query all bodies and integrate their velocities
    // 查询所有物体并积分它们的速度
    world.query(Body2D).forEach((_entity, body) => {
      // Skip sleeping bodies
      // 跳过休眠的物体
      if (!body.awake) return;

      // Skip static bodies (infinite mass)
      // 跳过静态物体（无限质量）
      if (body.invMass === 0) return;

      // Integrate linear velocity: position += velocity * dt
      // 积分线速度：位置 += 速度 * dt
      body.px = madd(body.px, body.vx, dtFX);
      body.py = madd(body.py, body.vy, dtFX);

      // Integrate angular velocity: angle += angularVelocity * dt
      // 积分角速度：角度 += 角速度 * dt
      // Calculate angular step in fixed point, then convert to u16 angle
      // 计算定点角步长，然后转换为u16角度
      const angularStep = madd(0, body.w, dtFX);

      // Map 2π fixed-point radians to 65536 u16 values
      // 将2π定点弧度映射到65536个u16值
      // Since 2π ≈ f(6.283), we scale by 65536/(2π) ≈ 10430
      const ANGLE_SCALE = 10430; // Approximately 65536 / (2 * PI)
      const angleIncrementU16 = ((angularStep * ANGLE_SCALE) >> FP) & 0xffff;

      body.angle = (body.angle + angleIncrementU16) & 0xffff;
    });
  }
)
  .stage('update')
  .inSet('physics')
  .build();

/**
 * Get fixed-point timestep from World
 * 从World获取定点时间步长
 */
function getFixedDt(world: World): FX {
  return world.getFixedDtFX();
}