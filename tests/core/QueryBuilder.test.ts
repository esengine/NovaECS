import { describe, test, expect, beforeEach } from 'vitest';
import { QueryBuilder } from '../../src/core/QueryBuilder';
import { Component } from '../../src/core/Component';
import { Entity } from '../../src/core/Entity';
import type { QueryCriteria, QueryOptions, QueryResult } from '../../src/utils/QueryTypes';

// Test components
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

class HealthComponent extends Component {
  constructor(public current: number = 100, public max: number = 100) {
    super();
  }
}

class DeadComponent extends Component {}

describe('QueryBuilder', () => {
  let mockExecuteQuery: (criteria: QueryCriteria, options?: QueryOptions) => QueryResult;
  let queryBuilder: QueryBuilder;
  let mockEntities: Entity[];

  beforeEach(() => {
    // Create mock entities
    mockEntities = [
      new Entity(1),
      new Entity(2),
      new Entity(3)
    ];

    // Mock execute query function
    mockExecuteQuery = (_criteria: QueryCriteria, _options?: QueryOptions): QueryResult => {
      return {
        entities: mockEntities,
        totalCount: mockEntities.length,
        fromCache: false,
        executionTime: 1.5,
        archetypesChecked: 2
      };
    };

    queryBuilder = new QueryBuilder(mockExecuteQuery);
  });

  describe('Fluent API', () => {
    test('should support with() method', () => {
      const builder = queryBuilder.with(PositionComponent, VelocityComponent);
      expect(builder).toBe(queryBuilder); // Should return same instance for chaining
      
      const criteria = builder.getCriteria();
      expect(criteria.all).toEqual([PositionComponent, VelocityComponent]);
    });

    test('should support all() method as alias for with()', () => {
      const builder = queryBuilder.all(PositionComponent);
      const criteria = builder.getCriteria();
      expect(criteria.all).toEqual([PositionComponent]);
    });

    test('should support any() method', () => {
      const builder = queryBuilder.any(PositionComponent, VelocityComponent);
      const criteria = builder.getCriteria();
      expect(criteria.any).toEqual([PositionComponent, VelocityComponent]);
    });

    test('should support without() method', () => {
      const builder = queryBuilder.without(DeadComponent);
      const criteria = builder.getCriteria();
      expect(criteria.none).toEqual([DeadComponent]);
    });

    test('should support none() method as alias for without()', () => {
      const builder = queryBuilder.none(DeadComponent);
      const criteria = builder.getCriteria();
      expect(criteria.none).toEqual([DeadComponent]);
    });

    test('should support method chaining', () => {
      const builder = queryBuilder
        .with(PositionComponent)
        .any(VelocityComponent, HealthComponent)
        .without(DeadComponent)
        .limit(10)
        .offset(5);

      const criteria = builder.getCriteria();
      const options = builder.getOptions();

      expect(criteria.all).toEqual([PositionComponent]);
      expect(criteria.any).toEqual([VelocityComponent, HealthComponent]);
      expect(criteria.none).toEqual([DeadComponent]);
      expect(options.limit).toBe(10);
      expect(options.offset).toBe(5);
    });
  });

  describe('Options', () => {
    test('should set limit', () => {
      queryBuilder.limit(5);
      const options = queryBuilder.getOptions();
      expect(options.limit).toBe(5);
    });

    test('should set offset', () => {
      queryBuilder.offset(10);
      const options = queryBuilder.getOptions();
      expect(options.offset).toBe(10);
    });

    test('should set includeInactive', () => {
      queryBuilder.includeInactive(true);
      const options = queryBuilder.getOptions();
      expect(options.includeInactive).toBe(true);
    });

    test('should set useCache', () => {
      queryBuilder.useCache(false);
      const options = queryBuilder.getOptions();
      expect(options.useCache).toBe(false);
    });

    test('should allow negative limit and offset for validation', () => {
      queryBuilder.limit(-5).offset(-10);
      const options = queryBuilder.getOptions();
      expect(options.limit).toBe(-5);
      expect(options.offset).toBe(-10);
    });
  });

  describe('Filters and Sorting', () => {
    test('should add custom filter', () => {
      const filterFn = (entity: Entity) => entity.id > 1;
      queryBuilder.filter(filterFn);
      
      const options = queryBuilder.getOptions();
      expect(options.filter).toBe(filterFn);
    });

    test('should combine multiple filters with AND logic', () => {
      const filter1 = (entity: Entity) => entity.id > 1;
      const filter2 = (entity: Entity) => entity.id < 5;
      
      queryBuilder.filter(filter1).filter(filter2);
      
      const options = queryBuilder.getOptions();
      expect(options.filter).toBeDefined();
      
      // Test combined filter
      const testEntity = new Entity(3);
      expect(options.filter!(testEntity)).toBe(true);
      
      const testEntity2 = new Entity(6);
      expect(options.filter!(testEntity2)).toBe(false);
    });

    test('should add sort function', () => {
      const sortFn = (a: Entity, b: Entity) => a.id - b.id;
      queryBuilder.sort(sortFn);
      
      const options = queryBuilder.getOptions();
      expect(options.sort).toBe(sortFn);
    });
  });

  describe('Execution Methods', () => {
    test('should execute query and return entities', () => {
      const entities = queryBuilder.with(PositionComponent).execute();
      expect(entities).toEqual(mockEntities);
    });

    test('should execute query and return metadata', () => {
      const result = queryBuilder.with(PositionComponent).executeWithMetadata();
      expect(result.entities).toEqual(mockEntities);
      expect(result.totalCount).toBe(mockEntities.length);
      expect(result.fromCache).toBe(false);
      expect(result.executionTime).toBe(1.5);
      expect(result.archetypesChecked).toBe(2);
    });

    test('should return first entity', () => {
      const entity = queryBuilder.with(PositionComponent).first();
      expect(entity).toBe(mockEntities[0]);
    });

    test('should return undefined when no entities match', () => {
      mockExecuteQuery = () => ({
        entities: [],
        totalCount: 0,
        fromCache: false,
        executionTime: 1,
        archetypesChecked: 0
      });
      
      queryBuilder = new QueryBuilder(mockExecuteQuery);
      const entity = queryBuilder.with(PositionComponent).first();
      expect(entity).toBeUndefined();
    });

    test('should check if entities exist', () => {
      expect(queryBuilder.with(PositionComponent).exists()).toBe(true);
      
      mockExecuteQuery = () => ({
        entities: [],
        totalCount: 0,
        fromCache: false,
        executionTime: 1,
        archetypesChecked: 0
      });
      
      queryBuilder = new QueryBuilder(mockExecuteQuery);
      expect(queryBuilder.with(PositionComponent).exists()).toBe(false);
    });

    test('should count entities', () => {
      const count = queryBuilder.with(PositionComponent).count();
      expect(count).toBe(mockEntities.length);
    });
  });

  describe('Builder Management', () => {
    test('should reset builder', () => {
      queryBuilder
        .with(PositionComponent)
        .limit(10)
        .reset();

      const criteria = queryBuilder.getCriteria();
      const options = queryBuilder.getOptions();

      expect(Object.keys(criteria)).toHaveLength(0);
      expect(Object.keys(options)).toHaveLength(0);
    });

    test('should clone builder', () => {
      const original = queryBuilder
        .with(PositionComponent)
        .limit(10);

      const cloned = original.clone();
      
      expect(cloned).not.toBe(original);
      expect(cloned.getCriteria()).toEqual(original.getCriteria());
      expect(cloned.getOptions()).toEqual(original.getOptions());
      
      // Modifications to clone should not affect original
      cloned.with(VelocityComponent);
      expect(original.getCriteria().all).toEqual([PositionComponent]);
      expect(cloned.getCriteria().all).toEqual([PositionComponent, VelocityComponent]);
    });
  });

  describe('Signature Generation', () => {
    test('should generate consistent signatures', () => {
      const builder1 = new QueryBuilder(mockExecuteQuery).with(PositionComponent, VelocityComponent);
      const builder2 = new QueryBuilder(mockExecuteQuery).with(VelocityComponent, PositionComponent);

      expect(builder1.getSignature()).toBe(builder2.getSignature());
    });

    test('should include options in signature', () => {
      const builder1 = new QueryBuilder(mockExecuteQuery).with(PositionComponent);
      const builder2 = new QueryBuilder(mockExecuteQuery).with(PositionComponent).limit(10);

      expect(builder1.getSignature()).not.toBe(builder2.getSignature());
    });
  });

  describe('Validation', () => {
    test('should validate valid query', () => {
      const result = queryBuilder.with(PositionComponent).validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect conflicting criteria', () => {
      const result = queryBuilder
        .with(PositionComponent)
        .without(PositionComponent)
        .validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Component PositionComponent is both required and excluded');
    });

    test('should detect empty query', () => {
      const result = queryBuilder.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Query must have at least one criteria or filter');
    });

    test('should detect invalid options', () => {
      // Use the limit method which now allows negative values for validation testing
      const testBuilder = new QueryBuilder(mockExecuteQuery);
      testBuilder.with(PositionComponent).limit(-5);

      const result = testBuilder.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit must be non-negative');
    });

    test('should allow query with custom filter only', () => {
      const result = queryBuilder
        .filter((entity: Entity) => entity.id > 0)
        .validate();
      expect(result.valid).toBe(true);
    });
  });
});
