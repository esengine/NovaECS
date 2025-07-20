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

// Test system
class TestSystem extends System {
  public executionCount = 0;
  public lastExecutionMode: string = '';

  constructor() {
    super([Position], [
      { componentType: Position as ComponentType, accessType: AccessType.Write }
    ], ExecutionMode.Worker);
  }

  update(entities: Entity[], deltaTime: number): void {
    this.executionCount++;
    this.lastExecutionMode = 'executed';
    
    // Modify components to test writeback
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      if (position) {
        position.x += deltaTime * 0.1;
        position.y += deltaTime * 0.1;
      }
    });
  }
}

describe('Worker Support Debug', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  afterEach(() => {
    if (world) {
      world.dispose();
    }
  });

  test('should check worker support in current environment', () => {
    console.log('\n🔍 Environment Check:');
    console.log(`  typeof Worker: ${typeof Worker}`);
    console.log(`  typeof window: ${typeof window}`);
    console.log(`  typeof global: ${typeof global}`);
    console.log(`  typeof process: ${typeof process}`);
    console.log(`  process.env.NODE_ENV: ${process.env.NODE_ENV}`);
    
    const isWorkerSupported = world.isParallelExecutionSupported;
    console.log(`  World.isParallelExecutionSupported: ${isWorkerSupported}`);
    
    const workerPoolStats = world.getWorkerPoolStatistics();
    console.log(`  Worker Pool Stats:`, workerPoolStats);
    
    expect(typeof Worker).toBe('undefined'); // In Node.js/Jest environment
    expect(isWorkerSupported).toBe(false);
  });

  test('should test worker execution vs main thread execution', async () => {
    const system = new TestSystem();
    world.addSystem(system);

    // Create test entities
    const entities: Entity[] = [];
    for (let i = 0; i < 10; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entities.push(entity);
    }

    // Record initial positions
    const initialPositions = entities.map(entity => {
      const pos = entity.getComponent(Position) as Position;
      return { x: pos.x, y: pos.y };
    });

    console.log('\n📊 Initial positions:', initialPositions.slice(0, 3));

    // Execute system
    const startTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async
    const executionTime = performance.now() - startTime;

    // Check final positions
    const finalPositions = entities.map(entity => {
      const pos = entity.getComponent(Position) as Position;
      return { x: pos.x, y: pos.y };
    });

    console.log('📊 Final positions:', finalPositions.slice(0, 3));
    console.log(`📊 Execution time: ${executionTime.toFixed(2)}ms`);
    console.log(`📊 System execution count: ${system.executionCount}`);
    console.log(`📊 System execution mode: ${system.executionMode}`);

    // Verify system executed
    expect(system.executionCount).toBe(1);

    // Check if positions actually changed
    let positionsChanged = false;
    for (let i = 0; i < entities.length; i++) {
      if (finalPositions[i].x !== initialPositions[i].x || 
          finalPositions[i].y !== initialPositions[i].y) {
        positionsChanged = true;
        break;
      }
    }

    console.log(`📊 Positions changed: ${positionsChanged}`);
    
    if (positionsChanged) {
      console.log('✅ Component updates are working');
    } else {
      console.log('❌ Component updates are NOT working');
    }
  });

  test('should compare execution modes explicitly', async () => {
    console.log('\n🔬 Explicit Mode Comparison:');

    // Test main thread system
    const mainThreadSystem = new TestSystem();
    Object.defineProperty(mainThreadSystem, 'executionMode', {
      value: ExecutionMode.MainThread,
      writable: false
    });

    // Test worker system  
    const workerSystem = new TestSystem();
    Object.defineProperty(workerSystem, 'executionMode', {
      value: ExecutionMode.Worker,
      writable: false
    });

    // Create entities for main thread test
    world.clear();
    for (let i = 0; i < 50; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
    }

    // Test main thread execution
    world.addSystem(mainThreadSystem);
    const mainStartTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 50));
    const mainExecutionTime = performance.now() - mainStartTime;
    world.removeSystem(mainThreadSystem);

    // Test worker execution (will fallback to main thread if not supported)
    world.addSystem(workerSystem);
    const workerStartTime = performance.now();
    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 50));
    const workerExecutionTime = performance.now() - workerStartTime;
    world.removeSystem(workerSystem);

    console.log(`  Main Thread: ${mainExecutionTime.toFixed(2)}ms`);
    console.log(`  Worker (or fallback): ${workerExecutionTime.toFixed(2)}ms`);
    console.log(`  Main thread executions: ${mainThreadSystem.executionCount}`);
    console.log(`  Worker executions: ${workerSystem.executionCount}`);

    expect(mainThreadSystem.executionCount).toBe(1);
    expect(workerSystem.executionCount).toBe(1);

    // Both should execute since worker falls back to main thread
    if (Math.abs(mainExecutionTime - workerExecutionTime) < 5) {
      console.log('  ℹ️  Similar execution times suggest fallback to main thread');
    } else {
      console.log('  ✨ Different execution times suggest actual worker execution');
    }
  });

  test('should test worker pool internals', () => {
    console.log('\n🔧 Worker Pool Internals:');
    
    const stats = world.getWorkerPoolStatistics();
    console.log('  Worker Pool Statistics:', stats);
    
    const memoryStats = world.getPerformanceStatistics().memory;
    console.log('  Memory Statistics:', memoryStats);
    
    // Check if workers were actually created
    expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);
    
    if (stats.totalWorkers === 0) {
      console.log('  ❌ No workers created - Worker not supported');
    } else {
      console.log(`  ✅ ${stats.totalWorkers} workers created`);
    }
  });

  test('should test in browser-like environment', () => {
    console.log('\n🌐 Browser Environment Simulation:');
    
    // Simulate browser environment
    const originalWorker = global.Worker;
    const originalWindow = global.window;
    
    try {
      // Mock Worker constructor
      global.Worker = class MockWorker {
        onmessage: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;
        
        constructor(scriptURL: string) {
          console.log(`    Mock Worker created with script: ${scriptURL.substring(0, 50)}...`);
        }
        
        postMessage(data: any): void {
          console.log(`    Mock Worker received message:`, Object.keys(data));
          // Simulate async response
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: {
                  id: data.id,
                  success: true,
                  executionTime: 5,
                  componentUpdates: []
                }
              });
            }
          }, 10);
        }
        
        terminate(): void {
          console.log('    Mock Worker terminated');
        }
      } as any;
      
      // Mock window
      global.window = {} as any;
      
      // Create new world with mocked environment
      const mockWorld = new World();
      
      console.log(`    Mock Worker supported: ${mockWorld.isParallelExecutionSupported}`);
      
      const mockStats = mockWorld.getWorkerPoolStatistics();
      console.log('    Mock Worker Pool Stats:', mockStats);
      
      mockWorld.dispose();
      
    } finally {
      // Restore original environment
      if (originalWorker) {
        global.Worker = originalWorker;
      } else {
        delete (global as any).Worker;
      }
      
      if (originalWindow) {
        global.window = originalWindow;
      } else {
        delete (global as any).window;
      }
    }
  });
});
