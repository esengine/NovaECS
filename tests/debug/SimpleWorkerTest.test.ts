import { World } from '../../src/core/World';
import { System, ExecutionMode } from '../../src/core/System';
import { Component } from '../../src/core/Component';
import { Entity } from '../../src/core/Entity';
import { AccessType } from '../../src/utils/AccessType';
import type { ComponentType } from '../../src/utils/Types';

// Simple test components
class Position extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

// Simple test system
class SimpleTestSystem extends System {
  public executionCount = 0;

  constructor() {
    super([Position], [
      { componentType: Position as ComponentType, accessType: AccessType.Write }
    ], ExecutionMode.Worker);
  }

  update(entities: Entity[], deltaTime: number): void {
    this.executionCount++;
    
    // Modify positions
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      if (position) {
        position.x += deltaTime * 0.1;
        position.y += deltaTime * 0.1;
      }
    });
  }
}

describe('Simple Worker Test', () => {
  test('should check if Worker is available', () => {
    console.log('\n🔍 Worker Availability Check:');
    console.log(`  typeof Worker: ${typeof Worker}`);
    console.log(`  Worker constructor: ${Worker ? Worker.name : 'undefined'}`);
    
    if (typeof Worker !== 'undefined') {
      console.log('  ✅ Worker is available');
    } else {
      console.log('  ❌ Worker is not available');
    }
  });

  test('should test worker execution with component updates', async () => {
    const world = new World();
    const system = new SimpleTestSystem();
    
    console.log('\n🧪 Testing Worker Execution:');
    console.log(`  World supports parallel execution: ${world.isParallelExecutionSupported}`);
    console.log(`  System execution mode: ${system.executionMode}`);
    
    world.addSystem(system);

    // Create test entities
    const entities: Entity[] = [];
    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entities.push(entity);
    }

    // Record initial positions
    const initialPositions = entities.map(entity => {
      const pos = entity.getComponent(Position) as Position;
      return { x: pos.x, y: pos.y };
    });

    console.log('  Initial positions:', initialPositions);

    // Execute system
    const startTime = performance.now();
    world.update(16);
    
    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const executionTime = performance.now() - startTime;

    // Check final positions
    const finalPositions = entities.map(entity => {
      const pos = entity.getComponent(Position) as Position;
      return { x: pos.x, y: pos.y };
    });

    console.log('  Final positions:', finalPositions);
    console.log(`  Execution time: ${executionTime.toFixed(2)}ms`);
    console.log(`  System executed: ${system.executionCount} times`);

    // In Worker mode, the system's update method is not called on main thread
    // Instead, the worker processes components directly
    // So executionCount will be 0, but positions should change
    console.log(`  System execution count: ${system.executionCount} (expected 0 for worker mode)`);

    // Check if positions changed
    let positionsChanged = false;
    for (let i = 0; i < entities.length; i++) {
      if (finalPositions[i].x !== initialPositions[i].x ||
          finalPositions[i].y !== initialPositions[i].y) {
        positionsChanged = true;
        break;
      }
    }

    console.log(`  Positions changed: ${positionsChanged}`);

    if (positionsChanged) {
      console.log('  ✅ Worker execution and component updates are working!');
      expect(positionsChanged).toBe(true);
    } else {
      console.log('  ❌ Worker execution or component updates are NOT working');
      expect(positionsChanged).toBe(true);
    }

    // Get worker statistics
    const stats = world.getWorkerPoolStatistics();
    console.log('  Worker pool stats:', stats);

    world.dispose();
  });

  test('should compare main thread vs worker execution', async () => {
    console.log('\n⚖️  Comparing Execution Modes:');

    // Test main thread execution
    const mainWorld = new World();
    const mainSystem = new SimpleTestSystem();
    Object.defineProperty(mainSystem, 'executionMode', {
      value: ExecutionMode.MainThread,
      writable: false
    });
    
    mainWorld.addSystem(mainSystem);
    
    for (let i = 0; i < 10; i++) {
      const entity = mainWorld.createEntity();
      entity.addComponent(new Position(i, i));
    }

    const mainStartTime = performance.now();
    mainWorld.update(16);
    await new Promise(resolve => setTimeout(resolve, 50));
    const mainExecutionTime = performance.now() - mainStartTime;

    // Test worker execution
    const workerWorld = new World();
    const workerSystem = new SimpleTestSystem();
    // Keep worker execution mode
    
    workerWorld.addSystem(workerSystem);
    
    for (let i = 0; i < 10; i++) {
      const entity = workerWorld.createEntity();
      entity.addComponent(new Position(i, i));
    }

    const workerStartTime = performance.now();
    workerWorld.update(16);
    await new Promise(resolve => setTimeout(resolve, 50));
    const workerExecutionTime = performance.now() - workerStartTime;

    console.log(`  Main thread: ${mainExecutionTime.toFixed(2)}ms`);
    console.log(`  Worker: ${workerExecutionTime.toFixed(2)}ms`);
    console.log(`  Main thread executions: ${mainSystem.executionCount}`);
    console.log(`  Worker executions: ${workerSystem.executionCount}`);

    expect(mainSystem.executionCount).toBe(1);
    // Worker system doesn't increment executionCount since it runs in worker
    expect(workerSystem.executionCount).toBe(0);

    if (Math.abs(mainExecutionTime - workerExecutionTime) < 5) {
      console.log('  ℹ️  Similar times suggest both are working correctly');
    } else {
      console.log('  ✨ Different times show main thread vs worker execution');
    }

    mainWorld.dispose();
    workerWorld.dispose();
  });
});
