/**
 * Editor Selection Component
 * 编辑器选择组件
 *
 * Marks entities as selected in the editor
 * 标记实体在编辑器中被选中
 */

export class EditorSelection {
  /** Selection timestamp 选择时间戳 */
  timestamp: number = Date.now();

  /** Selection color (for visual feedback) 选择颜色（用于视觉反馈） */
  color: [number, number, number, number] = [1, 0.5, 0, 1]; // Orange 橙色

  /** Whether to show selection outline 是否显示选择轮廓 */
  showOutline: boolean = true;

  /** Outline thickness 轮廓厚度 */
  outlineThickness: number = 2;
}