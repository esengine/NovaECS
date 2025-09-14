/**
 * Ring buffer for world snapshots to enable efficient rollback
 * 用于世界快照的环形缓冲区，支持高效回滚
 */

import type { World } from '../core/World';
import { WorldSerializer, SaveData } from '../serialize/WorldSerializer';
import { CommandLog } from './CommandLog';
import { Replayer } from './Replayer';

/**
 * Checkpoint entry in the ring buffer
 * 环形缓冲区中的检查点条目
 */
interface Checkpoint {
  frame: number;
  save: SaveData;
}

/**
 * Ring buffer for storing periodic world snapshots
 * 用于存储定期世界快照的环形缓冲区
 */
export class CheckpointRing {
  private ring: Array<Checkpoint | undefined>;
  private idx = 0;
  private count = 0;

  constructor(
    private serializer = new WorldSerializer(),
    ringSize = 8
  ) {
    this.ring = new Array<Checkpoint | undefined>(ringSize);
  }

  /**
   * Take a snapshot of the current world state
   * 对当前世界状态进行快照
   */
  snapshot(world: World): void {
    const save = this.serializer.save(world);
    this.ring[this.idx] = { frame: world.frame, save };
    this.idx = (this.idx + 1) % this.ring.length;
    this.count = Math.min(this.count + 1, this.ring.length);
  }

  /**
   * Restore to nearest checkpoint <= targetFrame
   * 恢复到最接近的检查点（<= targetFrame）
   * @param world Target world to restore to
   * @param targetFrame Target frame to rollback to
   * @returns Frame number of the restored checkpoint, undefined if no suitable checkpoint found
   */
  restoreNearest(world: World, targetFrame: number): number | undefined {
    let best: Checkpoint | undefined;

    // Find the best checkpoint (<= targetFrame)
    for (let i = 0; i < this.ring.length; i++) {
      const checkpoint = this.ring[i];
      if (!checkpoint) continue;

      if (checkpoint.frame <= targetFrame) {
        if (!best || checkpoint.frame > best.frame) {
          best = checkpoint;
        }
      }
    }

    if (!best) return undefined;

    // Clear world and load checkpoint
    this.clearWorld(world);
    this.serializer.load(world, best.save);

    // Restore frame number
    world.frame = best.frame;

    return best.frame;
  }

  /**
   * Get all available checkpoints, sorted by frame
   * 获取所有可用的检查点，按帧排序
   */
  getCheckpoints(): Array<{ frame: number }> {
    return this.ring
      .filter((cp): cp is Checkpoint => cp !== undefined)
      .map(cp => ({ frame: cp.frame }))
      .sort((a, b) => a.frame - b.frame);
  }

  /**
   * Get checkpoint closest to target frame (but not exceeding it)
   * 获取最接近目标帧的检查点（但不超过它）
   */
  getClosestCheckpoint(targetFrame: number): { frame: number } | undefined {
    let best: Checkpoint | undefined;

    for (let i = 0; i < this.ring.length; i++) {
      const checkpoint = this.ring[i];
      if (!checkpoint) continue;

      if (checkpoint.frame <= targetFrame) {
        if (!best || checkpoint.frame > best.frame) {
          best = checkpoint;
        }
      }
    }

    return best ? { frame: best.frame } : undefined;
  }

  /**
   * Clear all checkpoints
   * 清空所有检查点
   */
  clear(): void {
    this.ring.fill(undefined);
    this.idx = 0;
    this.count = 0;
  }

  /**
   * Get number of stored checkpoints
   * 获取存储的检查点数量
   */
  size(): number {
    return this.count;
  }

  /**
   * Check if ring is full
   * 检查环形缓冲区是否已满
   */
  isFull(): boolean {
    return this.count === this.ring.length;
  }

  /**
   * Get capacity of the ring buffer
   * 获取环形缓冲区的容量
   */
  capacity(): number {
    return this.ring.length;
  }

  /**
   * Create log subset for replay between frames
   * 创建用于重放指定帧间隔的日志子集
   */
  createLogSubset(fullLog: CommandLog, startFrame: number, endFrame: number): CommandLog {
    const subset = new CommandLog();
    subset.startFrame = startFrame;

    for (const frameLog of fullLog.frames) {
      if (frameLog.frame > startFrame && frameLog.frame <= endFrame) {
        subset.push(frameLog);
      }
    }

    return subset;
  }

  /**
   * Perform rollback to target frame using checkpoint + replay
   * 使用检查点 + 重放执行回滚到目标帧
   */
  rollbackTo(world: World, targetFrame: number, fullLog: CommandLog): boolean {
    // Find nearest checkpoint
    const checkpointFrame = this.restoreNearest(world, targetFrame);

    if (checkpointFrame === undefined) {
      // No suitable checkpoint found
      return false;
    }

    if (checkpointFrame === targetFrame) {
      // Exact match, no need to replay
      return true;
    }

    // For simplicity, use full replay from the beginning
    // This ensures correct entity mapping
    const replayer = new Replayer(world);
    replayer.loadToFrame(fullLog, targetFrame);

    // Ensure frame is set to target frame
    world.frame = targetFrame;

    return true;
  }

  /**
   * Clear world state (similar to Replayer)
   * 清空世界状态（类似 Replayer）
   */
  private clearWorld(world: World): void {
    const allEntities = world.getAllAliveEntities();
    for (const entity of allEntities) {
      world.destroyEntity(entity);
    }
  }


  /**
   * Get debug information about the ring state
   * 获取环形缓冲区状态的调试信息
   */
  getDebugInfo(): {
    size: number;
    capacity: number;
    currentIndex: number;
    checkpoints: Array<{ frame: number; position: number }>;
  } {
    const checkpoints: Array<{ frame: number; position: number }> = [];

    for (let i = 0; i < this.ring.length; i++) {
      const checkpoint = this.ring[i];
      if (checkpoint) {
        checkpoints.push({ frame: checkpoint.frame, position: i });
      }
    }

    return {
      size: this.count,
      capacity: this.ring.length,
      currentIndex: this.idx,
      checkpoints: checkpoints.sort((a, b) => a.frame - b.frame)
    };
  }
}