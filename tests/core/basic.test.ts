/**
 * Basic test to ensure test framework is working
 * 基本测试以确保测试框架正常工作
 */

import { describe, test, expect } from 'vitest';
import { World, EntityManager, makeEntity, indexOf, genOf } from '../../src/index';

describe('Basic Framework Tests', () => {
  test('Entity handle utilities should work correctly', () => {
    const entity = makeEntity(42, 1);
    expect(indexOf(entity)).toBe(42);
    expect(genOf(entity)).toBe(1);
  });

  test('EntityManager should create entities', () => {
    const em = new EntityManager();
    const entity = em.create();
    expect(em.isAlive(entity)).toBe(true);
    expect(em.isEnabled(entity)).toBe(true);
  });

  test('World should create and manage entities', () => {
    const world = new World();
    const entity = world.createEntity();
    expect(world.isAlive(entity)).toBe(true);
    expect(world.isEnabled(entity)).toBe(true);

    world.destroyEntity(entity);
    expect(world.isAlive(entity)).toBe(false);
  });

  test('Component registration should work', () => {
    class TestComponent {
      value = 42;
    }

    const world = new World();
    const entity = world.createEntity();

    world.addComponent(entity, TestComponent, { value: 100 });
    const component = world.getComponent(entity, TestComponent);

    expect(component).toBeDefined();
    expect(component?.value).toBe(100);
  });
});