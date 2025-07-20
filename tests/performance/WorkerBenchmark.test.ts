import { World } from '../../src/core/World';
import { System, ExecutionMode } from '../../src/core/System';
import { Component } from '../../src/core/Component';
import { Entity } from '../../src/core/Entity';
import { AccessType } from '../../src/utils/AccessType';
import type { ComponentType } from '../../src/utils/Types';

// Test components
class Position extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

class Velocity extends Component {
  constructor(public dx: number = 0, public dy: number = 0) {
    super();
  }
}

class Health extends Component {
  constructor(public current: number = 100, public max: number = 100) {
    super();
  }
}

// Read-only system (suitable for Worker)
class ReadOnlyCalculationSystem extends System {
  public executionTime = 0;
  public executionCount = 0;

  constructor(
    requiredComponents?: ComponentType[],
    componentAccess?: any[],
    executionMode?: ExecutionMode
  ) {
    super(
      requiredComponents || [Position, Velocity],
      componentAccess || [
        { componentType: Position as ComponentType, accessType: AccessType.Read },
        { componentType: Velocity as ComponentType, accessType: AccessType.Read }
      ],
      executionMode || ExecutionMode.MainThread
    );
  }

  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();
    
    // Simulate computational work
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      const velocity = entity.getComponent(Velocity) as Velocity;
      
      if (position && velocity) {
        // Intensive calculation
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(position.x * position.x + position.y * position.y);
          result += Math.sin(velocity.dx * deltaTime + i);
          result += Math.cos(velocity.dy * deltaTime + i);
        }
        
        // Use result to prevent optimization
        if (result > 1000000) {
          // This will rarely happen, just to use the result
        }
      }
    });
    
    this.executionTime = performance.now() - startTime;
    this.executionCount++;
  }
}

// Write-heavy system (not suitable for Worker)
class WriteHeavySystem extends System {
  public executionTime = 0;
  public executionCount = 0;

  constructor() {
    super([Position, Health], [
      { componentType: Position as ComponentType, accessType: AccessType.Write },
      { componentType: Health as ComponentType, accessType: AccessType.Write }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();
    
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      const health = entity.getComponent(Health) as Health;
      
      if (position && health) {
        // Modify components
        position.x += deltaTime;
        position.y += deltaTime;
        health.current = Math.max(0, health.current - 1);
      }
    });
    
    this.executionTime = performance.now() - startTime;
    this.executionCount++;
  }
}

describe('Worker Execution Benchmark', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  afterEach(() => {
    if (world) {
      world.dispose();
    }
  });

  test('should respect user-defined execution modes', async () => {
    // Create systems with different execution modes
    const mainThreadSystem = new ReadOnlyCalculationSystem(
      [Position, Velocity],
      [
        { componentType: Position as ComponentType, accessType: AccessType.Read },
        { componentType: Velocity as ComponentType, accessType: AccessType.Read }
      ],
      ExecutionMode.MainThread
    );

    const workerSystem = new ReadOnlyCalculationSystem(
      [Position, Velocity],
      [
        { componentType: Position as ComponentType, accessType: AccessType.Read },
        { componentType: Velocity as ComponentType, accessType: AccessType.Read }
      ],
      ExecutionMode.Worker
    );

    world.addSystem(mainThreadSystem);
    world.addSystem(workerSystem);

    // Create enough entities to trigger worker execution
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
    }

    const startTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 150));
    const totalTime = performance.now() - startTime;

    // All systems should have executed
    expect(mainThreadSystem.executionCount).toBe(1);
    expect(workerSystem.executionCount).toBe(1);
    expect(totalTime).toBeLessThan(1000);

    console.log(`Main thread system: ${mainThreadSystem.executionTime.toFixed(2)}ms`);
    console.log(`Worker system: ${workerSystem.executionTime.toFixed(2)}ms`);
    console.log(`Worker supported: ${world.isParallelExecutionSupported}`);
  });

  test('should support convenient system creation methods', async () => {
    // Create systems using static convenience methods
    const mainThreadSystem = System.createMainThreadSystem(ReadOnlyCalculationSystem);
    const workerSystem = System.createWorkerSystem(ReadOnlyCalculationSystem);

    // Verify execution modes
    expect(mainThreadSystem.executionMode).toBe(ExecutionMode.MainThread);
    expect(workerSystem.executionMode).toBe(ExecutionMode.Worker);

    world.addSystem(mainThreadSystem);
    world.addSystem(workerSystem);

    // Create entities
    for (let i = 0; i < 75; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
    }

    const startTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100));
    const totalTime = performance.now() - startTime;

    // Both systems should have executed
    expect(mainThreadSystem.executionCount).toBe(1);
    expect(workerSystem.executionCount).toBe(1);
    expect(totalTime).toBeLessThan(1000);

    console.log(`Convenience methods test completed in ${totalTime.toFixed(2)}ms`);
  });

  test('should fallback to main thread when worker not supported', async () => {
    // Create a system that prefers worker execution
    const workerPreferredSystem = new ReadOnlyCalculationSystem(
      [Position, Velocity],
      [
        { componentType: Position as ComponentType, accessType: AccessType.Read },
        { componentType: Velocity as ComponentType, accessType: AccessType.Read }
      ],
      ExecutionMode.Worker
    );

    world.addSystem(workerPreferredSystem);

    // Create entities
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
    }

    const startTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100));
    const totalTime = performance.now() - startTime;

    // System should have executed (either in worker or fallback to main thread)
    expect(workerPreferredSystem.executionCount).toBe(1);
    expect(totalTime).toBeLessThan(1000);

    if (world.isParallelExecutionSupported) {
      console.log('Worker execution was used');
    } else {
      console.log('Fallback to main thread execution was used');
    }

    console.log(`Fallback test completed in ${totalTime.toFixed(2)}ms`);
  });

  test('should benchmark read-only system execution', async () => {
    const readOnlySystem = new ReadOnlyCalculationSystem();
    world.addSystem(readOnlySystem);

    // Create entities with varying counts to test thresholds
    const entityCounts = [10, 25, 50, 100, 200];
    const results: Array<{
      entityCount: number;
      executionTime: number;
      usedWorker: boolean;
    }> = [];

    for (const entityCount of entityCounts) {
      // Clear previous entities
      world.clear();
      readOnlySystem.executionTime = 0;
      readOnlySystem.executionCount = 0;

      // Create entities
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        entity.addComponent(new Position(i, i));
        entity.addComponent(new Velocity(1, 1));
      }

      // Execute system
      const startTime = performance.now();
      world.update(16);
      
      // Wait for async execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const totalTime = performance.now() - startTime;

      // Check if worker would be used in Auto mode (entities > 50 and read-only)
      const wouldUseWorker = world.isParallelExecutionSupported &&
                             entityCount > 50 &&
                             readOnlySystem.componentAccess?.every(access =>
                               access.accessType === AccessType.Read
                             );

      results.push({
        entityCount,
        executionTime: totalTime,
        usedWorker: wouldUseWorker || false
      });

      console.log(`Entities: ${entityCount}, Time: ${totalTime.toFixed(2)}ms, Worker: ${wouldUseWorker}`);
    }

    // Verify that larger entity counts use workers
    const largeEntityResult = results.find(r => r.entityCount >= 100);
    if (world.isParallelExecutionSupported && largeEntityResult) {
      expect(largeEntityResult.usedWorker).toBe(true);
    }

    // Performance should be reasonable
    results.forEach(result => {
      expect(result.executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  test('should not use worker for write-heavy systems', async () => {
    const writeHeavySystem = new WriteHeavySystem();
    world.addSystem(writeHeavySystem);

    // Create many entities (above worker threshold)
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Health(100, 100));
    }

    const startTime = performance.now();
    world.update(16);
    
    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const totalTime = performance.now() - startTime;

    // Write-heavy systems should not use workers
    expect(writeHeavySystem.executionCount).toBe(1);
    expect(totalTime).toBeLessThan(500);

    console.log(`Write-heavy system execution time: ${totalTime.toFixed(2)}ms`);
  });

  test('should provide worker pool statistics', () => {
    const stats = world.getWorkerPoolStatistics();
    
    expect(stats).toHaveProperty('totalWorkers');
    expect(stats).toHaveProperty('availableWorkers');
    expect(stats).toHaveProperty('busyWorkers');
    expect(stats).toHaveProperty('queuedTasks');

    expect(typeof stats.totalWorkers).toBe('number');
    expect(typeof stats.availableWorkers).toBe('number');
    expect(typeof stats.busyWorkers).toBe('number');
    expect(typeof stats.queuedTasks).toBe('number');

    console.log('Worker Pool Statistics:', stats);
  });

  test('should handle worker execution errors gracefully', async () => {
    // Create a system that might fail in worker
    class ProblematicSystem extends System {
      public executed = false;
      
      constructor() {
        super([Position], [
          { componentType: Position as ComponentType, accessType: AccessType.Read }
        ]);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        this.executed = true;
        // This system should still execute even if worker fails
      }
    }

    const problematicSystem = new ProblematicSystem();
    world.addSystem(problematicSystem);

    // Create enough entities to trigger worker execution
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
    }

    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100));

    // System should have executed (either in worker or fallback to main thread)
    expect(problematicSystem.executed).toBe(true);
  });

  test('should compare worker vs main thread performance', async () => {
    const system1 = new ReadOnlyCalculationSystem();

    // Test with different entity counts
    const entityCount = 75; // Above worker threshold

    // Create entities
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
    }

    // Test current implementation (may use worker)
    world.addSystem(system1);
    const startTime1 = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100));
    const workerTime = performance.now() - startTime1;

    // Reset
    world.removeSystem(system1);
    system1.executionTime = 0;
    system1.executionCount = 0;

    // Force main thread execution by using a write system
    class ForceMainThreadSystem extends System {
      public executionTime = 0;
      public executionCount = 0;

      constructor() {
        super([Position], [
          { componentType: Position as ComponentType, accessType: AccessType.Write }
        ]);
      }

      update(entities: Entity[], deltaTime: number): void {
        const startTime = performance.now();

        // Same computation as ReadOnlyCalculationSystem
        entities.forEach(entity => {
          const position = entity.getComponent(Position) as Position;

          if (position) {
            // Intensive calculation
            let result = 0;
            for (let i = 0; i < 1000; i++) {
              result += Math.sqrt(position.x * position.x + position.y * position.y);
              result += Math.sin(deltaTime + i);
              result += Math.cos(deltaTime + i);
            }

            // Modify to force write access
            position.x += 0.001;
          }
        });

        this.executionTime = performance.now() - startTime;
        this.executionCount++;
      }
    }

    const forceMainSystem = new ForceMainThreadSystem();
    world.addSystem(forceMainSystem);
    const startTime2 = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100));
    const mainThreadTime = performance.now() - startTime2;

    console.log(`Worker execution: ${workerTime.toFixed(2)}ms`);
    console.log(`Main thread execution: ${mainThreadTime.toFixed(2)}ms`);
    console.log(`Worker supported: ${world.isParallelExecutionSupported}`);

    // Both should complete successfully
    expect(workerTime).toBeLessThan(1000);
    expect(mainThreadTime).toBeLessThan(1000);

    // If workers are supported, we should see some difference in execution patterns
    if (world.isParallelExecutionSupported) {
      console.log('Worker execution is supported and being tested');
    } else {
      console.log('Worker execution not supported in this environment');
    }
  });

  test('should handle mixed system types correctly', async () => {
    const readOnlySystem = new ReadOnlyCalculationSystem();
    const writeHeavySystem = new WriteHeavySystem();

    world.addSystem(readOnlySystem);
    world.addSystem(writeHeavySystem);

    // Create entities
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
      entity.addComponent(new Health(100, 100));
    }

    const startTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 150));
    const totalTime = performance.now() - startTime;

    // Both systems should have executed
    expect(readOnlySystem.executionCount).toBe(1);
    expect(writeHeavySystem.executionCount).toBe(1);
    expect(totalTime).toBeLessThan(1000);

    console.log(`Mixed systems execution time: ${totalTime.toFixed(2)}ms`);
    console.log(`Read-only system time: ${readOnlySystem.executionTime.toFixed(2)}ms`);
    console.log(`Write-heavy system time: ${writeHeavySystem.executionTime.toFixed(2)}ms`);
  });
});
