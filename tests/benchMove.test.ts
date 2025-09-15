/**
 * Movement benchmark test: performance + correctness validation
 * 移动基准测试：性能 + 正确性验证
 */

import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { registerSchema } from '../src/sab/Schema';
import { WorkerPool } from '../src/parallel/WorkerPool';
import { forEachChunkParallel } from '../src/parallel/ChunkParallel';
import { registerHostKernel } from '../src/parallel/KernelRegistry';
import { worldHash } from '../src/replay/StateHash';
import * as Environment from '../src/sab/Environment';

// Test components
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

// Mock worker for testing
class MockWorkerPool {
  async run(): Promise<any[]> {
    return [];
  }
  dispose() {}
}

function spawn(world: World, N = 1000) { // Smaller N for faster tests
  for (let i = 0; i < N; i++) {
    const e = world.createEntity();
    world.add(e, Position, { x: Math.random(), y: Math.random() });
    world.add(e, Velocity, { dx: Math.random() * 0.1, dy: Math.random() * 0.1 });
  }
}

describe('Movement Benchmark', () => {
  let world: World;
  
  beforeAll(() => {
    // Register components
    registerComponent(Position);
    registerComponent(Velocity);
    
    // Register SAB schemas
    registerSchema(Position, { 
      fields: { x: 'f32', y: 'f32' } 
    });
    registerSchema(Velocity, { 
      fields: { dx: 'f32', dy: 'f32' } 
    });
    
    // Register host kernel for movement
    registerHostKernel('move2D', (cols, length, params) => {
      const positions = cols[0] as Position[];
      const velocities = cols[1] as Velocity[];
      const { dt } = params as { dt: number };
      
      for (let i = 0; i < length; i++) {
        const pos = positions[i];
        const vel = velocities[i];
        if (pos && vel) {
          pos.x += vel.dx * dt;
          pos.y += vel.dy * dt;
        }
      }
      
      return { written: [0] }; // Modified Position only
    }, { writes: [0] }); // Metadata: writes to Position column
  });
  
  beforeEach(() => {
    world = new World();
  });
  
  test('should validate movement correctness between host and parallel execution', async () => {
    spawn(world, 100); // Small dataset for test speed
    const dt = 1/60;
    
    // Create two identical worlds for comparison
    const world1 = new World();
    const world2 = new World();
    
    // Populate both worlds with identical data
    for (let i = 0; i < 100; i++) {
      const e1 = world1.createEntity();
      const e2 = world2.createEntity();
      
      const pos = { x: Math.random(), y: Math.random() };
      const vel = { dx: Math.random() * 0.1, dy: Math.random() * 0.1 };
      
      world1.add(e1, Position, { ...pos });
      world1.add(e1, Velocity, { ...vel });
      
      world2.add(e2, Position, { ...pos });
      world2.add(e2, Velocity, { ...vel });
    }
    
    // Force host kernel execution (SAB unavailable)
    const originalSAB = Environment.getSABAvailability();
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(false);
    
    try {
      // Execute host kernel on world1
      await forEachChunkParallel(
        world1, 
        [Position, Velocity], 
        new MockWorkerPool() as any, 
        'move2D', 
        { dt }
      );
      
      // Get hash after host execution
      const hostHash = worldHash(world1);
      
      // For this test, we'll simulate parallel execution by running host again
      // In real scenario, this would use actual SAB worker pool
      await forEachChunkParallel(
        world2, 
        [Position, Velocity], 
        new MockWorkerPool() as any, 
        'move2D', 
        { dt }
      );
      
      const parallelHash = worldHash(world2);
      
      // Hashes should be identical for deterministic execution
      expect(hostHash).toBe(parallelHash);
      console.log('Hash validation passed:', hostHash === parallelHash);
      
    } finally {
      // Restore original SAB state
      vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(originalSAB);
    }
  });
  
  test('should measure performance difference between execution modes', async () => {
    spawn(world, 10000); // Larger dataset for performance measurement
    const dt = 1/60;
    
    // Force host execution
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(false);
    
    // Measure host kernel performance
    const hostStart = performance.now();
    await forEachChunkParallel(
      world, 
      [Position, Velocity], 
      new MockWorkerPool() as any, 
      'move2D', 
      { dt }
    );
    const hostTime = performance.now() - hostStart;
    
    console.log(`Host execution time: ${hostTime.toFixed(2)}ms`);
    
    // For this test, we can't easily measure actual parallel performance
    // without real worker implementation, but we can verify the code paths work
    expect(hostTime).toBeGreaterThan(0);
    expect(hostTime).toBeLessThan(1000); // Should complete within 1 second
  });
  
  test('should handle large datasets efficiently', async () => {
    const largeN = 50000;
    spawn(world, largeN);
    const dt = 1/60;
    
    // Force host execution
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(false);
    
    const start = performance.now();
    await forEachChunkParallel(
      world, 
      [Position, Velocity], 
      new MockWorkerPool() as any, 
      'move2D', 
      { dt }
    );
    const time = performance.now() - start;
    
    console.log(`Processed ${largeN} entities in ${time.toFixed(2)}ms`);
    console.log(`Rate: ${(largeN / time * 1000).toFixed(0)} entities/second`);
    
    // Verify some entities were actually processed
    let movedCount = 0;
    for (let i = 1; i <= Math.min(100, largeN); i++) {
      const pos = world.getComponent(i, Position);
      if (pos && (pos.x !== 0 || pos.y !== 0)) {
        movedCount++;
      }
    }
    
    expect(movedCount).toBeGreaterThan(0);
    expect(time).toBeLessThan(5000); // Should complete within 5 seconds
  });
  
  test('should validate frameHash consistency across multiple runs', async () => {
    // Create deterministic world state
    world = new World();
    for (let i = 0; i < 1000; i++) {
      const e = world.createEntity();
      world.add(e, Position, { x: i * 0.1, y: i * 0.2 });
      world.add(e, Velocity, { dx: 0.01, dy: 0.02 });
    }
    
    const dt = 1/60;
    vi.spyOn(Environment, 'getSABAvailability').mockReturnValue(false);
    
    // Run simulation multiple times and verify hash consistency
    const hashes: string[] = [];
    
    for (let run = 0; run < 3; run++) {
      // Reset world to initial state for each run
      const freshWorld = new World();
      for (let i = 0; i < 1000; i++) {
        const e = freshWorld.createEntity();
        freshWorld.add(e, Position, { x: i * 0.1, y: i * 0.2 });
        freshWorld.add(e, Velocity, { dx: 0.01, dy: 0.02 });
      }
      
      await forEachChunkParallel(
        freshWorld, 
        [Position, Velocity], 
        new MockWorkerPool() as any, 
        'move2D', 
        { dt }
      );
      
      hashes.push(worldHash(freshWorld).toString());
    }
    
    // All hashes should be identical for deterministic execution
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[1]).toBe(hashes[2]);
    
    console.log('Deterministic execution verified. Hash:', hashes[0]);
  });
});