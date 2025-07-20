import { World, Entity, Component, System } from '../src';

// Define components
class PositionComponent extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

class VelocityComponent extends Component {
  constructor(public dx: number = 0, public dy: number = 0) {
    super();
  }
}

class HealthComponent extends Component {
  constructor(public health: number = 100, public maxHealth: number = 100) {
    super();
  }
}

// Define systems
class MovementSystem extends System {
  constructor() {
    super([PositionComponent, VelocityComponent]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent(PositionComponent)!;
      const velocity = entity.getComponent(VelocityComponent)!;
      
      position.x += velocity.dx * deltaTime;
      position.y += velocity.dy * deltaTime;
    }
  }
}

class HealthSystem extends System {
  constructor() {
    super([HealthComponent]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent)!;
      
      // Remove entities with no health
      if (health.health <= 0) {
        entity.active = false;
      }
    }
  }
}

// Create world and add systems
const world = new World();
world.addSystem(new MovementSystem());
world.addSystem(new HealthSystem());

// Create player entity
const player = world.createEntity()
  .addComponent(new PositionComponent(100, 100))
  .addComponent(new VelocityComponent(5, 0))
  .addComponent(new HealthComponent(100, 100));

// Create enemy entity
const enemy = world.createEntity()
  .addComponent(new PositionComponent(200, 150))
  .addComponent(new VelocityComponent(-2, 1))
  .addComponent(new HealthComponent(50, 50));

// Game loop simulation
function gameLoop(): void {
  const deltaTime = 1/60; // 60 FPS
  
  // Update world
  world.update(deltaTime);
  
  // Print positions
  const entities = world.queryEntities(PositionComponent);
  entities.forEach((entity, index) => {
    const pos = entity.getComponent(PositionComponent)!;
    console.log(`Entity ${index}: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}`);
  });
}

// Run simulation for a few frames
console.log('=== NovaECS Basic Example ===');
for (let i = 0; i < 5; i++) {
  console.log(`\nFrame ${i + 1}:`);
  gameLoop();
}