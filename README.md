# NovaECS

下一代Entity Component System (ECS) 游戏框架，使用TypeScript构建，支持多平台运行。

[![CI](https://github.com/esengine/NovaECS/workflows/CI/badge.svg)](https://github.com/esengine/NovaECS/actions)
[![npm version](https://badge.fury.io/js/%40esengine%2Fnova-ecs.svg)](https://badge.fury.io/js/%40esengine%2Fnova-ecs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 特性 Features

- 🚀 **高性能**: 优化的ECS架构，专为游戏性能而设计
- 🔧 **TypeScript**: 完整的类型支持，提供优秀的开发体验
- 🌐 **多平台**: 支持浏览器、Node.js、Laya、Cocos等环境
- 📦 **模块化**: ES/UMD/CommonJS多种构建格式
- 🧪 **测试覆盖**: 完整的单元测试，确保代码质量
- 📚 **文档完善**: TSDoc注释，自动生成API文档
- 🧠 **内存管理**: 智能对象池和共享内存，减少GC压力
- ⚡ **零拷贝传输**: SharedArrayBuffer支持，高效数据传输

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
}
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