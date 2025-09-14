# NovaECS

Pure data-oriented Entity Component System (ECS) framework built with TypeScript, designed for high performance and simplicity.
纯数据导向的Entity Component System (ECS) 框架，使用TypeScript构建，专为高性能和简洁性设计。

[![CI](https://github.com/esengine/NovaECS/workflows/CI/badge.svg)](https://github.com/esengine/NovaECS/actions)
[![npm version](https://badge.fury.io/js/%40esengine%2Fnova-ecs.svg)](https://badge.fury.io/js/%40esengine%2Fnova-ecs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features | 特性

- 🚀 **Pure Data-Oriented**: Numeric entity handles with generation-based memory safety
  **纯数据导向**: 数值实体句柄，基于世代的内存安全
- ⚡ **High Performance**: Sparse-set storage with O(1) component operations
  **高性能**: 稀疏集存储，O(1)组件操作
- 🔧 **TypeScript**: Complete type support for excellent development experience
  **TypeScript**: 完整的类型支持，提供优秀的开发体验
- 🎯 **Smart Query System**: Intelligent anchor selection for optimal query performance
  **智能查询**: 智能锚点选择，优化查询性能
- 📋 **Command Buffer**: Batched operations with automatic deduplication
  **命令缓冲**: 批量操作，自动去重
- ⏱️ **Frame Tracking**: Built-in change detection with frame-based timestamps
  **帧追踪**: 内置变更检测，基于帧的时间戳
- 🔀 **System Scheduler**: Dependency resolution with topological sorting
  **系统调度**: 依赖解析，拓扑排序
- 🎮 **Game Loop Ready**: Complete execution stages (startup, preUpdate, update, postUpdate, cleanup)
  **游戏循环**: 完整执行阶段（启动、预更新、更新、后更新、清理）
- 🌐 **Multi-Platform**: Support for Browser, Node.js, and other JavaScript environments
  **多平台**: 支持浏览器、Node.js等JavaScript环境
- 📦 **Modular**: Multiple build formats including ES/UMD/CommonJS
  **模块化**: ES/UMD/CommonJS多种构建格式

## Installation | 安装

```bash
npm install @esengine/nova-ecs
```

## API Documentation | API 文档

For complete API documentation, visit: [https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)
完整的API文档请访问：[https://esengine.github.io/NovaECS/](https://esengine.github.io/NovaECS/)

## Quick Start | 快速开始

```typescript
import { World } from '@esengine/nova-ecs';
import { system } from '@esengine/nova-ecs/core/System';
import { Scheduler } from '@esengine/nova-ecs/core/Scheduler';

// 组件定义 | Define components
class Position { x = 0; y = 0; }
class Velocity { x = 0; y = 0; }
class Disabled {}

// 系统定义 | Define systems
const MoveSystem = system('Move', (ctx) => {
  ctx.world
    .query(Position, Velocity)
    .without(Disabled)
    .forEach((e, p, v) => {
      p.x += v.x * ctx.deltaTime;
      p.y += v.y * ctx.deltaTime;
      ctx.world.markChanged(e, Position);
    });
})
  .stage('update')
  .inSet('Gameplay')
  .build();

const SpawnSystem = system('Spawn', (ctx) => {
  const cmd = ctx.commandBuffer;
  const e = cmd.create(true);
  cmd.add(e, Position, { x: 10, y: 10 });
  cmd.add(e, Velocity, { x: 1, y: 0 });
})
  .stage('preUpdate')
  .before('set:Gameplay')
  .flushPolicy('afterStage')
  .build();

const KillSleepingSystem = system('KillSleeping', (ctx) => {
  const cmd = ctx.commandBuffer;
  ctx.world.query(Velocity).forEach((e, v) => {
    if (v.x === 0 && v.y === 0) cmd.destroy(e);
  });
})
  .stage('postUpdate')
  .after('Move')
  .build();

// 调度器组装 | Scheduler setup
const scheduler = new Scheduler()
  .add(SpawnSystem)
  .add(MoveSystem)
  .add(KillSleepingSystem);

// 创建世界 | Create world
const world = new World();

// 游戏循环 | Game loop
function mainLoop(deltaTime: number) {
  // 自动执行：beginFrame() -> startup -> preUpdate -> update -> postUpdate
  // startup阶段仅第一次tick时运行
  scheduler.tick(world, deltaTime);
}

// 启动游戏循环 | Start game loop
setInterval(() => mainLoop(16), 16);
```

## Core Concepts | 核心概念

### Entity Handles | 实体句柄

Entities are represented as numeric handles with generation-based safety:
实体表示为数值句柄，具有基于世代的安全性：

```typescript
// Entity is just a number (28-bit index + 20-bit generation)
// Entity只是一个数字（28位索引 + 20位世代）
const entity: Entity = world.createEntity();
console.log(entity); // e.g., 268435457

// Check if entity is still alive
// 检查实体是否仍然存在
if (world.isAlive(entity)) {
  // Entity is valid 实体有效
}
```

### Component Storage | 组件存储

Components are stored using sparse-set data structure for O(1) operations:
组件使用稀疏集数据结构存储，实现O(1)操作：

```typescript
// Add component to entity 向实体添加组件
world.addComponent(entity, Position, { x: 10, y: 20 });

// Get component from entity 从实体获取组件
const pos = world.getComponent(entity, Position);
if (pos) {
  console.log(`Position: ${pos.x}, ${pos.y}`);
}

// Remove component from entity 从实体移除组件
world.removeComponent(entity, Position);

// Check if entity has component 检查实体是否有组件
if (world.hasComponent(entity, Position)) {
  // Entity has Position component 实体有Position组件
}
```

### Command Buffer | 命令缓冲

Use command buffer for batched entity operations:
使用命令缓冲进行批量实体操作：

```typescript
const cmd = new CommandBuffer(world);

// Create entity with components 创建带组件的实体
const entity = cmd.create(true);
cmd.add(entity, Position, { x: 0, y: 0 });
cmd.add(entity, Velocity, { x: 1, y: 1 });

// Modify existing entities 修改现有实体
cmd.remove(otherEntity, Health);
cmd.destroy(deadEntity);

// Apply all changes at once 一次性应用所有更改
cmd.flush();
```

### Entity Queries | 实体查询

Query entities with specific component combinations:
查询具有特定组件组合的实体：

```typescript
// Basic query 基础查询
world.query(Position, Velocity).forEach((entity, pos, vel) => {
  pos.x += vel.x * deltaTime;
  pos.y += vel.y * deltaTime;
});

// Query with exclusions 带排除条件的查询
world.query(Position).without(Disabled).forEach((entity, pos) => {
  // Process enabled entities only 只处理启用的实体
});

// Query with change detection 带变更检测的查询
world.query(Position).changed().forEach((entity, pos) => {
  // Process only entities with changed Position components
  // 只处理Position组件发生变更的实体
});
```

### System Scheduling | 系统调度

Define and schedule systems with dependencies:
定义和调度带依赖关系的系统：

```typescript
// System with stage and dependencies 带阶段和依赖的系统
const PhysicsSystem = system('Physics', (ctx) => {
  // Physics simulation logic 物理模拟逻辑
})
  .stage('update')
  .inSet('Core')
  .before('Rendering')
  .after('Input')
  .runIf(world => world.hasComponent(world.getSingleton(), GameRunning))
  .flushPolicy('afterStage')
  .build();

// System execution stages 系统执行阶段
// startup: Run once on first tick 在第一次tick时运行一次
// preUpdate: Pre-processing 预处理
// update: Main game logic 主要游戏逻辑
// postUpdate: Post-processing 后处理
// cleanup: Resource cleanup 资源清理
```

### Change Detection | 变更检测

Track component changes with frame-based timestamps:
使用基于帧的时间戳跟踪组件变更：

```typescript
// Mark component as changed 标记组件为已变更
world.markChanged(entity, Position);

// Get current frame number 获取当前帧号
const currentFrame = world.frame;

// Check if component changed in specific frame 检查组件是否在特定帧变更
const changed = world.isChanged(entity, Position, currentFrame - 1);
```

## System Builder API | 系统构建器API

Complete system configuration with fluent API:
使用流式API进行完整的系统配置：

```typescript
const MySystem = system('MySystem', (ctx) => {
  // System logic here 系统逻辑
})
  .stage('update')                    // Execution stage 执行阶段
  .inSet('MyGroup')                   // System group 系统组
  .before('OtherSystem')              // Run before other systems 在其他系统前运行
  .after('set:Prerequisites')         // Run after system set 在系统集合后运行
  .runIf(world => gameIsRunning)      // Conditional execution 条件执行
  .flushPolicy('afterEach')           // Command flush policy 命令刷新策略
  .build();
```

## Performance Tips | 性能提示

### Query Optimization | 查询优化

- Use the smallest component set for queries 查询使用最小的组件集
- Leverage change detection to avoid unnecessary processing 利用变更检测避免不必要的处理
- Cache frequently used queries 缓存频繁使用的查询

### Memory Management | 内存管理

- Reuse component instances when possible 尽可能重用组件实例
- Use command buffer for batch operations 使用命令缓冲进行批量操作
- Minimize object allocations in hot paths 在热路径中最小化对象分配

### System Design | 系统设计

- Keep systems focused on single responsibilities 保持系统专注单一职责
- Use system sets for logical grouping 使用系统集合进行逻辑分组
- Declare dependencies explicitly for parallel execution 明确声明依赖以支持并行执行

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