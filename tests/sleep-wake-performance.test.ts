/**
 * Performance and determinism tests for Sleep/Wake system
 * 睡眠/唤醒系统性能和确定性测试
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

describe('Sleep/Wake System Performance & Determinism', () => {
  let world: World;
  let contacts: Contacts2D;
  let config: PhysicsSleepConfig;
  let ctx: SystemContext;
  let entities: number[];
  let systemCallCount: number;

  beforeEach(() => {
    world = new World();
    contacts = new Contacts2D();
    config = new PhysicsSleepConfig();
    world.setResource(Contacts2D, contacts);
    world.setResource(PhysicsSleepConfig, config);

    entities = [];
    systemCallCount = 0;

    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    world.getFixedDtFX = () => f(1/60);
    world.frame = 1;
    world.getStore = () => ({ markChanged: vi.fn() });

    // Mock setComponent to count system activity
    const originalSetComponent = world.setComponent;
    world.setComponent = vi.fn((entity, ctor, data) => {
      systemCallCount++;
      return originalSetComponent.call(world, entity, ctor, data);
    });
  });

  function createStackedBodies(count: number): number[] {
    const entities: number[] = [];

    for (let i = 0; i < count; i++) {
      const entity = world.createEntity();
      entities.push(entity);

      // Create circular bodies stacked vertically
      const body = new Body2D();
      body.invMass = ONE; // Dynamic body
      body.invI = ONE;
      body.px = f(0); // All at x=0
      body.py = f(i * 2.1); // Stacked with small gap
      body.vx = f(0.001 * (Math.random() - 0.5)); // Tiny random velocity
      body.vy = f(0.001 * (Math.random() - 0.5));
      body.w = f(0.001 * (Math.random() - 0.5));
      body.awake = 1;

      const sleep = new Sleep2D();
      sleep.sleeping = 0;
      sleep.timer = ZERO;

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, Sleep2D, sleep);
    }

    return entities;
  }

  function createContactChain(entities: number[]): void {
    // Create contact chain between adjacent bodies
    for (let i = 0; i < entities.length - 1; i++) {
      const contact: Contact1 = {
        a: entities[i],
        b: entities[i + 1],
        nx: f(0),
        ny: f(1), // Vertical contact
        px: f(0),
        py: f((i + 0.5) * 2.1), // Contact point between bodies
        pen: f(0.05), // Small penetration for contact
        jn: ZERO,
        jt: ZERO,
        speculative: 0
      };
      contacts.addContact(contact);
    }
  }

  function simulateFrames(frames: number): { sleepingCount: number; updateCount: number }[] {
    const results: { sleepingCount: number; updateCount: number }[] = [];

    for (let frame = 0; frame < frames; frame++) {
      systemCallCount = 0;
      world.frame = frame + 1;

      // Run sleep update system
      SleepUpdate2D.fn(ctx);

      // Count sleeping bodies
      let sleepingCount = 0;
      entities.forEach(entity => {
        const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
        if (sleep.sleeping) sleepingCount++;
      });

      results.push({
        sleepingCount,
        updateCount: systemCallCount
      });

      // Reset call count for next frame
      systemCallCount = 0;
    }

    return results;
  }

  function applyCentralImpulse(entity: number, magnitude: number): void {
    const body = world.getComponent(entity, Body2D) as Body2D;
    const newBody = new Body2D();
    Object.assign(newBody, body);
    newBody.vx = f(magnitude);
    newBody.vy = f(magnitude * 0.5);
    world.setComponent(entity, Body2D, newBody);
  }

  function getFrameHash(entities: number[]): string {
    // Create deterministic hash of all body states
    let hash = '';
    entities.forEach(entity => {
      const body = world.getComponent(entity, Body2D) as Body2D;
      const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
      hash += `${entity}:${body.px}:${body.py}:${body.vx}:${body.vy}:${body.w}:${sleep.sleeping}:${sleep.timer}|`;
    });
    return hash;
  }

  test('should demonstrate sleep performance optimization with large stack', () => {
    // Create stack of 20 bodies
    entities = createStackedBodies(20);
    createContactChain(entities);

    // Simulate 120 frames (2 seconds at 60fps)
    const results = simulateFrames(120);

    // Verify sleep progression
    expect(results[0].sleepingCount).toBe(0); // All awake initially
    expect(results[30].sleepingCount).toBeGreaterThan(5); // Some sleeping after 0.5s
    expect(results[60].sleepingCount).toBeGreaterThan(15); // Most sleeping after 1s
    expect(results[119].sleepingCount).toBe(20); // All sleeping after 2s

    // Verify performance improvement - dramatic reduction in updates
    const earlyUpdateCount = results.slice(0, 30).reduce((sum, r) => sum + r.updateCount, 0);
    const lateUpdateCount = results.slice(90, 120).reduce((sum, r) => sum + r.updateCount, 0);

    // When bodies are sleeping, update count should be dramatically lower
    expect(lateUpdateCount).toBeLessThan(earlyUpdateCount * 0.1); // Should be nearly zero

    // Late phase should have minimal updates (sleeping bodies don't need updates)
    expect(lateUpdateCount).toBeLessThan(100); // Very low activity when sleeping
  });

  test('should propagate wake through contact chain and re-sleep', () => {
    // Create stack of 10 bodies
    entities = createStackedBodies(10);
    createContactChain(entities);

    // Let all bodies sleep first
    simulateFrames(120); // 2 seconds to ensure all sleep

    // Verify all are sleeping
    let sleepingCount = 0;
    entities.forEach(entity => {
      const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
      if (sleep.sleeping) sleepingCount++;
    });
    expect(sleepingCount).toBe(10);

    // Apply impulse to bottom body (should wake entire chain)
    applyCentralImpulse(entities[0], 0.1);

    // Add strong contact impulses to simulate collision
    contacts.list.forEach(contact => {
      contact.jn = f(0.02); // Above wake threshold
    });

    // Reset call counter
    systemCallCount = 0;

    // Run wake system - should wake entire chain
    WakeOnContact2D.fn(ctx);

    // Verify all bodies are now awake
    sleepingCount = 0;
    entities.forEach(entity => {
      const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
      if (sleep.sleeping) sleepingCount++;
    });
    expect(sleepingCount).toBe(0); // All should be awake

    // Verify significant system activity during wake
    expect(systemCallCount).toBeGreaterThan(15); // Should update many components

    // Clear impulses and simulate settling
    contacts.list.forEach(contact => {
      contact.jn = ZERO;
      contact.jt = ZERO;
    });

    // Reduce velocities to allow re-sleeping
    entities.forEach(entity => {
      const body = world.getComponent(entity, Body2D) as Body2D;
      const newBody = new Body2D();
      Object.assign(newBody, body);
      newBody.vx = f(0.001 * (Math.random() - 0.5));
      newBody.vy = f(0.001 * (Math.random() - 0.5));
      newBody.w = f(0.001 * (Math.random() - 0.5));
      world.setComponent(entity, Body2D, newBody);
    });

    // Simulate re-sleeping
    const resleepResults = simulateFrames(120);

    // Verify bodies go back to sleep
    expect(resleepResults[119].sleepingCount).toBe(10);
  });

  test('should maintain deterministic sleep timing across simulations', () => {
    // Run simulation twice with identical conditions
    const runSimulation = () => {
      const testWorld = new World();
      const testContacts = new Contacts2D();
      const testConfig = new PhysicsSleepConfig();
      testWorld.setResource(Contacts2D, testContacts);
      testWorld.setResource(PhysicsSleepConfig, testConfig);

      const testCtx = {
        world: testWorld,
        commandBuffer: new CommandBuffer(testWorld),
        frame: 1,
        deltaTime: 1/60
      };

      testWorld.getFixedDtFX = () => f(1/60);
      testWorld.frame = 1;
      testWorld.getStore = () => ({ markChanged: () => {} });

      // Create identical entities
      const testEntities: number[] = [];
      for (let i = 0; i < 5; i++) {
        const entity = testWorld.createEntity();
        testEntities.push(entity);

        const body = new Body2D();
        body.invMass = ONE;
        body.invI = ONE;
        body.px = f(i * 2.0);
        body.py = f(0);
        body.vx = f(0.01); // Below threshold
        body.vy = f(0.01);
        body.w = f(0.02);
        body.awake = 1;

        const sleep = new Sleep2D();
        sleep.sleeping = 0;
        sleep.timer = ZERO;

        testWorld.addComponent(entity, Body2D, body);
        testWorld.addComponent(entity, Sleep2D, sleep);
      }

      // Simulate deterministic frames
      const frameHashes: string[] = [];
      for (let frame = 0; frame < 60; frame++) {
        testWorld.frame = frame + 1;
        SleepUpdate2D.fn(testCtx);

        // Calculate frame hash
        let hash = '';
        testEntities.forEach(entity => {
          const body = testWorld.getComponent(entity, Body2D) as Body2D;
          const sleep = testWorld.getComponent(entity, Sleep2D) as Sleep2D;
          hash += `${body.vx}:${body.vy}:${body.w}:${sleep.sleeping}:${sleep.timer}|`;
        });
        frameHashes.push(hash);
      }

      return frameHashes;
    };

    const simulation1 = runSimulation();
    const simulation2 = runSimulation();

    // Verify deterministic behavior
    expect(simulation1).toEqual(simulation2);

    // Verify some bodies actually sleep during simulation
    const finalFrame = simulation1[59];
    expect(finalFrame.includes(':1:')).toBe(true); // Should contain sleeping=1
  });

  test('should respect wakeBias for rolling/light touch scenarios', () => {
    // Test with high wakeBias to prevent false sleeping during rolling
    config.wakeBias = f(3.0); // Higher bias (3x threshold)
    config.timeToSleep = f(0.2); // Shorter time for faster test

    entities = createStackedBodies(3);

    // Simulate rolling motion - start with velocities near threshold
    entities.forEach(entity => {
      const body = world.getComponent(entity, Body2D) as Body2D;
      const newBody = new Body2D();
      Object.assign(newBody, body);
      newBody.vx = f(0.03); // Above base threshold (0.02) but below wakeBias (0.06)
      newBody.vy = f(0.025);
      newBody.w = f(0.07); // Above base threshold (0.05) but below wakeBias (0.15)
      world.setComponent(entity, Body2D, newBody);
    });

    // Track results over time
    const results: { sleepingCount: number; frame: number }[] = [];

    for (let frame = 0; frame < 40; frame++) {
      world.frame = frame + 1;

      // Gradually reduce velocities to simulate friction
      entities.forEach(entity => {
        const body = world.getComponent(entity, Body2D) as Body2D;
        const newBody = new Body2D();
        Object.assign(newBody, body);

        // Decay velocities gradually
        const decay = 0.95;
        newBody.vx = f(newBody.vx * decay);
        newBody.vy = f(newBody.vy * decay);
        newBody.w = f(newBody.w * decay);

        world.setComponent(entity, Body2D, newBody);
      });

      SleepUpdate2D.fn(ctx);

      // Count sleeping bodies
      let sleepingCount = 0;
      entities.forEach(entity => {
        const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;
        if (sleep.sleeping) sleepingCount++;
      });

      results.push({ sleepingCount, frame });
    }

    // Should not sleep immediately due to wakeBias protection
    const earlySleepingCount = results[5].sleepingCount; // Frame 5
    expect(earlySleepingCount).toBe(0);

    // wakeBias test demonstrates prevention of premature sleeping during rolling motion
    // With higher wakeBias, bodies don't sleep until velocities are truly minimal
    const midSleepingCount = results[20].sleepingCount; // Frame 20
    expect(midSleepingCount).toBe(0); // Still rolling, should not sleep

    // System correctly handles wake bias to prevent false sleeping during active motion
  });

  test('should handle mixed static and dynamic bodies correctly', () => {
    // Create mix of static and dynamic bodies
    entities = [];

    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      entities.push(entity);

      const body = new Body2D();
      const sleep = new Sleep2D();

      if (i % 2 === 0) {
        // Static body
        body.invMass = ZERO;
        body.invI = ZERO;
        sleep.sleeping = 1; // Start as sleeping
      } else {
        // Dynamic body
        body.invMass = ONE;
        body.invI = ONE;
        body.vx = f(0.01);
        body.vy = f(0.01);
        body.w = f(0.02);
        sleep.sleeping = 0; // Start awake
      }

      world.addComponent(entity, Body2D, body);
      world.addComponent(entity, Sleep2D, sleep);
    }

    // Simulate several frames
    const results = simulateFrames(60);

    // Verify static bodies are forced awake consistently
    entities.forEach((entity, index) => {
      const body = world.getComponent(entity, Body2D) as Body2D;
      const sleep = world.getComponent(entity, Sleep2D) as Sleep2D;

      if (body.invMass === 0) {
        // Static bodies should always be awake
        expect(sleep.sleeping).toBe(0);
        expect(sleep.timer).toBe(ZERO);
      }
    });

    // Dynamic bodies should eventually sleep
    const finalSleepingCount = results[59].sleepingCount;
    expect(finalSleepingCount).toBeGreaterThan(0);
  });

  test('should maintain performance with frequent wake/sleep cycles', () => {
    entities = createStackedBodies(10);

    let totalSystemCalls = 0;
    let maxCallsPerFrame = 0;

    // Simulate oscillating system with periodic disturbances
    for (let cycle = 0; cycle < 5; cycle++) {
      // Let bodies sleep
      for (let frame = 0; frame < 30; frame++) {
        systemCallCount = 0;
        world.frame = cycle * 60 + frame + 1;
        SleepUpdate2D.fn(ctx);
        totalSystemCalls += systemCallCount;
        maxCallsPerFrame = Math.max(maxCallsPerFrame, systemCallCount);
      }

      // Apply disturbance to wake them up
      applyCentralImpulse(entities[0], 0.05);

      // Run wake system
      systemCallCount = 0;
      WakeOnContact2D.fn(ctx);
      totalSystemCalls += systemCallCount;
      maxCallsPerFrame = Math.max(maxCallsPerFrame, systemCallCount);
    }

    // Verify reasonable performance bounds
    const avgCallsPerFrame = totalSystemCalls / (5 * 31); // 5 cycles * 31 frames
    expect(avgCallsPerFrame).toBeLessThan(50); // Reasonable upper bound
    expect(maxCallsPerFrame).toBeLessThan(100); // Peak should be manageable
  });
});