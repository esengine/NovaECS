import type { World } from '../core/World';
import type { Entity } from '../core/Entity';
import { Guid } from '../components/Guid';
import { componentSerdeRegistry } from './ComponentSerde';
import type { SaveData, SaveOptions, LoadOptions, SerializedEntity } from './Types';
import { getCtorByTypeId } from '../core/ComponentRegistry';

export class WorldSerializer {
  private static readonly CURRENT_VERSION = 1;

  static save(world: World, options: SaveOptions = {}): SaveData {
    const entities: SerializedEntity[] = [];

    for (const entity of world.entities()) {
      const guidComp = world.getComponent(entity, Guid);
      if (!guidComp) continue; // Skip entities without GUID

      const serializedEntity: SerializedEntity = {
        guid: guidComp.value,
        components: {}
      };

      // Serialize all registered components
      for (const type of componentSerdeRegistry.getRegisteredTypes()) {
        if (options.includeComponents && !options.includeComponents.includes(type)) {
          continue;
        }
        if (options.excludeComponents && options.excludeComponents.includes(type)) {
          continue;
        }

        const component = world.getComponent(entity, type);
        if (component) {
          const serde = componentSerdeRegistry.get(type);
          if (serde) {
            const typeName = type.name;
            serializedEntity.components[typeName] = serde.serialize(component);
          }
        }
      }

      entities.push(serializedEntity);
    }

    return {
      version: this.CURRENT_VERSION,
      entities,
      metadata: options.metadata
    };
  }

  static load(world: World, saveData: SaveData, options: LoadOptions = {}): void {
    if (saveData.version !== this.CURRENT_VERSION) {
      throw new Error(`Unsupported save version: ${saveData.version}, expected: ${this.CURRENT_VERSION}`);
    }

    if (options.clearWorld) {
      world.clear();
    }

    const guidToEntity = new Map<string, Entity>();

    // First pass: create entities and GUIDs
    for (const serializedEntity of saveData.entities) {
      let entity: Entity;

      if (options.mergeEntities) {
        // Try to find existing entity with this GUID
        entity = this.findEntityByGuid(world, serializedEntity.guid) || world.createEntity();
      } else {
        entity = world.createEntity();
      }

      guidToEntity.set(serializedEntity.guid, entity);

      // Set GUID component
      const guid = new Guid();
      guid.value = serializedEntity.guid;
      world.addComponent(entity, Guid, guid);
    }

    // Second pass: deserialize components
    for (const serializedEntity of saveData.entities) {
      const entity = guidToEntity.get(serializedEntity.guid)!;

      for (const [typeName, componentData] of Object.entries(serializedEntity.components)) {
        if (typeName === 'Guid') continue; // Already handled

        const type = this.getTypeByName(typeName);
        if (!type) {
          console.warn(`Component type not found: ${typeName}`);
          continue;
        }

        const serde = componentSerdeRegistry.get(type);
        if (!serde) {
          console.warn(`No serde registered for component: ${typeName}`);
          continue;
        }

        try {
          const component = serde.deserialize(componentData);
          world.addComponent(entity, type, component);
        } catch (error) {
          console.error(`Failed to deserialize component ${typeName}:`, error);
        }
      }
    }
  }

  private static findEntityByGuid(world: World, guid: string): Entity | undefined {
    for (const entity of world.entities()) {
      const guidComp = world.getComponent(entity, Guid);
      if (guidComp && guidComp.value === guid) {
        return entity;
      }
    }
    return undefined;
  }

  private static getTypeByName(name: string): any {
    // This is a simple implementation - in a real system you might want
    // a more robust type registry
    return getCtorByTypeId ? Object.values(getCtorByTypeId).find(ctor => ctor.name === name) : undefined;
  }
}