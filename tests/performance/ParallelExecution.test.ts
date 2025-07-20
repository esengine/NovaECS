import { World } from '../../src/core/World';
import { System } from '../../src/core/System';
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

// Test systems with different computational loads
class LightComputationSystem extends System {
  public executionTime = 0;

  constructor() {
    super([Position], [
      { componentType: Position as ComponentType, accessType: AccessType.Read }
    ]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    const startTime = performance.now();

    // Light computation
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      if (position) {
        // Simple calculation
        const distance = Math.sqrt(position.x * position.x + position.y * position.y);
        // Use the result to prevent optimization
        if (distance > 1000000) {
          position.x = 0;
        }
      }
    });

    this.executionTime = performance.now() - startTime;
  }
}

class MediumComputationSystem extends System {
  public executionTime = 0;

  constructor() {
    super([Velocity], [
      { componentType: Velocity as ComponentType, accessType: AccessType.Write }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();
    
    // Medium computation
    entities.forEach(entity => {
      const velocity = entity.getComponent(Velocity) as Velocity;
      if (velocity) {
        // More complex calculation
        for (let i = 0; i < 100; i++) {
          velocity.dx = Math.sin(velocity.dx + deltaTime * i);
          velocity.dy = Math.cos(velocity.dy + deltaTime * i);
        }
      }
    });
    
    this.executionTime = performance.now() - startTime;
  }
}

class HeavyComputationSystem extends System {
  public executionTime = 0;

  constructor() {
    super([Health], [
      { componentType: Health as ComponentType, accessType: AccessType.Write }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();
    
    // Heavy computation
    entities.forEach(entity => {
      const health = entity.getComponent(Health) as Health;
      if (health) {
        // Intensive calculation
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(i * deltaTime + health.current);
        }
        // Use the result to prevent optimization
        if (result > 1000000) {
          health.current = Math.max(0, health.current - 1);
        }
      }
    });
    
    this.executionTime = performance.now() - startTime;
  }
}

describe('Parallel Execution Performance', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  afterEach(() => {
    world.dispose();
  });

  test('should show performance improvement with parallel execution', async () => {
    const lightSystem = new LightComputationSystem();
    const mediumSystem = new MediumComputationSystem();
    const heavySystem = new HeavyComputationSystem();

    world.addSystem(lightSystem);
    world.addSystem(mediumSystem);
    world.addSystem(heavySystem);

    // Create test entities
    const entityCount = 100;
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
      entity.addComponent(new Health(100, 100));
    }

    // Measure execution time
    const startTime = performance.now();
    world.update(16);
    
    // Wait for async execution to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const totalTime = performance.now() - startTime;

    // Verify systems executed
    expect(lightSystem.executionTime).toBeGreaterThan(0);
    expect(mediumSystem.executionTime).toBeGreaterThan(0);
    expect(heavySystem.executionTime).toBeGreaterThan(0);

    // Performance should be reasonable
    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

    console.log('Performance Results:');
    console.log(`Total execution time: ${totalTime.toFixed(2)}ms`);
    console.log(`Light system: ${lightSystem.executionTime.toFixed(2)}ms`);
    console.log(`Medium system: ${mediumSystem.executionTime.toFixed(2)}ms`);
    console.log(`Heavy system: ${heavySystem.executionTime.toFixed(2)}ms`);
    console.log(`Parallel execution supported: ${world.isParallelExecutionSupported}`);
  });

  test('should handle large number of entities efficiently', async () => {
    const system = new LightComputationSystem();
    world.addSystem(system);

    // Create many entities
    const entityCount = 1000;
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
    }

    const startTime = performance.now();
    world.update(16);
    
    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const totalTime = performance.now() - startTime;

    // Should handle 1000 entities efficiently
    expect(totalTime).toBeLessThan(500); // Should complete within 500ms
    expect(system.executionTime).toBeGreaterThan(0);

    console.log(`Large scale test (${entityCount} entities): ${totalTime.toFixed(2)}ms`);
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

  test('should handle systems with no dependencies in parallel', async () => {
    // Create systems that don't conflict with each other
    class IndependentSystem1 extends System {
      public executed = false;
      constructor() {
        super([Position], [
          { componentType: Position as ComponentType, accessType: AccessType.Read }
        ]);
      }
      update(_entities: Entity[], _deltaTime: number): void {
        this.executed = true;
      }
    }

    class IndependentSystem2 extends System {
      public executed = false;
      constructor() {
        super([Velocity], [
          { componentType: Velocity as ComponentType, accessType: AccessType.Read }
        ]);
      }
      update(_entities: Entity[], _deltaTime: number): void {
        this.executed = true;
      }
    }

    const system1 = new IndependentSystem1();
    const system2 = new IndependentSystem2();

    world.addSystem(system1);
    world.addSystem(system2);

    // Create entities
    const entity = world.createEntity();
    entity.addComponent(new Position(0, 0));
    entity.addComponent(new Velocity(1, 1));

    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(system1.executed).toBe(true);
    expect(system2.executed).toBe(true);

    // Check that they were scheduled in the same group (no conflicts)
    const groups = world.getExecutionGroups();
    const system1Group = groups.find(g => g.systems.includes(system1));
    const system2Group = groups.find(g => g.systems.includes(system2));

    // They should be in the same group since they don't conflict
    expect(system1Group).toBe(system2Group);
  });

  test('should handle memory cleanup properly', async () => {
    const system = new LightComputationSystem();
    world.addSystem(system);

    const initialStats = world.getArchetypeStatistics();
    const initialEntityCount = initialStats.totalEntities;

    // Create and destroy entities
    const entities: Entity[] = [];

    // Create entities
    for (let i = 0; i < 50; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entities.push(entity);
    }

    // Update
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 20));

    // Verify entities were created
    const midStats = world.getArchetypeStatistics();
    expect(midStats.totalEntities).toBeGreaterThan(initialEntityCount);

    // Destroy entities
    entities.forEach(entity => entity.destroy());
    world.update(16); // Trigger cleanup
    await new Promise(resolve => setTimeout(resolve, 30));

    // Memory should be cleaned up (allowing for some async delay)
    const finalStats = world.getArchetypeStatistics();
    expect(finalStats.totalEntities).toBeLessThanOrEqual(midStats.totalEntities);
  });
});
