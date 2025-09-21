/**
 * TOI Inject and Mini Solve System
 * TOI注入和微求解系统
 *
 * Converts TOI events into temporary contact manifolds and runs a mini solver
 * iteration on the remaining time after impact. This upgrades "stop on impact"
 * to "impact → establish contact → mini solve for remaining time (friction/rebound)".
 * 将TOI事件转换为临时接触流形，并在撞击后的剩余时间内运行微求解器迭代。
 * 这将"撞击时停止"升级为"撞击→建立接触→剩余时间微求解（摩擦/反弹）"。
 */

import { system, SystemContext } from '../../core/System';
import { TOIQueue2D } from '../../resources/TOIQueue2D';
import { Contacts2D, type Contact1 } from '../../resources/Contacts2D';
import { SolverTimeScale } from '../../resources/SolverTimeScale';
import { BuildContactMaterial2D } from './BuildContactMaterial2D';
import { ContactsWarmStart2D } from './ContactsWarmStart2D';
import { ContactsCommit2D } from './ContactsCommit2D';
import { SolverGS2D } from './SolverGS2D';
import type { FX } from '../../math/fixed';
import { f, sub, ZERO, add } from '../../math/fixed';

/**
 * Small epsilon added to time scale for safety
 * 添加到时间缩放的小安全间隙
 */
const TIME_EPSILON = f(0.001);


/**
 * Create a temporary contact from TOI event
 * 从TOI事件创建临时接触
 */
function createTOIContact(
  entityA: number,
  entityB: number,
  nx: FX,
  ny: FX,
  px: FX,
  py: FX
): Contact1 {
  return {
    a: entityA,
    b: entityB,
    nx,
    ny,
    px,
    py,
    pen: ZERO,        // TOI contacts have zero penetration
    jn: ZERO,         // Start with zero impulse
    jt: ZERO,         // Start with zero impulse
    speculative: 0,   // Not speculative - actual contact
    featureId: 0      // TOI artificial contact point
  };
}

/**
 * TOI Inject and Mini Solve System
 * TOI注入和微求解系统
 */
export const TOIInjectAndMiniSolve2D = system(
  'phys.ccd.toiMiniSolve',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get TOI queue
    // 获取TOI队列
    const toiQueue = world.getResource(TOIQueue2D);
    if (!toiQueue || toiQueue.items.length === 0) {
      console.log(`TOI Mini Solve: No TOI events to process (queue length: ${toiQueue?.items.length ?? 0})`);
      return;
    }

    console.log(`TOI Mini Solve: Starting to process ${toiQueue.items.length} TOI events`);

    // Calculate remaining time scale from earliest TOI event
    // 从最早的TOI事件计算剩余时间缩放
    const earliestEvent = toiQueue.items[0];
    if (!earliestEvent) return;

    const remainingTimeScale = sub(f(1), earliestEvent.t);
    if (remainingTimeScale <= ZERO) {
      // No remaining time - clear queue and return
      // 无剩余时间 - 清空队列并返回
      toiQueue.clear();
      return;
    }

    // Add small epsilon for numerical stability
    // 添加小间隙以提升数值稳定性
    const timeScale = add(remainingTimeScale, TIME_EPSILON);

    // 1) Build temporary contact batch from TOI events
    // 1) 从TOI事件构建临时接触批次
    const tempContacts: Contact1[] = [];
    for (const event of toiQueue.items) {
      const contact = createTOIContact(
        event.a,
        event.b,
        event.nx,
        event.ny,
        event.px,
        event.py
      );
      tempContacts.push(contact);
    }

    // 2) Save original state and inject temporary batch
    // 2) 保存原始状态并注入临时批次
    const originalContacts = world.getResource(Contacts2D);
    const originalTimeScale = world.getResource(SolverTimeScale);

    // Create temporary resources
    // 创建临时资源
    const tempContactResource = new Contacts2D();
    tempContactResource.frame = world.frame;
    tempContactResource.list = tempContacts;

    const tempTimeScaleResource = new SolverTimeScale();
    tempTimeScaleResource.setScale(timeScale);

    // Replace resources temporarily
    // 临时替换资源
    world.setResource(Contacts2D, tempContactResource);
    world.setResource(SolverTimeScale, tempTimeScaleResource);

    try {
      // 3) Run mini solver pipeline on TOI contacts only
      // 3) 仅在TOI接触上运行微求解器管道

      // Build material properties for TOI contacts
      // 为TOI接触构建材质属性
      BuildContactMaterial2D.fn(ctx);

      // Warm start (TOI contacts start with zero impulse)
      // Warm start（TOI接触以零冲量开始）
      ContactsWarmStart2D.fn(ctx);

      // Run reduced iterations solver
      // 运行减少迭代的求解器
      SolverGS2D.fn(ctx);

      // Commit impulses (though TOI contacts are temporary)
      // 提交冲量（尽管TOI接触是临时的）
      ContactsCommit2D.fn(ctx);

    } finally {
      // 4) Restore original state and clear TOI queue
      // 4) 恢复原始状态并清空TOI队列

      console.log(`TOI Mini Solve: Processing ${tempContacts.length} TOI contacts with time scale ${timeScale}`);

      if (originalContacts) {
        world.setResource(Contacts2D, originalContacts);
      }

      if (originalTimeScale) {
        world.setResource(SolverTimeScale, originalTimeScale);
      } else {
        // Remove temporary time scale if none existed before
        // 如果之前不存在则移除临时时间缩放
        world.removeResource(SolverTimeScale);
      }

      // Clear TOI queue for next frame
      // 清空TOI队列为下一帧准备
      toiQueue.clear();
      console.log(`TOI Mini Solve: Cleared TOI queue after processing`);
    }
  }
)
  .stage('update')
  .after('phys.ccd.toiSort')          // After TOI events are sorted
  .before('phys.narrow.circle')       // Before regular discrete narrowphase
  .inSet('physics')
  .build();