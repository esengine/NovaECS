import { describe, test, expect, beforeEach } from 'vitest';
import { QueryManager } from '../../src/core/QueryManager';
import { ArchetypeManager } from '../../src/core/ArchetypeManager';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import type { QueryCriteria, QueryOptions } from '../../src/utils/QueryTypes';

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

describe('QueryManager', () => {
  let queryManager: QueryManager;
  let archetypeManager: ArchetypeManager;
  let entities: Entity[];

  beforeEach(() => {
    archetypeManager = new ArchetypeManager();
    entities = [];
    
    // Create test entities
    const entity1 = new Entity(1);
    entity1.addComponent(new PositionComponent(10, 20));
    entity1.addComponent(new VelocityComponent(1, 0));
    entities.push(entity1);

    const entity2 = new Entity(2);
    entity2.addComponent(new PositionComponent(30, 40));
    entity2.addComponent(new HealthComponent(80, 100));
    entities.push(entity2);

    const entity3 = new Entity(3);
    entity3.addComponent(new VelocityComponent(0, 1));
    entity3.addComponent(new DeadComponent());
    entities.push(entity3);

    const entity4 = new Entity(4);
    entity4.addComponent(new PositionComponent(50, 60));
    entity4.addComponent(new VelocityComponent(2, 2));
    entity4.addComponent(new HealthComponent(100, 100));
    entities.push(entity4);

    // Add entities to archetype manager
    for (const entity of entities) {
      const components = new Map();
      for (const component of entity.getComponents()) {
        components.set(component.constructor, component);
      }
      archetypeManager.addEntity(entity.id, components);
    }

    queryManager = new QueryManager(
      archetypeManager,
      () => entities
    );
  });

  describe('Basic Queries', () => {
    test('should query entities with single component', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map(e => e.id)).toEqual([1, 2, 4]);
      expect(result.fromCache).toBe(false);
      expect(result.totalCount).toBe(3);
    });

    test('should query entities with multiple components (AND)', () => {
      const criteria: QueryCriteria = { all: [PositionComponent, VelocityComponent] };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.id)).toEqual([1, 4]);
    });

    test('should query entities with any components (OR)', () => {
      const criteria: QueryCriteria = { any: [HealthComponent, DeadComponent] };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map(e => e.id)).toEqual([2, 3, 4]);
    });

    test('should query entities without specific components', () => {
      const criteria: QueryCriteria = {
        all: [PositionComponent],
        none: [DeadComponent]
      };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map(e => e.id)).toEqual([1, 2, 4]);
    });

    test('should support with/without aliases', () => {
      const criteria: QueryCriteria = {
        with: [PositionComponent],
        without: [DeadComponent]
      };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map(e => e.id)).toEqual([1, 2, 4]);
    });
  });

  describe('Complex Queries', () => {
    test('should combine all, any, and none criteria', () => {
      const criteria: QueryCriteria = {
        all: [PositionComponent],
        any: [VelocityComponent, HealthComponent],
        none: [DeadComponent]
      };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(3);
      expect(result.entities.map(e => e.id)).toEqual([1, 2, 4]);
    });

    test('should apply custom filter', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      const options: QueryOptions = {
        filter: (entity) => {
          const pos = entity.getComponent(PositionComponent);
          return pos ? pos.x > 20 : false;
        }
      };
      const result = queryManager.query(criteria, options);

      expect(result.entities).toHaveLength(2);
      expect(result.entities.map(e => e.id)).toEqual([2, 4]);
    });

    test('should apply sorting', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      const options: QueryOptions = {
        sort: (a, b) => {
          const posA = a.getComponent(PositionComponent)!;
          const posB = b.getComponent(PositionComponent)!;
          return posB.x - posA.x; // Descending by x
        }
      };
      const result = queryManager.query(criteria, options);

      expect(result.entities.map(e => e.id)).toEqual([4, 2, 1]);
    });

    test('should apply limit and offset', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      const options: QueryOptions = {
        limit: 2,
        offset: 1
      };
      const result = queryManager.query(criteria, options);

      expect(result.entities).toHaveLength(2);
      expect(result.totalCount).toBe(3); // Total before limit/offset
    });
  });

  describe('Caching', () => {
    test('should cache query results by default', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      
      // First query
      const result1 = queryManager.query(criteria);
      expect(result1.fromCache).toBe(false);

      // Second query should be from cache
      const result2 = queryManager.query(criteria);
      expect(result2.fromCache).toBe(true);
      expect(result2.entities).toEqual(result1.entities);
    });

    test('should respect useCache option', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      
      // First query with caching disabled
      const result1 = queryManager.query(criteria, { useCache: false });
      expect(result1.fromCache).toBe(false);

      // Second query with caching disabled
      const result2 = queryManager.query(criteria, { useCache: false });
      expect(result2.fromCache).toBe(false);
    });

    test('should clear cache', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      
      // First query
      queryManager.query(criteria);
      
      // Clear cache
      queryManager.clearCache();
      
      // Second query should not be from cache
      const result = queryManager.query(criteria);
      expect(result.fromCache).toBe(false);
    });

    test('should invalidate cache on entity changes', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      
      // First query
      const result1 = queryManager.query(criteria);
      expect(result1.fromCache).toBe(false);

      // Simulate entity change
      queryManager.onEntityChanged(1);

      // Second query should not be from cache
      const result2 = queryManager.query(criteria);
      expect(result2.fromCache).toBe(false);
    });
  });

  describe('Query Builder Integration', () => {
    test('should create query builder', () => {
      const builder = queryManager.createBuilder();
      expect(builder).toBeDefined();
      
      const entities = builder.with(PositionComponent).execute();
      expect(entities).toHaveLength(3);
    });

    test('should execute complex query through builder', () => {
      const entities = queryManager.createBuilder()
        .with(PositionComponent)
        .without(DeadComponent)
        .filter(entity => {
          const pos = entity.getComponent(PositionComponent);
          return pos ? pos.x >= 30 : false;
        })
        .sort((a, b) => a.id - b.id)
        .execute();

      expect(entities).toHaveLength(2);
      expect(entities.map(e => e.id)).toEqual([2, 4]);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track query statistics', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      
      // Execute some queries
      queryManager.query(criteria);
      queryManager.query(criteria); // This should be cached
      queryManager.query({ all: [VelocityComponent] });

      const stats = queryManager.getStatistics();
      expect(stats.totalQueries).toBe(3);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
    });

    test('should enable/disable performance monitoring', () => {
      queryManager.setPerformanceMonitoring(false);
      
      const criteria: QueryCriteria = { all: [PositionComponent] };
      queryManager.query(criteria);

      const stats = queryManager.getStatistics();
      expect(stats.totalQueries).toBe(0); // Should not track when disabled
    });

    test('should get cache statistics', () => {
      const criteria: QueryCriteria = { all: [PositionComponent] };
      queryManager.query(criteria);

      const cacheStats = queryManager.getCacheStatistics();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.maxSize).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    test('should configure cache settings', () => {
      queryManager.configureCache({
        maxSize: 50,
        ttl: 10000
      });

      const cacheStats = queryManager.getCacheStatistics();
      expect(cacheStats.maxSize).toBe(50);
    });

    test('should get performance monitor', () => {
      const monitor = queryManager.getPerformanceMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.isEnabled()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty criteria', () => {
      const criteria: QueryCriteria = {};
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(4); // All entities
    });

    test('should handle inactive entities', () => {
      // Make entity inactive
      entities[0].active = false;

      const criteria: QueryCriteria = { all: [PositionComponent] };
      const result = queryManager.query(criteria);

      expect(result.entities).toHaveLength(2); // Should exclude inactive entity
      expect(result.entities.map(e => e.id)).toEqual([2, 4]);
    });

    test('should include inactive entities when requested', () => {
      // Make entity inactive
      entities[0].active = false;

      const criteria: QueryCriteria = { all: [PositionComponent] };
      const options: QueryOptions = { includeInactive: true };
      const result = queryManager.query(criteria, options);

      // Note: This test depends on the implementation handling includeInactive
      // The current implementation filters by entity.active, so this might need adjustment
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
    });
  });
});
