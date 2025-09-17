/**
 * Mock-based tests for WakeOnContact2D system
 * 基于Mock的WakeOnContact2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { Sleep2D } from '../src/components/Sleep2D';
import { Contacts2D, Contact1 } from '../src/resources/Contacts2D';
import { PhysicsSleepConfig } from '../src/resources/PhysicsSleepConfig';
import { WakeOnContact2D } from '../src/systems/phys2d/WakeOnContact2D';
import { f, ZERO } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('WakeOnContact2D System (Mock-based)', () => {
  let world: World;
  let entityA: number;
  let entityB: number;
  let contacts: Contacts2D;
  let config: PhysicsSleepConfig;
  let ctx: SystemContext;
  let mockSetComponent: any;

  beforeEach(() => {
    world = new World();

    entityA = world.createEntity();
    entityB = world.createEntity();
    world.addComponent(entityA, Body2D);
    world.addComponent(entityA, Sleep2D);
    world.addComponent(entityB, Body2D);
    world.addComponent(entityB, Sleep2D);

    contacts = new Contacts2D();
    config = new PhysicsSleepConfig();
    world.setResource(Contacts2D, contacts);
    world.setResource(PhysicsSleepConfig, config);

    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    world.frame = 1;
    world.getStore = () => ({ markChanged: vi.fn() });

    // Mock setComponent to capture wake calls
    mockSetComponent = vi.fn();
    const originalSetComponent = world.setComponent;
    world.setComponent = vi.fn((entity, ctor, data) => {
      mockSetComponent(entity, ctor, data);
      return originalSetComponent.call(world, entity, ctor, data);
    });
  });

  function createContact(overrides: Partial<Contact1> = {}): Contact1 {
    return {
      a: entityA,
      b: entityB,
      nx: f(1.0),
      ny: ZERO,
      px: ZERO,
      py: ZERO,
      pen: f(0.00001), // Very small penetration, below wake threshold
      jn: ZERO,
      jt: ZERO,
      speculative: 0,
      ...overrides
    };
  }

  function setupSleepStates(sleepAState: 0 | 1, sleepBState: 0 | 1) {
    const sleepA = new Sleep2D();
    sleepA.sleeping = sleepAState;
    if (sleepAState) sleepA.timer = f(0.3);

    const sleepB = new Sleep2D();
    sleepB.sleeping = sleepBState;
    if (sleepBState) sleepB.timer = f(0.4);

    world.setComponent(entityA, Sleep2D, sleepA);
    world.setComponent(entityB, Sleep2D, sleepB);

    // Also need to sync Body2D awake state
    const bodyA = world.getComponent(entityA, Body2D) as Body2D;
    const bodyB = world.getComponent(entityB, Body2D) as Body2D;

    const newBodyA = new Body2D();
    Object.assign(newBodyA, bodyA);
    newBodyA.awake = sleepAState === 0 ? 1 : 0;

    const newBodyB = new Body2D();
    Object.assign(newBodyB, bodyB);
    newBodyB.awake = sleepBState === 0 ? 1 : 0;

    world.setComponent(entityA, Body2D, newBodyA);
    world.setComponent(entityB, Body2D, newBodyB);

    // Reset mock after setup
    mockSetComponent.mockClear();
  }

  test('should wake sleeping body when other is awake', () => {
    setupSleepStates(0, 1); // A awake, B sleeping

    const contact = createContact();
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    // Verify that setComponent was called to wake sleeping body
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
    setupSleepStates(1, 1); // Both sleeping

    const contact = createContact({
      jn: f(0.02) // Above impulseWake threshold
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    // Verify both bodies were woken (2 entities × 2 components each = 4 calls)
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

  test('should wake on tangential impulse', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      jt: f(0.015) // Above impulseWake threshold
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should wake on negative impulse (absolute value)', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      jn: f(-0.02) // Negative but abs value above threshold
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should wake on deep penetration', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      pen: f(0.001), // Above deep penetration threshold
      speculative: 0
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should not wake on weak impulse', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      jn: f(0.005) // Below threshold
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    // No wake calls should be made
    expect(mockSetComponent).not.toHaveBeenCalled();
  });

  test('should not wake on speculative penetration', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      pen: f(0.001),
      speculative: 1 // Speculative contact
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).not.toHaveBeenCalled();
  });

  test('should not wake on shallow penetration', () => {
    setupSleepStates(1, 1);

    const contact = createContact({
      pen: f(0.00005), // Below threshold
      speculative: 0
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).not.toHaveBeenCalled();
  });

  test('should handle custom impulse threshold', () => {
    config.impulseWake = f(0.05); // Higher threshold
    setupSleepStates(1, 1);

    const contact = createContact({
      jn: f(0.03) // Below new threshold
    });
    contacts.addContact(contact);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).not.toHaveBeenCalled();

    // Test above new threshold
    mockSetComponent.mockClear();
    contact.jn = f(0.06);

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should not process when no contacts exist', () => {
    setupSleepStates(1, 1);
    // No contacts added

    WakeOnContact2D.fn(ctx);

    expect(mockSetComponent).not.toHaveBeenCalled();
  });

  test('should handle multiple contacts correctly', () => {
    setupSleepStates(1, 1);

    // Add weak contact
    contacts.addContact(createContact({ jn: f(0.005) }));
    // Add strong contact
    contacts.addContact(createContact({ jn: f(0.02) }));

    WakeOnContact2D.fn(ctx);

    // Should wake due to strong contact (2 entities × 2 components each = 4 calls)
    expect(mockSetComponent).toHaveBeenCalledTimes(4);
  });

  test('should have correct system configuration', () => {
    expect(WakeOnContact2D.name).toBe('phys.sleep.wakeOnContact');
    expect(WakeOnContact2D.stage).toBe('update');
    expect(WakeOnContact2D.after).toContain('phys.narrowphase');
    expect(WakeOnContact2D.before).toContain('phys.solver.gs');
  });
});