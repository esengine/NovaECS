/**
 * Hierarchy policy for parent destruction behavior
 * 父实体销毁行为的层级策略
 */

/**
 * Policy for what happens to children when parent is destroyed
 * 父实体被销毁时子实体的处理策略
 */
export type OnParentDestroyed = 'destroyChildren' | 'detachToRoot';

/**
 * Configuration for hierarchy behavior
 * 层级行为配置
 */
export class HierarchyPolicy {
  public onParentDestroyed: OnParentDestroyed = 'detachToRoot';

  constructor(onParentDestroyed?: OnParentDestroyed) {
    if (onParentDestroyed !== undefined) {
      this.onParentDestroyed = onParentDestroyed;
    }
  }
}