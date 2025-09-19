/**
 * ContactsCommit2D System Tests
 * ContactsCommit2D系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Contacts2D, Contact1 } from '../src/resources/Contacts2D';
import { ContactCache2D } from '../src/resources/ContactCache2D';
import { ContactsCommit2D, ContactsCommitAggressiveCleanup2D } from '../src/systems/phys2d/ContactsCommit2D';
import { Guid, createGuid } from '../src/components/Guid';
import { makePairKey } from '../src/determinism/PairKey';
import { f, ONE, ZERO } from '../src/math/fixed';

describe('ContactsCommit2D System', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('should commit solved impulses to cache', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with initial values
    const cache = new ContactCache2D();
    cache.frame = 1;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, ZERO, ZERO, f(5), f(5), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Create contacts with solved impulses
    const contacts = new Contacts2D();
    contacts.frame = 1;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5.1),     // Slightly different position
      py: f(5.1),
      pen: f(0.1),
      jn: f(2.5),     // Solved normal impulse
      jt: f(1.0),     // Solved tangent impulse
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 1;
    scheduler.tick(world, 16);

    // Verify impulses were committed to cache
    const updatedCache = world.getResource(ContactCache2D)!;
    const cachedContact = updatedCache.get(pairKey, 1)!;
    expect(cachedContact.jn).toBe(f(2.5));
    expect(cachedContact.jt).toBe(f(1.0));
    expect(cachedContact.px).toBe(f(5.1)); // Position updated
    expect(cachedContact.py).toBe(f(5.1));
    // Age should remain 1 because updateImpulses doesn't increment age
    expect(cachedContact.age).toBe(1);
    // lastFrame should be updated to cache's current frame
    expect(cachedContact.lastFrame).toBeGreaterThanOrEqual(1);
  });

  test('should create new cache entries for new contacts', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // No existing cache
    const cache = new ContactCache2D();
    world.setResource(ContactCache2D, cache);

    // Create new contact
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
      jn: f(1.5),
      jt: f(0.8),
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 1;
    scheduler.tick(world, 16);

    // Verify new cache entry was created
    const updatedCache = world.getResource(ContactCache2D)!;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    const cachedContact = updatedCache.get(pairKey, 1)!;
    expect(cachedContact).toBeDefined();
    expect(cachedContact.jn).toBe(f(1.5));
    expect(cachedContact.jt).toBe(f(0.8));
    expect(cachedContact.age).toBe(1);
  });

  test('should clean up stale contacts based on age', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    const entityC = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));
    world.addComponent(entityC, Guid, createGuid(world));

    // Set up cache with contacts of different ages
    const cache = new ContactCache2D();
    cache.maxAge = 3;
    cache.frame = 1;

    const { key: pairKey1 } = makePairKey(world, entityA, entityB);
    const { key: pairKey2 } = makePairKey(world, entityA, entityC);

    // Old contact (should be cleaned up)
    cache.set(pairKey1, 1, f(1), f(0.1), f(5), f(5), ONE, ZERO);
    const oldContact = cache.get(pairKey1, 1)!;
    oldContact.lastFrame = 1;
    oldContact.age = 5; // Exceeds maxAge

    // Recent contact (should be kept)
    cache.set(pairKey2, 1, f(2), f(0.2), f(6), f(6), ONE, ZERO);
    const recentContact = cache.get(pairKey2, 1)!;
    recentContact.lastFrame = 10;
    recentContact.age = 2;

    world.setResource(ContactCache2D, cache);

    // No current contacts (trigger cleanup only)
    const contacts = new Contacts2D();
    contacts.frame = 10;
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 10;
    scheduler.tick(world, 16);

    // Verify old contact was cleaned up
    const updatedCache = world.getResource(ContactCache2D)!;
    expect(updatedCache.get(pairKey1, 1)).toBeUndefined();
    expect(updatedCache.get(pairKey2, 1)).toBeDefined();
  });

  test('should clean up contacts not updated recently', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

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
    cache.set(pairKey, 1, f(1), f(0.1), f(5), f(5), ONE, ZERO);
    const contact = cache.get(pairKey, 1)!;
    contact.lastFrame = 5; // Old frame
    contact.age = 2; // Within age limit but stale

    world.setResource(ContactCache2D, cache);

    // No current contacts
    const contacts = new Contacts2D();
    contacts.frame = 10; // Much later frame
    world.setResource(Contacts2D, contacts);

    // Run commit (should clean up stale contact)
    world.frame = 10;
    scheduler.tick(world, 16);

    // Verify stale contact was cleaned up
    const updatedCache = world.getResource(ContactCache2D)!;
    expect(updatedCache.get(pairKey, 1)).toBeUndefined();
  });

  test('should handle multiple contacts with different feature IDs', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache
    const cache = new ContactCache2D();
    world.setResource(ContactCache2D, cache);

    // Create multiple contacts with different feature IDs
    const contacts = new Contacts2D();
    contacts.frame = 1;

    const contact1: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(5), py: f(5),
      pen: f(0.1),
      jn: f(1.0), jt: f(0.1),
      featureId: 1
    };

    const contact2: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(6), py: f(6),
      pen: f(0.1),
      jn: f(2.0), jt: f(0.2),
      featureId: 2
    };

    const contact3: Contact1 = {
      a: entityA, b: entityB,
      nx: ONE, ny: ZERO,
      px: f(7), py: f(7),
      pen: f(0.1),
      jn: f(3.0), jt: f(0.3),
      featureId: 3
    };

    contacts.addContact(contact1);
    contacts.addContact(contact2);
    contacts.addContact(contact3);
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 1;
    scheduler.tick(world, 16);

    // Verify all contacts were committed with correct feature IDs
    const updatedCache = world.getResource(ContactCache2D)!;
    const { key: pairKey } = makePairKey(world, entityA, entityB);

    expect(updatedCache.get(pairKey, 1)!.jn).toBe(f(1.0));
    expect(updatedCache.get(pairKey, 2)!.jn).toBe(f(2.0));
    expect(updatedCache.get(pairKey, 3)!.jn).toBe(f(3.0));
  });

  test('should remove empty pairs after cleanup', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache with all stale contacts
    const cache = new ContactCache2D();
    cache.maxAge = 2;
    cache.frame = 1;

    const { key: pairKey } = makePairKey(world, entityA, entityB);
    cache.set(pairKey, 1, f(1), f(0.1), f(5), f(5), ONE, ZERO);
    cache.set(pairKey, 2, f(2), f(0.2), f(6), f(6), ONE, ZERO);

    // Make all contacts stale
    const contact1 = cache.get(pairKey, 1)!;
    const contact2 = cache.get(pairKey, 2)!;
    contact1.lastFrame = 1;
    contact1.age = 5;
    contact2.lastFrame = 1;
    contact2.age = 5;

    world.setResource(ContactCache2D, cache);

    // No current contacts
    const contacts = new Contacts2D();
    contacts.frame = 10;
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 10;
    scheduler.tick(world, 16);

    // Verify empty pair was removed
    const updatedCache = world.getResource(ContactCache2D)!;
    expect(updatedCache.hasPair(pairKey)).toBe(false);
  });

  test('should handle contacts without featureId', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommit2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));

    // Set up cache
    const cache = new ContactCache2D();
    world.setResource(ContactCache2D, cache);

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
      jn: f(1.5),
      jt: f(0.8)
      // No featureId - should use default (0)
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run commit
    world.frame = 1;
    scheduler.tick(world, 16);

    // Verify cache entry was created with default feature ID
    const updatedCache = world.getResource(ContactCache2D)!;
    const { key: pairKey } = makePairKey(world, entityA, entityB);
    const cachedContact = updatedCache.get(pairKey, 0)!; // Default feature ID is 0
    expect(cachedContact).toBeDefined();
    expect(cachedContact.jn).toBe(f(1.5));
    expect(cachedContact.jt).toBe(f(0.8));
  });
});

describe('ContactsCommitAggressiveCleanup2D System', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('should remove inactive pairs aggressively', () => {
    const world = new World();
    const scheduler = new Scheduler(world);
    scheduler.add(ContactsCommitAggressiveCleanup2D);

    // Create test entities
    const entityA = world.createEntity();
    const entityB = world.createEntity();
    const entityC = world.createEntity();
    world.addComponent(entityA, Guid, createGuid(world));
    world.addComponent(entityB, Guid, createGuid(world));
    world.addComponent(entityC, Guid, createGuid(world));

    // Set up cache with two pairs
    const cache = new ContactCache2D();
    cache.frame = 1;

    const { key: activePair } = makePairKey(world, entityA, entityB);
    const { key: inactivePair } = makePairKey(world, entityA, entityC);

    cache.set(activePair, 1, f(1), f(0.1), f(5), f(5), ONE, ZERO);
    cache.set(inactivePair, 1, f(2), f(0.2), f(6), f(6), ONE, ZERO);
    world.setResource(ContactCache2D, cache);

    // Only create contact for one pair (the other becomes inactive)
    const contacts = new Contacts2D();
    contacts.frame = 2;
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(5),
      py: f(5),
      pen: f(0.1),
      jn: f(1.5),
      jt: f(0.8),
      featureId: 1
    };
    contacts.addContact(contact);
    world.setResource(Contacts2D, contacts);

    // Run aggressive cleanup
    world.frame = 2;
    scheduler.tick(world, 16);

    // Verify active pair remains and inactive pair was removed
    const updatedCache = world.getResource(ContactCache2D)!;
    expect(updatedCache.hasPair(activePair)).toBe(true);
    expect(updatedCache.hasPair(inactivePair)).toBe(false);

    // Verify active pair was updated
    const activeContact = updatedCache.get(activePair, 1)!;
    expect(activeContact.jn).toBe(f(1.5));
    expect(activeContact.jt).toBe(f(0.8));
  });
});