/**
 * Internationalization keys for visual node framework
 * 可视化节点框架的国际化键定义
 *
 * This file centralizes all i18n keys to ensure type safety and IDE autocomplete
 * 此文件集中所有i18n键以确保类型安全和IDE自动补全
 */

/**
 * ECS-related i18n keys
 * ECS相关的i18n键
 */
export const I18N_KEYS = {
  // ECS Entity operations
  // ECS实体操作
  ECS: {
    ENTITY: {
      CREATE: {
        TITLE: 'ecs.entity.create.title',
        DESCRIPTION: 'ecs.entity.create.description'
      },
      DESTROY: {
        TITLE: 'ecs.entity.destroy.title',
        DESCRIPTION: 'ecs.entity.destroy.description'
      },
      QUERY: {
        TITLE: 'ecs.entity.query.title',
        DESCRIPTION: 'ecs.entity.query.description'
      }
    },

    // ECS Component operations
    // ECS组件操作
    COMPONENT: {
      ADD: {
        TITLE: 'ecs.component.add.title',
        DESCRIPTION: 'ecs.component.add.description'
      },
      REMOVE: {
        TITLE: 'ecs.component.remove.title',
        DESCRIPTION: 'ecs.component.remove.description'
      },
      GET: {
        TITLE: 'ecs.component.get.title',
        DESCRIPTION: 'ecs.component.get.description'
      },
      HAS: {
        TITLE: 'ecs.component.has.title',
        DESCRIPTION: 'ecs.component.has.description'
      }
    },

    // ECS Query operations
    // ECS查询操作
    QUERY: {
      FOR_EACH: {
        TITLE: 'ecs.query.forEach.title',
        DESCRIPTION: 'ecs.query.forEach.description'
      },
      COUNT: {
        TITLE: 'ecs.query.count.title',
        DESCRIPTION: 'ecs.query.count.description'
      },
      WITHOUT: {
        TITLE: 'ecs.query.without.title',
        DESCRIPTION: 'ecs.query.without.description'
      }
    }
  },

  // Common UI elements
  // 通用UI元素
  COMMON: {
    EXECUTE: 'common.execute',
    THEN: 'common.then',
    ENABLED: 'common.enabled',
    ENTITY: 'common.entity',
    COMPONENT: 'common.component',
    QUERY: 'common.query',
    VALUE: 'common.value',
    RESULT: 'common.result',
    COUNT: 'common.count'
  },

  // Categories for node organization
  // 节点组织的分类
  CATEGORY: {
    ECS: {
      ENTITY: 'category.ecs.entity',
      COMPONENT: 'category.ecs.component',
      QUERY: 'category.ecs.query',
      SYSTEM: 'category.ecs.system'
    },
    MATH: {
      BASIC: 'category.math.basic',
      VECTOR: 'category.math.vector',
      TRIGONOMETRY: 'category.math.trigonometry'
    },
    FLOW: {
      CONTROL: 'category.flow.control',
      LOGIC: 'category.flow.logic',
      ITERATION: 'category.flow.iteration'
    },
    EVENTS: {
      TRIGGERS: 'category.events.triggers',
      HANDLERS: 'category.events.handlers'
    },
    UTILITY: {
      CONVERSION: 'category.utility.conversion',
      DEBUG: 'category.utility.debug'
    }
  },

  // Pin descriptions
  // 引脚描述
  PIN: {
    EXECUTE: {
      DESCRIPTION: 'pin.execute.description'
    },
    THEN: {
      DESCRIPTION: 'pin.then.description'
    },
    ENTITY: {
      DESCRIPTION: 'pin.entity.description'
    },
    ENABLED: {
      DESCRIPTION: 'pin.enabled.description'
    },
    COMPONENT_TYPE: {
      DESCRIPTION: 'pin.componentType.description'
    },
    COMPONENT_DATA: {
      DESCRIPTION: 'pin.componentData.description'
    },
    QUERY: {
      DESCRIPTION: 'pin.query.description'
    },
    COUNT: {
      DESCRIPTION: 'pin.count.description'
    },
    HAS_COMPONENT: {
      DESCRIPTION: 'pin.hasComponent.description'
    }
  },

  // Error messages
  // 错误信息
  ERROR: {
    TRANSLATION_MISSING: 'error.translation.missing',
    LOCALE_UNSUPPORTED: 'error.locale.unsupported',
    NODE_CREATION_FAILED: 'error.node.creation.failed',
    CONNECTION_INVALID: 'error.connection.invalid'
  },

  // Debug and development
  // 调试和开发
  DEBUG: {
    NODE: {
      EXECUTION_START: 'debug.node.execution.start',
      EXECUTION_END: 'debug.node.execution.end'
    },
    GRAPH: {
      VALIDATION_START: 'debug.graph.validation.start',
      VALIDATION_END: 'debug.graph.validation.end'
    }
  }
} as const;

/**
 * Type helper to extract all possible i18n key values
 * 提取所有可能的i18n键值的类型辅助器
 */
export type I18nKeyValue = typeof I18N_KEYS[keyof typeof I18N_KEYS];

/**
 * Utility function to get nested i18n key safely
 * 安全获取嵌套i18n键的工具函数
 */
export function getI18nKey(path: string[]): string {
  let current: any = I18N_KEYS;
  for (const segment of path) {
    current = current[segment];
    if (current === undefined) {
      throw new Error(`I18n key path not found: ${path.join('.')}`);
    }
  }
  return current;
}

/**
 * Validate that an i18n key exists in the key constants
 * 验证i18n键是否存在于键常量中
 */
export function validateI18nKey(key: string): boolean {
  const findKey = (obj: any): boolean => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && value === key) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (findKey(value)) {
          return true;
        }
      }
    }
    return false;
  };

  return findKey(I18N_KEYS);
}