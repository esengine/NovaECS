import { World } from '../src/core/World';
import { describe, it, expect, beforeEach } from 'vitest';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Health {
  constructor(public value: number = 100) {}
}

describe('Query optional() and changed() functionality', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('should handle optional components correctly', () => {
    // 创建实体：一些有Health，一些没有
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
    world.addComponent(entity1, Health, { value: 100 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });
    // entity2 没有 Health 组件

    const results: Array<{
      entity: number;
      position: Position;
      velocity: Velocity;
      health?: Health;
    }> = [];

    // 查询：要求Position和Velocity，Health是可选的
    world.query(Position, Velocity)
      .optional(Health)
      .forEach((entity, position, velocity, health) => {
        results.push({ entity, position, velocity, health });
      });

    expect(results).toHaveLength(2);

    // entity1 应该有所有组件
    const result1 = results.find(r => r.entity === entity1);
    expect(result1).toBeDefined();
    expect(result1!.position.x).toBe(10);
    expect(result1!.velocity.dx).toBe(1);
    expect(result1!.health).toBeDefined();
    expect(result1!.health!.value).toBe(100);

    // entity2 应该没有health组件
    const result2 = results.find(r => r.entity === entity2);
    expect(result2).toBeDefined();
    expect(result2!.position.x).toBe(30);
    expect(result2!.velocity.dx).toBe(3);
    expect(result2!.health).toBeUndefined();
  });

  it('should handle changed() queries', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

    const results: number[] = [];

    // 查询只有Position组件发生变化的实体
    world.query(Position, Velocity)
      .changed(Position)
      .forEach((entity) => {
        results.push(entity);
      });

    // 由于目前是fallback实现，应该返回所有实体
    expect(results).toHaveLength(2);
    expect(results).toContain(entity1);
    expect(results).toContain(entity2);
  });

  it('should work with both optional and changed together', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
    world.addComponent(entity1, Health, { value: 100 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

    const results: Array<{
      entity: number;
      position: Position;
      velocity: Velocity;
      health?: Health;
    }> = [];

    // 组合使用 optional 和 changed
    world.query(Position, Velocity)
      .optional(Health)
      .changed(Position)
      .forEach((entity, position, velocity, health) => {
        results.push({ entity, position, velocity, health });
      });

    expect(results).toHaveLength(2);

    const result1 = results.find(r => r.entity === entity1);
    expect(result1!.health).toBeDefined();

    const result2 = results.find(r => r.entity === entity2);
    expect(result2!.health).toBeUndefined();
  });

  it('should use forEachRaw with optional columns', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
    world.addComponent(entity1, Health, { value: 100 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

    const results: Array<{
      row: number;
      entitiesLength: number;
      requiredCols: number;
      optionalCols?: number;
    }> = [];

    world.query(Position, Velocity)
      .optional(Health)
      .forEachRaw((row, entities, cols, optionalCols) => {
        results.push({
          row,
          entitiesLength: entities.length,
          requiredCols: cols.length,
          optionalCols: optionalCols?.length
        });
      });

    expect(results.length).toBeGreaterThan(0);

    // 应该有2个必需的列（Position, Velocity）
    expect(results[0].requiredCols).toBe(2);

    // 应该有1个可选列（Health）
    expect(results[0].optionalCols).toBe(1);
  });
});