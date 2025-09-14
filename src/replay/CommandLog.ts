/**
 * Command log types and storage for replay system
 * 重放系统的命令日志类型和存储
 */

import type { Entity } from '../utils/Types';

export type Cmd =
  | { op: 'create'; e: Entity; enable: boolean }
  | { op: 'destroy'; e: Entity }
  | { op: 'setEnabled'; e: Entity; v: boolean }
  | { op: 'add'; e: Entity; typeId: number; data: any }
  | { op: 'remove'; e: Entity; typeId: number };

export interface FrameLog {
  frame: number;
  cmds: Cmd[];
  rngSeed?: number;
}

/**
 * Storage for command logs organized by frames
 * 按帧组织的命令日志存储
 */
export class CommandLog {
  frames: FrameLog[] = [];
  startFrame = 0;

  /**
   * Clear all logged frames
   * 清空所有记录的帧
   */
  clear(): void {
    this.frames.length = 0;
  }

  /**
   * Add a frame log entry
   * 添加一个帧日志条目
   */
  push(f: FrameLog): void {
    this.frames.push(f);
  }

  /**
   * Get frame log by frame number
   * 根据帧号获取帧日志
   */
  getFrame(frameNumber: number): FrameLog | undefined {
    return this.frames.find(f => f.frame === frameNumber);
  }

  /**
   * Get all frames in a range
   * 获取指定范围内的所有帧
   */
  getFrameRange(start: number, end: number): FrameLog[] {
    return this.frames.filter(f => f.frame >= start && f.frame <= end);
  }

  /**
   * Get total number of frames logged
   * 获取记录的总帧数
   */
  getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * Get the latest frame number
   * 获取最新的帧号
   */
  getLatestFrame(): number {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1].frame : 0;
  }
}