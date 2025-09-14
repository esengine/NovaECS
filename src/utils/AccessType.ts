/**
 * Component access types for dependency analysis
 * 组件访问类型，用于依赖分析
 */
export enum AccessType {
  /** Read-only access 只读访问 */
  Read = 'read',
  /** Write access 写访问 */
  Write = 'write',
  /** Read-write access 读写访问 */
  ReadWrite = 'readwrite'
}

import type { ComponentType } from './Types';

/**
 * Component access descriptor
 * 组件访问描述符
 */
export interface ComponentAccess {
  /** Component type 组件类型 */
  componentType: ComponentType;
  /** Access type 访问类型 */
  accessType: AccessType;
}