/**
 * Joint Event Handler System for 2D Physics
 * 2D物理关节事件处理系统
 *
 * Listens to JointEvents2D.events and handles joint breaking by destroying broken joints.
 * This system avoids modifying joint structure during constraint solving by processing
 * events after the solver has completed.
 *
 * 监听JointEvents2D.events并通过销毁断裂关节来处理关节断裂。
 * 该系统通过在求解器完成后处理事件来避免在约束求解期间修改关节结构。
 */

import { JointEvents2D, JointBrokenEvent } from './SolverGSJoints2D';
import { JointDistance2D } from '../../components/JointDistance2D';
import { JointConstraints2D } from '../../resources/JointConstraints2D';
import { system, SystemContext } from '../../core/System';

/**
 * Joint Event Handler System
 * 关节事件处理系统
 */
export const JointEventHandler2D = system(
  'phys.joint.events',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const events = world.getResource(JointEvents2D);
    if (!events || events.events.length === 0) return;

    const constraints = world.getResource(JointConstraints2D);

    // Process each joint broken event
    // 处理每个关节断裂事件
    for (const event of events.events) {
      if (event instanceof JointBrokenEvent) {
        const jointEntity = event.joint;

        // Remove from constraints list if present
        // 如果存在则从约束列表中移除
        if (constraints) {
          constraints.removeJoint(jointEntity);
        }

        // Optionally destroy the joint entity
        // 可选择销毁关节实体
        // Note: This is optional - users might want to keep the entity for other purposes
        // 注意：这是可选的 - 用户可能出于其他目的想要保留实体
        if (world.hasComponent(jointEntity, JointDistance2D)) {
          world.removeComponent(jointEntity, JointDistance2D);
          // Uncomment the next line if you want to completely destroy the entity
          // 如果您想要完全销毁实体，请取消注释下一行
          // world.destroyEntity(jointEntity);
        }
      }
    }

    // Clear processed events
    // 清除已处理的事件
    events.clear();
  }
)
  .stage('cleanup')
  .after('phys.solver.joints.gs')
  .build();