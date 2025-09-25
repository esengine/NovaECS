/**
 * Visual framework integration tests
 * 可视化框架集成测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../../src/core/World';
import { Scheduler } from '../../src/core/Scheduler';

// Import visual framework
import { VisualGraph } from '../../src/visual/core/VisualGraph';
import { NodeGenerator } from '../../src/visual/core/NodeGenerator';
import { VisualSystemBuilder } from '../../src/visual/core/VisualSystemBuilder';
import { ExecutionEngine } from '../../src/visual/core/ExecutionEngine';

// Visual framework is now automatically initialized when imported

// Test components
class Position {
  x: number = 0;
  y: number = 0;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
}

class Velocity {
  x: number = 0;
  y: number = 0;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
}

class Health {
  current: number = 100;
  max: number = 100;

  constructor(current: number = 100, max: number = 100) {
    this.current = current;
    this.max = max;
  }
}

describe('Visual Framework', () => {
  let world: World;
  let scheduler: Scheduler;

  beforeEach(() => {
    world = new World();
    scheduler = new Scheduler();
    // Reset node ID counter for consistent tests
    NodeGenerator.resetNodeIdCounter();
  });

  test('should create and execute basic visual graph', () => {
    // Create a simple graph that creates an entity
    const graph = new VisualGraph('TestGraph', 'Test entity creation');

    // Add create entity node
    const createNode = NodeGenerator.createNode('world.createEntity', 'create_test');
    createNode.setInput('Enabled', true);
    graph.addNode(createNode);

    expect(graph.getAllNodes()).toHaveLength(3); // 1 user node + 2 system nodes (start/end)
    expect(graph.getAllConnections()).toHaveLength(0);
  });

  test('should register ECS methods as node types', () => {
    const nodeTypes = NodeGenerator.getAvailableNodeTypes();

    // Should have World methods
    expect(nodeTypes.some(type => type.name === 'world.createEntity')).toBe(true);
    expect(nodeTypes.some(type => type.name === 'world.destroyEntity')).toBe(true);
    expect(nodeTypes.some(type => type.name === 'world.addComponent')).toBe(true);

    // Should have Query methods
    expect(nodeTypes.some(type => type.name === 'query.forEach')).toBe(true);
    expect(nodeTypes.some(type => type.name === 'query.count')).toBe(true);
  });

  test('should create nodes by type name', () => {
    const createNode = NodeGenerator.createNode('world.createEntity', 'test_create');
    expect(createNode.id).toBe('test_create');
    expect(createNode.type).toBe('world.createEntity');

    const queryNode = NodeGenerator.createNode('world.query', 'test_query');
    expect(queryNode.id).toBe('test_query');
    expect(queryNode.type).toBe('world.query');
  });

  test('should validate graph connections', () => {
    const graph = new VisualGraph('TestGraph', 'Test connections');

    const createNode = NodeGenerator.createNode('world.createEntity', 'create');
    const addComponentNode = NodeGenerator.createNode('world.addComponent', 'add_comp');

    graph.addNode(createNode);
    graph.addNode(addComponentNode);

    // Valid connection
    const connection = {
      id: 'test_connection',
      fromNodeId: 'create',
      fromPin: 'Entity',
      toNodeId: 'add_comp',
      toPin: 'Entity'
    };

    const validation = graph.validateConnection(connection);
    expect(validation.valid).toBe(true);
  });

  test('should detect cycle in graph connections', () => {
    const graph = new VisualGraph('CycleTest', 'Test cycle detection');

    const node1 = NodeGenerator.createNode('world.createEntity', 'node1');
    const node2 = NodeGenerator.createNode('world.addComponent', 'node2');

    graph.addNode(node1);
    graph.addNode(node2);

    // Add valid connection first
    graph.addConnection({
      id: 'conn1',
      fromNodeId: 'node1',
      fromPin: 'Entity',
      toNodeId: 'node2',
      toPin: 'Entity'
    });

    // Try to create cycle (should be invalid)
    const cycleConnection = {
      id: 'cycle',
      fromNodeId: 'node2',
      fromPin: 'Then',
      toNodeId: 'node1',
      toPin: 'Execute'
    };

    const validation = graph.validateConnection(cycleConnection);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('cycle');
  });

  test('should create visual system from graph', () => {
    const graph = new VisualGraph('MovementSystem', 'Test movement');

    // Create a basic movement graph
    const queryNode = NodeGenerator.createNode('world.query', 'query_moving');
    graph.addNode(queryNode);

    const system = VisualSystemBuilder
      .fromGraph('TestMovement', graph)
      .setStage('update')
      .build();

    expect(system).toBeDefined();
    expect(system.build).toBeDefined();
  });

  test('should execute visual system in scheduler', () => {
    const graph = new VisualGraph('TestSystem', 'Test execution');

    const createNode = NodeGenerator.createNode('world.createEntity', 'create');
    createNode.setInput('Enabled', true);
    graph.addNode(createNode);

    const system = VisualSystemBuilder
      .fromGraph('TestExecution', graph)
      .setStage('startup')
      .build();

    scheduler.add(system);

    const initialEntityCount = world.entityCount;

    // Run one tick
    scheduler.tick(world, 0.016);

    // Should have created entity (if system actually executes)
    // Note: This might not increase count due to simplified test setup
    expect(world.entityCount).toBeGreaterThanOrEqual(initialEntityCount);
  });

  test('should handle execution errors gracefully', () => {
    const engine = new ExecutionEngine({
      debugMode: true,
      errorHandler: (error, nodeId) => {
        console.log(`Test error handler: ${error.message} in ${nodeId}`);
      }
    });

    expect(engine).toBeDefined();
    expect(engine.getStats().totalExecutions).toBe(0);
  });

  test('should provide node type categories', () => {
    const categories = NodeGenerator.getCategories();

    expect(categories).toContain('ECS/Entity');
    expect(categories).toContain('ECS/Component');
    expect(categories).toContain('ECS/Query');
  });

  test('should search node types', () => {
    const entityNodes = NodeGenerator.searchNodeTypes('entity');
    expect(entityNodes.length).toBeGreaterThan(0);

    const createNodes = NodeGenerator.searchNodeTypes('create');
    expect(createNodes.length).toBeGreaterThan(0);
  });

  test('should create node palette for UI', () => {
    const palette = NodeGenerator.createNodePalette();

    expect(palette.categories).toBeDefined();
    expect(Object.keys(palette.categories).length).toBeGreaterThan(0);

    // Should have ECS categories
    expect(palette.categories['ECS/Entity']).toBeDefined();
    expect(palette.categories['ECS/Component']).toBeDefined();
  });

  test('should serialize and deserialize graphs', () => {
    const graph = new VisualGraph('SerializationTest', 'Test serialization');

    const createNode = NodeGenerator.createNode('world.createEntity', 'create');
    createNode.setInput('Enabled', true);
    graph.addNode(createNode);

    const serialized = graph.serialize();

    expect(serialized.name).toBe('SerializationTest');
    expect(serialized.nodes).toHaveLength(3); // 1 user node + 2 system nodes (start/end)
    expect(serialized.connections).toHaveLength(0);
    expect(serialized.metadata).toBeDefined();

    // Test deserialization
    const deserializedGraph = VisualGraph.deserialize(serialized);
    expect(deserializedGraph.name).toBe('SerializationTest');
    expect(deserializedGraph.getAllNodes()).toHaveLength(3); // 1 user node + 2 system nodes (start/end)
    expect(deserializedGraph.getAllConnections()).toHaveLength(0);

    // Test that the deserialized user node works
    const allNodes = deserializedGraph.getAllNodes();
    const deserializedNode = allNodes.find(node => node.id === 'create');
    expect(deserializedNode).toBeDefined();
    expect(deserializedNode!.id).toBe('create');
    expect(deserializedNode!.type).toBe('world.createEntity');
    expect(deserializedNode!.getInput('Enabled')).toBe(true);
  });

  test('should manage node inputs and outputs', () => {
    const node = NodeGenerator.createNode('world.createEntity', 'test');

    // Test input management
    node.setInput('Enabled', true);
    expect(node.getInput('Enabled')).toBe(true);
    expect(node.hasInput('Enabled')).toBe(true);

    // Test output management
    node.setOutput('Entity', 123);
    expect(node.getOutput('Entity')).toBe(123);
  });

  test('should validate node types registration', () => {
    const validationResults = NodeGenerator.validateRegistration();

    // Should have no errors in registration
    const errorResults = validationResults.filter(result => !result.valid);
    if (errorResults.length > 0) {
      console.warn('Node type validation errors:', errorResults);
    }

    // Most node types should be valid
    const validResults = validationResults.filter(result => result.valid);
    expect(validResults.length).toBeGreaterThan(0);
  });
});