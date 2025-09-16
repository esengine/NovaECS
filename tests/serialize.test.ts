/**
 * Tests for serialization system
 * 序列化系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Guid, registerSerde, getSerde, WorldSerializer, getGuidValue } from '../src/serialize';

// Test components
class Position {
  x: number = 0;
  y: number = 0;
}

class Velocity {
  vx: number = 0;
  vy: number = 0;
}

class CustomData {
  value: number = 0;
  flag: boolean = false;
}

describe('Serialization System', () => {
  let world: World;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    serializer = new WorldSerializer();

    // Register components
    registerComponent(Guid);
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(CustomData);
  });

  describe('Guid Component', () => {
    test('should generate unique GUIDs', () => {
      const guid1 = new Guid();
      const guid2 = new Guid();

      expect(guid1.value).toBeDefined();
      expect(guid2.value).toBeDefined();
      expect(guid1.value).not.toBe(guid2.value);
      // Accept both UUID format and fallback format
      expect(typeof guid1.value).toBe('string');
      expect(guid1.value.length).toBeGreaterThan(0);
    });

    test('should accept custom GUID value', () => {
      const customGuid = 'test-guid-123';
      const guid = new Guid(customGuid);

      expect(guid.value).toBe(customGuid);
    });
  });

  describe('Component Serde', () => {
    test('should use default serialization for unregistered components', () => {
      const serde = getSerde(Position);
      const pos = new Position();
      pos.x = 10;
      pos.y = 20;

      const serialized = serde.toJSON(pos);
      expect(serialized).toEqual({ x: 10, y: 20 });

      const deserialized = serde.fromJSON(serialized);
      expect(deserialized).toBeInstanceOf(Position);
      expect(deserialized.x).toBe(10);
      expect(deserialized.y).toBe(20);
    });

    test('should use custom serialization when registered', () => {
      // Register custom serde
      registerSerde(CustomData, {
        toJSON: (comp) => ({ val: comp.value, f: comp.flag }),
        fromJSON: (data) => {
          const comp = new CustomData();
          comp.value = data.val;
          comp.flag = data.f;
          return comp;
        }
      });

      const serde = getSerde(CustomData);
      const data = new CustomData();
      data.value = 42;
      data.flag = true;

      const serialized = serde.toJSON(data);
      expect(serialized).toEqual({ val: 42, f: true });

      const deserialized = serde.fromJSON(serialized);
      expect(deserialized).toBeInstanceOf(CustomData);
      expect(deserialized.value).toBe(42);
      expect(deserialized.flag).toBe(true);
    });
  });

  describe('WorldSerializer', () => {
    test('should save and load empty world', () => {
      const saveData = serializer.save(world);

      expect(saveData.version).toBe(1);
      expect(saveData.entities).toEqual([]);
    });

    test('should save and load single entity with components', () => {
      // Create entity with GUID
      const entity = world.createEntity();
      world.addComponent(entity, Guid, { value: 'test-guid-123' });
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { vx: 1, vy: 2 });

      // Save
      const saveData = serializer.save(world);
      expect(saveData.entities).toHaveLength(1);
      expect(saveData.entities[0].guid).toBe('test-guid-123');
      expect(saveData.entities[0].comps).toHaveLength(3);

      // Load into new world
      const newWorld = new World();
      registerComponent(Guid);
      registerComponent(Position);
      registerComponent(Velocity);

      serializer.load(newWorld, saveData);

      // Verify loaded entity
      let entityCount = 0;
      newWorld.query(Guid).forEach((loadedEntity, guid) => {
        entityCount++;
        expect(getGuidValue(guid)).toBe('test-guid-123');

        const pos = newWorld.getComponent(loadedEntity, Position);
        const vel = newWorld.getComponent(loadedEntity, Velocity);

        expect(pos?.x).toBe(10);
        expect(pos?.y).toBe(20);
        expect(vel?.vx).toBe(1);
        expect(vel?.vy).toBe(2);
      });
      expect(entityCount).toBe(1);
    });

    test('should save and load multiple entities', () => {
      // Create multiple entities
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();

      world.addComponent(entity1, Guid, { value: 'entity-1' });
      world.addComponent(entity1, Position, { x: 10, y: 20 });

      world.addComponent(entity2, Guid, { value: 'entity-2' });
      world.addComponent(entity2, Velocity, { vx: 5, vy: 6 });

      world.addComponent(entity3, Guid, { value: 'entity-3' });
      world.addComponent(entity3, Position, { x: 30, y: 40 });
      world.addComponent(entity3, Velocity, { vx: 7, vy: 8 });

      // Save
      const saveData = serializer.save(world);
      expect(saveData.entities).toHaveLength(3);

      // Load
      const newWorld = new World();
      registerComponent(Guid);
      registerComponent(Position);
      registerComponent(Velocity);

      serializer.load(newWorld, saveData);

      // Verify all entities loaded
      const guidValues = new Set<string>();
      let entityCount = 0;
      newWorld.query(Guid).forEach((_, guid) => {
        entityCount++;
        const guidValue = getGuidValue(guid);
        if (guidValue) {
          guidValues.add(guidValue);
        }
      });

      expect(entityCount).toBe(3);
      expect(guidValues).toEqual(new Set(['entity-1', 'entity-2', 'entity-3']));
    });

    test('should skip entities without GUID', () => {
      // Create entities with and without GUID
      const entityWithGuid = world.createEntity();
      const entityWithoutGuid = world.createEntity();

      world.addComponent(entityWithGuid, Guid, { value: 'has-guid' });
      world.addComponent(entityWithGuid, Position, { x: 10, y: 20 });

      world.addComponent(entityWithoutGuid, Position, { x: 30, y: 40 });

      // Save should only include entity with GUID
      const saveData = serializer.save(world);
      expect(saveData.entities).toHaveLength(1);
      expect(saveData.entities[0].guid).toBe('has-guid');
    });

    test('should handle custom component serialization', () => {
      // Register custom serde
      registerSerde(CustomData, {
        toJSON: (comp) => ({ customValue: comp.value * 2, customFlag: !comp.flag }),
        fromJSON: (data) => {
          const comp = new CustomData();
          comp.value = data.customValue / 2;
          comp.flag = !data.customFlag;
          return comp;
        }
      });

      const entity = world.createEntity();
      world.addComponent(entity, Guid, { value: 'test-entity' });

      const customData = new CustomData();
      customData.value = 21;
      customData.flag = false;
      world.addComponent(entity, CustomData, customData);

      // Save
      const saveData = serializer.save(world);
      const savedComp = saveData.entities[0].comps.find(c =>
        world.getComponent(entity, CustomData) &&
        world.getEntityComponents(entity).some(comp => comp.constructor === CustomData)
      );

      // Load
      const newWorld = new World();
      registerComponent(Guid);
      registerComponent(CustomData);

      serializer.load(newWorld, saveData);

      // Verify custom serialization worked
      newWorld.query(Guid).forEach((loadedEntity) => {
        const loadedCustom = newWorld.getComponent(loadedEntity, CustomData);
        expect(loadedCustom?.value).toBe(21);
        expect(loadedCustom?.flag).toBe(false);
      });
    });

    test('should handle missing component types gracefully', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Guid, { value: 'test-entity' });
      world.addComponent(entity, Position, { x: 10, y: 20 });

      const saveData = serializer.save(world);

      // Load without registering Position component
      const newWorld = new World();
      registerComponent(Guid);

      // Should not throw
      expect(() => {
        serializer.load(newWorld, saveData);
      }).not.toThrow();

      // Should still load GUID
      let entityCount = 0;
      newWorld.query(Guid).forEach(() => {
        entityCount++;
      });
      expect(entityCount).toBe(1);
    });

    test('should use custom version', () => {
      const customSerializer = new WorldSerializer(2);
      const saveData = customSerializer.save(world);

      expect(saveData.version).toBe(2);
    });
  });
});