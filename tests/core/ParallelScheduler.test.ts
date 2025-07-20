import { ParallelScheduler } from '../../src/core/ParallelScheduler';
import { System } from '../../src/core/System';
import { Component } from '../../src/core/Component';
import { Entity } from '../../src/core/Entity';
import { AccessType } from '../../src/utils/AccessType';
import { describe, beforeEach, test, expect } from 'vitest';

class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }
}

class AnotherComponent extends Component {
  constructor(public name: string = '') {
    super();
  }
}

class ReadOnlySystem extends System {
  constructor() {
    super([TestComponent], [
      { componentType: TestComponent as any, accessType: AccessType.Read }
    ]);
  }

  update(_entities: Entity[], _deltaTime: number): void {
    // Test implementation
  }
}

class WriteSystem extends System {
  constructor() {
    super([TestComponent], [
      { componentType: TestComponent as any, accessType: AccessType.Write }
    ]);
  }

  update(_entities: Entity[], _deltaTime: number): void {
    // Test implementation
  }
}

class ReadWriteSystem extends System {
  constructor() {
    super([TestComponent], [
      { componentType: TestComponent as any, accessType: AccessType.ReadWrite }
    ]);
  }

  update(_entities: Entity[], _deltaTime: number): void {
    // Test implementation
  }
}

class NoAccessSystem extends System {
  constructor() {
    super([AnotherComponent]);
  }

  update(_entities: Entity[], _deltaTime: number): void {
    // Test implementation
  }
}



describe('ParallelScheduler', () => {
  let scheduler: ParallelScheduler;

  beforeEach(() => {
    scheduler = new ParallelScheduler();
  });

  test('should initialize with empty execution groups', () => {
    expect(scheduler.getExecutionGroups()).toEqual([]);
  });

  test('should add single system', () => {
    const system = new ReadOnlySystem();
    scheduler.addSystem(system);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(system);
    expect(groups[0].level).toBe(0);
  });

  test('should add multiple non-conflicting systems to same group', () => {
    const system1 = new ReadOnlySystem();
    const system2 = new ReadOnlySystem();
    
    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(system1);
    expect(groups[0].systems).toContain(system2);
  });

  test('should separate conflicting systems into different groups', () => {
    const readSystem = new ReadOnlySystem();
    const writeSystem = new WriteSystem();
    
    scheduler.addSystem(readSystem);
    scheduler.addSystem(writeSystem);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should handle read-write conflicts', () => {
    const readSystem = new ReadOnlySystem();
    const readWriteSystem = new ReadWriteSystem();
    
    scheduler.addSystem(readSystem);
    scheduler.addSystem(readWriteSystem);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should handle write-write conflicts', () => {
    const writeSystem1 = new WriteSystem();
    const writeSystem2 = new WriteSystem();
    
    scheduler.addSystem(writeSystem1);
    scheduler.addSystem(writeSystem2);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should respect system priorities in conflict resolution', () => {
    class HighPriorityWriteSystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 10;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class LowPriorityWriteSystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 1;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const highPrioritySystem = new HighPriorityWriteSystem();
    const lowPrioritySystem = new LowPriorityWriteSystem();

    scheduler.addSystem(lowPrioritySystem);
    scheduler.addSystem(highPrioritySystem);

    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);

    // High priority system should be in earlier group (lower level)
    const highPriorityGroup = groups.find(g => g.systems.includes(highPrioritySystem));
    const lowPriorityGroup = groups.find(g => g.systems.includes(lowPrioritySystem));

    expect(highPriorityGroup!.level).toBeLessThan(lowPriorityGroup!.level);
  });

  test('should handle same priority systems deterministically', () => {
    class SamePriorityWriteSystem1 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 0;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class SamePriorityWriteSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 0;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const system1 = new SamePriorityWriteSystem1();
    const system2 = new SamePriorityWriteSystem2();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);

    // Should be deterministic based on order added
    const system1Group = groups.find(g => g.systems.includes(system1));
    const system2Group = groups.find(g => g.systems.includes(system2));

    expect(system1Group!.level).toBeLessThan(system2Group!.level);
  });

  test('should remove system correctly', () => {
    const system1 = new ReadOnlySystem();
    const system2 = new WriteSystem();
    
    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    
    let groups = scheduler.getExecutionGroups();

    scheduler.removeSystem(system1);
    
    groups = scheduler.getExecutionGroups();
    expect(groups.every(g => !g.systems.includes(system1))).toBe(true);
    expect(groups.some(g => g.systems.includes(system2))).toBe(true);
  });

  test('should handle removing non-existent system', () => {
    const system1 = new ReadOnlySystem();
    const system2 = new WriteSystem();
    
    scheduler.addSystem(system1);
    
    // Try to remove system that was never added
    scheduler.removeSystem(system2);
    
    const groups = scheduler.getExecutionGroups();
    expect(groups.some(g => g.systems.includes(system1))).toBe(true);
  });

  test('should use default access type when componentAccess is not defined', () => {
    const system1 = new NoAccessSystem();
    const system2 = new NoAccessSystem();
    
    // These systems don't define componentAccess, should default to ReadWrite
    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    
    const groups = scheduler.getExecutionGroups();
    // Since both access AnotherComponent with default ReadWrite, they should conflict
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should handle systems with no component access conflicts', () => {
    const testSystem = new ReadOnlySystem();
    const anotherSystem = new NoAccessSystem();
    
    scheduler.addSystem(testSystem);
    scheduler.addSystem(anotherSystem);
    
    const groups = scheduler.getExecutionGroups();
    // These systems access different components, so they can run in parallel
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(testSystem);
    expect(groups[0].systems).toContain(anotherSystem);
  });

  test('should handle empty componentAccess array', () => {
    class EmptyAccessSystem extends System {
      constructor() {
        super([TestComponent], []); // Empty componentAccess array
      }

      update(_entities: Entity[], _deltaTime: number): void {
        // Test implementation
      }
    }

    const system = new EmptyAccessSystem();
    scheduler.addSystem(system);

    const groups = scheduler.getExecutionGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(system);
  });

  test('should handle complex dependency chains', () => {
    class HighPriorityWriteSystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 30;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class MediumPriorityWriteSystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 20;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class LowPriorityWriteSystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 10;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const system1 = new HighPriorityWriteSystem();
    const system2 = new MediumPriorityWriteSystem();
    const system3 = new LowPriorityWriteSystem();

    scheduler.addSystem(system3);
    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBe(3);

    // Verify execution order by priority
    const system1Group = groups.find(g => g.systems.includes(system1));
    const system2Group = groups.find(g => g.systems.includes(system2));
    const system3Group = groups.find(g => g.systems.includes(system3));

    expect(system1Group!.level).toBeLessThan(system2Group!.level);
    expect(system2Group!.level).toBeLessThan(system3Group!.level);
  });

  test('should handle multiple component access types', () => {
    class MultiAccessSystem extends System {
      constructor() {
        super([TestComponent, AnotherComponent], [
          { componentType: TestComponent as any, accessType: AccessType.Read },
          { componentType: AnotherComponent as any, accessType: AccessType.Write }
        ]);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        // Test implementation
      }
    }

    const system1 = new MultiAccessSystem();
    const system2 = new WriteSystem(); // Writes to TestComponent

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    const groups = scheduler.getExecutionGroups();
    // Should conflict because system2 writes to TestComponent while system1 reads it
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should rebuild dependency graph when systems are added/removed', () => {
    const system1 = new WriteSystem();
    const system2 = new WriteSystem();
    const system3 = new NoAccessSystem(); // Uses AnotherComponent, no conflict

    // Add conflicting systems
    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    let groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);

    // Remove one conflicting system
    scheduler.removeSystem(system2);

    // Add non-conflicting system
    scheduler.addSystem(system3);

    groups = scheduler.getExecutionGroups();
    // Now system1 and system3 should be able to run in parallel since they access different components
    expect(groups.some(g => g.systems.includes(system1) && g.systems.includes(system3))).toBe(true);
  });

  test('should handle systems with undefined componentAccess', () => {
    class UndefinedAccessSystem extends System {
      constructor() {
        super([TestComponent]);
        // componentAccess is undefined
      }

      update(_entities: Entity[], _deltaTime: number): void {
        // Test implementation
      }
    }

    const system1 = new UndefinedAccessSystem();
    const system2 = new UndefinedAccessSystem();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    const groups = scheduler.getExecutionGroups();
    // Should conflict because both default to ReadWrite access
    expect(groups.length).toBeGreaterThan(1);
  });

  test('should sort execution groups by level', () => {
    class HighPriorityWriteSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 30;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class MediumPriorityWriteSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 20;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class LowPriorityWriteSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 10;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const system1 = new HighPriorityWriteSystem2();
    const system2 = new LowPriorityWriteSystem2();
    const system3 = new MediumPriorityWriteSystem2();

    scheduler.addSystem(system2);
    scheduler.addSystem(system3);
    scheduler.addSystem(system1);

    const groups = scheduler.getExecutionGroups();

    // Groups should be sorted by level (ascending)
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i].level).toBeGreaterThanOrEqual(groups[i - 1].level);
    }
  });

  test('should handle circular dependency detection', () => {
    // This test ensures the circular dependency detection works
    // In practice, circular dependencies are prevented by the priority-based ordering
    const system1 = new WriteSystem();
    const system2 = new WriteSystem();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    // Should not throw error even with potential circular dependencies
    expect(() => scheduler.getExecutionGroups()).not.toThrow();
  });

  test('should handle systems with no dependencies', () => {
    const system1 = new ReadOnlySystem();
    const system2 = new NoAccessSystem(); // Different component

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);

    const groups = scheduler.getExecutionGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toHaveLength(2);
  });

  test('should handle level calculation edge cases', () => {
    // Test with systems that have complex dependency chains
    class ChainSystem1 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 100;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class ChainSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 50;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class ChainSystem3 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 25;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const system1 = new ChainSystem1();
    const system2 = new ChainSystem2();
    const system3 = new ChainSystem3();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    scheduler.addSystem(system3);

    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBe(3);

    // Verify proper level assignment
    const levels = groups.map(g => g.level).sort((a, b) => a - b);
    expect(levels).toEqual([0, 1, 2]);
  });

  test('should handle removal of systems with dependencies', () => {
    const system1 = new WriteSystem();
    const system2 = new WriteSystem();
    const system3 = new ReadOnlySystem();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    scheduler.addSystem(system3);

    let groups = scheduler.getExecutionGroups();

    // Remove a system that has dependencies
    scheduler.removeSystem(system1);

    groups = scheduler.getExecutionGroups();
    expect(groups.every(g => !g.systems.includes(system1))).toBe(true);

    // Should rebuild the dependency graph
    expect(groups.some(g => g.systems.includes(system2))).toBe(true);
    expect(groups.some(g => g.systems.includes(system3))).toBe(true);
  });

  test('should handle system priority edge cases', () => {
    class HigherPrioritySystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 20;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class LowerPrioritySystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 10;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const higherSystem = new HigherPrioritySystem();
    const lowerSystem = new LowerPrioritySystem();

    // Add in reverse order to test priority handling
    scheduler.addSystem(lowerSystem);
    scheduler.addSystem(higherSystem);

    const groups = scheduler.getExecutionGroups();
    expect(groups.length).toBeGreaterThan(1);

    // Higher priority system should be in earlier group
    const higherGroup = groups.find(g => g.systems.includes(higherSystem));
    const lowerGroup = groups.find(g => g.systems.includes(lowerSystem));

    expect(higherGroup!.level).toBeLessThan(lowerGroup!.level);
  });

  test('should handle systems with explicit component access', () => {
    class ExplicitAccessSystem extends System {
      constructor() {
        super([TestComponent], [
          { componentType: TestComponent as any, accessType: AccessType.Read }
        ]);
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const explicitSystem = new ExplicitAccessSystem();
    const readSystem = new ReadOnlySystem();

    scheduler.addSystem(explicitSystem);
    scheduler.addSystem(readSystem);

    const groups = scheduler.getExecutionGroups();
    // Both systems only read, so they should be in the same group
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(explicitSystem);
    expect(groups[0].systems).toContain(readSystem);
  });

  test('should handle systems with no access conflicts', () => {
    class ComponentASystem extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Read }]);
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class ComponentBSystem extends System {
      constructor() {
        super([AnotherComponent], [{ componentType: AnotherComponent as any, accessType: AccessType.Write }]);
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const systemA = new ComponentASystem();
    const systemB = new ComponentBSystem();

    scheduler.addSystem(systemA);
    scheduler.addSystem(systemB);

    const groups = scheduler.getExecutionGroups();
    // No conflicts, should be in same group
    expect(groups).toHaveLength(1);
    expect(groups[0].systems).toContain(systemA);
    expect(groups[0].systems).toContain(systemB);
  });

  test('should handle dependency cleanup when removing systems', () => {
    class DependentSystem1 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 30;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class DependentSystem2 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 20;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class DependentSystem3 extends System {
      constructor() {
        super([TestComponent], [{ componentType: TestComponent as any, accessType: AccessType.Write }]);
        this.priority = 10;
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    const system1 = new DependentSystem1();
    const system2 = new DependentSystem2();
    const system3 = new DependentSystem3();

    scheduler.addSystem(system1);
    scheduler.addSystem(system2);
    scheduler.addSystem(system3);

    // Remove middle system to test dependency cleanup
    scheduler.removeSystem(system2);

    const groups = scheduler.getExecutionGroups();
    expect(groups.every(g => !g.systems.includes(system2))).toBe(true);
    expect(groups.some(g => g.systems.includes(system1))).toBe(true);
    expect(groups.some(g => g.systems.includes(system3))).toBe(true);
  });
});
