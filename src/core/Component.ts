/**
 * Base class for all components in the ECS architecture
 * ECS架构中所有组件的基类
 * 
 * @example
 * ```typescript
 * class PositionComponent extends Component {
 *   constructor(public x: number = 0, public y: number = 0) {
 *     super();
 *   }
 * }
 * 
 * class VelocityComponent extends Component {
 *   constructor(public dx: number = 0, public dy: number = 0) {
 *     super();
 *   }
 * }
 * ```
 */
export abstract class Component {
  private _enabled = true;

  /**
   * Get component enabled state
   * 获取组件启用状态
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Set component enabled state
   * 设置组件启用状态
   */
  set enabled(value: boolean) {
    this._enabled = value;
  }

  /**
   * Called when component is added to entity
   * 组件添加到实体时调用
   */
  onAdded?(): void;

  /**
   * Called when component is removed from entity
   * 组件从实体移除时调用
   */
  onRemoved?(): void;

  /**
   * Called to reset component state
   * 调用以重置组件状态
   */
  reset?(): void;
}