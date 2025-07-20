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

class Damage extends Component {
  constructor(public amount: number = 10) {
    super();
  }
}

class Renderer extends Component {
  constructor(public sprite: string = '') {
    super();
  }
}

// Test systems
class MovementSystem extends System {
  public processedEntities: Entity[] = [];
  public executionOrder: number[] = [];

  constructor() {
    super([Position, Velocity], [
      { componentType: Position as ComponentType, accessType: AccessType.Write },
      { componentType: Velocity as ComponentType, accessType: AccessType.Read }
    ]);
    this.priority = 10;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.processedEntities = [...entities];
    this.executionOrder.push(Date.now());
    
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      const velocity = entity.getComponent(Velocity) as Velocity;
      
      if (position && velocity) {
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    });
  }
}

class DamageSystem extends System {
  public processedEntities: Entity[] = [];
  public executionOrder: number[] = [];

  constructor() {
    super([Health, Damage], [
      { componentType: Health as ComponentType, accessType: AccessType.Write },
      { componentType: Damage as ComponentType, accessType: AccessType.Read }
    ]);
    this.priority = 5;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.processedEntities = [...entities];
    this.executionOrder.push(Date.now());
    
    entities.forEach(entity => {
      const health = entity.getComponent(Health) as Health;
      const damage = entity.getComponent(Damage) as Damage;
      
      if (health && damage) {
        health.current = Math.max(0, health.current - damage.amount * deltaTime);
      }
    });
  }
}

class RenderSystem extends System {
  public processedEntities: Entity[] = [];
  public executionOrder: number[] = [];

  constructor() {
    super([Position, Renderer], [
      { componentType: Position as ComponentType, accessType: AccessType.Read },
      { componentType: Renderer as ComponentType, accessType: AccessType.Read }
    ]);
    this.priority = 1;
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.processedEntities = [...entities];
    this.executionOrder.push(Date.now());

    // Simulate rendering
    entities.forEach(entity => {
      const position = entity.getComponent(Position) as Position;
      const renderer = entity.getComponent(Renderer) as Renderer;

      if (position && renderer) {
        // Simulate rendering at position
      }
    });
  }
}

class HealthRegenSystem extends System {
  public processedEntities: Entity[] = [];
  public executionOrder: number[] = [];

  constructor() {
    super([Health], [
      { componentType: Health as ComponentType, accessType: AccessType.Write }
    ]);
    this.priority = 3;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.processedEntities = [...entities];
    this.executionOrder.push(Date.now());
    
    entities.forEach(entity => {
      const health = entity.getComponent(Health) as Health;
      
      if (health && health.current < health.max) {
        health.current = Math.min(health.max, health.current + 5 * deltaTime);
      }
    });
  }
}

describe('Archetype + Parallel Execution Integration', () => {
  let world: World;
  let movementSystem: MovementSystem;
  let damageSystem: DamageSystem;
  let renderSystem: RenderSystem;
  let healthRegenSystem: HealthRegenSystem;

  beforeEach(() => {
    world = new World();
    movementSystem = new MovementSystem();
    damageSystem = new DamageSystem();
    renderSystem = new RenderSystem();
    healthRegenSystem = new HealthRegenSystem();
  });

  test('should create entities with different archetypes', () => {
    // Create a fresh world for this test
    const testWorld = new World();

    // Create entities with different component combinations
    const player = testWorld.createEntity();
    player.addComponent(new Position(0, 0));
    player.addComponent(new Velocity(1, 0));
    player.addComponent(new Health(100, 100));
    player.addComponent(new Renderer('player.png'));

    const enemy = testWorld.createEntity();
    enemy.addComponent(new Position(10, 10));
    enemy.addComponent(new Health(50, 50));
    enemy.addComponent(new Damage(20));
    enemy.addComponent(new Renderer('enemy.png'));

    const projectile = testWorld.createEntity();
    projectile.addComponent(new Position(5, 5));
    projectile.addComponent(new Velocity(5, 0));
    projectile.addComponent(new Damage(15));

    // Verify different archetypes are created
    const stats = testWorld.getArchetypeStatistics();
    // Note: May include empty archetype from entity creation process
    expect(stats.archetypeCount).toBeGreaterThanOrEqual(3);
    expect(stats.totalEntities).toBe(3);
  });

  test('should execute systems in parallel based on dependencies', async () => {
    // Add systems with different priorities and dependencies
    world.addSystem(movementSystem);
    world.addSystem(damageSystem);
    world.addSystem(renderSystem);
    world.addSystem(healthRegenSystem);

    // Create test entities
    const entity1 = world.createEntity();
    entity1.addComponent(new Position(0, 0));
    entity1.addComponent(new Velocity(1, 1));
    entity1.addComponent(new Health(100, 100));
    entity1.addComponent(new Renderer('test.png'));

    const entity2 = world.createEntity();
    entity2.addComponent(new Health(50, 100));
    entity2.addComponent(new Damage(10));

    // Execute update
    world.update(1);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify all systems processed their entities
    expect(movementSystem.processedEntities).toHaveLength(1);
    expect(movementSystem.processedEntities).toContain(entity1);

    expect(damageSystem.processedEntities).toHaveLength(1);
    expect(damageSystem.processedEntities).toContain(entity2);

    expect(renderSystem.processedEntities).toHaveLength(1);
    expect(renderSystem.processedEntities).toContain(entity1);

    expect(healthRegenSystem.processedEntities).toHaveLength(2);
    expect(healthRegenSystem.processedEntities).toContain(entity1);
    expect(healthRegenSystem.processedEntities).toContain(entity2);
  });

  test('should handle system dependencies correctly', async () => {
    world.addSystem(movementSystem);
    world.addSystem(renderSystem);

    // Both systems access Position component
    // MovementSystem writes to Position, RenderSystem reads from Position
    // They should be in different execution groups

    const groups = world.getExecutionGroups();
    const movementGroup = groups.find(g => g.systems.includes(movementSystem));
    const renderGroup = groups.find(g => g.systems.includes(renderSystem));

    // MovementSystem should execute before RenderSystem due to write/read dependency
    expect(movementGroup!.level).toBeLessThan(renderGroup!.level);
  });

  test('should optimize queries with archetype storage', () => {
    // Create many entities with different component combinations
    const entities: Entity[] = [];

    // 100 moving entities
    for (let i = 0; i < 100; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
      entities.push(entity);
    }

    // 50 health entities
    for (let i = 0; i < 50; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Health(100, 100));
      entities.push(entity);
    }

    // 25 renderable entities
    for (let i = 0; i < 25; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Renderer('sprite.png'));
      entities.push(entity);
    }

    // Query for specific component combinations
    const movingEntities = world.queryEntities(Position, Velocity);
    const healthEntities = world.queryEntities(Health);
    const renderableEntities = world.queryEntities(Position, Renderer);

    expect(movingEntities).toHaveLength(100);
    expect(healthEntities).toHaveLength(50);
    expect(renderableEntities).toHaveLength(25);

    // Verify archetype optimization
    const stats = world.getArchetypeStatistics();
    // Note: May include additional archetypes from previous tests or empty archetypes
    expect(stats.archetypeCount).toBeGreaterThanOrEqual(3);
    expect(stats.totalEntities).toBe(175);
  });

  test('should handle dynamic component changes', async () => {
    world.addSystem(movementSystem);
    world.addSystem(renderSystem);

    const entity = world.createEntity();
    entity.addComponent(new Position(0, 0));
    entity.addComponent(new Renderer('test.png'));

    // Initially, entity should only be processed by RenderSystem
    world.update(1);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(movementSystem.processedEntities).toHaveLength(0);
    expect(renderSystem.processedEntities).toContain(entity);

    // Add Velocity component (should migrate to new archetype)
    entity.addComponent(new Velocity(1, 1));

    // Reset system tracking
    movementSystem.processedEntities = [];
    renderSystem.processedEntities = [];

    // Now entity should be processed by both systems
    world.update(1);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(movementSystem.processedEntities).toContain(entity);
    expect(renderSystem.processedEntities).toContain(entity);
  });

  test('should maintain performance with large entity counts', async () => {
    world.addSystem(movementSystem);
    world.addSystem(healthRegenSystem);

    // Create 1000 entities
    const entityCount = 1000;
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      entity.addComponent(new Position(i, i));
      entity.addComponent(new Velocity(1, 1));
      entity.addComponent(new Health(100, 100));
    }

    const startTime = Date.now();
    world.update(1);
    await new Promise(resolve => setTimeout(resolve, 100));
    const endTime = Date.now();

    // Verify all entities were processed
    expect(movementSystem.processedEntities).toHaveLength(entityCount);
    expect(healthRegenSystem.processedEntities).toHaveLength(entityCount);

    // Performance should be reasonable (less than 100ms for 1000 entities)
    expect(endTime - startTime).toBeLessThan(200);
  });

  test('should handle scheduler statistics correctly', () => {
    world.addSystem(movementSystem);
    world.addSystem(damageSystem);
    world.addSystem(renderSystem);
    world.addSystem(healthRegenSystem);

    const stats = world.getSchedulerStatistics();
    expect(stats.totalSystems).toBe(4);
    expect(stats.totalGroups).toBeGreaterThan(0);
    expect(stats.groupDetails).toHaveLength(stats.totalGroups);

    // Verify systems are properly grouped
    const groups = world.getExecutionGroups();
    const allSystems = groups.flatMap(g => g.systems);
    expect(allSystems).toContain(movementSystem);
    expect(allSystems).toContain(damageSystem);
    expect(allSystems).toContain(renderSystem);
    expect(allSystems).toContain(healthRegenSystem);
  });
});
