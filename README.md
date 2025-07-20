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

## 安装 Installation

```bash
npm install @esengine/nova-ecs
```

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
const player = world.createEntity()
  .addComponent(new PositionComponent(100, 100))
  .addComponent(new VelocityComponent(5, 0));

// 游戏循环
function gameLoop(deltaTime: number) {
  world.update(deltaTime);

  // 获取性能统计
  const stats = world.getPerformanceStatistics();
  console.log('系统执行统计:', stats);
}

// 启动游戏循环
setInterval(() => gameLoop(16), 16);
```

## 高级功能 Advanced Features

### 系统依赖和并行调度

```typescript
import { System, AccessType } from '@esengine/nova-ecs';

// 只读系统 - 可以并行执行
class RenderSystem extends System {
  constructor() {
    super([PositionComponent], [
      { componentType: PositionComponent, accessType: AccessType.Read }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    // 渲染逻辑，只读取位置数据
    entities.forEach(entity => {
      const position = entity.getComponent(PositionComponent)!;
      console.log(`渲染实体在位置: (${position.x}, ${position.y})`);
    });
  }
}

// 写入系统 - 会与其他写入系统串行执行
class PhysicsSystem extends System {
  constructor() {
    super([PositionComponent, VelocityComponent], [
      { componentType: PositionComponent, accessType: AccessType.Write },
      { componentType: VelocityComponent, accessType: AccessType.Read }
    ]);
  }

  update(entities: Entity[], deltaTime: number): void {
    // 物理计算，修改位置数据
    entities.forEach(entity => {
      const position = entity.getComponent(PositionComponent)!;
      const velocity = entity.getComponent(VelocityComponent)!;

      position.x += velocity.dx * deltaTime;
      position.y += velocity.dy * deltaTime;
    });
  }
}

// 添加系统 - 框架会自动分析依赖关系
world.addSystem(new RenderSystem());
world.addSystem(new PhysicsSystem());
world.addSystem(new MovementSystem());

// 查看执行组
const groups = world.getExecutionGroups();
console.log('系统执行组:', groups);
```

## 内存管理工具 Memory Management Tools

NovaECS 提供了独立的内存管理工具，包括组件对象池，可以根据需要选择性使用。

### 组件对象池 Component Object Pool

```typescript
import { ComponentPool, ComponentPoolManager } from '@esengine/nova-ecs';

// 创建单个组件池
const positionPool = new ComponentPool(PositionComponent, {
  initialSize: 50,    // 初始池大小
  maxSize: 200,       // 最大池大小
  autoCleanup: true,  // 自动清理
  cleanupInterval: 60000, // 清理间隔
  maxIdleTime: 30000  // 最大空闲时间
});

// 从池中获取组件
const position = positionPool.acquire();
position.x = 100;
position.y = 200;

// 使用完毕后释放回池
positionPool.release(position);

// 使用池管理器管理多个池
const poolManager = new ComponentPoolManager();
const pool = poolManager.getPool(PositionComponent);
const component = pool.acquire();
```





## 核心概念 Core Concepts

### Entity (实体)
实体是游戏世界中的基本对象，本身不包含数据或逻辑，只是组件的容器。

### Component (组件)
组件存储数据，定义实体的属性和状态。

### System (系统)
系统包含逻辑，处理具有特定组件组合的实体。

### World (世界)
世界管理所有实体和系统，协调整个ECS架构的运行。

### Memory Management Tools (内存管理工具)
独立的内存管理工具，包括组件对象池，可选择性使用以优化性能。

## 最佳实践 Best Practices

### 内存管理最佳实践

1. **合理配置对象池大小**
```typescript
// 根据游戏规模配置池大小
const pool = new ComponentPool(PositionComponent, {
  initialSize: Math.min(expectedEntityCount * 0.8, 100),
  maxSize: expectedEntityCount * 1.2
});
```

2. **及时释放组件**
```typescript
// 手动管理组件池时要记得释放
const component = pool.acquire();
// ... 使用组件
pool.release(component);
```

3. **监控内存使用**
```typescript
// 定期检查内存使用情况
setInterval(() => {
  const stats = pool.statistics;
  console.log('Pool hit rate:', stats.hitRate);
  console.log('Memory usage:', stats.memoryUsage);
}, 10000);
```

### 系统设计最佳实践

1. **明确组件访问类型**
```typescript
class OptimizedSystem extends System {
  constructor() {
    super([PositionComponent, VelocityComponent], [
      { componentType: PositionComponent, accessType: AccessType.Write },
      { componentType: VelocityComponent, accessType: AccessType.Read }
    ]);
  }
}
```

2. **避免在系统中创建实体**
```typescript
// ❌ 不推荐：在系统中直接创建实体
class BadSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    if (entities.length < 10) {
      this.world?.createEntity(); // 可能导致并发问题
    }
  }
}

// ✅ 推荐：使用事件或延迟创建
class GoodSystem extends System {
  private entitiesToCreate: number = 0;

  update(entities: Entity[], deltaTime: number): void {
    if (entities.length < 10) {
      this.entitiesToCreate++;
    }
  }

  postUpdate(deltaTime: number): void {
    // 在后处理阶段创建实体
    for (let i = 0; i < this.entitiesToCreate; i++) {
      this.world?.createEntity();
    }
    this.entitiesToCreate = 0;
  }
}
```

3. **合理使用查询过滤**
```typescript
// 使用自定义查询过滤器
const activeEntities = world.queryEntities(
  PositionComponent,
  VelocityComponent
).filter(entity => entity.active);
```

## 性能优化 Performance Optimization

### 原型存储优化

NovaECS使用基于原型(Archetype)的存储系统，自动优化内存布局：

```typescript
// 框架会自动将具有相同组件组合的实体存储在一起
const entity1 = world.createEntity()
  .addComponent(new PositionComponent())
  .addComponent(new VelocityComponent());

const entity2 = world.createEntity()
  .addComponent(new PositionComponent())
  .addComponent(new VelocityComponent());

// entity1和entity2会被存储在同一个原型中，提高缓存效率

// 查看原型统计
const archetypeStats = world.getArchetypeStatistics();
console.log('原型数量:', archetypeStats.archetypeCount);
console.log('平均每个原型的实体数:', archetypeStats.averageEntitiesPerArchetype);
```

### 系统执行优化

```typescript
// 查看系统执行统计
const schedulerStats = world.getSchedulerStatistics();
console.log('执行组数量:', schedulerStats.totalGroups);
console.log('系统总数:', schedulerStats.totalSystems);

// 查看详细的执行组信息
schedulerStats.groupDetails.forEach((group, index) => {
  console.log(`组 ${index}: 级别 ${group.level}, 系统数 ${group.systemCount}`);
  console.log('系统列表:', group.systems);
});
```

## API文档 API Documentation

完整的API文档请访问: [API Documentation](https://esengine.github.io/NovaECS/)

## 构建和开发 Build & Development

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 生成文档
npm run docs

# 代码检查
npm run lint
```

## 平台兼容性 Platform Compatibility

- ✅ 现代浏览器 (Chrome, Firefox, Safari, Edge)
- ✅ Node.js 16+
- ✅ Laya引擎
- ✅ Cocos Creator
- ✅ 微信小游戏
- ✅ 支付宝小游戏

## 许可证 License

MIT © [esengine](https://github.com/esengine)

## 贡献 Contributing

欢迎提交Issue和Pull Request！

1. Fork 这个仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启Pull Request

## 更新日志 Changelog

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新信息。