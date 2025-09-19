/**
 * ContactCache2D Tests
 * ContactCache2D测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ContactCache2D } from '../src/resources/ContactCache2D';
import { f, ONE, ZERO } from '../src/math/fixed';

describe('ContactCache2D', () => {
  let cache: ContactCache2D;

  beforeEach(() => {
    cache = new ContactCache2D();
  });

  test('should initialize with default values', () => {
    expect(cache.maxPairs).toBe(10000);
    expect(cache.maxAge).toBe(8);
    expect(cache.frame).toBe(1);

    const stats = cache.getStats();
    expect(stats.pairCount).toBe(0);
    expect(stats.totalContacts).toBe(0);
  });

  test('should store and retrieve cached contact points', () => {
    const pairKey = 'entity1_entity2';
    const featureId = 1;
    const jn = f(1.5);
    const jt = f(0.5);
    const px = f(10);
    const py = f(20);
    const nx = ONE;
    const ny = ZERO;

    // Store contact
    cache.set(pairKey, featureId, jn, jt, px, py, nx, ny);

    // Retrieve contact
    const cached = cache.get(pairKey, featureId);
    expect(cached).toBeDefined();
    expect(cached!.jn).toBe(jn);
    expect(cached!.jt).toBe(jt);
    expect(cached!.px).toBe(px);
    expect(cached!.py).toBe(py);
    expect(cached!.nx).toBe(nx);
    expect(cached!.ny).toBe(ny);
    expect(cached!.age).toBe(1);
    expect(cached!.lastFrame).toBe(1);
  });

  test('should return undefined for non-existent contacts', () => {
    const cached = cache.get('nonexistent', 999);
    expect(cached).toBeUndefined();
  });

  test('should update impulses for existing contacts', () => {
    const pairKey = 'pair1';
    const featureId = 1;

    // Store initial contact
    cache.set(pairKey, featureId, ONE, ZERO, f(5), f(5), ONE, ZERO);

    // Update impulses
    const newJn = f(2.5);
    const newJt = f(1.0);
    const updated = cache.updateImpulses(pairKey, featureId, newJn, newJt);

    expect(updated).toBe(true);

    const cached = cache.get(pairKey, featureId);
    expect(cached!.jn).toBe(newJn);
    expect(cached!.jt).toBe(newJt);
    expect(cached!.lastFrame).toBe(1);
  });

  test('should fail to update non-existent contacts', () => {
    const updated = cache.updateImpulses('nonexistent', 999, ONE, ONE);
    expect(updated).toBe(false);
  });

  test('should track contact age correctly', () => {
    const pairKey = 'aging_pair';
    const featureId = 1;

    // Initial contact
    cache.set(pairKey, featureId, ONE, ZERO, f(0), f(0), ONE, ZERO);
    expect(cache.get(pairKey, featureId)!.age).toBe(1);

    // Same contact next frame
    cache.beginFrame(2);
    cache.set(pairKey, featureId, ONE, ZERO, f(0), f(0), ONE, ZERO);
    expect(cache.get(pairKey, featureId)!.age).toBe(2);

    // Another frame
    cache.beginFrame(3);
    cache.set(pairKey, featureId, ONE, ZERO, f(0), f(0), ONE, ZERO);
    expect(cache.get(pairKey, featureId)!.age).toBe(3);
  });

  test('should remove specific contacts', () => {
    const pairKey = 'removal_test';

    // Add multiple contacts for same pair
    cache.set(pairKey, 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    cache.set(pairKey, 2, ONE, ZERO, f(1), f(1), ONE, ZERO);

    expect(cache.get(pairKey, 1)).toBeDefined();
    expect(cache.get(pairKey, 2)).toBeDefined();

    // Remove one contact
    const removed = cache.removeContact(pairKey, 1);
    expect(removed).toBe(true);
    expect(cache.get(pairKey, 1)).toBeUndefined();
    expect(cache.get(pairKey, 2)).toBeDefined();

    // Remove non-existent contact
    const notRemoved = cache.removeContact(pairKey, 999);
    expect(notRemoved).toBe(false);
  });

  test('should remove entire pairs', () => {
    const pairKey = 'pair_removal';

    cache.set(pairKey, 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    cache.set(pairKey, 2, ONE, ZERO, f(1), f(1), ONE, ZERO);

    expect(cache.hasPair(pairKey)).toBe(true);

    const removed = cache.removePair(pairKey);
    expect(removed).toBe(true);
    expect(cache.hasPair(pairKey)).toBe(false);
    expect(cache.get(pairKey, 1)).toBeUndefined();
    expect(cache.get(pairKey, 2)).toBeUndefined();
  });

  test('should clean up stale contacts by age', () => {
    cache.maxAge = 3;

    // Add contact at frame 1
    cache.set('stale_pair', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    // Advance frames without updating contact
    cache.beginFrame(2);
    cache.beginFrame(3);
    cache.beginFrame(4);
    cache.beginFrame(5); // Contact is now 4 frames old, exceeds maxAge

    // Contact should be cleaned up
    expect(cache.get('stale_pair', 1)).toBeUndefined();
  });

  test('should clean up contacts not updated recently', () => {
    cache.maxAge = 5;

    // Add contact at frame 1
    cache.set('outdated_pair', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    // Advance frames beyond maxAge threshold
    for (let frame = 2; frame <= 7; frame++) {
      cache.beginFrame(frame);
    }

    // Contact should be cleaned up (lastFrame=1, current=7, threshold=7-5=2)
    expect(cache.get('outdated_pair', 1)).toBeUndefined();
  });

  test('should enforce size limits with LRU eviction', () => {
    cache.maxPairs = 3;

    // Add contacts in different frames
    cache.beginFrame(1);
    cache.set('pair1', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    cache.beginFrame(2);
    cache.set('pair2', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    cache.beginFrame(3);
    cache.set('pair3', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    cache.beginFrame(4);
    cache.set('pair4', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    // Trigger LRU cleanup by beginning next frame
    cache.beginFrame(5);

    const stats = cache.getStats();
    expect(stats.pairCount).toBe(3);

    // pair1 should be evicted (oldest)
    expect(cache.hasPair('pair1')).toBe(false);
    expect(cache.hasPair('pair2')).toBe(true);
    expect(cache.hasPair('pair3')).toBe(true);
    expect(cache.hasPair('pair4')).toBe(true);
  });

  test('should clear all cached data', () => {
    cache.set('pair1', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    cache.set('pair2', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);

    let stats = cache.getStats();
    expect(stats.pairCount).toBe(2);

    cache.clear();

    stats = cache.getStats();
    expect(stats.pairCount).toBe(0);
    expect(stats.totalContacts).toBe(0);
  });

  test('should provide accurate statistics', () => {
    // Add contacts with different ages
    cache.set('pair1', 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    cache.set('pair1', 2, ONE, ZERO, f(0), f(0), ONE, ZERO);

    cache.beginFrame(2);
    cache.set('pair1', 1, ONE, ZERO, f(0), f(0), ONE, ZERO); // age=2
    cache.set('pair2', 1, ONE, ZERO, f(0), f(0), ONE, ZERO); // age=1

    const stats = cache.getStats();
    expect(stats.pairCount).toBe(2);
    expect(stats.totalContacts).toBe(3);
    expect(stats.avgContactsPerPair).toBe(1.5);
    expect(stats.avgAge).toBeCloseTo(4/3); // (2+1+1)/3
  });

  test('should handle multiple features per pair', () => {
    const pairKey = 'multi_feature';

    cache.set(pairKey, 1, f(1), f(0.1), f(10), f(20), ONE, ZERO);
    cache.set(pairKey, 2, f(2), f(0.2), f(11), f(21), ONE, ZERO);
    cache.set(pairKey, 3, f(3), f(0.3), f(12), f(22), ONE, ZERO);

    const featureIds = cache.getFeatureIds(pairKey);
    expect(featureIds).toHaveLength(3);
    expect(featureIds).toContain(1);
    expect(featureIds).toContain(2);
    expect(featureIds).toContain(3);

    // Verify each feature has correct data
    expect(cache.get(pairKey, 1)!.jn).toBe(f(1));
    expect(cache.get(pairKey, 2)!.jn).toBe(f(2));
    expect(cache.get(pairKey, 3)!.jn).toBe(f(3));
  });

  test('should clean up empty feature maps', () => {
    const pairKey = 'cleanup_test';

    cache.set(pairKey, 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    cache.set(pairKey, 2, ONE, ZERO, f(0), f(0), ONE, ZERO);

    expect(cache.hasPair(pairKey)).toBe(true);

    // Remove all features
    cache.removeContact(pairKey, 1);
    expect(cache.hasPair(pairKey)).toBe(true); // Still has feature 2

    cache.removeContact(pairKey, 2);
    expect(cache.hasPair(pairKey)).toBe(false); // Should be cleaned up
  });

  test('should handle frame updates correctly', () => {
    const pairKey = 'frame_test';

    cache.set(pairKey, 1, ONE, ZERO, f(0), f(0), ONE, ZERO);
    expect(cache.get(pairKey, 1)!.lastFrame).toBe(1);

    cache.beginFrame(5);
    cache.updateImpulses(pairKey, 1, f(2), f(1));
    expect(cache.get(pairKey, 1)!.lastFrame).toBe(5);

    cache.beginFrame(10);
    cache.set(pairKey, 1, f(3), f(1.5), f(0), f(0), ONE, ZERO);
    expect(cache.get(pairKey, 1)!.lastFrame).toBe(10);
    expect(cache.get(pairKey, 1)!.age).toBe(2); // Age incremented
  });
});