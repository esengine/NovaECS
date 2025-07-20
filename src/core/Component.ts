// No imports needed for basic serialization support

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



  /**
   * Get serializable properties of the component
   * 获取组件的可序列化属性
   *
   * Override this method to customize which properties are serialized
   * 重写此方法以自定义哪些属性被序列化
   */
  getSerializableProperties(): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    // Get all enumerable properties
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key) && !key.startsWith('_')) {
        const value = this[key];

        // Only serialize primitive values and plain objects
        if (this.isSerializableValue(value)) {
          properties[key] = value;
        }
      }
    }

    return properties;
  }

  /**
   * Set serializable properties of the component
   * 设置组件的可序列化属性
   *
   * Override this method to customize how properties are restored
   * 重写此方法以自定义如何恢复属性
   */
  setSerializableProperties(properties: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(properties)) {
      if (key in this && !key.startsWith('_')) {
        (this as Record<string, unknown>)[key] = value;
      }
    }
  }

  /**
   * Check if a value is serializable
   * 检查值是否可序列化
   */
  private isSerializableValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    const type = typeof value;

    // Primitive types
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }

    // Arrays
    if (Array.isArray(value)) {
      return value.every(item => this.isSerializableValue(item));
    }

    // Plain objects
    if (type === 'object' && value.constructor === Object) {
      return Object.values(value).every(item => this.isSerializableValue(item));
    }

    return false;
  }


}