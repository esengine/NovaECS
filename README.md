# NovaECS

Next-generation Entity Component System (ECS) game framework built with TypeScript, supporting multi-platform deployment.
下一代Entity Component System (ECS) 游戏框架，使用TypeScript构建，支持多平台运行。

[![CI](https://github.com/esengine/NovaECS/workflows/CI/badge.svg)](https://github.com/esengine/NovaECS/actions)
[![npm version](https://badge.fury.io/js/%40esengine%2Fnova-ecs.svg)](https://badge.fury.io/js/%40esengine%2Fnova-ecs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features | 特性

- 🚀 **High Performance**: Archetype-based storage system with optimized memory layout and access patterns
  **高性能**: 基于原型(Archetype)的存储系统，优化内存布局和访问模式
- 🔧 **TypeScript**: Complete type support for excellent development experience
  **TypeScript**: 完整的类型支持，提供优秀的开发体验
- 🌐 **Multi-Platform**: Support for Browser, Node.js, Laya, Cocos and other environments
  **多平台**: 支持浏览器、Node.js、Laya、Cocos等环境
- 📦 **Modular**: Multiple build formats including ES/UMD/CommonJS
  **模块化**: ES/UMD/CommonJS多种构建格式
- 🧪 **Test Coverage**: Complete unit tests ensuring code quality
  **测试覆盖**: 完整的单元测试，确保代码质量
- 📚 **Well Documented**: TSDoc comments with auto-generated API documentation
  **文档完善**: TSDoc注释，自动生成API文档
- 🧠 **Memory Management**: Smart component object pools to reduce GC pressure
  **内存管理**: 智能组件对象池，减少GC压力
- ⚡ **Smart Scheduling**: Automatic system dependency analysis for efficient execution scheduling
  **智能调度**: 自动分析系统依赖关系，实现高效的执行调度
- 📡 **Event System**: Type-safe event bus with priority and deferred processing support
  **事件系统**: 类型安全的事件总线，支持优先级和延迟处理
- 🔌 **Plugin System**: Extensible plugin architecture with dependency management and lifecycle hooks
  **插件系统**: 可扩展的插件架构，支持依赖管理和生命周期钩子
- ⚛️ **Physics Integration**: Modular physics system with Box2D support for deterministic 2D physics simulation
  **物理集成**: 模块化物理系统，支持Box2D确定性2D物理模拟

## Installation | 安装

```bash
npm install @esengine/nova-ecs
```

## API Documentation | API 文档

For complete API documentation, visit: [https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)
完整的API文档请访问：[https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)

## Quick Start | 快速开始

```typescript
import { World, Entity, Component, System } from '@esengine/nova-ecs';

// Define components | 定义组件
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

// Define systems | 定义系统
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

// Create world and systems | 创建世界和系统
const world = new World();
world.addSystem(new MovementSystem());

// Create entities | 创建实体
const entity = world.createEntity();
entity.addComponent(new PositionComponent(0, 0));
entity.addComponent(new VelocityComponent(1, 1));

// Game loop | 游戏循环
function gameLoop(deltaTime: number) {
  world.update(deltaTime);
}

// Start game loop | 启动游戏循环
setInterval(() => gameLoop(16), 16);
```

## Related Libraries | 相关库

### Math Library | 数学库

For deterministic fixed-point mathematics (recommended for multiplayer games), see [@esengine/nova-ecs-math](https://github.com/esengine/nova-ecs-math).

对于确定性定点数学运算（推荐用于多人游戏），请参考 [@esengine/nova-ecs-math](https://github.com/esengine/nova-ecs-math)。

### Physics Libraries | 物理库

NovaECS provides a modular physics system with pluggable physics engines:

NovaECS 提供了模块化的物理系统，支持可插拔的物理引擎：

- **[@esengine/nova-ecs-physics-core](./thirdparty/nova-ecs-physics-core)** - Physics engine abstraction layer
  **物理引擎抽象层** - 提供统一的物理接口和组件
- **[@esengine/nova-ecs-physics-box2d](./thirdparty/nova-ecs-physics-box2d)** - Box2D physics engine implementation
  **Box2D物理引擎实现** - 基于Box2D WASM的高性能2D物理模拟

## Event System | 事件系统

NovaECS provides a powerful event system that supports loose coupling communication between systems.
NovaECS 提供了强大的事件系统，支持系统间的松耦合通信。

```typescript
import { Event, EventPriority } from '@esengine/nova-ecs';

// Define custom events | 定义自定义事件
class PlayerDeathEvent extends Event {
  constructor(
    public readonly playerId: number,
    public readonly cause: string
  ) {
    super('PlayerDeath', EventPriority.High);
  }
}

// Use events in systems | 在系统中使用事件
class HealthSystem extends System {
  onAddedToWorld(world: World): void {
    super.onAddedToWorld(world);

    // Subscribe to events | 订阅事件
    this.subscribeToEventType(PlayerDeathEvent, (event) => {
      console.log(`Player ${event.playerId} died: ${event.cause}`);
    });
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent)!;

      if (health.current <= 0) {
        // Dispatch events | 分发事件
        this.dispatchEvent(new PlayerDeathEvent(entity.id, 'health depleted'));
      }
    }
  }
}
```

## Component Pool | 组件对象池

Use component pools to optimize memory management:
使用组件对象池来优化内存管理：

```typescript
import { ComponentPool } from '@esengine/nova-ecs';

// Create component pool | 创建组件池
const bulletPool = new ComponentPool(
  () => new BulletComponent(),
  { initialSize: 50, maxSize: 200 }
);

// Acquire component from pool | 从池中获取组件
const bullet = bulletPool.acquire();
bullet.damage = 10;
bullet.speed = 100;

// Release component back to pool | 使用完毕后释放回池
bulletPool.release(bullet);
```

## Entity Queries | 实体查询

Query entities with specific component combinations:
查询具有特定组件组合的实体：

```typescript
// Query entities with specific components | 查询具有特定组件的实体
const movableEntities = world.query({
  all: [PositionComponent, VelocityComponent]
});

// Query entities with any of the components | 查询具有任一组件的实体
const renderableEntities = world.query({
  any: [SpriteComponent, MeshComponent]
});

// Query entities excluding specific components | 查询排除特定组件的实体
const aliveEntities = world.query({
  all: [HealthComponent],
  none: [DeadComponent]
});
```

## Query System | 查询系统

NovaECS provides a powerful query system that supports complex entity filtering, cache optimization, and performance monitoring.
NovaECS 提供了强大的查询系统，支持复杂的实体筛选、缓存优化和性能监控。

### Basic Queries | 基础查询

```typescript
// Fluent chaining query API | 流畅的链式查询API
const entities = world.query()
  .with(PositionComponent, VelocityComponent)  // Must contain components | 必须包含的组件
  .without(DeadComponent)                      // Must not contain components | 必须不包含的组件
  .execute();

// Using aliases | 使用别名
const entities2 = world.query()
  .all(PositionComponent)                      // Equivalent to with() | 等同于 with()
  .none(DeadComponent)                         // Equivalent to without() | 等同于 without()
  .execute();
```

### Complex Queries | 复杂查询

```typescript
// Any component query (OR logic) | 任意组件查询（OR逻辑）
const combatants = world.query()
  .any(PlayerComponent, EnemyComponent)        // Contains any component | 包含任一组件
  .without(DeadComponent)
  .execute();

// Custom filters | 自定义过滤器
const lowHealthEntities = world.query()
  .with(HealthComponent)
  .filter(entity => {
    const health = entity.getComponent(HealthComponent);
    return health.current < health.max * 0.5;
  })
  .execute();

// Sorting and pagination | 排序和分页
const nearestEnemies = world.query()
  .with(EnemyComponent, PositionComponent)
  .sort((a, b) => {
    // Sort by distance | 按距离排序
    const posA = a.getComponent(PositionComponent);
    const posB = b.getComponent(PositionComponent);
    return calculateDistance(posA) - calculateDistance(posB);
  })
  .limit(5)                                    // Take only first 5 | 只取前5个
  .execute();
```

### Convenience Methods | 便利方法

```typescript
// Check if matching entities exist | 检查是否存在匹配的实体
const hasPlayer = world.query().with(PlayerComponent).exists();

// Get first matching entity | 获取第一个匹配的实体
const player = world.query().with(PlayerComponent).first();

// Count matching entities | 计算匹配的实体数量
const enemyCount = world.query().with(EnemyComponent).count();

// Get detailed query results | 获取详细的查询结果
const result = world.query()
  .with(PositionComponent)
  .executeWithMetadata();

console.log(`Found ${result.entities.length} entities`); // 找到 ${result.entities.length} 个实体
console.log(`Query time: ${result.executionTime}ms`); // 查询耗时: ${result.executionTime}ms
console.log(`From cache: ${result.fromCache}`); // 来自缓存: ${result.fromCache}
```

### Query Builder Reuse | 查询构建器复用

```typescript
// Create base query | 创建基础查询
const baseQuery = world.query()
  .with(EnemyComponent)
  .without(DeadComponent);

// Clone and add additional conditions | 克隆并添加额外条件
const movingEnemies = baseQuery.clone()
  .with(VelocityComponent)
  .execute();

const stationaryEnemies = baseQuery.clone()
  .without(VelocityComponent)
  .execute();
```

### Query Cache and Performance | 查询缓存和性能

```typescript
// Configure query cache | 配置查询缓存
world.configureQueryCache({
  maxSize: 100,        // Maximum cache entries | 最大缓存条目数
  ttl: 5000,          // Cache time-to-live (milliseconds) | 缓存生存时间（毫秒）
  evictionStrategy: 'lru'  // Eviction strategy: lru, lfu, ttl | 淘汰策略：lru, lfu, ttl
});

// Get query statistics | 获取查询统计信息
const stats = world.getQueryStatistics();
console.log(`Total queries: ${stats.totalQueries}`); // 总查询次数: ${stats.totalQueries}
console.log(`Cache hit rate: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses)}`); // 缓存命中率: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses)}
console.log(`Average execution time: ${stats.averageExecutionTime}ms`); // 平均执行时间: ${stats.averageExecutionTime}ms

// Clear query cache | 清除查询缓存
world.clearQueryCache();

// Enable/disable performance monitoring | 启用/禁用性能监控
world.setQueryPerformanceMonitoring(true);
```

### Query Optimization Strategies | 查询优化策略

- **Archetype Optimization**: Automatically use archetype system to optimize simple queries
  **原型优化**：自动使用原型系统优化简单查询
- **Smart Caching**: Automatically cache query results with intelligent invalidation on entity changes
  **智能缓存**：自动缓存查询结果，实体变化时智能失效
- **Batch Processing**: Support limit and offset for paginated queries
  **批量处理**：支持limit和offset进行分页查询
- **Performance Monitoring**: Track slow queries and popular queries
  **性能监控**：跟踪慢查询和热门查询

## Plugin System | 插件系统

NovaECS provides a powerful plugin system that allows you to extend functionality in a modular way.
NovaECS 提供了强大的插件系统，允许您以模块化的方式扩展功能。

```typescript
import { BasePlugin, PluginPriority, World } from '@esengine/nova-ecs';

// Define a custom plugin | 定义自定义插件
class MyPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'MyPlugin',
      version: '1.0.0',
      description: 'My custom plugin',
      priority: PluginPriority.Normal
    });
  }

  async install(world: World): Promise<void> {
    this.log('Plugin installed');
    // Plugin installation logic | 插件安装逻辑
  }

  async uninstall(world: World): Promise<void> {
    this.log('Plugin uninstalled');
    // Plugin cleanup logic | 插件清理逻辑
  }

  update(deltaTime: number): void {
    // Plugin update logic | 插件更新逻辑
  }
}

// Install plugin | 安装插件
const world = new World();
const plugin = new MyPlugin();
const result = await world.plugins.install(plugin);

if (result.success) {
  console.log('Plugin installed successfully');
} else {
  console.error('Plugin installation failed:', result.error);
}

// Get plugin instance | 获取插件实例
const myPlugin = world.plugins.get<MyPlugin>('MyPlugin');

// Uninstall plugin | 卸载插件
await world.plugins.uninstall('MyPlugin');
```

### Plugin Dependencies | 插件依赖

```typescript
class DependentPlugin extends BasePlugin {
  constructor() {
    super({
      name: 'DependentPlugin',
      version: '1.0.0',
      description: 'Plugin with dependencies',
      dependencies: ['MyPlugin'], // Required dependencies | 必需依赖
      optionalDependencies: ['OptionalPlugin'], // Optional dependencies | 可选依赖
      conflicts: ['ConflictingPlugin'] // Conflicting plugins | 冲突插件
    });
  }

  async install(world: World): Promise<void> {
    // Installation logic | 安装逻辑
  }

  async uninstall(world: World): Promise<void> {
    // Uninstallation logic | 卸载逻辑
  }
}
```

### Plugin Lifecycle Hooks | 插件生命周期钩子

```typescript
class LifecyclePlugin extends BasePlugin {
  constructor() {
    super({
      name: 'LifecyclePlugin',
      version: '1.0.0'
    });
  }

  async install(world: World): Promise<void> {
    // Plugin installation | 插件安装
  }

  async uninstall(world: World): Promise<void> {
    // Plugin uninstallation | 插件卸载
  }

  // World lifecycle | 世界生命周期
  onWorldCreate(world: World): void {
    this.log('World created');
  }

  onWorldDestroy(world: World): void {
    this.log('World destroyed');
  }

  // Entity lifecycle | 实体生命周期
  onEntityCreate(entity: Entity): void {
    this.log(`Entity ${entity.id} created`);
  }

  onEntityDestroy(entity: Entity): void {
    this.log(`Entity ${entity.id} destroyed`);
  }

  // Component lifecycle | 组件生命周期
  onComponentAdd(entity: Entity, component: Component): void {
    this.log(`Component added to entity ${entity.id}`);
  }

  onComponentRemove(entity: Entity, component: Component): void {
    this.log(`Component removed from entity ${entity.id}`);
  }

  // System lifecycle | 系统生命周期
  onSystemAdd(system: System): void {
    this.log(`System ${system.constructor.name} added`);
  }

  onSystemRemove(system: System): void {
    this.log(`System ${system.constructor.name} removed`);
  }
}
```

### Plugin Configuration | 插件配置

```typescript
class ConfigurablePlugin extends BasePlugin {
  constructor() {
    super({
      name: 'ConfigurablePlugin',
      version: '1.0.0'
    });
  }

  async install(world: World, options?: PluginInstallOptions): Promise<void> {
    // Use configuration | 使用配置
    const enabled = this.getConfigValue('enabled', true);
    const maxItems = this.getConfigValue('maxItems', 100);

    this.log(`Plugin enabled: ${enabled}, maxItems: ${maxItems}`);
  }

  validateConfig(config: Record<string, unknown>): boolean {
    // Validate configuration | 验证配置
    return typeof config.enabled === 'boolean' &&
           typeof config.maxItems === 'number';
  }

  async uninstall(world: World): Promise<void> {
    // Cleanup logic | 清理逻辑
  }
}

// Install with configuration | 带配置安装
await world.plugins.install(new ConfigurablePlugin(), {
  config: {
    enabled: true,
    maxItems: 200
  }
});
```

### Plugin Utilities | 插件工具

```typescript
import { PluginUtils } from '@esengine/nova-ecs';

// Create metadata with defaults | 创建带默认值的元数据
const metadata = PluginUtils.createMetadata({
  name: 'MyPlugin',
  version: '1.0.0'
});

// Validate metadata | 验证元数据
const validation = PluginUtils.validateMetadata(metadata);
if (!validation.valid) {
  console.error('Invalid metadata:', validation.errors);
}

// Check version compatibility | 检查版本兼容性
const isCompatible = PluginUtils.isCompatible(plugin, '1.0.0');

// Create configuration validator | 创建配置验证器
const validator = PluginUtils.createConfigValidator({
  enabled: { type: 'boolean', required: true },
  count: { type: 'number', required: false }
});

// Install multiple plugins | 安装多个插件
const helper = PluginUtils.createInstallationHelper(world);
const result = await helper.installMany([plugin1, plugin2, plugin3]);
```

## Serialization System | 序列化系统

NovaECS provides a powerful serialization system that supports game save/load, network synchronization and other features.
NovaECS 提供了强大的序列化系统，支持游戏保存/加载、网络同步等功能。

```typescript
import { Serializer, SerializationUtils, SerializationFormat } from '@esengine/nova-ecs';

// Create serializer | 创建序列化器
const serializer = new Serializer();

// Register component types | 注册组件类型
serializer.registerComponentType('PositionComponent', PositionComponent);
serializer.registerComponentType('VelocityComponent', VelocityComponent);

// JSON serialization (human readable) | JSON 序列化（人类可读）
const jsonData = await SerializationUtils.toJSON(gameData, true);
const restored = await SerializationUtils.fromJSON(jsonData);

// Binary serialization (high performance, small size) | 二进制序列化（高性能，小体积）
const binaryData = await SerializationUtils.toBinary(gameData);
const restored2 = await SerializationUtils.fromBinary(binaryData);

// Deep clone objects | 深拷贝对象
const clone = SerializationUtils.clone(originalObject);
```

### Supported Data Types | 支持的数据类型

- ✅ **Primitive types**: string, number, boolean, null, undefined
  **基础类型**：string, number, boolean, null, undefined
- ✅ **Complex types**: Date, Map, Set, Array, Object
  **复杂类型**：Date, Map, Set, Array, Object
- ✅ **Circular references**: Automatically handle circular references
  **循环引用**：自动处理循环引用
- ✅ **Custom types**: Support component and system serialization through registration
  **自定义类型**：通过注册支持组件和系统序列化

## License | 许可证

MIT License - See [LICENSE](LICENSE) file for details.
MIT License - 详见 [LICENSE](LICENSE) 文件。

## Contributing | 贡献

Issues and Pull Requests are welcome!
欢迎提交 Issue 和 Pull Request！

## Support | 支持

If you encounter problems during use, please:
如果您在使用过程中遇到问题，请：

1. Check the [API Documentation](https://esengine.github.io/NovaECS/)
   查看 [API 文档](https://esengine.github.io/NovaECS/)
2. Search existing [Issues](https://github.com/esengine/NovaECS/issues)
   搜索已有的 [Issues](https://github.com/esengine/NovaECS/issues)
3. Create a new Issue describing your problem
   创建新的 Issue 描述您的问题
