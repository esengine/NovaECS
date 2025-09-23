/**
 * Chinese (Simplified) language resources for visual node framework
 * 可视化节点框架的简体中文语言资源
 */

import type { LanguageResource } from '../types';

export const zhCNLocale: LanguageResource = {
  // ECS实体操作
  'ecs.entity.create.title': '创建实体',
  'ecs.entity.create.description': '在世界中创建一个新实体，可选择启用状态',
  'ecs.entity.destroy.title': '销毁实体',
  'ecs.entity.destroy.description': '从世界中移除一个实体',
  'ecs.entity.query.title': '查询实体',
  'ecs.entity.query.description': '创建一个查询以匹配指定组件的实体',

  // ECS组件操作
  'ecs.component.add.title': '添加组件',
  'ecs.component.add.description': '为实体添加组件',
  'ecs.component.remove.title': '移除组件',
  'ecs.component.remove.description': '从实体中移除组件',
  'ecs.component.get.title': '获取组件',
  'ecs.component.get.description': '从实体中获取组件',
  'ecs.component.has.title': '检查组件',
  'ecs.component.has.description': '检查实体是否具有指定组件',

  // ECS查询操作
  'ecs.query.forEach.title': '遍历实体',
  'ecs.query.forEach.description': '遍历所有匹配查询的实体',
  'ecs.query.count.title': '计数实体',
  'ecs.query.count.description': '返回匹配查询的实体数量',
  'ecs.query.without.title': '排除组件',
  'ecs.query.without.description': '排除具有指定组件的实体',

  // 通用UI元素
  'common.execute': '执行',
  'common.then': '然后',
  'common.enabled': '启用',
  'common.entity': '实体',
  'common.component': '组件',
  'common.query': '查询',
  'common.value': '值',
  'common.result': '结果',
  'common.count': '计数',

  // 分类
  'category.ecs.entity': 'ECS/实体',
  'category.ecs.component': 'ECS/组件',
  'category.ecs.query': 'ECS/查询',
  'category.ecs.system': 'ECS/系统',
  'category.math.basic': '数学/基础',
  'category.math.vector': '数学/向量',
  'category.math.trigonometry': '数学/三角函数',
  'category.flow.control': '流程/控制',
  'category.flow.logic': '流程/逻辑',
  'category.flow.iteration': '流程/迭代',
  'category.events.triggers': '事件/触发器',
  'category.events.handlers': '事件/处理器',
  'category.utility.conversion': '工具/转换',
  'category.utility.debug': '工具/调试',

  // 引脚描述
  'pin.execute.description': '触发执行',
  'pin.then.description': '在此处继续执行',
  'pin.entity.description': '实体句柄',
  'pin.enabled.description': '创建时实体是否应该被启用',
  'pin.componentType.description': '组件类型构造函数',
  'pin.componentData.description': '组件实例数据',
  'pin.query.description': '实体查询实例',
  'pin.count.description': '实体数量',
  'pin.hasComponent.description': '实体是否具有指定组件',

  // 错误信息
  'error.translation.missing': '缺少翻译键: {key}',
  'error.locale.unsupported': '不支持的语言: {locale}',
  'error.node.creation.failed': '创建节点失败，类型: {type}',
  'error.connection.invalid': '无效连接: {reason}',

  // 调试和开发
  'debug.node.execution.start': '执行节点: {nodeId}',
  'debug.node.execution.end': '节点执行完成: {nodeId}',
  'debug.graph.validation.start': '验证图形: {graphName}',
  'debug.graph.validation.end': '图形验证完成: {graphName}'
} as const;