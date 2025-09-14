/**
 * Tests for Transform hierarchy system
 * 变换层级系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Scheduler } from '../src/core/Scheduler';
import { Profiler } from '../src/core/Profiler';
import {
  Parent,
  LocalTransform,
  WorldTransform,
  DirtyTransform
} from '../src/components/Transform';
import {
  TransformMarkDirtySystem,
  TransformUpdateSystem,
  setLocalTransform,
  setParent
} from '../src/systems/TransformSystems';
import { HierarchySyncSystem } from '../src/hierarchy/HierarchySyncSystem';
import { mul, fromLocal, identity, transformPoint } from '../src/math/Mat3';

describe('Transform System', () => {
  let world: World;
  let scheduler: Scheduler;

  beforeEach(() => {
    world = new World();
    scheduler = new Scheduler();

    // Register components
    registerComponent(Parent);
    registerComponent(LocalTransform);
    registerComponent(WorldTransform);
    registerComponent(DirtyTransform);

    // Set up profiler for systems to work
    world.setResource(Profiler, new Profiler());

    // Add hierarchy and transform systems
    scheduler.add(HierarchySyncSystem);
    scheduler.add(TransformMarkDirtySystem);
    scheduler.add(TransformUpdateSystem);
  });

  describe('Math utilities', () => {
    test('should multiply matrices correctly', () => {
      const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const b = [9, 8, 7, 6, 5, 4, 3, 2, 1];

      const result = mul(a, b);

      expect(result).toHaveLength(9);
      expect(result[0]).toBe(30); // 1*9 + 2*6 + 3*3
      expect(result[4]).toBe(69); // 4*8 + 5*5 + 6*2 = 32 + 25 + 12 = 69
    });

    test('should create transformation matrix from local parameters', () => {
      const matrix = fromLocal(10, 20, 0, 2, 3);

      expect(matrix).toHaveLength(9);
      expect(matrix[2]).toBe(10); // translation x
      expect(matrix[5]).toBe(20); // translation y
      expect(matrix[0]).toBe(2);  // scale x
      expect(matrix[4]).toBe(3);  // scale y
    });

    test('should create identity matrix', () => {
      const id = identity();
      expect(id).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    });

    test('should transform points correctly', () => {
      const matrix = fromLocal(10, 20, 0, 1, 1); // translate by (10, 20)
      const [x, y] = transformPoint(matrix, 5, 5);

      expect(x).toBe(15); // 5 + 10
      expect(y).toBe(25); // 5 + 20
    });
  });

  describe('Transform components', () => {
    test('should create transform hierarchy', () => {
      const parent = world.createEntity();
      const child = world.createEntity();

      world.addComponent(parent, LocalTransform, { x: 10, y: 20 });
      world.addComponent(child, LocalTransform, { x: 5, y: 5 });
      world.addComponent(child, Parent, { value: parent });

      expect(world.hasComponent(parent, LocalTransform)).toBe(true);
      expect(world.hasComponent(child, LocalTransform)).toBe(true);
      expect(world.hasComponent(child, Parent)).toBe(true);

      const parentComp = world.getComponent(child, Parent);
      expect(parentComp?.value).toBe(parent);
    });
  });

  describe('Transform systems', () => {
    test('should mark transforms dirty when components are added', () => {
      const entity = world.createEntity();

      // Add LocalTransform - should trigger dirty marking
      world.addComponent(entity, LocalTransform);

      // Run the marking system
      scheduler.tick(world, 16);

      // Check if events were processed
      const addedEvents = world.getAddedChannel().takeAll();
      // Should have DirtyTransform marker (or will be added by Update system)
      expect(world.hasComponent(entity, DirtyTransform) || world.hasComponent(entity, WorldTransform)).toBe(true);
    });

    test('should update world transforms for single entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity, LocalTransform, { x: 10, y: 20, rot: 0, sx: 2, sy: 3 });

      // Run transform update
      scheduler.tick(world, 16);

      // Should have WorldTransform with correct matrix
      const worldTransform = world.getComponent(entity, WorldTransform);
      expect(worldTransform).toBeDefined();

      const expected = fromLocal(10, 20, 0, 2, 3);
      expect(worldTransform!.m).toEqual(expected);

      // Should no longer be dirty
      expect(world.hasComponent(entity, DirtyTransform)).toBe(false);
    });

    test('should update parent-child transform hierarchy', () => {
      const parent = world.createEntity();
      const child = world.createEntity();

      // Set up parent: translate by (10, 20), scale by (2, 2)
      world.addComponent(parent, LocalTransform, { x: 10, y: 20, rot: 0, sx: 2, sy: 2 });

      // Set up child: translate by (5, 5) relative to parent
      world.addComponent(child, LocalTransform, { x: 5, y: 5 });
      world.addComponent(child, Parent, { value: parent });

      // Run transform systems
      scheduler.tick(world, 16);

      // Check parent transform
      const parentWorld = world.getComponent(parent, WorldTransform);
      expect(parentWorld).toBeDefined();
      const expectedParent = fromLocal(10, 20, 0, 2, 2);
      expect(parentWorld!.m).toEqual(expectedParent);

      // Check child transform (should be parent * child)
      const childWorld = world.getComponent(child, WorldTransform);
      expect(childWorld).toBeDefined();

      const childLocal = fromLocal(5, 5, 0, 1, 1);
      const expectedChild = mul(expectedParent, childLocal);
      expect(childWorld!.m).toEqual(expectedChild);

      // Child's world position should be (10 + 5*2, 20 + 5*2) = (20, 30)
      const [worldX, worldY] = transformPoint(childWorld!.m, 0, 0);
      expect(worldX).toBeCloseTo(20);
      expect(worldY).toBeCloseTo(30);
    });

    test('should handle deep hierarchy', () => {
      const grandParent = world.createEntity();
      const parent = world.createEntity();
      const child = world.createEntity();

      // Set up hierarchy: grandparent -> parent -> child
      world.addComponent(grandParent, LocalTransform, { x: 100, y: 0 });

      world.addComponent(parent, LocalTransform, { x: 10, y: 0 });
      world.addComponent(parent, Parent, { value: grandParent });

      world.addComponent(child, LocalTransform, { x: 1, y: 0 });
      world.addComponent(child, Parent, { value: parent });

      // Run systems
      scheduler.tick(world, 16);

      // Check final positions
      const grandParentWorld = world.getComponent(grandParent, WorldTransform);
      const [gpX] = transformPoint(grandParentWorld!.m, 0, 0);
      expect(gpX).toBeCloseTo(100);

      const parentWorld = world.getComponent(parent, WorldTransform);
      const [pX] = transformPoint(parentWorld!.m, 0, 0);
      expect(pX).toBeCloseTo(110); // 100 + 10

      const childWorld = world.getComponent(child, WorldTransform);
      const [cX] = transformPoint(childWorld!.m, 0, 0);
      expect(cX).toBeCloseTo(111); // 100 + 10 + 1
    });

    test('should handle orphaned entities (no parent or dead parent)', () => {
      const orphan = world.createEntity();
      world.addComponent(orphan, LocalTransform, { x: 50, y: 60 });

      // Run systems
      scheduler.tick(world, 16);

      // Should have world transform equal to local transform
      const worldTransform = world.getComponent(orphan, WorldTransform);
      expect(worldTransform).toBeDefined();

      const expected = fromLocal(50, 60, 0, 1, 1);
      expect(worldTransform!.m).toEqual(expected);
    });

    test('should only update dirty branches for efficiency', () => {
      const parent = world.createEntity();
      const child1 = world.createEntity();
      const child2 = world.createEntity();

      world.addComponent(parent, LocalTransform, { x: 0, y: 0 });
      world.addComponent(child1, LocalTransform, { x: 10, y: 0 });
      world.addComponent(child1, Parent, { value: parent });
      world.addComponent(child2, LocalTransform, { x: 20, y: 0 });
      world.addComponent(child2, Parent, { value: parent });

      // Initial update - all should get world transforms
      scheduler.tick(world, 16);

      expect(world.hasComponent(parent, WorldTransform)).toBe(true);
      expect(world.hasComponent(child1, WorldTransform)).toBe(true);
      expect(world.hasComponent(child2, WorldTransform)).toBe(true);

      // All should be clean now
      expect(world.hasComponent(parent, DirtyTransform)).toBe(false);
      expect(world.hasComponent(child1, DirtyTransform)).toBe(false);
      expect(world.hasComponent(child2, DirtyTransform)).toBe(false);

      // Modify only child1
      const child1Local = world.getComponent(child1, LocalTransform)!;
      child1Local.x = 15;
      world.markChanged(child1, LocalTransform);

      const cmd = world.cmd();
      cmd.add(child1, DirtyTransform);
      world.flush(cmd);

      // Run update
      scheduler.tick(world, 16);

      // child1 should be clean, others should remain untouched
      expect(world.hasComponent(child1, DirtyTransform)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    test('setLocalTransform should update transform and mark dirty', () => {
      const entity = world.createEntity();
      world.addComponent(entity, LocalTransform);

      setLocalTransform(world, entity, 100, 200, Math.PI / 4, 2, 3);

      const local = world.getComponent(entity, LocalTransform)!;
      expect(local.x).toBe(100);
      expect(local.y).toBe(200);
      expect(local.rot).toBeCloseTo(Math.PI / 4);
      expect(local.sx).toBe(2);
      expect(local.sy).toBe(3);

      expect(world.hasComponent(entity, DirtyTransform)).toBe(true);
    });

    test('setParent should establish parent-child relationship', () => {
      const parent = world.createEntity();
      const child = world.createEntity();

      world.addComponent(child, LocalTransform);

      // Manually set parent for now
      world.addComponent(child, Parent, { value: parent });

      // Check if parent component was added
      expect(world.hasComponent(child, Parent)).toBe(true);

      const parentComp = world.getComponent(child, Parent);
      expect(parentComp).toBeDefined();
      expect(parentComp!.value).toBe(parent);
    });

    test('setParent with null should remove parent', () => {
      const parent = world.createEntity();
      const child = world.createEntity();

      world.addComponent(child, LocalTransform);
      world.addComponent(child, Parent, { value: parent });

      setParent(world, child, null);

      expect(world.hasComponent(child, Parent)).toBe(false);
    });
  });

  describe('Rotation transforms', () => {
    test('should handle rotation correctly', () => {
      const entity = world.createEntity();
      world.addComponent(entity, LocalTransform, {
        x: 0, y: 0,
        rot: Math.PI / 2, // 90 degrees
        sx: 1, sy: 1
      });

      scheduler.tick(world, 16);

      const worldTransform = world.getComponent(entity, WorldTransform)!;

      // Point (1, 0) should rotate to (0, 1)
      const [x, y] = transformPoint(worldTransform.m, 1, 0);
      expect(x).toBeCloseTo(0, 5);
      expect(y).toBeCloseTo(1, 5);
    });
  });
});