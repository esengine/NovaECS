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

## API 文档 API Documentation

完整的API文档请访问：[https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)

## 许可证 License

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 贡献 Contributing

欢迎提交 Issue 和 Pull Request！

## 支持 Support

如果您在使用过程中遇到问题，请：

1. 查看 [API 文档](https://esengine.github.io/NovaECS/)
2. 搜索已有的 [Issues](https://github.com/esengine/NovaECS/issues)
3. 创建新的 Issue 描述您的问题
