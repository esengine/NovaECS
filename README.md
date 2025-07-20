# NovaECS

下一代Entity Component System (ECS) 游戏框架，使用TypeScript构建，支持多平台运行。

[![CI](https://github.com/esengine/NovaECS/workflows/CI/badge.svg)](https://github.com/esengine/NovaECS/actions)
[![npm version](https://badge.fury.io/js/%40esengine%2Fnova-ecs.svg)](https://badge.fury.io/js/%40esengine%2Fnova-ecs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 特性 Features

- 🚀 **高性能**: 基于原型(Archetype)的存储系统，优化内存布局和访问模式
- 🔧 **TypeScript**: 完整的类型支持，提供优秀的开发体验
- 🌐 **多平台**: 支持浏览器、Node.js、Laya、Cocos等环境
- 📦 **模块化**: ES/UMD/CommonJS多种构建格式
- 🧪 **测试覆盖**: 完整的单元测试，确保代码质量
- 📚 **文档完善**: TSDoc注释，自动生成API文档
- 🧠 **内存管理**: 智能组件对象池，减少GC压力
- ⚡ **智能调度**: 自动分析系统依赖关系，实现高效的执行调度
- 📡 **事件系统**: 类型安全的事件总线，支持优先级和延迟处理

## 安装 Installation

```bash
npm install @esengine/nova-ecs
```

## API 文档 API Documentation

完整的API文档请访问：[https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)

## 快速开始 Quick Start

```typescript
import { World, Entity, Component, System } from '@esengine/nova-ecs';

// 定义组件
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

// 定义系统
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

// 创建世界和系统
const world = new World();
world.addSystem(new MovementSystem());

// 创建实体
const entity = world.createEntity();
entity.addComponent(new PositionComponent(0, 0));
entity.addComponent(new VelocityComponent(1, 1));

// 游戏循环
function gameLoop(deltaTime: number) {
  world.update(deltaTime);
}

// 启动游戏循环
setInterval(() => gameLoop(16), 16);
```

## 事件系统 Event System

NovaECS 提供了强大的事件系统，支持系统间的松耦合通信。

```typescript
import { Event, EventPriority } from '@esengine/nova-ecs';

// 定义自定义事件
class PlayerDeathEvent extends Event {
  constructor(
    public readonly playerId: number,
    public readonly cause: string
  ) {
    super('PlayerDeath', EventPriority.High);
  }
}

// 在系统中使用事件
class HealthSystem extends System {
  onAddedToWorld(world: World): void {
    super.onAddedToWorld(world);
    
    // 订阅事件
    this.subscribeToEventType(PlayerDeathEvent, (event) => {
      console.log(`Player ${event.playerId} died: ${event.cause}`);
    });
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent)!;
      
      if (health.current <= 0) {
        // 分发事件
        this.dispatchEvent(new PlayerDeathEvent(entity.id, 'health depleted'));
      }
    }
  }
}
```

## 组件对象池 Component Pool

使用组件对象池来优化内存管理：

```typescript
import { ComponentPool } from '@esengine/nova-ecs';

// 创建组件池
const bulletPool = new ComponentPool(
  () => new BulletComponent(),
  { initialSize: 50, maxSize: 200 }
);

// 从池中获取组件
const bullet = bulletPool.acquire();
bullet.damage = 10;
bullet.speed = 100;

// 使用完毕后释放回池
bulletPool.release(bullet);
```

## 实体查询 Entity Queries

查询具有特定组件组合的实体：

```typescript
// 查询具有特定组件的实体
const movableEntities = world.query({
  all: [PositionComponent, VelocityComponent]
});

// 查询具有任一组件的实体
const renderableEntities = world.query({
  any: [SpriteComponent, MeshComponent]
});

// 查询排除特定组件的实体
const aliveEntities = world.query({
  all: [HealthComponent],
  none: [DeadComponent]
});
```

## 查询系统 Query System

NovaECS 提供了强大的查询系统，支持复杂的实体筛选、缓存优化和性能监控。

### 基础查询

```typescript
// 流畅的链式查询API
const entities = world.query()
  .with(PositionComponent, VelocityComponent)  // 必须包含的组件
  .without(DeadComponent)                      // 必须不包含的组件
  .execute();

// 使用别名
const entities2 = world.query()
  .all(PositionComponent)                      // 等同于 with()
  .none(DeadComponent)                         // 等同于 without()
  .execute();
```

### 复杂查询

```typescript
// 任意组件查询（OR逻辑）
const combatants = world.query()
  .any(PlayerComponent, EnemyComponent)        // 包含任一组件
  .without(DeadComponent)
  .execute();

// 自定义过滤器
const lowHealthEntities = world.query()
  .with(HealthComponent)
  .filter(entity => {
    const health = entity.getComponent(HealthComponent);
    return health.current < health.max * 0.5;
  })
  .execute();

// 排序和分页
const nearestEnemies = world.query()
  .with(EnemyComponent, PositionComponent)
  .sort((a, b) => {
    // 按距离排序
    const posA = a.getComponent(PositionComponent);
    const posB = b.getComponent(PositionComponent);
    return calculateDistance(posA) - calculateDistance(posB);
  })
  .limit(5)                                    // 只取前5个
  .execute();
```

### 便利方法

```typescript
// 检查是否存在匹配的实体
const hasPlayer = world.query().with(PlayerComponent).exists();

// 获取第一个匹配的实体
const player = world.query().with(PlayerComponent).first();

// 计算匹配的实体数量
const enemyCount = world.query().with(EnemyComponent).count();

// 获取详细的查询结果
const result = world.query()
  .with(PositionComponent)
  .executeWithMetadata();

console.log(`找到 ${result.entities.length} 个实体`);
console.log(`查询耗时: ${result.executionTime}ms`);
console.log(`来自缓存: ${result.fromCache}`);
```

### 查询构建器复用

```typescript
// 创建基础查询
const baseQuery = world.query()
  .with(EnemyComponent)
  .without(DeadComponent);

// 克隆并添加额外条件
const movingEnemies = baseQuery.clone()
  .with(VelocityComponent)
  .execute();

const stationaryEnemies = baseQuery.clone()
  .without(VelocityComponent)
  .execute();
```

### 查询缓存和性能

```typescript
// 配置查询缓存
world.configureQueryCache({
  maxSize: 100,        // 最大缓存条目数
  ttl: 5000,          // 缓存生存时间（毫秒）
  evictionStrategy: 'lru'  // 淘汰策略：lru, lfu, ttl
});

// 获取查询统计信息
const stats = world.getQueryStatistics();
console.log(`总查询次数: ${stats.totalQueries}`);
console.log(`缓存命中率: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses)}`);
console.log(`平均执行时间: ${stats.averageExecutionTime}ms`);

// 清除查询缓存
world.clearQueryCache();

// 启用/禁用性能监控
world.setQueryPerformanceMonitoring(true);
```

### 查询优化策略

- **原型优化**：自动使用原型系统优化简单查询
- **智能缓存**：自动缓存查询结果，实体变化时智能失效
- **批量处理**：支持limit和offset进行分页查询
- **性能监控**：跟踪慢查询和热门查询

## 序列化系统 Serialization System

NovaECS 提供了强大的序列化系统，支持游戏保存/加载、网络同步等功能。

```typescript
import { Serializer, SerializationUtils, SerializationFormat } from '@esengine/nova-ecs';

// 创建序列化器
const serializer = new Serializer();

// 注册组件类型
serializer.registerComponentType('PositionComponent', PositionComponent);
serializer.registerComponentType('VelocityComponent', VelocityComponent);

// JSON 序列化（人类可读）
const jsonData = await SerializationUtils.toJSON(gameData, true);
const restored = await SerializationUtils.fromJSON(jsonData);

// 二进制序列化（高性能，小体积）
const binaryData = await SerializationUtils.toBinary(gameData);
const restored2 = await SerializationUtils.fromBinary(binaryData);

// 深拷贝对象
const clone = SerializationUtils.clone(originalObject);
```

### 支持的数据类型

- ✅ 基础类型：string, number, boolean, null, undefined
- ✅ 复杂类型：Date, Map, Set, Array, Object
- ✅ 循环引用：自动处理循环引用
- ✅ 自定义类型：通过注册支持组件和系统序列化

## 许可证 License

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 贡献 Contributing

欢迎提交 Issue 和 Pull Request！

## 支持 Support

如果您在使用过程中遇到问题，请：

1. 查看 [API 文档](https://esengine.github.io/NovaECS/)
2. 搜索已有的 [Issues](https://github.com/esengine/NovaECS/issues)
3. 创建新的 Issue 描述您的问题
