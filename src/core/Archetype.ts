import type { Component } from './Component';
import type { ComponentType, ComponentTypeId, EntityId } from '../utils/Types';
import type {
  ArchetypeId,
  ComponentStorage,
  QuerySignature
} from '../utils/ArchetypeTypes';

/**
 * Archetype represents entities with the same component composition
 * 原型表示具有相同组件组合的实体
 * 
 * Key benefits:
 * - Cache-friendly memory layout 缓存友好的内存布局
 * - Fast iteration over entities 快速实体迭代
 * - Efficient component access 高效组件访问
 */
export class Archetype {
  private readonly _id: ArchetypeId;
  private readonly _componentTypes: Set<ComponentType>;
  private readonly _componentTypeIds: Set<ComponentTypeId>;
  private readonly _componentStorages = new Map<ComponentType, ComponentStorage>();
  private readonly _entityIds: EntityId[] = [];
  private readonly _entityIndexMap = new Map<EntityId, number>();
  private readonly _edgePairs = new Map<ComponentTypeId, { add?: ArchetypeId; remove?: ArchetypeId }>();
  private _entityCount = 0;

  constructor(componentTypes: ComponentType[]) {
    // Create unique ID based on component types
    this._id = this.createArchetypeId(componentTypes);
    this._componentTypes = new Set(componentTypes);
    this._componentTypeIds = new Set(componentTypes.map(type => type.typeId));

    // Initialize component storages
    for (const componentType of componentTypes) {
      this._componentStorages.set(componentType, {
        componentType,
        components: []
      });
    }
  }

  /**
   * Get archetype unique identifier
   * 获取原型唯一标识符
   */
  get id(): ArchetypeId {
    return this._id;
  }

  /**
   * Get component types in this archetype
   * 获取此原型中的组件类型
   */
  get componentTypes(): Set<ComponentType> {
    return new Set(this._componentTypes);
  }

  /**
   * Get number of entities in this archetype
   * 获取此原型中的实体数量
   */
  get entityCount(): number {
    return this._entityCount;
  }

  /**
   * Get all entity IDs in this archetype
   * 获取此原型中的所有实体ID
   */
  get entityIds(): EntityId[] {
    return [...this._entityIds];
  }

  /**
   * Check if archetype has specific component type
   * 检查原型是否具有特定组件类型
   */
  hasComponent(componentType: ComponentType): boolean {
    return this._componentTypes.has(componentType);
  }

  /**
   * Check if archetype matches query signature using stable typeIds
   * 使用稳定typeId检查原型是否匹配查询签名
   */
  matchesQuery(query: QuerySignature): boolean {
    // Check required components - default to empty set if undefined
    const required = query.required || new Set<ComponentTypeId>();
    for (const requiredTypeId of required) {
      if (!this._componentTypeIds.has(requiredTypeId)) {
        return false;
      }
    }

    // Check excluded components
    if (query.excluded) {
      for (const excludedTypeId of query.excluded) {
        if (this._componentTypeIds.has(excludedTypeId)) {
          return false;
        }
      }
    }

    // Check optional components - if specified, at least one must be present
    if (query.optional && query.optional.size > 0) {
      let hasOptional = false;
      for (const optionalTypeId of query.optional) {
        if (this._componentTypeIds.has(optionalTypeId)) {
          hasOptional = true;
          break;
        }
      }
      if (!hasOptional) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add entity to archetype
   * 向原型添加实体
   */
  addEntity(entityId: EntityId, components: Map<ComponentType, Component>): number {
    const archetypeIndex = this._entityCount;

    // Add entity ID
    this._entityIds.push(entityId);
    this._entityIndexMap.set(entityId, archetypeIndex);

    // Add components to storages
    for (const [componentType, component] of components) {
      const storage = this._componentStorages.get(componentType);
      if (storage) {
        storage.components.push(component);
      }
    }

    this._entityCount++;
    return archetypeIndex;
  }

  /**
   * Remove entity from archetype
   * 从原型移除实体
   */
  removeEntity(entityId: EntityId): {
    components: Map<ComponentType, Component>;
    swappedEntity?: { entityId: EntityId; newIndex: number }
  } | undefined {
    const entityIndex = this._entityIndexMap.get(entityId);
    if (entityIndex === undefined) {
      return undefined;
    }

    const components = new Map<ComponentType, Component>();

    // Get components before removal
    for (const [componentType, storage] of this._componentStorages) {
      const component = storage.components[entityIndex];
      if (component !== undefined) {
        components.set(componentType, component);
      }
    }

    // Remove from all storages using swap-remove for O(1) performance
    const lastIndex = this._entityCount - 1;
    let swappedEntity: { entityId: EntityId; newIndex: number } | undefined;

    if (entityIndex !== lastIndex) {
      // Swap with last entity
      const lastEntityId = this._entityIds[lastIndex];
      this._entityIds[entityIndex] = lastEntityId;
      this._entityIndexMap.set(lastEntityId, entityIndex);

      // Record swapped entity info for ArchetypeManager to update
      swappedEntity = { entityId: lastEntityId, newIndex: entityIndex };

      // Swap components
      for (const storage of this._componentStorages.values()) {
        storage.components[entityIndex] = storage.components[lastIndex];
      }
    }

    // Remove last elements
    this._entityIds.pop();
    this._entityIndexMap.delete(entityId);

    for (const storage of this._componentStorages.values()) {
      storage.components.pop();
    }

    this._entityCount--;

    if (swappedEntity) {
      return { components, swappedEntity };
    } else {
      return { components };
    }
  }

  /**
   * Get component for entity
   * 获取实体的组件
   */
  getComponent<T extends Component>(entityId: EntityId, componentType: ComponentType<T>): T | undefined {
    const entityIndex = this._entityIndexMap.get(entityId);
    if (entityIndex === undefined) {
      return undefined;
    }

    const storage = this._componentStorages.get(componentType);
    if (!storage) {
      return undefined;
    }

    return storage.components[entityIndex] as T;
  }

  /**
   * Get all components for entity at specific index
   * 获取特定索引处实体的所有组件
   */
  getComponentsAtIndex(index: number): Map<ComponentType, Component> {
    if (index < 0 || index >= this._entityCount) {
      return new Map();
    }

    const components = new Map<ComponentType, Component>();
    for (const [componentType, storage] of this._componentStorages) {
      const component = storage.components[index];
      if (component !== undefined) {
        components.set(componentType, component);
      }
    }

    return components;
  }

  /**
   * Get component storage for iteration
   * 获取用于迭代的组件存储
   */
  getComponentStorage<T extends Component>(componentType: ComponentType<T>): T[] | undefined {
    const storage = this._componentStorages.get(componentType);
    return storage ? storage.components as T[] : undefined;
  }

  /**
   * Iterate over entities with callback
   * 使用回调迭代实体
   */
  forEach(callback: (entityId: EntityId, index: number, components: Map<ComponentType, Component>) => void): void {
    for (let i = 0; i < this._entityCount; i++) {
      const entityId = this._entityIds[i];
      const components = this.getComponentsAtIndex(i);
      callback(entityId, i, components);
    }
  }

  /**
   * Add archetype edge for component transitions
   * 添加组件转换的原型边
   */
  addEdge(componentType: ComponentType, targetArchetypeId: ArchetypeId, isAddition: boolean): void {
    const typeId = componentType.typeId;
    const edgePair = this._edgePairs.get(typeId) || {};

    if (isAddition) {
      edgePair.add = targetArchetypeId;
    } else {
      edgePair.remove = targetArchetypeId;
    }

    this._edgePairs.set(typeId, edgePair);
  }

  /**
   * Get archetype edge pair for component transitions
   * 获取组件转换的原型边对
   */
  getEdgePair(componentTypeId: ComponentTypeId): { add?: ArchetypeId; remove?: ArchetypeId } | undefined {
    return this._edgePairs.get(componentTypeId);
  }

  /**
   * Get add edge for component type
   * 获取组件类型的添加边
   */
  getAddEdge(componentTypeId: ComponentTypeId): ArchetypeId | undefined {
    const edgePair = this._edgePairs.get(componentTypeId);
    return edgePair?.add;
  }

  /**
   * Get remove edge for component type
   * 获取组件类型的移除边
   */
  getRemoveEdge(componentTypeId: ComponentTypeId): ArchetypeId | undefined {
    const edgePair = this._edgePairs.get(componentTypeId);
    return edgePair?.remove;
  }


  /**
   * Create unique archetype ID from component types
   * 从组件类型创建唯一原型ID
   */
  private createArchetypeId(componentTypes: ComponentType[]): ArchetypeId {
    // Sort component types by typeId for consistent ID
    const sortedTypeIds = componentTypes
      .map(type => type.typeId)
      .sort((a, b) => a - b)
      .join('|');

    return `archetype:${sortedTypeIds}`;
  }

  /**
   * Check if this archetype can transition to another by adding/removing a component
   * 检查此原型是否可以通过添加/移除组件转换到另一个原型
   */
  canTransitionTo(other: Archetype, componentType: ComponentType): 'add' | 'remove' | null {
    const thisTypes = this._componentTypes;
    const otherTypes = other._componentTypes;

    // Check for addition
    if (!thisTypes.has(componentType) && otherTypes.has(componentType)) {
      const expectedTypes = new Set([...thisTypes, componentType]);
      if (this.setsEqual(expectedTypes, otherTypes)) {
        return 'add';
      }
    }

    // Check for removal
    if (thisTypes.has(componentType) && !otherTypes.has(componentType)) {
      const expectedTypes = new Set([...thisTypes]);
      expectedTypes.delete(componentType);
      if (this.setsEqual(expectedTypes, otherTypes)) {
        return 'remove';
      }
    }

    return null;
  }

  /**
   * Helper to check if two sets are equal
   * 检查两个集合是否相等的辅助方法
   */
  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) {
      return false;
    }
    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }
    return true;
  }
}