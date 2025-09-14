import { Archetype } from './Archetype';
import type { Component } from './Component';
import type { ComponentType, ComponentTypeId, EntityId } from '../utils/Types';
import type { ArchetypeId, QuerySignature } from '../utils/ArchetypeTypes';

/**
 * Entity archetype record for tracking entity location
 * 实体原型记录，用于跟踪实体位置
 */
interface EntityArchetypeRecord {
  /** Archetype containing the entity 包含实体的原型 */
  archetype: Archetype;
  /** Index within the archetype 在原型中的索引 */
  index: number;
}

/**
 * Manages all archetypes and entity-archetype relationships
 * 管理所有原型和实体-原型关系
 */
export class ArchetypeManager {
  private readonly _archetypes = new Map<ArchetypeId, Archetype>();
  private readonly _entityToArchetype = new Map<EntityId, EntityArchetypeRecord>();
  private readonly _queryCache = new Map<string, Archetype[]>();

  /**
   * Get or create archetype for component types
   * 获取或创建组件类型的原型
   */
  getOrCreateArchetype(componentTypes: ComponentType[]): Archetype {
    // Sort component types by typeId for consistent archetype ID
    const sortedTypes = [...componentTypes].sort((a, b) => a.typeId - b.typeId);
    const archetypeId = this.createArchetypeId(sortedTypes);
    
    let archetype = this._archetypes.get(archetypeId);
    if (!archetype) {
      archetype = new Archetype(sortedTypes);
      this._archetypes.set(archetypeId, archetype);
      
      // Build edges to related archetypes
      this.buildArchetypeEdges(archetype);
      
      // Invalidate query cache
      this._queryCache.clear();
    }
    
    return archetype;
  }

  /**
   * Get archetype by ID
   * 通过ID获取原型
   * @param archetypeId The archetype ID to retrieve 要获取的原型ID
   * @returns The archetype if found, undefined otherwise 如果找到则返回原型，否则返回undefined
   */
  getArchetype(archetypeId: ArchetypeId): Archetype | undefined {
    return this._archetypes.get(archetypeId);
  }

  /**
   * Get all archetypes
   * 获取所有原型
   */
  getAllArchetypes(): Archetype[] {
    return Array.from(this._archetypes.values());
  }

  /**
   * Add entity to appropriate archetype
   * 将实体添加到适当的原型
   * @param entityId The entity ID to add 要添加的实体ID
   * @param components Map of component types to component instances 组件类型到组件实例的映射
   */
  addEntity(entityId: EntityId, components: Map<ComponentType, Component>): void {
    const componentTypes = Array.from(components.keys());
    const archetype = this.getOrCreateArchetype(componentTypes);
    
    const index = archetype.addEntity(entityId, components);
    this._entityToArchetype.set(entityId, { archetype, index });
  }

  /**
   * Remove entity from its archetype
   * 从原型中移除实体
   * @param entityId The entity ID to remove 要移除的实体ID
   * @returns Map of components that were removed, undefined if entity not found 被移除的组件映射，如果实体未找到则返回undefined
   */
  removeEntity(entityId: EntityId): Map<ComponentType, Component> | undefined {
    const record = this._entityToArchetype.get(entityId);
    if (!record) {
      return undefined;
    }

    const components = record.archetype.removeEntity(entityId);
    this._entityToArchetype.delete(entityId);
    
    return components;
  }

  /**
   * Move entity to new archetype (for component addition/removal)
   * 将实体移动到新原型（用于组件添加/移除）
   */
  moveEntity(
    entityId: EntityId, 
    newComponents: Map<ComponentType, Component>
  ): boolean {
    // Remove from current archetype
    const oldComponents = this.removeEntity(entityId);
    if (!oldComponents) {
      return false;
    }

    // Add to new archetype
    this.addEntity(entityId, newComponents);
    return true;
  }

  /**
   * Get entity's current archetype
   * 获取实体当前的原型
   */
  getEntityArchetype(entityId: EntityId): Archetype | undefined {
    const record = this._entityToArchetype.get(entityId);
    return record ? record.archetype : undefined;
  }

  /**
   * Get entity's component from its archetype
   * 从实体的原型获取组件
   */
  getEntityComponent<T extends Component>(
    entityId: EntityId, 
    componentType: ComponentType<T>
  ): T | undefined {
    const record = this._entityToArchetype.get(entityId);
    if (!record) {
      return undefined;
    }

    return record.archetype.getComponent(entityId, componentType);
  }

  /**
   * Check if entity has specific component
   * 检查实体是否具有特定组件
   */
  entityHasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    const record = this._entityToArchetype.get(entityId);
    if (!record) {
      return false;
    }

    return record.archetype.hasComponent(componentType);
  }

  /**
   * Get all component types for an entity
   * 获取实体的所有组件类型
   */
  getEntityComponentTypes(entityId: EntityId): ComponentType[] {
    const record = this._entityToArchetype.get(entityId);
    if (!record) {
      return [];
    }

    return Array.from(record.archetype.componentTypes);
  }

  /**
   * Get all components for an entity
   * 获取实体的所有组件
   */
  getEntityComponents(entityId: EntityId): Component[] {
    const componentTypes = this.getEntityComponentTypes(entityId);
    const components: Component[] = [];

    for (const componentType of componentTypes) {
      const component = this.getEntityComponent(entityId, componentType);
      if (component) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Check if entity has all specified components
   * 检查实体是否具有所有指定组件
   */
  entityHasComponents(entityId: EntityId, componentTypes: ComponentType[]): boolean {
    const record = this._entityToArchetype.get(entityId);
    if (!record) {
      return false;
    }

    return componentTypes.every(type => record.archetype.hasComponent(type));
  }

  /**
   * Query archetypes that match component requirements
   * 查询匹配组件要求的原型
   */
  queryArchetypes(componentTypes: ComponentType[]): Archetype[] {
    // Create cache key using stable typeId instead of name
    const cacheKey = componentTypes
      .map(type => type.typeId)
      .sort((a, b) => a - b)
      .join('|');
    
    // Check cache first
    let matchingArchetypes = this._queryCache.get(cacheKey);
    if (matchingArchetypes) {
      return matchingArchetypes;
    }

    // Create query signature using stable typeIds
    const query: QuerySignature = {
      required: new Set(componentTypes.map(type => type.typeId))
    };

    // Find matching archetypes
    matchingArchetypes = Array.from(this._archetypes.values())
      .filter(archetype => archetype.matchesQuery(query));

    // Cache result
    this._queryCache.set(cacheKey, matchingArchetypes);
    return matchingArchetypes;
  }

  /**
   * Query archetypes with advanced filtering
   * 使用高级过滤查询原型
   */
  queryArchetypesAdvanced(query: QuerySignature): Archetype[] {
    return Array.from(this._archetypes.values())
      .filter(archetype => archetype.matchesQuery(query));
  }

  /**
   * Get entities that match component requirements
   * 获取匹配组件要求的实体
   */
  queryEntities(componentTypes: ComponentType[]): EntityId[] {
    const matchingArchetypes = this.queryArchetypes(componentTypes);
    const entities: EntityId[] = [];

    for (const archetype of matchingArchetypes) {
      entities.push(...archetype.entityIds);
    }

    return entities;
  }

  /**
   * Iterate over entities with specific components
   * 迭代具有特定组件的实体
   */
  iterateEntities<T extends Component[]>(
    componentTypes: ComponentType[],
    callback: (entityId: EntityId, ...components: T) => void
  ): void {
    const matchingArchetypes = this.queryArchetypes(componentTypes);

    for (const archetype of matchingArchetypes) {
      // Get component storages for efficient iteration
      const storages = componentTypes.map(type => 
        archetype.getComponentStorage(type)
      ).filter(Boolean) as Component[][];

      // Ensure all required storages exist
      if (storages.length !== componentTypes.length) {
        continue;
      }

      // Iterate over entities in this archetype
      for (let i = 0; i < archetype.entityCount; i++) {
        const entityId = archetype.entityIds[i];
        const components = storages.map(storage => storage[i]) as T;
        callback(entityId, ...components);
      }
    }
  }

  /**
   * Get archetype statistics
   * 获取原型统计信息
   */
  getStatistics(): {
    archetypeCount: number;
    totalEntities: number;
    averageEntitiesPerArchetype: number;
    largestArchetype: { id: ArchetypeId; entityCount: number } | null;
  } {
    const archetypes = Array.from(this._archetypes.values());
    const totalEntities = archetypes.reduce((sum, arch) => sum + arch.entityCount, 0);
    
    let largestArchetype: { id: ArchetypeId; entityCount: number } | null = null;
    for (const archetype of archetypes) {
      if (!largestArchetype || archetype.entityCount > largestArchetype.entityCount) {
        largestArchetype = {
          id: archetype.id,
          entityCount: archetype.entityCount
        };
      }
    }

    return {
      archetypeCount: this._archetypes.size,
      totalEntities,
      averageEntitiesPerArchetype: this._archetypes.size > 0 ? totalEntities / this._archetypes.size : 0,
      largestArchetype
    };
  }

  /**
   * Clear all archetypes and entities
   * 清除所有原型和实体
   */
  clear(): void {
    this._archetypes.clear();
    this._entityToArchetype.clear();
    this._queryCache.clear();
  }

  /**
   * Create archetype ID from sorted component types
   * 从排序的组件类型创建原型ID
   */
  private createArchetypeId(componentTypes: ComponentType[]): ArchetypeId {
    const typeIds = componentTypes.map(type => type.typeId).join('|');
    return `archetype:${typeIds}`;
  }

  /**
   * Build edges between related archetypes
   * 构建相关原型之间的边
   */
  private buildArchetypeEdges(newArchetype: Archetype): void {
    const newTypes = newArchetype.componentTypes;

    // Find archetypes that differ by exactly one component
    for (const existingArchetype of this._archetypes.values()) {
      if (existingArchetype === newArchetype) continue;

      const existingTypes = existingArchetype.componentTypes;
      
      // Check all components in new archetype
      for (const componentType of newTypes) {
        const transition = existingArchetype.canTransitionTo(newArchetype, componentType);
        if (transition === 'add') {
          existingArchetype.addEdge(componentType, newArchetype.id, true);
          newArchetype.addEdge(componentType, existingArchetype.id, false);
        }
      }

      // Check all components in existing archetype
      for (const componentType of existingTypes) {
        const transition = newArchetype.canTransitionTo(existingArchetype, componentType);
        if (transition === 'add') {
          newArchetype.addEdge(componentType, existingArchetype.id, true);
          existingArchetype.addEdge(componentType, newArchetype.id, false);
        }
      }
    }
  }
}