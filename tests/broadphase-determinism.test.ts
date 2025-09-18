/**
 * Broadphase Determinism Tests
 * 宽相确定性测试
 *
 * Tests the deterministic behavior of broadphase collision detection
 * across multiple runs and different scenarios.
 * 测试宽相碰撞检测在多次运行和不同场景下的确定性行为。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

// Import physics components and systems
// 导入物理组件和系统
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { AABB2D } from '../src/components/AABB2D';
import { BroadphasePairs } from '../src/resources/BroadphasePairs';
import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { SyncAABBSystem } from '../src/systems/phys2d/SyncAABBSystem';
import { BroadphaseSAP } from '../src/systems/phys2d/BroadphaseSAP';
import { Guid } from '../src/components/Guid';

// Import math utilities
// 导入数学工具
import { f, ONE, TWO, ZERO, fromInt } from '../src/math/fixed';
import { frameHash } from '../src/replay/StateHash';

describe('Broadphase Determinism', () => {
  beforeEach(() => {
    // Register all required components
    // 注册所有必需的组件
    registerComponent(Body2D);
    registerComponent(ShapeCircle);
    registerComponent(AABB2D);
    registerComponent(Guid);
  });

  test('should produce identical collision pairs across multiple runs', () => {
    // Test configuration
    // 测试配置
    const NUM_BODIES = 20;
    const NUM_FRAMES = 10;
    const PHYSICS_DT = 1 / 60;

    // Function to create and run broadphase simulation
    // 创建并运行宽相仿真的函数
    const runBroadphaseSimulation = (seed: number): { pairs: string; hash: number } => {
      const world = new World();
      const scheduler = new Scheduler(world);

      // Set fixed timestep
      // 设置固定时间步长
      world.setFixedDt(PHYSICS_DT);

      // Add physics systems in correct order
      // 按正确顺序添加物理系统
      scheduler.add(IntegrateVelocitiesSystem);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);

      // Create test bodies with deterministic initial conditions
      // 创建具有确定性初始条件的测试物体
      for (let i = 0; i < NUM_BODIES; i++) {
        const entity = world.createEntity();

        // Create body with predictable position and velocity
        // 使用可预测的位置和速度创建物体
        const body = createDynamicBody(
          fromInt(i * 3),        // px: spread bodies along X axis
          fromInt((i % 5) * 2),  // py: some vertical spread
          ONE,                   // mass: 1.0
          ONE                    // inertia: 1.0
        );
        body.vx = f((i % 7) - 3); // Varying velocities -3..+3
        body.vy = f((i % 5) - 2); // Varying velocities -2..+2

        // Create circle shape with varying radius
        // 创建具有不同半径的圆形
        const radius = f(0.5 + (i % 3) * 0.25); // 0.5, 0.75, 1.0, 0.5, ...
        const circle = createCircleShape(radius);

        // Create AABB
        // 创建AABB
        const aabb = new AABB2D();

        // Add components
        // 添加组件
        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        // Add Guid for stable sorting (using seed for determinism)
        // 添加Guid用于稳定排序（使用种子确保确定性）
        const guid = new Guid(
          seed >>> 0,                    // Use seed as high bits
          (i << 16 | (seed & 0xFFFF))    // Use index and seed low bits as low bits
        );
        world.addComponent(entity, Guid, guid);
      }

      // Run simulation
      // 运行仿真
      for (let frame = 0; frame < NUM_FRAMES; frame++) {
        scheduler.tick(world, 16);
      }

      // Get final broadphase results
      // 获取最终宽相结果
      const broadphasePairs = world.getResource(BroadphasePairs);
      const pairsString = JSON.stringify(
        broadphasePairs?.pairs.map(p => `${p.a}-${p.b}`).sort()
      );
      const worldHash = frameHash(world, false);

      return { pairs: pairsString, hash: worldHash };
    };

    // Run the simulation multiple times with same seed
    // 使用相同种子多次运行仿真
    const result1 = runBroadphaseSimulation(12345);
    const result2 = runBroadphaseSimulation(12345);
    const result3 = runBroadphaseSimulation(12345);

    // All runs should produce identical results
    // 所有运行应产生相同的结果
    expect(result2.pairs).toBe(result1.pairs);
    expect(result3.pairs).toBe(result1.pairs);
    expect(result2.hash).toBe(result1.hash);
    expect(result3.hash).toBe(result1.hash);
  });

  test('should handle empty world correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);

    // Run with no entities
    // 没有实体时运行
    scheduler.tick(world, 16);

    const broadphasePairs = world.getResource(BroadphasePairs);
    expect(broadphasePairs?.pairs).toEqual([]);
    expect(broadphasePairs?.generated).toBe(0);
    expect(broadphasePairs?.culled).toBe(0);
  });

  test('should handle single entity correctly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);

    // Create single entity
    // 创建单个实体
    const entity = world.createEntity();
    const body = createDynamicBody();
    const circle = createCircleShape(ONE);
    const aabb = new AABB2D();

    world.addComponent(entity, Body2D, body);
    world.addComponent(entity, ShapeCircle, circle);
    world.addComponent(entity, AABB2D, aabb);

    scheduler.tick(world, 16);

    const broadphasePairs = world.getResource(BroadphasePairs);
    expect(broadphasePairs?.pairs).toEqual([]);
    expect(broadphasePairs?.generated).toBe(0);
  });

  test('should generate pairs for overlapping circles', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);

    // Create two overlapping circles
    // 创建两个重叠的圆
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO); // At origin
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(ONE, ZERO); // Slightly offset, should overlap
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const broadphasePairs = world.getResource(BroadphasePairs);
    expect(broadphasePairs?.pairs).toHaveLength(1);

    const pair = broadphasePairs?.pairs[0];
    expect(pair?.a).toBeDefined();
    expect(pair?.b).toBeDefined();
    expect(pair?.a).not.toBe(pair?.b);
  });

  test('should not generate pairs for distant circles', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);

    // Create two distant circles
    // 创建两个距离较远的圆
    const entity1 = world.createEntity();
    const body1 = createDynamicBody(ZERO, ZERO);
    const circle1 = createCircleShape(ONE);
    const aabb1 = new AABB2D();
    world.addComponent(entity1, Body2D, body1);
    world.addComponent(entity1, ShapeCircle, circle1);
    world.addComponent(entity1, AABB2D, aabb1);

    const entity2 = world.createEntity();
    const body2 = createDynamicBody(fromInt(10), ZERO); // Far apart
    const circle2 = createCircleShape(ONE);
    const aabb2 = new AABB2D();
    world.addComponent(entity2, Body2D, body2);
    world.addComponent(entity2, ShapeCircle, circle2);
    world.addComponent(entity2, AABB2D, aabb2);

    scheduler.tick(world, 16);

    const broadphasePairs = world.getResource(BroadphasePairs);
    expect(broadphasePairs?.pairs).toEqual([]);
  });

  test('broadphase statistics should be consistent', () => {
    const world = new World();
    const scheduler = new Scheduler(world);

    world.setFixedDt(1 / 60);
    scheduler.add(SyncAABBSystem);
    scheduler.add(BroadphaseSAP);

    // Create multiple entities in a grid pattern
    // 以网格模式创建多个实体
    const gridSize = 3;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const entity = world.createEntity();
        const body = createDynamicBody(
          fromInt(x * 2), // Spaced 2 units apart
          fromInt(y * 2)
        );
        const circle = createCircleShape(ONE);
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);
      }
    }

    scheduler.tick(world, 16);

    const broadphasePairs = world.getResource(BroadphasePairs);
    expect(broadphasePairs?.frame).toBe(world.frame);
    expect(broadphasePairs?.generated).toBeGreaterThan(0);
    expect((broadphasePairs?.pairs.length ?? 0) + (broadphasePairs?.culled ?? 0)).toBe(broadphasePairs?.generated);
  });

  test('should handle 2k random circles with density-based pair growth', () => {
    // Test pair count growth with different densities
    // 测试不同密度下配对数量的增长
    const runDensityTest = (entityCount: number, areaSize: number, seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);

      // Use fixed seed for deterministic random positions
      // 使用固定种子生成确定性随机位置
      let rng = seed;
      const nextRandom = () => {
        rng = (rng * 1664525 + 1013904223) % 4294967296;
        return rng / 4294967296;
      };

      // Create random circles within the specified area
      // 在指定区域内创建随机圆形
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();

        // Random position within area
        // 区域内的随机位置
        const x = f((nextRandom() - 0.5) * areaSize);
        const y = f((nextRandom() - 0.5) * areaSize);

        const body = createDynamicBody(x, y, ONE, ONE);

        // Small random velocity
        // 小的随机速度
        body.vx = f((nextRandom() - 0.5) * 0.1);
        body.vy = f((nextRandom() - 0.5) * 0.1);

        // Fixed radius for consistent density calculation
        // 固定半径用于一致的密度计算
        const radius = f(0.5);
        const circle = createCircleShape(radius);
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        // Add Guid for stable sorting
        // 添加Guid用于稳定排序
        const guid = new Guid(
          seed >>> 0,
          (i << 16 | (seed & 0xFFFF))
        );
        world.addComponent(entity, Guid, guid);
      }

      // Run one frame to update AABB and generate pairs
      // 运行一帧以更新AABB并生成配对
      scheduler.tick(world, 16);

      const broadphasePairs = world.getResource(BroadphasePairs);
      return {
        pairCount: broadphasePairs?.pairs.length ?? 0,
        density: entityCount / (areaSize * areaSize),
        pairs: broadphasePairs?.pairs.map(p => `${p.a}-${p.b}`).sort(),
        worldHash: frameHash(world, true)
      };
    };

    // Test with 2k entities at different densities
    // 在不同密度下测试2k个实体
    const entityCount = 2000;

    // Low density: large area
    // 低密度：大区域
    const lowDensity = runDensityTest(entityCount, 200, 12345);

    // Medium density: medium area
    // 中等密度：中等区域
    const mediumDensity = runDensityTest(entityCount, 100, 12345);

    // High density: small area
    // 高密度：小区域
    const highDensity = runDensityTest(entityCount, 50, 12345);

    // Pair count should increase with density
    // 配对数量应该随密度增加
    expect(lowDensity.pairCount).toBeLessThan(mediumDensity.pairCount);
    expect(mediumDensity.pairCount).toBeLessThan(highDensity.pairCount);

    // Verify density relationship
    // 验证密度关系
    expect(lowDensity.density).toBeLessThan(mediumDensity.density);
    expect(mediumDensity.density).toBeLessThan(highDensity.density);

    // At high density, we should have significant overlap
    // 高密度时应该有显著重叠
    expect(highDensity.pairCount).toBeGreaterThan(entityCount * 0.1); // At least 10% entities have pairs
  });

  test('should maintain deterministic pair order across multiple runs', () => {
    // Test deterministic behavior across multiple simulation runs
    // 测试多次仿真运行的确定性行为
    const runSimulationWithFrameHash = (seed: number) => {
      const world = new World();
      const scheduler = new Scheduler(world);

      world.setFixedDt(1 / 60);
      scheduler.add(SyncAABBSystem);
      scheduler.add(BroadphaseSAP);

      // Create deterministic set of entities
      // 创建确定性的实体集合
      const entityCount = 500; // Smaller for faster testing
      let rng = seed;
      const nextRandom = () => {
        rng = (rng * 1664525 + 1013904223) % 4294967296;
        return rng / 4294967296;
      };

      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();

        const x = f((nextRandom() - 0.5) * 50);
        const y = f((nextRandom() - 0.5) * 50);
        const body = createDynamicBody(x, y, ONE, ONE);

        body.vx = f((nextRandom() - 0.5) * 2);
        body.vy = f((nextRandom() - 0.5) * 2);

        const radius = f(0.5 + nextRandom() * 0.5); // Variable radius 0.5-1.0
        const circle = createCircleShape(radius);
        const aabb = new AABB2D();

        world.addComponent(entity, Body2D, body);
        world.addComponent(entity, ShapeCircle, circle);
        world.addComponent(entity, AABB2D, aabb);

        // Stable sorting with Guid
        // 使用Guid进行稳定排序
        const guid = new Guid(seed >>> 0, (i << 16 | (seed & 0xFFFF)));
        world.addComponent(entity, Guid, guid);
      }

      // Run a few frames to let objects move and interact
      // 运行几帧让物体移动和相互作用
      for (let frame = 0; frame < 5; frame++) {
        scheduler.tick(world, 16);
      }

      const broadphasePairs = world.getResource(BroadphasePairs);
      return {
        pairOrder: broadphasePairs?.pairs.map(p => `${p.a}-${p.b}`), // Preserve original order
        sortedPairs: broadphasePairs?.pairs.map(p => `${p.a}-${p.b}`).sort(),
        pairCount: broadphasePairs?.pairs.length ?? 0,
        worldHash: frameHash(world, true), // Include RNG state
        worldHashNoRng: frameHash(world, false) // Exclude RNG state
      };
    };

    // Run same simulation multiple times
    // 多次运行相同仿真
    const result1 = runSimulationWithFrameHash(54321);
    const result2 = runSimulationWithFrameHash(54321);
    const result3 = runSimulationWithFrameHash(54321);

    // All runs should produce identical results
    // 所有运行应产生相同结果
    expect(result2.pairOrder).toEqual(result1.pairOrder);
    expect(result3.pairOrder).toEqual(result1.pairOrder);

    expect(result2.sortedPairs).toEqual(result1.sortedPairs);
    expect(result3.sortedPairs).toEqual(result1.sortedPairs);

    expect(result2.pairCount).toBe(result1.pairCount);
    expect(result3.pairCount).toBe(result1.pairCount);

    // Hash with RNG should be identical
    // 包含RNG的哈希应该相同
    expect(result2.worldHash).toBe(result1.worldHash);
    expect(result3.worldHash).toBe(result1.worldHash);

    // Hash without RNG should also be identical since physics state is deterministic
    // 不包含RNG的哈希也应该相同，因为物理状态是确定性的
    expect(result2.worldHashNoRng).toBe(result1.worldHashNoRng);
    expect(result3.worldHashNoRng).toBe(result1.worldHashNoRng);

    // Different seeds should produce different results
    // 不同种子应产生不同结果
    const differentSeedResult = runSimulationWithFrameHash(98765);
    expect(differentSeedResult.worldHash).not.toBe(result1.worldHash);
  });
});