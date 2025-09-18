/**
 * Contact-based wake system for 2D physics bodies
 *
 * Wakes up sleeping bodies when they have contacts with active bodies or
 * when contact impulses exceed wake thresholds. Ensures proper propagation
 * of motion through contact networks.
 *
 * 基于接触的2D物理刚体唤醒系统
 *
 * 当睡眠刚体与活跃刚体接触或接触冲量超过唤醒阈值时唤醒它们。
 * 确保运动通过接触网络正确传播。
 */

import { Body2D } from '../../components/Body2D';
import { Sleep2D } from '../../components/Sleep2D';
import { Contacts2D } from '../../resources/Contacts2D';
import { PhysicsSleepConfig } from '../../resources/PhysicsSleepConfig';
import { FX, abs, f } from '../../math/fixed';
import { system, SystemContext } from '../../core/System';
import type { Entity } from '../../utils/Types';

/**
 * Wake up a sleeping body and mark it as changed
 * 唤醒睡眠刚体并标记为已变更
 */
function wake(world: { replaceComponent: (entity: Entity, ctor: any, data: any) => void; getComponent: (entity: Entity, ctor: any) => any }, entity: Entity, sleep: Sleep2D): void {
  if (sleep.sleeping) {
    // Create new sleep state and update via replaceComponent
    const newSleep = new Sleep2D();
    newSleep.sleeping = 0;
    newSleep.timer = 0 as FX;
    newSleep.keepAwake = sleep.keepAwake; // Preserve keepAwake flag
    world.replaceComponent(entity, Sleep2D, newSleep);

    // Update Body2D awake state for consistency
    const body = world.getComponent(entity, Body2D) as Body2D | undefined;
    if (body) {
      const newBody = new Body2D();
      // Copy all body properties
      Object.assign(newBody, body);
      newBody.awake = 1;
      world.replaceComponent(entity, Body2D, newBody);
    }
  }
}

/**
 * Wake On Contact System for 2D Physics Bodies
 * 2D物理刚体的接触唤醒系统
 *
 * Processes contact list and wakes bodies based on:
 * - Contact with already awake bodies
 * - Strong impulse accumulation
 * - Deep penetration in non-speculative contacts
 *
 * 处理接触列表并基于以下条件唤醒刚体：
 * - 与已清醒刚体的接触
 * - 强冲量累积
 * - 非推测接触中的深度穿透
 */
export const WakeOnContact2D = system(
  'phys.wake.contact',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get contacts resource
    const contacts = world.getResource(Contacts2D);
    if (!contacts || contacts.list.length === 0) return;

    // Get or create sleep configuration
    let cfg = world.getResource(PhysicsSleepConfig);
    if (!cfg) {
      cfg = new PhysicsSleepConfig();
      world.setResource(PhysicsSleepConfig, cfg);
    }

    // Process each contact
    for (const contact of contacts.list) {
      const sleepA = world.getComponent(contact.a, Sleep2D) as Sleep2D | undefined;
      const sleepB = world.getComponent(contact.b, Sleep2D) as Sleep2D | undefined;
      const bodyA = world.getComponent(contact.a, Body2D) as Body2D | undefined;
      const bodyB = world.getComponent(contact.b, Body2D) as Body2D | undefined;

      // Skip if either entity doesn't have required components
      if (!sleepA || !sleepB || !bodyA || !bodyB) continue;

      // If either side is already awake, wake the other side
      if (!sleepA.sleeping || !sleepB.sleeping) {
        wake(world, contact.a, sleepA);
        wake(world, contact.b, sleepB);
        continue;
      }

      // Both bodies are sleeping - check wake conditions

      // Strong impulse wake: accumulated normal or tangential impulse exceeds threshold
      const strongNormalImpulse = abs(contact.jn) >= cfg.impulseWake;
      const strongTangentialImpulse = abs(contact.jt) >= cfg.impulseWake;
      const strongImpulse = strongNormalImpulse || strongTangentialImpulse;

      // Deep penetration wake: non-speculative contact with significant penetration
      const isSpeculative = contact.speculative === 1;
      const deepPenetration = !isSpeculative && (contact.pen > f(0.0001));

      // Wake both bodies if any wake condition is met
      if (strongImpulse || deepPenetration) {
        wake(world, contact.a, sleepA);
        wake(world, contact.b, sleepB);
      }
    }
  }
)
  .stage('update')
  .after('phys.poscor.split')
  .before('phys.sleep.update')
  .build();