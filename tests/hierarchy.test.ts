/**
 * Tests for hierarchy system
 * 层级系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { ChildrenIndex, HierarchyPolicy, HierarchySyncSystem } from '../src/hierarchy';
import { Parent, LocalTransform } from '../src/components/Transform';

describe('Hierarchy System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    registerComponent(Parent);
    registerComponent(LocalTransform);
  });

  describe('ChildrenIndex', () => {
    let index: ChildrenIndex;

    beforeEach(() => {
      index = new ChildrenIndex();
    });

    test('should link parent-child relationships', () => {
      const parent = 1;
      const child = 2;

      index.link(child, parent);

      expect(index.childrenOf(parent)).toContain(child);
      expect(index.parentOfEntity(child)).toBe(parent);
    });

    test('should handle multiple children for one parent', () => {
      const parent = 1;
      const child1 = 2;
      const child2 = 3;
      const child3 = 4;

      index.link(child1, parent);
      index.link(child2, parent);
      index.link(child3, parent);

      const children = index.childrenOf(parent);
      expect(children).toHaveLength(3);
      expect(children).toContain(child1);
      expect(children).toContain(child2);
      expect(children).toContain(child3);

      expect(index.parentOfEntity(child1)).toBe(parent);
      expect(index.parentOfEntity(child2)).toBe(parent);
      expect(index.parentOfEntity(child3)).toBe(parent);
    });

    test('should handle reparenting', () => {
      const oldParent = 1;
      const newParent = 2;
      const child = 3;

      // Initial link
      index.link(child, oldParent);
      expect(index.childrenOf(oldParent)).toContain(child);
      expect(index.parentOfEntity(child)).toBe(oldParent);

      // Reparent
      index.link(child, newParent);
      expect(index.childrenOf(oldParent)).not.toContain(child);
      expect(index.childrenOf(newParent)).toContain(child);
      expect(index.parentOfEntity(child)).toBe(newParent);
    });

    test('should handle orphaning (parent = 0)', () => {
      const parent = 1;
      const child = 2;

      index.link(child, parent);
      expect(index.parentOfEntity(child)).toBe(parent);

      index.link(child, 0);
      expect(index.parentOfEntity(child)).toBe(0);
      expect(index.childrenOf(parent)).not.toContain(child);
    });

    test('should detect cycles', () => {
      const parent = 1;
      const child = 2;
      const grandchild = 3;

      index.link(child, parent);
      index.link(grandchild, child);

      // Try to make parent a child of grandchild (cycle)
      expect(index.wouldCreateCycle(parent, grandchild)).toBe(true);
      expect(index.wouldCreateCycle(parent, child)).toBe(true);
      expect(index.wouldCreateCycle(parent, parent)).toBe(true);

      // Valid relationships should not create cycles
      const newEntity = 4;
      expect(index.wouldCreateCycle(newEntity, parent)).toBe(false);
      expect(index.wouldCreateCycle(newEntity, child)).toBe(false);
    });

    test('should handle takeChildrenOf', () => {
      const parent = 1;
      const child1 = 2;
      const child2 = 3;

      index.link(child1, parent);
      index.link(child2, parent);

      const children = index.takeChildrenOf(parent);
      expect(children).toHaveLength(2);
      expect(children).toContain(child1);
      expect(children).toContain(child2);

      // After taking, parent should have no children and children should have no parent
      expect(index.childrenOf(parent)).toHaveLength(0);
      expect(index.parentOfEntity(child1)).toBe(0);
      expect(index.parentOfEntity(child2)).toBe(0);
    });

    test('should clear entity properly', () => {
      const parent = 1;
      const child1 = 2;
      const child2 = 3;
      const grandchild = 4;

      index.link(child1, parent);
      index.link(child2, parent);
      index.link(grandchild, child1);

      // Clear child1 (which has a child and a parent)
      index.clearEntity(child1);

      // child1 should be removed from parent's children
      expect(index.childrenOf(parent)).not.toContain(child1);
      expect(index.childrenOf(parent)).toContain(child2);

      // grandchild should be orphaned
      expect(index.parentOfEntity(grandchild)).toBe(0);

      // child1 should have no parent or children
      expect(index.parentOfEntity(child1)).toBe(0);
      expect(index.childrenOf(child1)).toHaveLength(0);
    });

    test('should get all parents and children', () => {
      const parent1 = 1;
      const parent2 = 2;
      const child1 = 3;
      const child2 = 4;
      const orphan = 5;

      index.link(child1, parent1);
      index.link(child2, parent2);
      // orphan has no parent

      const parents = index.getAllParents();
      expect(parents).toContain(parent1);
      expect(parents).toContain(parent2);
      expect(parents).not.toContain(orphan);

      const children = index.getAllChildren();
      expect(children).toContain(child1);
      expect(children).toContain(child2);
      expect(children).not.toContain(orphan);
    });

    test('should get root entities', () => {
      const root1 = 1;
      const root2 = 2;
      const child = 3;
      const grandchild = 4;

      index.link(child, root1);
      index.link(grandchild, child);
      // root2 has no parent - but we need to add it to the index somehow
      index.link(root2, 0); // Explicitly mark as root

      const roots = index.getRootEntities();
      expect(roots).toContain(root1);
      expect(roots).toContain(root2);
      expect(roots).not.toContain(child);
      expect(roots).not.toContain(grandchild);
    });

    test('should calculate depth correctly', () => {
      const root = 1;
      const child = 2;
      const grandchild = 3;
      const greatGrandchild = 4;

      index.link(child, root);
      index.link(grandchild, child);
      index.link(greatGrandchild, grandchild);

      expect(index.getDepth(root)).toBe(0);
      expect(index.getDepth(child)).toBe(1);
      expect(index.getDepth(grandchild)).toBe(2);
      expect(index.getDepth(greatGrandchild)).toBe(3);
    });

    test('should get descendants recursively', () => {
      const root = 1;
      const child1 = 2;
      const child2 = 3;
      const grandchild1 = 4;
      const grandchild2 = 5;

      index.link(child1, root);
      index.link(child2, root);
      index.link(grandchild1, child1);
      index.link(grandchild2, child2);

      const descendants = index.getDescendants(root);
      expect(descendants).toHaveLength(4);
      expect(descendants).toContain(child1);
      expect(descendants).toContain(child2);
      expect(descendants).toContain(grandchild1);
      expect(descendants).toContain(grandchild2);
    });

    test('should get ancestors', () => {
      const root = 1;
      const child = 2;
      const grandchild = 3;
      const greatGrandchild = 4;

      index.link(child, root);
      index.link(grandchild, child);
      index.link(greatGrandchild, grandchild);

      const ancestors = index.getAncestors(greatGrandchild);
      expect(ancestors).toEqual([grandchild, child, root]);

      const childAncestors = index.getAncestors(child);
      expect(childAncestors).toEqual([root]);

      const rootAncestors = index.getAncestors(root);
      expect(rootAncestors).toHaveLength(0);
    });

    test('should handle size and clear', () => {
      const parent = 1;
      const child1 = 2;
      const child2 = 3;

      expect(index.size()).toBe(0);

      index.link(child1, parent);
      index.link(child2, parent);
      expect(index.size()).toBe(2);

      index.clear();
      expect(index.size()).toBe(0);
      expect(index.childrenOf(parent)).toHaveLength(0);
      expect(index.parentOfEntity(child1)).toBe(0);
    });
  });

  describe('HierarchyPolicy', () => {
    test('should have default policy', () => {
      const policy = new HierarchyPolicy();
      expect(policy.onParentDestroyed).toBe('detachToRoot');
    });

    test('should accept custom policy', () => {
      const policy = new HierarchyPolicy('destroyChildren');
      expect(policy.onParentDestroyed).toBe('destroyChildren');
    });
  });

  describe('HierarchySyncSystem Integration', () => {
    beforeEach(() => {
      // Add the system to scheduler for integration tests
      // Note: In real usage, you'd add this to your main scheduler
    });

    test('should create resources when system runs', () => {
      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      const index = world.getResource(ChildrenIndex as any);
      const policy = world.getResource(HierarchyPolicy as any);

      expect(index).toBeInstanceOf(ChildrenIndex);
      expect(policy).toBeInstanceOf(HierarchyPolicy);
    });

    test('should create and maintain ChildrenIndex resource', () => {
      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      const index = world.getResource(ChildrenIndex as any);
      const policy = world.getResource(HierarchyPolicy as any);

      expect(index).toBeInstanceOf(ChildrenIndex);
      expect(policy).toBeInstanceOf(HierarchyPolicy);

      // Test that the resources work with basic operations
      expect((index as ChildrenIndex).size()).toBe(0);
      expect(policy.onParentDestroyed).toBe('detachToRoot');
    });

    test('should handle self-parenting edge case', () => {
      const entity = world.createEntity();
      world.addComponent(entity, LocalTransform, { x: 0, y: 0 });

      // Attempt self-parenting - should be rejected and set to root
      world.addComponent(entity, Parent, { value: entity });

      // Run the system
      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      const index = world.getResource(ChildrenIndex as any) as ChildrenIndex;
      expect(index.parentOfEntity(entity)).toBe(0); // Should be root
      expect(index.childrenOf(entity)).toHaveLength(0); // Should have no children
    });

    test('should handle invalid parent entity', () => {
      const child = world.createEntity();
      const invalidParent = 999; // Non-existent entity

      world.addComponent(child, LocalTransform, { x: 0, y: 0 });
      world.addComponent(child, Parent, { value: invalidParent });

      // Run the system
      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      const index = world.getResource(ChildrenIndex as any) as ChildrenIndex;
      expect(index.parentOfEntity(child)).toBe(0); // Should be root
    });

    test('should handle dead parent entity', () => {
      const parent = world.createEntity();
      const child = world.createEntity();

      world.addComponent(parent, LocalTransform, { x: 0, y: 0 });
      world.addComponent(child, LocalTransform, { x: 0, y: 0 });
      world.addComponent(child, Parent, { value: parent });

      // First run - establish relationship
      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      let index = world.getResource(ChildrenIndex as any) as ChildrenIndex;
      expect(index.parentOfEntity(child)).toBe(parent);

      // Kill the parent
      world.destroyEntity(parent);

      // Second run - should detect dead parent and set child to root
      HierarchySyncSystem.fn(ctx);

      index = world.getResource(ChildrenIndex as any) as ChildrenIndex;
      expect(index.parentOfEntity(child)).toBe(0); // Should be root
    });

    test('should prevent cycle creation', () => {
      const grandParent = world.createEntity();
      const parent = world.createEntity();
      const child = world.createEntity();

      world.addComponent(grandParent, LocalTransform, { x: 0, y: 0 });
      world.addComponent(parent, LocalTransform, { x: 0, y: 0 });
      world.addComponent(child, LocalTransform, { x: 0, y: 0 });

      // Establish grandParent -> parent -> child
      world.addComponent(parent, Parent, { value: grandParent });
      world.addComponent(child, Parent, { value: parent });

      const ctx = { world };
      HierarchySyncSystem.fn(ctx);

      // Now try to make grandParent a child of child (would create cycle)
      world.addComponent(grandParent, Parent, { value: child });

      HierarchySyncSystem.fn(ctx);

      const index = world.getResource(ChildrenIndex as any) as ChildrenIndex;
      expect(index.parentOfEntity(grandParent)).toBe(0); // Should be root, not child
    });
  });
});