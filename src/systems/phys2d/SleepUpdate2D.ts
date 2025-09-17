/**
 * Sleep evaluation system for 2D physics bodies
 *
 * Evaluates sleep state for dynamic bodies based on velocity thresholds and timing.
 * Should run at the end of physics pipeline to update sleep states.
 *
 * 2D物理刚体的睡眠评估系统
 *
 * 基于速度阈值和时间评估动态刚体的睡眠状态。
 * 应在物理管道末尾运行以更新睡眠状态。
 */

import { Body2D } from '../../components/Body2D';
import { Sleep2D } from '../../components/Sleep2D';
import { PhysicsSleepConfig } from '../../resources/PhysicsSleepConfig';
import { FX, abs, add, mul, div, f } from '../../math/fixed';
import { system, SystemContext } from '../../core/System';

/**
 * Fast approximate vector length using consistent formula with narrowphase
 * Uses hi + 3/8*(lo^2/hi) approximation for stable and fast calculation
 * 与窄相一致的快速近似向量长度计算
 * 使用 hi + 3/8*(lo^2/hi) 近似公式，稳定且快速
 */
const approxLen = (vx: FX, vy: FX): FX => {
  const ax = abs(vx);
  const ay = abs(vy);
  const hi = ax > ay ? ax : ay;
  const lo = ax > ay ? ay : ax;
  const lo2_over_hi = hi ? div(mul(lo, lo), hi) : (0 as FX);
  return add(hi, mul(f(0.375), lo2_over_hi));
};

/**
 * Sleep Update System for 2D Physics Bodies
 * 2D物理刚体的睡眠更新系统
 *
 * Evaluates and updates sleep states for dynamic bodies based on velocity thresholds.
 * Bodies below velocity thresholds for sufficient time will enter sleep state.
 * 基于速度阈值评估和更新动态刚体的睡眠状态。
 * 速度低于阈值足够时间的刚体将进入睡眠状态。
 */
export const SleepUpdate2D = system(
  'phys.sleep.update',
  (ctx: SystemContext) => {
    const { world, deltaTime } = ctx;

    // Get or create sleep configuration
    let cfg = world.getResource(PhysicsSleepConfig);
    if (!cfg) {
      cfg = new PhysicsSleepConfig();
      world.setResource(PhysicsSleepConfig, cfg);
    }

    // Use fixed timestep or provided deltaTime
    const dt = world.getFixedDtFX ? world.getFixedDtFX() : f(deltaTime);

    // Component stores are handled by replaceComponent calls

    // Process all bodies with sleep components
    world.query(Body2D, Sleep2D).forEach((e, b: Body2D, s: Sleep2D) => {
      let needsUpdate = false;
      const newSleep = new Sleep2D();
      Object.assign(newSleep, s);
      const newBody = new Body2D();
      Object.assign(newBody, b);

      // Skip static bodies (infinite mass or inertia)
      if ((b.invMass | 0) === 0 || (b.invI | 0) === 0) {
        newSleep.sleeping = 0;
        newSleep.timer = 0 as FX;
        needsUpdate = true;
      }
      // Force awake if keepAwake flag is set
      else if (s.keepAwake) {
        newSleep.sleeping = 0;
        newSleep.timer = 0 as FX;
        needsUpdate = true;
      }
      else {
        // Calculate current speed and angular velocity
        const speed = approxLen(b.vx, b.vy);
        const angularSpeed = abs(b.w);

        // Check if both linear and angular velocities are below thresholds
        const belowThreshold = (speed <= cfg.linThresh) && (angularSpeed <= cfg.angThresh);

        // Check if velocities exceed wake bias thresholds (for immediate wake)
        const aboveWakeBias = (speed > mul(cfg.linThresh, cfg.wakeBias)) || (angularSpeed > mul(cfg.angThresh, cfg.wakeBias));

        if (belowThreshold) {
          if (s.sleeping) {
            // Already sleeping - no update needed unless external forces act
            // Keep existing values unchanged
          } else {
            // Accumulate idle time for awake bodies
            newSleep.timer = add(s.timer, dt);

            // Check if ready to sleep
            if (newSleep.timer >= cfg.timeToSleep) {
              newSleep.sleeping = 1;
              // Clear velocities to prevent jitter
              newBody.vx = 0 as FX;
              newBody.vy = 0 as FX;
              newBody.w = 0 as FX;
              // Update Body2D awake state for consistency
              newBody.awake = 0;
              needsUpdate = true;
            } else if (newSleep.timer !== s.timer) {
              needsUpdate = true;
            }
          }
        } else if (aboveWakeBias) {
          // Well above threshold with bias - force wake immediately
          if (s.sleeping || s.timer !== 0) {
            newSleep.sleeping = 0;
            newSleep.timer = 0 as FX;
            newBody.awake = 1;
            needsUpdate = true;
          }
        } else {
          // Between normal threshold and wake bias - clear timer but allow gradual sleep
          if (s.sleeping || s.timer !== 0) {
            newSleep.sleeping = 0;
            newSleep.timer = 0 as FX;
            newBody.awake = 1;
            needsUpdate = true;
          }
        }
      }

      // Update components if changes were made
      if (needsUpdate) {
        world.replaceComponent(e, Sleep2D, newSleep);
        world.replaceComponent(e, Body2D, newBody);
      }
    });
  }
)
  .stage('postUpdate')
  .after('phys.solver.gs')
  .before('cleanup')
  .build();