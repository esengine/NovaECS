/**
 * Component type registration with bidirectional mapping (ctor ↔ id)
 * 组件类型注册，支持双向映射（构造函数 ↔ ID）
 */

/**
 * Component constructor type
 * 组件构造函数类型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentCtor<T> = new (...args: any[]) => T;

/**
 * Component type with stable numeric ID and constructor
 * 具有稳定数字ID和构造函数的组件类型
 */
export interface ComponentType<T> {
  /** Stable numeric type identifier 稳定数字类型ID */
  id: number;
  /** Component constructor 组件构造函数 */
  ctor: ComponentCtor<T>;
}

let _nextTypeId = 1; // 0 reserved 0被预留
const _idByCtor = new Map<Function, number>();
const _ctorById = new Map<number, ComponentCtor<any>>();

/**
 * Register component with optional explicit ID for hot reload/toolchain stability
 * 注册组件，可显式指定ID，用于热重载/工具链保证稳定ID
 */
export function registerComponent<T>(
  ctor: ComponentCtor<T>,
  explicitId?: number
): ComponentType<T> {
  if (_idByCtor.has(ctor)) {
    const id = _idByCtor.get(ctor)!;
    return { id, ctor };
  }

  const id = explicitId ?? _nextTypeId++;
  if (_ctorById.has(id)) {
    throw new Error(
      `[ComponentTypeRegistry] id ${id} already occupied by ${_ctorById.get(id)?.name}`
    );
  }

  _idByCtor.set(ctor, id);
  _ctorById.set(id, ctor);
  return { id, ctor };
}

/**
 * Get component type (auto-register if not registered)
 * 获取组件类型（若未注册则自动注册并分配ID）
 */
export function getComponentType<T>(ctor: ComponentCtor<T>): ComponentType<T> {
  const id = _idByCtor.get(ctor);
  return id ? { id, ctor } : registerComponent(ctor);
}

/**
 * Get constructor by type ID (critical for bidirectional lookup)
 * 通过ID取回构造函数（正反向查询关键）
 */
export function getCtorByTypeId<T = any>(id: number): ComponentCtor<T> | undefined {
  return _ctorById.get(id) as ComponentCtor<T> | undefined;
}

/**
 * Create component type from ID (shell type for command buffer paths that don't depend on ctor)
 * 通过ID拼出"壳类型"（用于命令缓冲等不依赖构造函数的路径）
 */
export function typeFromId<T = any>(id: number): ComponentType<T> {
  const ctor = _ctorById.get(id) as ComponentCtor<T> | undefined;
  return { id, ctor: ctor ?? (class {} as any) };
}

/**
 * Reset registry (for testing/editor)
 * 重置注册表（测试/编辑器用）
 */
export function __resetRegistry(): void {
  _nextTypeId = 1;
  _idByCtor.clear();
  _ctorById.clear();
}