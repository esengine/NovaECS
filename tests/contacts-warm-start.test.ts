/**
 * ContactsWarmStart2D System Tests
 * ContactsWarmStart2D系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Contacts2D, Contact1 } from '../src/resources/Contacts2D';
import { ContactCache2D } from '../src/resources/ContactCache2D';
import { ContactsWarmStart2D, WarmStartStats } from '../src/systems/phys2d/ContactsWarmStart2D';
import { Guid, createGuid } from '../src/components/Guid';
import { makePairKey } from '../src/determinism/PairKey';
import { f, ONE, ZERO } from '../src/math/fixed';

describe('ContactsWarmStart2D System', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('should initialize contacts with zero impulses when no cache exists', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Create contacts
    const contacts = new Contacts2D();
    contacts.frame = 1;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5),
      py: f(5),
      pen: f(0.1),
      jn: f(999), // Should be reset to zero
      jt: f(999),  // Should be reset to zero
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    scheduler.tick(world, 16);

    // Verify impulses were reset
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(ZERO);
    expect(updatedContacts.list[0].jt).toBe(ZERO);

    // Verify cache was created
    const cache = world.getResource(ContactCache2D);
    expect(cache).toBeDefined();
  });

  test('should apply cached impulses for matching features', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with previous impulses
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.5), f(0.5), f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create current frame contacts
    const contacts = new Contacts2D();
    contacts.frame = 2;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5),     // Same position
      py: f(5),
      pen: f(0.1),
      jn: ZERO,     // Should be loaded from cache
      jt: ZERO,     // Should be loaded from cache
      featureId: 1  // Matching feature ID
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 2;
    scheduler.tick(world, 16);

    // Verify cached impulses were applied
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(f(1.5));
    expect(updatedContacts.list[0].jt).toBe(f(0.5));
  });

  test('should clear impulses when geometry changes significantly', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with previous impulses
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.5), f(0.5), f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contact with flipped normal (geometry changed)
    const contacts = new Contacts2D();
    contacts.frame = 2;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: f(-1),    // Flipped normal
      ny: ZERO,
      px: f(5),
      py: f(5),
      pen: f(0.1),
      jn: f(999),   // Should be cleared
      jt: f(999),   // Should be cleared
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 2;
    scheduler.tick(world, 16);

    // Verify impulses were cleared due to normal flip
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(ZERO);
    expect(updatedContacts.list[0].jt).toBe(ZERO);
  });

  test('should clear impulses when contact position drifts too much', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with previous impulses
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.5), f(0.5), f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contact with significant position drift
    const contacts = new Contacts2D();
    contacts.frame = 2;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(10),    // Large position change
      py: f(10),
      pen: f(0.1),
      jn: f(999),   // Should be cleared
      jt: f(999),   // Should be cleared
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 2;
    scheduler.tick(world, 16);

    // Verify impulses were cleared due to position drift
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(ZERO);
    expect(updatedContacts.list[0].jt).toBe(ZERO);
  });

  test('should handle contacts without explicit featureId', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Create contact without featureId
    const contacts = new Contacts2D();
    contacts.frame = 1;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5),
      py: f(5),
      pen: f(0.1),
      jn: f(999),
      jt: f(999)
      // No featureId - should use default
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    scheduler.tick(world, 16);

    // Should work without errors
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(ZERO);
    expect(updatedContacts.list[0].jt).toBe(ZERO);

    // Cache should exist with default feature ID
    const cache = world.getResource(ContactCache2D)!;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    expect(cache.get(pairKey, 0)).toBeDefined(); // Default feature ID is 0
  });

  test('should handle multiple contacts with different feature IDs', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with multiple features
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.0), f(0.1), f(5), f(5), ONE, ZERO);
    cache.set(pairKey, 2, f(2.0), f(0.2), f(6), f(6), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contacts with different feature IDs
    const contacts = new Contacts2D();
    contacts.frame = 2;

    const contact1: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(5), py: f(5),
      pen: f(0.1),
      jn: ZERO, jt: ZERO,
      featureId: 1
    };

    const contact2: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(6), py: f(6),
      pen: f(0.1),
      jn: ZERO, jt: ZERO,
      featureId: 2
    };

    const contact3: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(7), py: f(7),
      pen: f(0.1),
      jn: ZERO, jt: ZERO,
      featureId: 3  // New feature, no cache
    };

    contacts.addContact(contact1);
    contacts.addContact(contact2);
    contacts.addContact(contact3);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 2;
    scheduler.tick(world, 16);

    const updatedContacts = world.getResource(Contacts2D)!;

    // Feature 1 should have cached impulses
    expect(updatedContacts.list[0].jn).toBe(f(1.0));
    expect(updatedContacts.list[0].jt).toBe(f(0.1));

    // Feature 2 should have cached impulses
    expect(updatedContacts.list[1].jn).toBe(f(2.0));
    expect(updatedContacts.list[1].jt).toBe(f(0.2));

    // Feature 3 should be zero (new contact)
    expect(updatedContacts.list[2].jn).toBe(ZERO);
    expect(updatedContacts.list[2].jt).toBe(ZERO);
  });

  test('should ignore stale cached contacts beyond maxAge', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with old contact
    const cache = new ContactCache2D();
    cache.maxAge = 3;
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.5), f(0.5), f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contact many frames later
    const contacts = new Contacts2D();
    contacts.frame = 10; // Much later frame
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5),
      py: f(5),
      pen: f(0.1),
      jn: f(999),
      jt: f(999),
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 10;
    scheduler.tick(world, 16);

    // Verify stale cache was ignored
    const updatedContacts = world.getResource(Contacts2D)!;
    expect(updatedContacts.list[0].jn).toBe(ZERO);
    expect(updatedContacts.list[0].jt).toBe(ZERO);
  });

  test('should collect and store warm-start statistics', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsWarmStart2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with existing contact
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1.5), f(0.5), f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contacts (one warmed, one new)
    const contacts = new Contacts2D();
    contacts.frame = 2;

    const warmedContact: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(5), py: f(5),
      pen: f(0.1),
      jn: ZERO, jt: ZERO,
      featureId: 1  // Will be warmed from cache
    };

    const newContact: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(10), py: f(10),
      pen: f(0.1),
      jn: ZERO, jt: ZERO,
      featureId: 2  // New contact
    };

    contacts.addContact(warmedContact);
    contacts.addContact(newContact);
    world.setResource(Contacts2D, contacts);

    // Run warm start
    world.frame = 1; // Will be incremented to 2 by scheduler.tick()
    scheduler.tick(world, 16);

    // Verify statistics were collected
    const stats = world.getResource(WarmStartStats);
    expect(stats).toBeDefined();
    expect(stats!.frame).toBe(2);
    expect(stats!.totalContacts).toBe(2);
    expect(stats!.warmedContacts).toBe(1);
    expect(stats!.newContacts).toBe(1);
    expect(stats!.invalidatedContacts).toBe(0);
    expect(stats!.cacheStats).toBeDefined();

    // Test convenience methods
    expect(stats!.getWarmStartRatio()).toBe(0.5); // 1/2
    expect(stats!.getCacheHitRatio()).toBe(0.5); // 1/(1+1)
  });
});