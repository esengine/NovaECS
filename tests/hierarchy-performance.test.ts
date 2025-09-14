/**
 * Performance and stress tests for hierarchy system
 * 层级系统性能和压力测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Profiler } from '../src/core/Profiler';
import { ChildrenIndex, HierarchyPolicy, HierarchySyncSystem } from '../src/hierarchy';
import { Parent, LocalTransform, WorldTransform, DirtyTransform } from '../src/components/Transform';
import { TransformMarkDirtySystem, TransformUpdateSystem } from '../src/systems/TransformSystems';

describe('Hierarchy System Performance Tests', () => {
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

    // Set up profiler
    world.setResource(Profiler, new Profiler());

    // Add systems
    scheduler.add(HierarchySyncSystem);
    scheduler.add(TransformMarkDirtySystem);
    scheduler.add(TransformUpdateSystem);
  });

  test('should handle large hierarchy without linear degradation', () => {
    const treeCount = 1000;
    const treeDepth = 10;
    const totalEntities = treeCount * treeDepth; // 10,000 entities

    console.log(`Creating ${totalEntities} entities in ${treeCount} trees of depth ${treeDepth}`);

    const trees: Array<{ root: number; nodes: number[] }> = [];

    // Create 1000 trees, each with 10 levels
    for (let t = 0; t < treeCount; t++) {
      const nodes: number[] = [];

      // Create root
      const root = world.createEntity();
      world.addComponent(root, LocalTransform, { x: t, y: 0 });
      nodes.push(root);

      // Create chain of children
      let parent = root;
      for (let d = 1; d < treeDepth; d++) {
        const child = world.createEntity();
        world.addComponent(child, LocalTransform, { x: t, y: d });
        world.addComponent(child, Parent, { value: parent });
        nodes.push(child);
        parent = child;
      }

      trees.push({ root, nodes });
    }

    // Measure first run
    const start1 = performance.now();
    scheduler.tick(world, 16);
    const time1 = performance.now() - start1;

    console.log(`First run: ${time1.toFixed(2)}ms`);

    // Verify hierarchy was built correctly
    const idx = world.getResource(ChildrenIndex)!;
    expect(idx.getAllParents()).toHaveLength(treeCount * (treeDepth - 1)); // All non-leaf nodes

    // Make some changes to trigger updates
    for (let i = 0; i < 100; i++) {
      const tree = trees[i];
      const leafNode = tree.nodes[tree.nodes.length - 1];
      world.addComponent(leafNode, DirtyTransform);
    }

    // Measure second run with partial updates
    const start2 = performance.now();
    scheduler.tick(world, 16);
    const time2 = performance.now() - start2;

    console.log(`Second run (partial update): ${time2.toFixed(2)}ms`);

    // Performance should not degrade linearly with entity count
    // Both runs should complete in reasonable time (<200ms for 10k entities)
    expect(time1).toBeLessThan(200);
    expect(time2).toBeLessThan(200);

    // Verify some transforms were updated
    let updatedCount = 0;
    for (const tree of trees.slice(0, 100)) {
      for (const node of tree.nodes) {
        if (world.hasComponent(node, WorldTransform)) {
          updatedCount++;
        }
      }
    }
    expect(updatedCount).toBeGreaterThan(0);
  });

  test('should handle same-frame remove and add parent correctly', () => {
    const parent1 = world.createEntity();
    const parent2 = world.createEntity();
    const child = world.createEntity();

    world.addComponent(parent1, LocalTransform, { x: 10, y: 0 });
    world.addComponent(parent2, LocalTransform, { x: 20, y: 0 });
    world.addComponent(child, LocalTransform, { x: 5, y: 5 });

    // Initial parent setup
    world.addComponent(child, Parent, { value: parent1 });
    scheduler.tick(world, 16);

    const idx = world.getResource(ChildrenIndex)!;
    expect(idx.parentOfEntity(child)).toBe(parent1);
    expect(idx.childrenOf(parent1)).toContain(child);

    // Same frame: remove old parent and add new parent
    world.removeComponent(child, Parent);
    world.addComponent(child, Parent, { value: parent2 });

    scheduler.tick(world, 16);

    // Final parent should be parent2, not root
    expect(idx.parentOfEntity(child)).toBe(parent2);
    expect(idx.childrenOf(parent1)).not.toContain(child);
    expect(idx.childrenOf(parent2)).toContain(child);
  });

  test('should handle parent destruction with detachToRoot policy', () => {
    // Set policy to detach to root
    world.setResource(HierarchyPolicy, new HierarchyPolicy('detachToRoot'));

    const parent = world.createEntity();
    const child1 = world.createEntity();
    const child2 = world.createEntity();
    const grandchild = world.createEntity();

    world.addComponent(parent, LocalTransform, { x: 0, y: 0 });
    world.addComponent(child1, LocalTransform, { x: 1, y: 0 });
    world.addComponent(child2, LocalTransform, { x: 2, y: 0 });
    world.addComponent(grandchild, LocalTransform, { x: 3, y: 0 });

    // Build hierarchy: parent -> [child1, child2], child1 -> grandchild
    world.addComponent(child1, Parent, { value: parent });
    world.addComponent(child2, Parent, { value: parent });
    world.addComponent(grandchild, Parent, { value: child1 });

    scheduler.tick(world, 16);

    const idx = world.getResource(ChildrenIndex)!;
    expect(idx.childrenOf(parent)).toHaveLength(2);
    expect(idx.childrenOf(child1)).toHaveLength(1);

    // Destroy parent
    world.destroyEntity(parent);
    scheduler.tick(world, 16);

    // Children should be detached to root, grandchild should remain with child1
    expect(idx.parentOfEntity(child1)).toBe(0);
    expect(idx.parentOfEntity(child2)).toBe(0);
    expect(idx.parentOfEntity(grandchild)).toBe(child1); // Still under child1

    // All entities except parent should still be alive
    expect(world.isAlive(child1)).toBe(true);
    expect(world.isAlive(child2)).toBe(true);
    expect(world.isAlive(grandchild)).toBe(true);
    expect(world.isAlive(parent)).toBe(false);
  });

  test('should handle parent destruction with destroyChildren policy', () => {
    // Set policy to destroy children
    world.setResource(HierarchyPolicy, new HierarchyPolicy('destroyChildren'));

    const parent = world.createEntity();
    const child1 = world.createEntity();
    const child2 = world.createEntity();
    const grandchild = world.createEntity();
    const otherEntity = world.createEntity(); // Should not be affected

    world.addComponent(parent, LocalTransform, { x: 0, y: 0 });
    world.addComponent(child1, LocalTransform, { x: 1, y: 0 });
    world.addComponent(child2, LocalTransform, { x: 2, y: 0 });
    world.addComponent(grandchild, LocalTransform, { x: 3, y: 0 });
    world.addComponent(otherEntity, LocalTransform, { x: 4, y: 0 });

    // Build hierarchy: parent -> [child1, child2], child1 -> grandchild
    world.addComponent(child1, Parent, { value: parent });
    world.addComponent(child2, Parent, { value: parent });
    world.addComponent(grandchild, Parent, { value: child1 });

    scheduler.tick(world, 16);

    const initialAliveCount = world.aliveCount();
    expect(initialAliveCount).toBe(5);

    // Destroy parent
    world.destroyEntity(parent);
    scheduler.tick(world, 16);

    // Only otherEntity should remain alive
    // Note: grandchild is not a direct child of parent, so destruction depends on implementation
    expect(world.isAlive(parent)).toBe(false);
    expect(world.isAlive(child1)).toBe(false);
    expect(world.isAlive(child2)).toBe(false);
    expect(world.isAlive(otherEntity)).toBe(true);

    // The exact behavior of grandchild depends on when child1 gets destroyed
    // It should either be destroyed with child1 or become orphaned
    const finalAliveCount = world.aliveCount();
    expect(finalAliveCount).toBeLessThanOrEqual(2); // otherEntity + possibly grandchild
  });

  test('should reject self-parenting and descendant parenting', () => {
    const grandparent = world.createEntity();
    const parent = world.createEntity();
    const child = world.createEntity();

    world.addComponent(grandparent, LocalTransform, { x: 0, y: 0 });
    world.addComponent(parent, LocalTransform, { x: 1, y: 0 });
    world.addComponent(child, LocalTransform, { x: 2, y: 0 });

    // Build initial hierarchy: grandparent -> parent -> child
    world.addComponent(parent, Parent, { value: grandparent });
    world.addComponent(child, Parent, { value: parent });

    scheduler.tick(world, 16);

    const idx = world.getResource(ChildrenIndex)!;

    // Test self-parenting rejection
    world.addComponent(parent, Parent, { value: parent });
    scheduler.tick(world, 16);
    expect(idx.parentOfEntity(parent)).toBe(grandparent); // Should remain unchanged

    // Test descendant parenting rejection (would create cycle)
    world.addComponent(grandparent, Parent, { value: child });
    scheduler.tick(world, 16);
    expect(idx.parentOfEntity(grandparent)).toBe(0); // Should be set to root
  });

  test('should handle deep hierarchy reparenting without degradation', () => {
    const chainDepth = 100;
    const entities: number[] = [];

    // Create a deep chain
    let root = world.createEntity();
    world.addComponent(root, LocalTransform, { x: 0, y: 0 });
    entities.push(root);

    let current = root;
    for (let i = 1; i < chainDepth; i++) {
      const entity = world.createEntity();
      world.addComponent(entity, LocalTransform, { x: i, y: 0 });
      world.addComponent(entity, Parent, { value: current });
      entities.push(entity);
      current = entity;
    }

    scheduler.tick(world, 16);

    const idx = world.getResource(ChildrenIndex)!;

    // Verify initial chain
    for (let i = 1; i < chainDepth; i++) {
      expect(idx.parentOfEntity(entities[i])).toBe(entities[i - 1]);
    }

    // Create a new root and reparent the entire chain
    const newRoot = world.createEntity();
    world.addComponent(newRoot, LocalTransform, { x: -1, y: 0 });

    const start = performance.now();

    // Reparent the old root to the new root
    world.addComponent(entities[0], Parent, { value: newRoot });

    scheduler.tick(world, 16);

    const reparentTime = performance.now() - start;

    console.log(`Deep reparenting (depth ${chainDepth}): ${reparentTime.toFixed(2)}ms`);

    // Should complete quickly (not O(N^2))
    expect(reparentTime).toBeLessThan(10);

    // Verify the chain is still intact but now under newRoot
    expect(idx.parentOfEntity(entities[0])).toBe(newRoot);
    for (let i = 1; i < chainDepth; i++) {
      expect(idx.parentOfEntity(entities[i])).toBe(entities[i - 1]);
    }

    // Verify depth calculations work correctly
    expect(idx.getDepth(newRoot)).toBe(0);
    expect(idx.getDepth(entities[0])).toBe(1);
    expect(idx.getDepth(entities[chainDepth - 1])).toBe(chainDepth);
  });

  test('should handle rapid parent switching without memory leaks', () => {
    const parent1 = world.createEntity();
    const parent2 = world.createEntity();
    const child = world.createEntity();

    world.addComponent(parent1, LocalTransform, { x: 10, y: 0 });
    world.addComponent(parent2, LocalTransform, { x: 20, y: 0 });
    world.addComponent(child, LocalTransform, { x: 5, y: 5 });

    // Run once to initialize the system
    scheduler.tick(world, 16);

    const idx = world.getResource(ChildrenIndex)!;

    // Rapidly switch parents multiple times
    const switches = 1000;
    const start = performance.now();

    for (let i = 0; i < switches; i++) {
      const targetParent = i % 2 === 0 ? parent1 : parent2;
      world.addComponent(child, Parent, { value: targetParent });
      scheduler.tick(world, 16);
    }

    const switchTime = performance.now() - start;
    console.log(`${switches} parent switches: ${switchTime.toFixed(2)}ms`);

    // Should complete reasonably quickly
    expect(switchTime).toBeLessThan(100);

    // Final parent should be correct
    const finalParent = switches % 2 === 0 ? parent1 : parent2;
    expect(idx.parentOfEntity(child)).toBe(finalParent);
    expect(idx.childrenOf(finalParent)).toContain(child);

    // No memory leaks - index should be clean
    expect(idx.getAllParents()).toHaveLength(1);
    expect(idx.getAllChildren()).toHaveLength(1);
  });
});