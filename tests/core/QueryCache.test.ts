import { describe, test, expect, beforeEach } from 'vitest';
import { QueryCache } from '../../src/core/QueryCache';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import type { QueryCacheConfig } from '../../src/utils/QueryTypes';

// Test component
class PositionComponent extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

describe('QueryCache', () => {
  let cache: QueryCache;
  let mockEntities: Entity[];

  beforeEach(() => {
    cache = new QueryCache();
    mockEntities = [
      new Entity(1),
      new Entity(2),
      new Entity(3)
    ];
  });

  describe('Basic Operations', () => {
    test('should store and retrieve cached results', () => {
      const signature = 'test-query';
      cache.set(signature, mockEntities);

      const result = cache.get(signature);
      expect(result).toEqual(mockEntities);
      expect(result).not.toBe(mockEntities); // Should be a copy
    });

    test('should return null for non-existent cache entries', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    test('should check if cache has entry', () => {
      const signature = 'test-query';
      expect(cache.has(signature)).toBe(false);

      cache.set(signature, mockEntities);
      expect(cache.has(signature)).toBe(true);
    });

    test('should delete cache entries', () => {
      const signature = 'test-query';
      cache.set(signature, mockEntities);

      expect(cache.delete(signature)).toBe(true);
      expect(cache.has(signature)).toBe(false);
      expect(cache.delete(signature)).toBe(false); // Already deleted
    });

    test('should clear all cache entries', () => {
      cache.set('query1', mockEntities);
      cache.set('query2', mockEntities);

      cache.clear();
      expect(cache.has('query1')).toBe(false);
      expect(cache.has('query2')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should respect TTL configuration', () => {
      const shortTTLCache = new QueryCache({ ttl: 10 }); // 10ms TTL
      const signature = 'test-query';

      shortTTLCache.set(signature, mockEntities);
      expect(shortTTLCache.has(signature)).toBe(true);

      // Wait for TTL to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortTTLCache.has(signature)).toBe(false);
          expect(shortTTLCache.get(signature)).toBeNull();
          resolve();
        }, 15);
      });
    });

    test('should cleanup expired entries', () => {
      const shortTTLCache = new QueryCache({ ttl: 10 });
      shortTTLCache.set('query1', mockEntities);
      shortTTLCache.set('query2', mockEntities);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortTTLCache.cleanup();
          const stats = shortTTLCache.getStatistics();
          expect(stats.size).toBe(0);
          resolve();
        }, 15);
      });
    });
  });

  describe('Cache Size Limits', () => {
    test('should respect max size configuration', () => {
      const smallCache = new QueryCache({ maxSize: 2 });

      smallCache.set('query1', mockEntities);
      smallCache.set('query2', mockEntities);
      smallCache.set('query3', mockEntities); // Should evict oldest

      const stats = smallCache.getStatistics();
      expect(stats.size).toBe(2);
      expect(smallCache.has('query1')).toBe(false); // Should be evicted
      expect(smallCache.has('query2')).toBe(true);
      expect(smallCache.has('query3')).toBe(true);
    });

    test('should update max size configuration', () => {
      cache.set('query1', mockEntities);
      cache.set('query2', mockEntities);
      cache.set('query3', mockEntities);

      cache.updateConfig({ maxSize: 2 });
      const stats = cache.getStatistics();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Eviction Strategies', () => {
    test('should use LRU eviction strategy', () => {
      const lruCache = new QueryCache({ maxSize: 2, evictionStrategy: 'lru' });

      lruCache.set('query1', mockEntities);
      lruCache.set('query2', mockEntities);
      
      // Access query1 to make it more recently used
      lruCache.get('query1');
      
      // Add query3, should evict query2 (least recently used)
      lruCache.set('query3', mockEntities);

      expect(lruCache.has('query1')).toBe(true);
      expect(lruCache.has('query2')).toBe(false);
      expect(lruCache.has('query3')).toBe(true);
    });

    test('should use LFU eviction strategy', () => {
      const lfuCache = new QueryCache({ maxSize: 2, evictionStrategy: 'lfu' });

      lfuCache.set('query1', mockEntities);
      lfuCache.set('query2', mockEntities);
      
      // Access query1 multiple times
      lfuCache.get('query1');
      lfuCache.get('query1');
      lfuCache.get('query2'); // query2 accessed once, query1 accessed twice
      
      // Add query3, should evict query2 (least frequently used)
      lfuCache.set('query3', mockEntities);

      expect(lfuCache.has('query1')).toBe(true);
      expect(lfuCache.has('query2')).toBe(false);
      expect(lfuCache.has('query3')).toBe(true);
    });

    test('should use TTL eviction strategy', () => {
      const ttlCache = new QueryCache({ 
        maxSize: 3, 
        evictionStrategy: 'ttl',
        ttl: 10 
      });

      ttlCache.set('query1', mockEntities);
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          ttlCache.set('query2', mockEntities);
          ttlCache.set('query3', mockEntities);
          ttlCache.set('query4', mockEntities); // Should trigger TTL eviction first

          expect(ttlCache.has('query1')).toBe(false); // Expired
          expect(ttlCache.has('query2')).toBe(true);
          expect(ttlCache.has('query3')).toBe(true);
          expect(ttlCache.has('query4')).toBe(true);
          resolve();
        }, 15);
      });
    });
  });

  describe('Statistics', () => {
    test('should track cache statistics', () => {
      cache.set('query1', mockEntities);
      cache.get('query1'); // Hit
      cache.get('query1'); // Hit
      cache.get('query2'); // Miss

      const stats = cache.getStatistics();
      expect(stats.size).toBe(1);
      expect(stats.totalHits).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    test('should track oldest and newest entries', () => {
      const now = Date.now();
      cache.set('query1', mockEntities);
      
      // Small delay to ensure different timestamps
      setTimeout(() => {
        cache.set('query2', mockEntities);
        
        const stats = cache.getStatistics();
        expect(stats.oldestEntry).toBeLessThanOrEqual(stats.newestEntry);
        expect(stats.newestEntry).toBeGreaterThanOrEqual(now);
      }, 1);
    });
  });

  describe('Configuration Management', () => {
    test('should get current configuration', () => {
      const config = cache.getConfig();
      expect(config.maxSize).toBeDefined();
      expect(config.ttl).toBeDefined();
      expect(config.evictionStrategy).toBeDefined();
    });

    test('should update configuration', () => {
      const newConfig: Partial<QueryCacheConfig> = {
        maxSize: 50,
        ttl: 10000,
        evictionStrategy: 'lfu'
      };

      cache.updateConfig(newConfig);
      const config = cache.getConfig();
      
      expect(config.maxSize).toBe(50);
      expect(config.ttl).toBe(10000);
      expect(config.evictionStrategy).toBe('lfu');
    });
  });

  describe('Invalidation', () => {
    test('should invalidate by component type', () => {
      // Set cache entries with criteria that include PositionComponent
      cache.set('query1', mockEntities, { all: [PositionComponent] });
      cache.set('query2', mockEntities, { all: [PositionComponent] });

      cache.invalidateByComponentType(PositionComponent);

      // With auto-invalidate enabled, all entries should be cleared
      expect(cache.has('query1')).toBe(false);
      expect(cache.has('query2')).toBe(false);
    });

    test('should respect auto-invalidate setting', () => {
      const noAutoInvalidateCache = new QueryCache({ autoInvalidate: false });
      noAutoInvalidateCache.set('query1', mockEntities);

      noAutoInvalidateCache.invalidateByComponentType(PositionComponent);

      // With auto-invalidate disabled, entries should remain
      expect(noAutoInvalidateCache.has('query1')).toBe(true);
    });

    test('should invalidate by component types', () => {
      // Set cache entries with criteria that include PositionComponent
      cache.set('query1', mockEntities, { all: [PositionComponent] });
      cache.set('query2', mockEntities, { all: [PositionComponent] });

      // Invalidate by component type
      cache.invalidateByComponentTypes([PositionComponent]);

      // Entries should be cleared if they involve the component type
      expect(cache.has('query1')).toBe(false);
      expect(cache.has('query2')).toBe(false);
    });
  });

  describe('Debug and Inspection', () => {
    test('should get all cache entries', () => {
      cache.set('query1', mockEntities);
      cache.set('query2', mockEntities);

      const entries = cache.getAllEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].signature).toBeDefined();
      expect(entries[0].entities).toBeDefined();
      expect(entries[0].timestamp).toBeDefined();
      expect(entries[0].hitCount).toBeDefined();
    });

    test('should track hit counts', () => {
      cache.set('query1', mockEntities);
      
      cache.get('query1');
      cache.get('query1');
      cache.get('query1');

      const entries = cache.getAllEntries();
      const entry = entries.find(e => e.signature === 'query1');
      expect(entry?.hitCount).toBe(3);
    });
  });
});
