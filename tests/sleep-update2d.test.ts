/**
 * Tests for SleepUpdate2D system
 * SleepUpdate2D系统测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Body2D } from '../src/components/Body2D';
import { Sleep2D } from '../src/components/Sleep2D';
import { PhysicsSleepConfig } from '../src/resources/PhysicsSleepConfig';
import { SleepUpdate2D } from '../src/systems/phys2d/SleepUpdate2D';
import { f, ZERO, ONE } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';

describe('SleepUpdate2D System', () => {
  let world: World;
  let entity: number;
  let config: PhysicsSleepConfig;
  let ctx: SystemContext;
  let mockReplaceComponent: any;

  beforeEach(() => {
    world = new World();

    // Create entity with body and sleep components
    entity = world.createEntity();
    const body = new Body2D();
    const sleep = new Sleep2D();

    world.addComponent(entity, Body2D, body);
    world.addComponent(entity, Sleep2D, sleep);

    // Add sleep configuration
    config = new PhysicsSleepConfig();
    world.setResource(PhysicsSleepConfig, config);

    // Create system context
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

    // Mock replaceComponent to capture system behavior
    mockReplaceComponent = vi.fn();
    const originalSetComponent = world.replaceComponent;
    world.replaceComponent = vi.fn((entityId, ctor, data) => {
      mockReplaceComponent(entityId, ctor, data);
      return originalSetComponent.call(world, entityId, ctor, data);
    });

    // Mock query method to return our test entity
    const originalQuery = world.query;
    world.query = (...ctors: any[]) => {
      const mockQuery = originalQuery.call(world, ...ctors);
      mockQuery.forEach = (callback: any) => {
        const currentBody = world.getComponent(entity, Body2D) as Body2D;
        const currentSleep = world.getComponent(entity, Sleep2D) as Sleep2D;
        callback(entity, currentBody, currentSleep);
      };
      return mockQuery;
    };
  });

  function setupBodyVelocity(vx: number, vy: number, w: number) {
    const body = new Body2D();
    Object.assign(body, world.getComponent(entity, Body2D));
    body.vx = f(vx);
    body.vy = f(vy);
    body.w = f(w);
    world.replaceComponent(entity, Body2D, body);
    mockReplaceComponent.mockClear();
  }

  function setupSleepState(sleeping: 0 | 1, timer = 0, keepAwake = 0) {
    const sleep = new Sleep2D();
    sleep.sleeping = sleeping;
    sleep.timer = f(timer);
    sleep.keepAwake = keepAwake;
    world.replaceComponent(entity, Sleep2D, sleep);
    mockReplaceComponent.mockClear();
  }

  function makeBodyStatic() {
    const body = new Body2D();
    Object.assign(body, world.getComponent(entity, Body2D));
    body.invMass = ZERO;
    body.invI = ZERO;
    world.replaceComponent(entity, Body2D, body);
    mockReplaceComponent.mockClear();
  }

  test('should force wake static bodies', () => {
    makeBodyStatic();
    setupSleepState(1, 1.0); // Set as sleeping initially

    SleepUpdate2D.fn(ctx);

    // Should force wake static body
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Body2D,
      expect.any(Object)
    );
  });

  test('should force wake when keepAwake is set', () => {
    setupSleepState(1, 1.0, 1); // Sleeping with keepAwake flag

    SleepUpdate2D.fn(ctx);

    // Should force wake due to keepAwake flag
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
  });

  test('should accumulate timer when below thresholds', () => {
    setupBodyVelocity(0.01, 0.01, 0.02); // Below default thresholds
    setupSleepState(0, 0.3); // Awake with some timer

    SleepUpdate2D.fn(ctx);

    // Should accumulate timer but not enter sleep yet
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: expect.any(Number) // Timer should be accumulated
      })
    );
  });

  test('should clear timer when above thresholds', () => {
    setupBodyVelocity(0.05, 0.05, 0.1); // Above thresholds
    setupSleepState(0, 0.4); // High timer

    SleepUpdate2D.fn(ctx);

    // Should reset timer and stay awake
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Body2D,
      expect.objectContaining({ awake: 1 })
    );
  });

  test('should enter sleep when timer exceeds threshold', () => {
    setupBodyVelocity(0.01, 0.01, 0.02); // Below thresholds
    setupSleepState(0, 0.49); // Just below timeToSleep (0.5)

    SleepUpdate2D.fn(ctx);

    // Should enter sleep and clear velocities
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({ sleeping: 1 })
    );
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Body2D,
      expect.objectContaining({
        awake: 0,
        vx: ZERO,
        vy: ZERO,
        w: ZERO
      })
    );
  });

  test('should clear velocities when entering sleep', () => {
    setupBodyVelocity(0.01, 0.01, 0.02);
    setupSleepState(0, 0.6); // Above timeToSleep (0.5)

    SleepUpdate2D.fn(ctx);

    // Should enter sleep and clear all velocities
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Body2D,
      expect.objectContaining({
        vx: ZERO,
        vy: ZERO,
        w: ZERO,
        awake: 0
      })
    );
  });

  test('should handle angular velocity threshold separately', () => {
    setupBodyVelocity(0.01, 0.01, 0.08); // Linear below, angular above threshold
    setupSleepState(0, 0.3);

    SleepUpdate2D.fn(ctx);

    // Should reset timer due to high angular velocity
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: ZERO
      })
    );
  });

  test('should handle custom configuration values', () => {
    // Modify configuration
    config.linThresh = f(0.05);
    config.angThresh = f(0.1);
    config.timeToSleep = f(0.3);

    // Set velocities below new thresholds
    setupBodyVelocity(0.03, 0.03, 0.05);
    setupSleepState(0, 0.25);

    SleepUpdate2D.fn(ctx);

    // Should accumulate timer but not sleep yet
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({
        sleeping: 0,
        timer: expect.any(Number)
      })
    );

    // Now test with timer exceeding new threshold
    setupSleepState(0, 0.35);
    mockReplaceComponent.mockClear();

    SleepUpdate2D.fn(ctx);

    // Should enter sleep with new threshold
    expect(mockReplaceComponent).toHaveBeenCalledWith(
      entity,
      Sleep2D,
      expect.objectContaining({ sleeping: 1 })
    );
  });

  test('should create config if not present', () => {
    // Mock empty getResource to simulate missing config
    const originalGetResource = world.getResource;
    let addedConfig: PhysicsSleepConfig | null = null;

    world.getResource = (type: any) => {
      if (type === PhysicsSleepConfig) return undefined;
      return originalGetResource.call(world, type);
    };

    // Mock setResource to capture added config
    const originalSetResource = world.setResource;
    world.setResource = (type: any, instance: any) => {
      if (type === PhysicsSleepConfig) {
        addedConfig = instance;
      }
      return originalSetResource.call(world, type, instance);
    };

    SleepUpdate2D.fn(ctx);

    expect(addedConfig).toBeInstanceOf(PhysicsSleepConfig);
  });

  test('should have correct system configuration', () => {
    const builtSystem = SleepUpdate2D;
    expect(builtSystem.name).toBe('phys.sleep.update');
    expect(builtSystem.stage).toBe('postUpdate');
    expect(builtSystem.after).toContain('phys.solver.gs');
    expect(builtSystem.before).toContain('cleanup');
  });

  test('should optimize by not updating when no changes needed', () => {
    // Set up a body that's already in the correct state
    setupBodyVelocity(0.05, 0.05, 0.1); // Above thresholds
    setupSleepState(0, 0); // Already awake with zero timer

    SleepUpdate2D.fn(ctx);

    // Optimized system should NOT update when state is already correct
    expect(mockReplaceComponent).not.toHaveBeenCalled();
  });
});