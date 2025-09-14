/**
 * Command recorder for replay system
 * 重放系统的命令记录器
 */

import { CommandLog, Cmd } from './CommandLog';
import { PRNG } from '../determinism/PRNG';
import type { World } from '../core/World';
import type { Entity } from '../utils/Types';

/**
 * Records actual commands applied to the world for deterministic replay
 * 记录应用到世界的实际命令以便确定性重放
 */
export class Recorder {
  private current: Cmd[] = [];
  private recording = true;

  constructor(private world: World, public log = new CommandLog()) {}

  /**
   * Start recording a new frame
   * 开始记录新帧
   */
  beginFrame(): void {
    if (!this.recording) return;
    this.current = [];
  }

  /**
   * Finish recording current frame and store it
   * 完成当前帧记录并存储
   */
  endFrame(): void {
    if (!this.recording) return;

    const rng = this.world.getResource(PRNG);
    const rngSeed = (rng as any)?.s;

    this.log.push({
      frame: this.world.frame,
      cmds: this.current.slice(),
      rngSeed
    });

    this.current = [];
  }

  /**
   * Record entity creation
   * 记录实体创建
   */
  onCreate(e: Entity, enable: boolean): void {
    if (!this.recording) return;
    this.current.push({ op: 'create', e, enable });
  }

  /**
   * Record entity destruction
   * 记录实体销毁
   */
  onDestroy(e: Entity): void {
    if (!this.recording) return;
    this.current.push({ op: 'destroy', e });
  }

  /**
   * Record entity enable/disable state change
   * 记录实体启用/禁用状态变更
   */
  onSetEnabled(e: Entity, v: boolean): void {
    if (!this.recording) return;
    this.current.push({ op: 'setEnabled', e, v });
  }

  /**
   * Record component addition
   * 记录组件添加
   */
  onAdd(e: Entity, typeId: number, value: any): void {
    if (!this.recording) return;

    // Deep clone for serialization safety
    let data: any;
    try {
      data = JSON.parse(JSON.stringify(value));
    } catch {
      // Fallback to shallow copy for non-serializable objects
      data = { ...value };
    }

    this.current.push({ op: 'add', e, typeId, data });
  }

  /**
   * Record component removal
   * 记录组件移除
   */
  onRemove(e: Entity, typeId: number): void {
    if (!this.recording) return;
    this.current.push({ op: 'remove', e, typeId });
  }

  /**
   * Start recording commands
   * 开始记录命令
   */
  startRecording(): void {
    this.recording = true;
  }

  /**
   * Stop recording commands
   * 停止记录命令
   */
  stopRecording(): void {
    this.recording = false;
  }

  /**
   * Check if currently recording
   * 检查是否正在记录
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Clear all recorded data
   * 清空所有记录数据
   */
  clear(): void {
    this.log.clear();
    this.current = [];
  }

  /**
   * Get current frame's command count
   * 获取当前帧的命令数量
   */
  getCurrentFrameCommandCount(): number {
    return this.current.length;
  }

  /**
   * Export log data for serialization
   * 导出日志数据用于序列化
   */
  exportLog(): CommandLog {
    return this.log;
  }

  /**
   * Import log data from serialization
   * 从序列化数据导入日志
   */
  importLog(log: CommandLog): void {
    this.log = log;
  }
}