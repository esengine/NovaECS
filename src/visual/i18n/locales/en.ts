/**
 * English language resources for visual node framework
 * 可视化节点框架的英文语言资源
 */

import type { LanguageResource } from '../types';

export const enLocale: LanguageResource = {
  // ECS Entity operations
  'ecs.entity.create.title': 'Create Entity',
  'ecs.entity.create.description': 'Creates a new entity in the world with optional enabled state',
  'ecs.entity.destroy.title': 'Destroy Entity',
  'ecs.entity.destroy.description': 'Removes an entity from the world',
  'ecs.entity.query.title': 'Query Entities',
  'ecs.entity.query.description': 'Creates a query for entities matching specified components',

  // ECS Component operations
  'ecs.component.add.title': 'Add Component',
  'ecs.component.add.description': 'Adds a component to an entity',
  'ecs.component.remove.title': 'Remove Component',
  'ecs.component.remove.description': 'Removes a component from an entity',
  'ecs.component.get.title': 'Get Component',
  'ecs.component.get.description': 'Retrieves a component from an entity',
  'ecs.component.has.title': 'Has Component',
  'ecs.component.has.description': 'Checks if an entity has a specific component',

  // ECS Query operations
  'ecs.query.forEach.title': 'For Each Entity',
  'ecs.query.forEach.description': 'Iterates over all entities matching the query',
  'ecs.query.count.title': 'Count Entities',
  'ecs.query.count.description': 'Returns the number of entities matching the query',
  'ecs.query.without.title': 'Without Components',
  'ecs.query.without.description': 'Excludes entities that have specified components',

  // Common UI elements
  'common.execute': 'Execute',
  'common.then': 'Then',
  'common.enabled': 'Enabled',
  'common.entity': 'Entity',
  'common.component': 'Component',
  'common.query': 'Query',
  'common.value': 'Value',
  'common.result': 'Result',
  'common.count': 'Count',

  // Categories
  'category.ecs.entity': 'ECS/Entity',
  'category.ecs.component': 'ECS/Component',
  'category.ecs.query': 'ECS/Query',
  'category.ecs.system': 'ECS/System',
  'category.math.basic': 'Math/Basic',
  'category.math.vector': 'Math/Vector',
  'category.math.trigonometry': 'Math/Trigonometry',
  'category.flow.control': 'Flow/Control',
  'category.flow.logic': 'Flow/Logic',
  'category.flow.iteration': 'Flow/Iteration',
  'category.events.triggers': 'Events/Triggers',
  'category.events.handlers': 'Events/Handlers',
  'category.utility.conversion': 'Utility/Conversion',
  'category.utility.debug': 'Utility/Debug',

  // Visual node categories
  'visual.categories.flow': 'Flow/Control',
  'visual.categories.math': 'Math',

  // Built-in node titles
  'visual.nodes.flow.start.title': 'Start',
  'visual.nodes.flow.start.description': 'Start execution point',
  'visual.nodes.math.add.title': 'Add',
  'visual.nodes.math.add.description': 'Add two numbers',
  'visual.nodes.math.multiply.title': 'Multiply',
  'visual.nodes.math.multiply.description': 'Multiply two numbers',
  'visual.nodes.math.subtract.title': 'Subtract',
  'visual.nodes.math.subtract.description': 'Subtract two numbers',
  'visual.nodes.math.divide.title': 'Divide',
  'visual.nodes.math.divide.description': 'Divide two numbers',
  'visual.nodes.math.constant.title': 'Constant',
  'visual.nodes.math.constant.description': 'Mathematical constant value',

  // Flow control nodes
  'visual.nodes.flow.if.title': 'If',
  'visual.nodes.flow.if.description': 'Conditional execution branch',

  // Pin labels
  'visual.pins.execute': 'Execute',
  'visual.pins.a': 'A',
  'visual.pins.b': 'B',
  'visual.pins.result': 'Result',
  'visual.pins.value': 'Value',
  'visual.pins.condition': 'Condition',
  'visual.pins.true': 'True',
  'visual.pins.false': 'False',

  // Additional common labels
  'common.componentType': 'Component Type',
  'common.componentData': 'Component Data',
  'common.componentTypes': 'Component Types',
  'common.hasComponent': 'Has Component',
  'common.forEach': 'For Each',
  'common.components': 'Components',
  'common.excludeTypes': 'Exclude Types',
  'common.filteredQuery': 'Filtered Query',

  // Pin descriptions
  'pin.execute.description': 'Trigger execution',
  'pin.then.description': 'Execution continues here',
  'pin.entity.description': 'Entity handle',
  'pin.enabled.description': 'Whether the entity should be enabled on creation',
  'pin.componentType.description': 'Component type constructor',
  'pin.componentData.description': 'Component instance data',
  'pin.query.description': 'Entity query instance',
  'pin.count.description': 'Number of entities',
  'pin.hasComponent.description': 'Whether the entity has the specified component',
  'pin.componentType.remove.description': 'Component type to remove from entity',
  'pin.componentType.get.description': 'Component type to retrieve from entity',
  'pin.componentType.check.description': 'Component type to check on entity',
  'pin.componentTypes.query.description': 'Component types to query for',
  'pin.forEach.description': 'Execute for each entity',
  'pin.components.description': 'Components to operate on',
  'pin.excludeTypes.description': 'Component types to exclude from query',
  'pin.filteredQuery.description': 'Filtered entity query result',

  // Error messages
  'error.translation.missing': 'Translation missing for key: {key}',
  'error.locale.unsupported': 'Unsupported locale: {locale}',
  'error.node.creation.failed': 'Failed to create node of type: {type}',
  'error.connection.invalid': 'Invalid connection: {reason}',

  // Debug and development
  'debug.node.execution.start': 'Executing node: {nodeId}',
  'debug.node.execution.end': 'Node execution completed: {nodeId}',
  'debug.graph.validation.start': 'Validating graph: {graphName}',
  'debug.graph.validation.end': 'Graph validation completed: {graphName}'
} as const;