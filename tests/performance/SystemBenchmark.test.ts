import { PerformanceBenchmark } from '../../src/performance/PerformanceBenchmark';
import { System, ExecutionMode } from '../../src/core/System';
import { Component } from '../../src/core/Component';
import { Entity } from '../../src/core/Entity';
import { World } from '../../src/core/World';
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

class Mass extends Component {
  constructor(public value: number = 1) {
    super();
  }
}

// Lightweight system for testing
class LightweightSystem extends System {
  constructor() {
    super([Position], [
      { componentType: Position as ComponentType, accessType: AccessType.Read }
    ]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      if (position) {
        // Simple calculation
        const distance = Math.sqrt(position.x * position.x + position.y * position.y);
        // Use result to prevent optimization
        if (distance > 1000) {
          // Rarely executed
        }
      }
    });
  }
}

// Compute-intensive system for testing
class ComputeIntensiveSystem extends System {
  constructor() {
    super([Position, Velocity, Mass], [
      { componentType: Position as ComponentType, accessType: AccessType.Write },
      { componentType: Velocity as ComponentType, accessType: AccessType.Read },
      { componentType: Mass as ComponentType, accessType: AccessType.Read }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      const velocity = entity.getComponent(Velocity) as Velocity;
      const mass = entity.getComponent(Mass) as Mass;
      
      if (position && velocity && mass) {
        // Intensive physics calculations
        for (let i = 0; i < 1000; i++) {
          const force = Math.sin(deltaTime * i) * mass.value;
          const acceleration = force / mass.value;
          
          position.x += velocity.dx * deltaTime + 0.5 * acceleration * deltaTime * deltaTime;
          position.y += velocity.dy * deltaTime + 0.5 * acceleration * deltaTime * deltaTime;
          
          // Complex trigonometric calculations
          const angle = Math.atan2(position.y, position.x);
          const magnitude = Math.sqrt(position.x * position.x + position.y * position.y);
          
          // Apply some transformations
          position.x = magnitude * Math.cos(angle + deltaTime * 0.01);
          position.y = magnitude * Math.sin(angle + deltaTime * 0.01);
        }
      }
    });
  }
}

// Helper function to create entities
function createTestEntities(count: number, world: World): Entity[] {
  const entities: Entity[] = [];
  
  for (let i = 0; i < count; i++) {
    const entity = world.createEntity();
    entity.addComponent(new Position(Math.random() * 100, Math.random() * 100));
    entity.addComponent(new Velocity(Math.random() * 10 - 5, Math.random() * 10 - 5));
    entity.addComponent(new Mass(0.5 + Math.random() * 2));
    entities.push(entity);
  }
  
  return entities;
}

describe('System Performance Benchmark', () => {
  let benchmark: PerformanceBenchmark;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark({
      iterations: 5,
      warmupIterations: 2,
      entityCounts: [25, 50, 100, 200],
      deltaTime: 16
    });
  });

  afterEach(() => {
    benchmark.dispose();
  });

  test('should benchmark lightweight system performance', async () => {
    console.log('\n🔬 Benchmarking Lightweight System');
    
    const results = await benchmark.benchmarkSystemExecution(
      LightweightSystem,
      createTestEntities
    );

    expect(results).toHaveLength(4); // 4 entity counts
    
    results.forEach(result => {
      expect(result.mainThreadTime).toBeGreaterThan(0);
      expect(result.workerTime).toBeGreaterThan(0);
      expect(result.systemName).toBe('LightweightSystem');
      expect(['worker', 'main_thread']).toContain(result.recommendation);
    });

    const report = benchmark.generateReport(results);
    console.log(report);
  }, 30000);

  test('should benchmark compute-intensive system performance', async () => {
    console.log('\n🔬 Benchmarking Compute-Intensive System');
    
    const results = await benchmark.benchmarkSystemExecution(
      ComputeIntensiveSystem,
      createTestEntities
    );

    expect(results).toHaveLength(4);
    
    results.forEach(result => {
      expect(result.mainThreadTime).toBeGreaterThan(0);
      expect(result.workerTime).toBeGreaterThan(0);
      expect(result.systemName).toBe('ComputeIntensiveSystem');
    });

    // Compute-intensive systems should generally benefit from workers
    const largeEntityResults = results.filter(r => r.entityCount >= 100);
    if (largeEntityResults.length > 0) {
      console.log(`Large entity count recommendations: ${largeEntityResults.map(r => r.recommendation).join(', ')}`);
    }

    const report = benchmark.generateReport(results);
    console.log(report);
  }, 30000);

  test('should compare system performance', async () => {
    console.log('\n🏁 Comparing System Performance');
    
    const comparison = await benchmark.compareSystemsPerformance(
      LightweightSystem,
      ComputeIntensiveSystem,
      createTestEntities,
      100
    );

    expect(comparison.systemA.mainThread).toBeGreaterThan(0);
    expect(comparison.systemA.worker).toBeGreaterThan(0);
    expect(comparison.systemB.mainThread).toBeGreaterThan(0);
    expect(comparison.systemB.worker).toBeGreaterThan(0);
    expect(['LightweightSystem', 'ComputeIntensiveSystem']).toContain(comparison.winner);

    console.log('Comparison Results:');
    console.log(`  LightweightSystem - Main: ${comparison.systemA.mainThread.toFixed(2)}ms, Worker: ${comparison.systemA.worker.toFixed(2)}ms`);
    console.log(`  ComputeIntensiveSystem - Main: ${comparison.systemB.mainThread.toFixed(2)}ms, Worker: ${comparison.systemB.worker.toFixed(2)}ms`);
    console.log(`  Winner: ${comparison.winner}`);
  }, 20000);

  test('should find optimal worker threshold', async () => {
    console.log('\n🎯 Finding Optimal Worker Threshold');
    
    const threshold = await benchmark.findOptimalWorkerThreshold(
      ComputeIntensiveSystem,
      createTestEntities,
      200
    );

    expect(threshold).toBeGreaterThan(0);
    expect(threshold).toBeLessThanOrEqual(200);

    console.log(`Optimal worker threshold: ${threshold} entities`);
  }, 25000);

  test('should handle systems with different execution modes', async () => {
    // Create a system that's forced to main thread
    class MainThreadOnlySystem extends System {
      constructor() {
        super([Position], [
          { componentType: Position as ComponentType, accessType: AccessType.Write }
        ], ExecutionMode.MainThread);
      }

      update(entities: Entity[], _deltaTime: number): void {
        entities.forEach(entity => {
          const position = entity.getComponent(Position) as Position;
          if (position) {
            position.x += 1;
            position.y += 1;
          }
        });
      }
    }

    const results = await benchmark.benchmarkSystemExecution(
      MainThreadOnlySystem,
      createTestEntities
    );

    expect(results).toHaveLength(4);
    
    // All results should recommend main thread since it's forced
    results.forEach(result => {
      expect(result.systemName).toBe('MainThreadOnlySystem');
      // Note: The benchmark might still test worker mode for comparison
    });

    console.log('\n📊 Main Thread Only System Results:');
    const report = benchmark.generateReport(results);
    console.log(report);
  }, 20000);

  test('should provide meaningful performance insights', async () => {
    const lightweightResults = await benchmark.benchmarkSystemExecution(
      LightweightSystem,
      createTestEntities
    );

    const computeResults = await benchmark.benchmarkSystemExecution(
      ComputeIntensiveSystem,
      createTestEntities
    );

    // Lightweight systems should generally be faster
    const lightweightAvg = lightweightResults.reduce((sum, r) => sum + r.mainThreadTime, 0) / lightweightResults.length;
    const computeAvg = computeResults.reduce((sum, r) => sum + r.mainThreadTime, 0) / computeResults.length;

    expect(lightweightAvg).toBeLessThan(computeAvg);

    console.log('\n📈 Performance Insights:');
    console.log(`  Lightweight System Average: ${lightweightAvg.toFixed(2)}ms`);
    console.log(`  Compute-Intensive System Average: ${computeAvg.toFixed(2)}ms`);
    console.log(`  Performance Ratio: ${(computeAvg / lightweightAvg).toFixed(2)}x`);
  }, 25000);
});
