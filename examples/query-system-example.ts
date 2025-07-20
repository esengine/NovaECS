/**
 * NovaECS Enhanced Query System Example
 * 展示如何使用增强的查询系统进行复杂的实体查询
 */

import { 
  World, 
  Entity, 
  Component, 
  System 
} from '../src/index';

// 定义游戏组件
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
  constructor(public current: number = 100, public max: number = 100) {
    super();
  }
}

class PlayerComponent extends Component {
  constructor(public name: string = 'Player', public level: number = 1) {
    super();
  }
}

class EnemyComponent extends Component {
  constructor(public type: string = 'basic', public damage: number = 10) {
    super();
  }
}

class DeadComponent extends Component {}

class PowerUpComponent extends Component {
  constructor(public type: string = 'health', public value: number = 25) {
    super();
  }
}

// 定义游戏系统
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

class CombatSystem extends System {
  constructor() {
    super([HealthComponent]);
  }

  update(entities: Entity[], deltaTime: number): void {
    // 简单的战斗逻辑示例
    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent)!;
      
      if (health.current <= 0 && !entity.hasComponent(DeadComponent)) {
        entity.addComponent(new DeadComponent());
      }
    }
  }
}

// 查询系统使用示例
async function querySystemExample(): Promise<void> {
  console.log('🔍 NovaECS 增强查询系统示例');
  console.log('================================');

  // 创建游戏世界
  const world = new World();
  world.addSystem(new MovementSystem());
  world.addSystem(new CombatSystem());

  // 创建各种实体
  console.log('📦 创建游戏实体...');

  // 玩家实体
  const player = world.createEntity();
  player.addComponent(new PositionComponent(100, 100));
  player.addComponent(new VelocityComponent(5, 0));
  player.addComponent(new HealthComponent(100, 100));
  player.addComponent(new PlayerComponent('Hero', 5));

  // 敌人实体
  const enemy1 = world.createEntity();
  enemy1.addComponent(new PositionComponent(200, 150));
  enemy1.addComponent(new VelocityComponent(-2, 1));
  enemy1.addComponent(new HealthComponent(50, 50));
  enemy1.addComponent(new EnemyComponent('goblin', 15));

  const enemy2 = world.createEntity();
  enemy2.addComponent(new PositionComponent(300, 200));
  enemy2.addComponent(new HealthComponent(30, 30));
  enemy2.addComponent(new EnemyComponent('orc', 25));

  // 死亡的敌人
  const deadEnemy = world.createEntity();
  deadEnemy.addComponent(new PositionComponent(150, 180));
  deadEnemy.addComponent(new HealthComponent(0, 40));
  deadEnemy.addComponent(new EnemyComponent('skeleton', 20));
  deadEnemy.addComponent(new DeadComponent());

  // 道具实体
  const powerUp1 = world.createEntity();
  powerUp1.addComponent(new PositionComponent(250, 120));
  powerUp1.addComponent(new PowerUpComponent('health', 25));

  const powerUp2 = world.createEntity();
  powerUp2.addComponent(new PositionComponent(180, 160));
  powerUp2.addComponent(new PowerUpComponent('speed', 10));

  console.log(`✅ 创建了 ${world.getEntityCount()} 个实体`);

  // 1. 基础查询 - 查找所有可移动的实体
  console.log('\n🔍 基础查询示例:');
  const movableEntities = world.query()
    .with(PositionComponent, VelocityComponent)
    .execute();
  
  console.log(`可移动实体数量: ${movableEntities.length}`);
  movableEntities.forEach(entity => {
    const pos = entity.getComponent(PositionComponent)!;
    const vel = entity.getComponent(VelocityComponent)!;
    console.log(`  实体 ${entity.id}: 位置(${pos.x}, ${pos.y}), 速度(${vel.dx}, ${vel.dy})`);
  });

  // 2. 排除查询 - 查找活着的敌人
  console.log('\n🔍 排除查询示例:');
  const aliveEnemies = world.query()
    .with(EnemyComponent)
    .without(DeadComponent)
    .execute();
  
  console.log(`活着的敌人数量: ${aliveEnemies.length}`);
  aliveEnemies.forEach(entity => {
    const enemy = entity.getComponent(EnemyComponent)!;
    const health = entity.getComponent(HealthComponent);
    console.log(`  敌人类型: ${enemy.type}, 伤害: ${enemy.damage}, 生命值: ${health?.current || 'N/A'}`);
  });

  // 3. 任意组件查询 - 查找玩家或敌人
  console.log('\n🔍 任意组件查询示例:');
  const combatants = world.query()
    .any(PlayerComponent, EnemyComponent)
    .without(DeadComponent)
    .execute();
  
  console.log(`战斗单位数量: ${combatants.length}`);

  // 4. 复杂查询 - 查找低血量的战斗单位
  console.log('\n🔍 复杂查询示例:');
  const lowHealthCombatants = world.query()
    .with(HealthComponent)
    .any(PlayerComponent, EnemyComponent)
    .without(DeadComponent)
    .filter(entity => {
      const health = entity.getComponent(HealthComponent)!;
      return health.current < health.max * 0.8; // 血量低于80%
    })
    .execute();
  
  console.log(`低血量战斗单位数量: ${lowHealthCombatants.length}`);

  // 5. 排序查询 - 按距离排序的实体
  console.log('\n🔍 排序查询示例:');
  const playerPos = player.getComponent(PositionComponent)!;
  const nearbyEntities = world.query()
    .with(PositionComponent)
    .without(PlayerComponent) // 排除玩家自己
    .sort((a, b) => {
      const posA = a.getComponent(PositionComponent)!;
      const posB = b.getComponent(PositionComponent)!;
      const distA = Math.sqrt((posA.x - playerPos.x) ** 2 + (posA.y - playerPos.y) ** 2);
      const distB = Math.sqrt((posB.x - playerPos.x) ** 2 + (posB.y - playerPos.y) ** 2);
      return distA - distB;
    })
    .limit(3)
    .execute();
  
  console.log(`距离玩家最近的3个实体:`);
  nearbyEntities.forEach((entity, index) => {
    const pos = entity.getComponent(PositionComponent)!;
    const distance = Math.sqrt((pos.x - playerPos.x) ** 2 + (pos.y - playerPos.y) ** 2);
    console.log(`  ${index + 1}. 实体 ${entity.id}: 距离 ${distance.toFixed(2)}`);
  });

  // 6. 分页查询 - 分页获取实体
  console.log('\n🔍 分页查询示例:');
  const allEntitiesPage1 = world.query()
    .with(PositionComponent)
    .offset(0)
    .limit(2)
    .executeWithMetadata();
  
  console.log(`第1页实体 (共${allEntitiesPage1.totalCount}个):`);
  allEntitiesPage1.entities.forEach(entity => {
    console.log(`  实体 ${entity.id}`);
  });

  const allEntitiesPage2 = world.query()
    .with(PositionComponent)
    .offset(2)
    .limit(2)
    .executeWithMetadata();
  
  console.log(`第2页实体:`);
  allEntitiesPage2.entities.forEach(entity => {
    console.log(`  实体 ${entity.id}`);
  });

  // 7. 查询性能统计
  console.log('\n📊 查询性能统计:');
  const stats = world.getQueryStatistics();
  console.log(`总查询次数: ${stats.totalQueries}`);
  console.log(`缓存命中次数: ${stats.cacheHits}`);
  console.log(`缓存未命中次数: ${stats.cacheMisses}`);
  console.log(`平均执行时间: ${stats.averageExecutionTime.toFixed(2)}ms`);

  // 8. 便利方法示例
  console.log('\n🔍 便利方法示例:');
  
  // 检查是否存在玩家
  const hasPlayer = world.query().with(PlayerComponent).exists();
  console.log(`是否存在玩家: ${hasPlayer}`);
  
  // 获取第一个敌人
  const firstEnemy = world.query().with(EnemyComponent).first();
  console.log(`第一个敌人ID: ${firstEnemy?.id || 'N/A'}`);
  
  // 计算道具数量
  const powerUpCount = world.query().with(PowerUpComponent).count();
  console.log(`道具数量: ${powerUpCount}`);

  // 9. 查询构建器复用
  console.log('\n🔍 查询构建器复用示例:');
  const baseEnemyQuery = world.query()
    .with(EnemyComponent)
    .without(DeadComponent);
  
  // 克隆并添加额外条件
  const movingEnemies = baseEnemyQuery.clone()
    .with(VelocityComponent)
    .execute();
  
  const stationaryEnemies = baseEnemyQuery.clone()
    .without(VelocityComponent)
    .execute();
  
  console.log(`移动的敌人: ${movingEnemies.length}`);
  console.log(`静止的敌人: ${stationaryEnemies.length}`);

  // 10. 缓存管理
  console.log('\n💾 缓存管理示例:');
  
  // 配置查询缓存
  world.configureQueryCache({
    maxSize: 50,
    ttl: 10000 // 10秒
  });
  
  // 执行相同查询多次以测试缓存
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    world.query().with(PositionComponent).execute();
  }
  const end = performance.now();
  
  console.log(`执行100次相同查询耗时: ${(end - start).toFixed(2)}ms`);
  
  // 清除缓存
  world.clearQueryCache();
  console.log('查询缓存已清除');

  console.log('\n✨ 查询系统示例完成!');
}

// 运行示例
if (require.main === module) {
  querySystemExample().catch(console.error);
}

export { querySystemExample };
