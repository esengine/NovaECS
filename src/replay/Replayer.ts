/**
 * Command replayer for deterministic replay
 * 确定性重放的命令重放器
 */

import { CommandLog, Cmd } from './CommandLog';
import type { World } from '../core/World';
import { CommandBuffer } from '../core/CommandBuffer';
import { PRNG } from '../determinism/PRNG';
import type { Entity } from '../utils/Types';

/**
 * Entity mapping for replay consistency
 * 重放一致性的实体映射
 */
interface EntityMapping {
  recorded: Entity;
  actual: Entity;
}

/**
 * Replays recorded commands to recreate deterministic world state
 * 重放记录的命令以重新创建确定性的世界状态
 */
export class Replayer {
  private entityMap = new Map<Entity, Entity>();
  private reverseEntityMap = new Map<Entity, Entity>();

  constructor(private world: World) {}

  /**
   * Clear world state and reset for replay
   * 清空世界状态并重置以便重放
   */
  clearWorld(): void {
    // Clear all entities (this will also remove all components)
    const allEntities = this.world.getAllAliveEntities();
    for (const entity of allEntities) {
      this.world.destroyEntity(entity);
    }

    // Reset frame counter
    this.world.frame = 0;

    // Clear mappings
    this.entityMap.clear();
    this.reverseEntityMap.clear();
  }

  /**
   * Load and replay command log
   * 加载并重放命令日志
   */
  load(log: CommandLog): void {
    this.clearWorld();

    const rng = this.world.getResource(PRNG);

    for (const frameLog of log.frames) {
      // Restore RNG seed for this frame
      if (rng && frameLog.rngSeed !== undefined) {
        (rng as any).s = frameLog.rngSeed >>> 0;
      }

      this.world.beginFrame();
      const cmd = new CommandBuffer(this.world);

      for (const c of frameLog.cmds) {
        this.replayCommand(cmd, c);
      }

      cmd.flush();
    }
  }

  /**
   * Load and replay up to specific frame
   * 加载并重放到指定帧
   */
  loadToFrame(log: CommandLog, targetFrame: number): void {
    this.clearWorld();

    const rng = this.world.getResource(PRNG);

    for (const frameLog of log.frames) {
      if (frameLog.frame > targetFrame) break;

      // Restore RNG seed for this frame
      if (rng && frameLog.rngSeed !== undefined) {
        (rng as any).s = frameLog.rngSeed >>> 0;
      }

      this.world.beginFrame();
      const cmd = new CommandBuffer(this.world);

      for (const c of frameLog.cmds) {
        this.replayCommand(cmd, c);
      }

      cmd.flush();
    }
  }

  /**
   * Replay a single command with entity mapping
   * 使用实体映射重放单个命令
   */
  private replayCommand(cmd: CommandBuffer, c: Cmd): void {
    switch (c.op) {
      case 'create': {
        // Create new entity and map it to recorded entity
        const actualEntity = cmd.create(c.enable);
        this.entityMap.set(c.e, actualEntity);
        this.reverseEntityMap.set(actualEntity, c.e);
        break;
      }

      case 'destroy': {
        const actualEntity = this.entityMap.get(c.e);
        if (actualEntity !== undefined) {
          cmd.destroy(actualEntity);
          this.entityMap.delete(c.e);
          this.reverseEntityMap.delete(actualEntity);
        }
        break;
      }

      case 'setEnabled': {
        const actualEntity = this.entityMap.get(c.e);
        if (actualEntity !== undefined) {
          cmd.setEnabled(actualEntity, c.v);
        }
        break;
      }

      case 'add': {
        const actualEntity = this.entityMap.get(c.e);
        if (actualEntity !== undefined) {
          cmd.addByTypeId(actualEntity, c.typeId, c.data);
        }
        break;
      }

      case 'remove': {
        const actualEntity = this.entityMap.get(c.e);
        if (actualEntity !== undefined) {
          cmd.removeByTypeId(actualEntity, c.typeId);
        }
        break;
      }
    }
  }

  /**
   * Get actual entity ID from recorded entity ID
   * 从记录的实体ID获取实际的实体ID
   */
  getActualEntity(recordedEntity: Entity): Entity | undefined {
    return this.entityMap.get(recordedEntity);
  }

  /**
   * Get recorded entity ID from actual entity ID
   * 从实际的实体ID获取记录的实体ID
   */
  getRecordedEntity(actualEntity: Entity): Entity | undefined {
    return this.reverseEntityMap.get(actualEntity);
  }

  /**
   * Get all entity mappings
   * 获取所有实体映射
   */
  getEntityMappings(): EntityMapping[] {
    const mappings: EntityMapping[] = [];
    for (const [recorded, actual] of this.entityMap) {
      mappings.push({ recorded, actual });
    }
    return mappings;
  }

  /**
   * Check if replay is consistent with original recording
   * 检查重放是否与原始记录一致
   */
  validateReplay(originalLog: CommandLog, newRecording: CommandLog): boolean {
    if (originalLog.frames.length !== newRecording.frames.length) {
      return false;
    }

    for (let i = 0; i < originalLog.frames.length; i++) {
      const originalFrame = originalLog.frames[i];
      const newFrame = newRecording.frames[i];

      if (originalFrame.cmds.length !== newFrame.cmds.length) {
        return false;
      }

      // Check RNG seeds match
      if (originalFrame.rngSeed !== newFrame.rngSeed) {
        return false;
      }

      // Check commands match (accounting for entity ID differences)
      for (let j = 0; j < originalFrame.cmds.length; j++) {
        if (!this.commandsMatch(originalFrame.cmds[j], newFrame.cmds[j])) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if two commands are equivalent (ignoring entity ID differences)
   * 检查两个命令是否等价（忽略实体ID差异）
   */
  private commandsMatch(cmd1: Cmd, cmd2: Cmd): boolean {
    if (cmd1.op !== cmd2.op) return false;

    switch (cmd1.op) {
      case 'create':
        return cmd1.enable === (cmd2 as any).enable;

      case 'destroy':
        return true; // Only operation type matters for destroy

      case 'setEnabled':
        return cmd1.v === (cmd2 as any).v;

      case 'add':
        return cmd1.typeId === (cmd2 as any).typeId &&
               JSON.stringify(cmd1.data) === JSON.stringify((cmd2 as any).data);

      case 'remove':
        return cmd1.typeId === (cmd2 as any).typeId;

      default:
        return false;
    }
  }
}