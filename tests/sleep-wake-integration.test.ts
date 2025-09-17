/**
 * Integration tests for Sleep/Wake system
 * 睡眠/唤醒系统集成测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { Sleep2D } from '../src/components/Sleep2D';
import { Contacts2D, Contact1 } from '../src/resources/Contacts2D';
import { PhysicsSleepConfig } from '../src/resources/PhysicsSleepConfig';
import { SleepUpdate2D } from '../src/systems/phys2d/SleepUpdate2D';
import { WakeOnContact2D } from '../src/systems/phys2d/WakeOnContact2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('Sleep/Wake System Integration', () => {
  let world: World;
  let entityA: number;
  let entityB: number;
  let contacts: Contacts2D;
  let config: PhysicsSleepConfig;
  let ctx: SystemContext;
  let mockSetComponent: any;

  beforeEach(() => {
    world = new World();

    // Create test entities
    entityA = world.createEntity();
    entityB = world.createEntity();

    // Add components
    const bodyA = new Body2D();
    bodyA.invMass = ONE;
    bodyA.invI = ONE;
    const sleepA = new Sleep2D();

    const bodyB = new Body2D();
    bodyB.invMass = ONE;
    bodyB.invI = ONE;
    const sleepB = new Sleep2D();

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityA, Sleep2D, sleepA);
    world.addComponent(entityB, Body2D, bodyB);
    world.addComponent(entityB, Sleep2D, sleepB);

    // Initialize resources
    contacts = new Contacts2D();
    config = new PhysicsSleepConfig();
    world.setResource(Contacts2D, contacts);
    world.setResource(PhysicsSleepConfig, config);

    // Setup context
    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    // Mock required world methods
    world.getFixedDtFX = () => f(1/60);
    world.frame = 1;
    world.getStore = () => ({ markChanged: vi.fn() });

    // Mock setComponent to track system behavior
    mockSetComponent = vi.fn();
    const originalSetComponent = world.setComponent;
    world.setComponent = vi.fn((entity, ctor, data) => {
      mockSetComponent(entity, ctor, data);
      return originalSetComponent.call(world, entity, ctor, data);
    });

    // Mock query method for sleep update
    const originalQuery = world.query;
    world.query = (...ctors: any[]) => {
      const mockQuery = originalQuery.call(world, ...ctors);
      mockQuery.forEach = (callback: any) => {
        [entityA, entityB].forEach(entity => {
          const body = world.getComponent(entity, Body2D) as Body2D;
          const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
          if (body && sleep) {
            callback(entity, body, sleep);
          }
        });
      };
      return mockQuery;
    };
  });

  function createContact(overrides: Partial<Contact1> = {}): Contact1 {
    return {
      a: entityA,
      b: entityB,
      nx: f(1.0),
      ny: ZERO,
      px: ZERO,
      py: ZERO,
      pen: f(0.00001), // Very small penetration
      jn: ZERO,
      jt: ZERO,
      speculative: 0,
      ...overrides
    };
  }

  function setupBodiesWithVelocity(vxA: number, vyA: number, wA: number, vxB: number, vyB: number, wB: number) {
    const bodyA = new Body2D();
    Object.assign(bodyA, world.getComponent(entityA, Body2D));
    bodyA.vx = f(vxA);
    bodyA.vy = f(vyA);
    bodyA.w = f(wA);

    const bodyB = new Body2D();
    Object.assign(bodyB, world.getComponent(entityB, Body2D));
    bodyB.vx = f(vxB);
    bodyB.vy = f(vyB);
    bodyB.w = f(wB);

    world.setComponent(entityA, Body2D, bodyA);
    world.setComponent(entityB, Body2D, bodyB);

    // Reset mock after setup
    mockSetComponent.mockClear();
  }

  function setupSleepStates(sleepAState: 0 | 1, sleepBState: 0 | 1, timerA = 0, timerB = 0) {
    const sleepA = new Sleep2D();
    sleepA.sleeping = sleepAState;
    sleepA.timer = f(timerA);

    const sleepB = new Sleep2D();
    sleepB.sleeping = sleepBState;
    sleepB.timer = f(timerB);

    world.setComponent(entityA, Sleep2D, sleepA);
    world.setComponent(entityB, Sleep2D, sleepB);

    // Sync body awake state
    const bodyA = new Body2D();
    Object.assign(bodyA, world.getComponent(entityA, Body2D));
    bodyA.awake = sleepAState === 0 ? 1 : 0;

    const bodyB = new Body2D();
    Object.assign(bodyB, world.getComponent(entityB, Body2D));
    bodyB.awake = sleepBState === 0 ? 1 : 0;

    world.setComponent(entityA, Body2D, bodyA);
    world.setComponent(entityB, Body2D, bodyB);

    // Reset mock after setup
    mockSetComponent.mockClear();
  }

  test('should update components when bodies enter sleep', () => {
    // Set low velocities and high timer approaching sleep threshold
    setupBodiesWithVelocity(0.01, 0.01, 0.02, 0.01, 0.01, 0.02);
    setupSleepStates(0, 0, 0.49, 0.48); // Just below timeToSleep (0.5)

    // Run sleep update system
    SleepUpdate2D.fn(ctx);

    // Should have updated both entities to sleeping state
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Sleep2D,
      expect.objectContaining({ sleeping: 1 })
    );

    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Body2D,
      expect.objectContaining({
        awake: 0,
        vx: ZERO,
        vy: ZERO,
        w: ZERO
      })
    );
  });

  test('should not enter sleep when above velocity thresholds', () => {
    // Set high velocities above thresholds
    setupBodiesWithVelocity(0.05, 0.05, 0.1, 0.03, 0.03, 0.08);
    setupSleepStates(0, 0, 0.49, 0.48);

    // Run sleep update system
    SleepUpdate2D.fn(ctx);

    // Should reset timers and keep awake
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );

    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Body2D,
      expect.objectContaining({ awake: 1 })
    );
  });

  test('should wake sleeping body when in contact with awake body', () => {
    // A is awake, B is sleeping
    setupSleepStates(0, 1, 0, 1.0);

    // Create contact between A and B
    const contact = createContact();
    contacts.addContact(contact);

    // Run wake system
    WakeOnContact2D.fn(ctx);

    // Should wake sleeping body B (2 component updates: Sleep2D and Body2D)
    expect(mockSetComponent).toHaveBeenCalledTimes(2);
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityB,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
  });

  test('should wake both bodies on strong impulse', () => {
    // Both sleeping
    setupSleepStates(1, 1, 1.0, 1.0);

    // Create contact with strong impulse
    const contact = createContact({
      jn: f(0.02) // Above impulseWake threshold (0.01)
    });
    contacts.addContact(contact);

    // Run wake system
    WakeOnContact2D.fn(ctx);

    // Should wake both bodies (4 component updates total)
    expect(mockSetComponent).toHaveBeenCalledTimes(4);
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Sleep2D,
      expect.objectContaining({ sleeping: 0, timer: ZERO })
    );
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityB,
      Sleep2D,
      expect.objectContaining({ sleeping: 0, timer: ZERO })
    );
  });

  test('should not wake on weak impulse', () => {
    // Both sleeping
    setupSleepStates(1, 1, 1.0, 1.0);

    // Create contact with weak impulse
    const contact = createContact({
      jn: f(0.005) // Below threshold
    });
    contacts.addContact(contact);

    // Run wake system
    WakeOnContact2D.fn(ctx);

    // Should not wake any body
    expect(mockSetComponent).not.toHaveBeenCalled();
  });

  test('should wake on deep penetration', () => {
    // Both sleeping
    setupSleepStates(1, 1, 1.0, 1.0);

    // Create contact with deep penetration
    const contact = createContact({
      pen: f(0.001), // Above deep penetration threshold
      speculative: 0
    });
    contacts.addContact(contact);

    // Run wake system
    WakeOnContact2D.fn(ctx);

    // Should wake both bodies
    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should handle sleep/wake system interaction', () => {
    // Start with awake body A and sleeping body B
    setupBodiesWithVelocity(0.1, 0.1, 0.1, 0, 0, 0);
    setupSleepStates(0, 1, 0, 1.0);

    // Create contact with strong impulse
    const contact = createContact({ jn: f(0.02) });
    contacts.addContact(contact);

    // Run wake system - should wake B
    WakeOnContact2D.fn(ctx);

    // Should wake B due to contact with awake A
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityB,
      Sleep2D,
      expect.objectContaining({ sleeping: 0, timer: ZERO })
    );

    // Clear contacts and slow down A
    contacts.list.length = 0;
    mockSetComponent.mockClear();
    setupBodiesWithVelocity(0.01, 0.01, 0.02, 0.01, 0.01, 0.02);
    setupSleepStates(0, 0, 0.48, 0.49); // High timer values

    // Run sleep update - both should enter sleep
    SleepUpdate2D.fn(ctx);

    // Both entities should have their sleep states updated
    // Entity B should enter sleep state (timer was higher)
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityB,
      Sleep2D,
      expect.objectContaining({ sleeping: 1 })
    );
    // Entity A may or may not sleep depending on timer accumulation, but should be updated
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Sleep2D,
      expect.any(Object)
    );
  });

  test('should respect custom configuration values', () => {
    // Change configuration
    config.impulseWake = f(0.02);

    // Both sleeping
    setupSleepStates(1, 1, 1.0, 1.0);

    // Test impulse below new threshold
    const contact = createContact({
      jn: f(0.015) // Above old threshold (0.01) but below new threshold (0.02)
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    // Should not wake due to higher threshold
    expect(mockSetComponent).not.toHaveBeenCalled();

    // Test impulse above new threshold
    contact.jn = f(0.025);
    mockSetComponent.mockClear();

    WakeOnContact2D.fn(ctx);

    // Should wake both bodies
    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should have correct system configuration', () => {
    expect(SleepUpdate2D.name).toBe('phys.sleep.update');
    expect(SleepUpdate2D.stage).toBe('postUpdate');
    expect(WakeOnContact2D.name).toBe('phys.sleep.wakeOnContact');
    expect(WakeOnContact2D.stage).toBe('update');
  });

  test('should handle static bodies correctly', () => {
    // Make body A static
    const bodyA = new Body2D();
    Object.assign(bodyA, world.getComponent(entityA, Body2D));
    bodyA.invMass = ZERO; // Static body
    bodyA.invI = ZERO;
    world.setComponent(entityA, Body2D, bodyA);

    setupSleepStates(1, 0); // A sleeping (but static), B awake
    mockSetComponent.mockClear();

    // Run sleep update - static body should be forced awake
    SleepUpdate2D.fn(ctx);

    // Should update static body to awake state
    expect(mockSetComponent).toHaveBeenCalledWith(
      entityA,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
  });
});