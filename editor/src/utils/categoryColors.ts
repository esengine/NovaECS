/**
 * Category color system for visual nodes
 * 可视化节点的分类颜色系统
 */

export interface CategoryColorScheme {
  primary: string;      // 主要颜色 (节点头部背景)
  secondary: string;    // 次要颜色 (悬停状态)
  border: string;       // 边框颜色
  text: string;         // 文字颜色
}

/**
 * Category colors mapping
 * 分类颜色映射
 */
export const CATEGORY_COLORS: Record<string, CategoryColorScheme> = {
  // Flow Control - 绿色系
  'Flow/Control': {
    primary: '#4CAF50',
    secondary: '#66BB6A',
    border: '#388E3C',
    text: '#FFFFFF'
  },

  // Math Operations - 蓝色系
  'Math/Basic': {
    primary: '#2196F3',
    secondary: '#42A5F5',
    border: '#1976D2',
    text: '#FFFFFF'
  },

  // ECS Entities - 紫色系
  'ECS/Entity': {
    primary: '#9C27B0',
    secondary: '#AB47BC',
    border: '#7B1FA2',
    text: '#FFFFFF'
  },

  // ECS Components - 橙色系
  'ECS/Component': {
    primary: '#FF9800',
    secondary: '#FFA726',
    border: '#F57C00',
    text: '#FFFFFF'
  },

  // ECS Queries - 青色系
  'ECS/Query': {
    primary: '#00BCD4',
    secondary: '#26C6DA',
    border: '#0097A7',
    text: '#FFFFFF'
  },

  // ECS Systems - 深蓝色系
  'ECS/System': {
    primary: '#3F51B5',
    secondary: '#5C6BC0',
    border: '#303F9F',
    text: '#FFFFFF'
  },

  // Logic - 红色系
  'Logic': {
    primary: '#F44336',
    secondary: '#EF5350',
    border: '#D32F2F',
    text: '#FFFFFF'
  },

  // Variables - 黄色系
  'Variables': {
    primary: '#FFC107',
    secondary: '#FFCA28',
    border: '#FFA000',
    text: '#000000'
  },

  // Events - 粉色系
  'Events': {
    primary: '#E91E63',
    secondary: '#EC407A',
    border: '#C2185B',
    text: '#FFFFFF'
  },

  // Utility - 棕色系
  'Utility': {
    primary: '#795548',
    secondary: '#8D6E63',
    border: '#5D4037',
    text: '#FFFFFF'
  },

  // Default/Uncategorized - 灰色系
  'Uncategorized': {
    primary: '#607D8B',
    secondary: '#78909C',
    border: '#455A64',
    text: '#FFFFFF'
  }
};

/**
 * Get color scheme for a category
 * 获取分类的颜色方案
 */
export function getCategoryColors(category: string): CategoryColorScheme {
  // Try exact match first
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }

  // Try to match by category prefix (e.g., "ECS/Entity" matches "ECS/*")
  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes('/') && category.startsWith(key.split('/')[0] + '/')) {
      return colors;
    }
  }

  // Try to match by main category (e.g., "Flow" matches "Flow/Control")
  for (const [key, colors] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes('/') && category === key.split('/')[0]) {
      return colors;
    }
  }

  // Return default colors for uncategorized nodes
  return CATEGORY_COLORS['Uncategorized'];
}

/**
 * Get all available categories with their colors
 * 获取所有可用分类及其颜色
 */
export function getAllCategoryColors(): Array<{ category: string; colors: CategoryColorScheme }> {
  return Object.entries(CATEGORY_COLORS).map(([category, colors]) => ({
    category,
    colors
  }));
}