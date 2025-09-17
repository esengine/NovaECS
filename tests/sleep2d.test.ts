/**
 * Tests for Sleep2D component and PhysicsSleepConfig resource
 * Sleep2D组件和PhysicsSleepConfig资源测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { Sleep2D } from '../src/components/Sleep2D';
import { PhysicsSleepConfig } from '../src/resources/PhysicsSleepConfig';
import { f } from '../src/math/fixed';

describe('Sleep2D Component', () => {
  let sleep: Sleep2D;

  beforeEach(() => {
    sleep = new Sleep2D();
  });

  test('should initialize with default awake state', () => {
    expect(sleep.sleeping).toBe(0);
    expect(sleep.timer).toBe(0);
    expect(sleep.keepAwake).toBe(0);
  });

  test('should allow setting sleep state', () => {
    sleep.sleeping = 1;
    expect(sleep.sleeping).toBe(1);
  });

  test('should allow accumulating idle timer', () => {
    const deltaTime = f(0.1);
    sleep.timer = deltaTime;
    expect(sleep.timer).toBe(deltaTime);
  });

  test('should allow external keep awake control', () => {
    sleep.keepAwake = 1;
    expect(sleep.keepAwake).toBe(1);
  });

  test('should maintain state consistency', () => {
    sleep.sleeping = 1;
    sleep.timer = f(1.0);
    sleep.keepAwake = 0;

    expect(sleep.sleeping).toBe(1);
    expect(sleep.timer).toBe(f(1.0));
    expect(sleep.keepAwake).toBe(0);
  });
});

describe('PhysicsSleepConfig Resource', () => {
  let config: PhysicsSleepConfig;

  beforeEach(() => {
    config = new PhysicsSleepConfig();
  });

  test('should initialize with conservative default values', () => {
    expect(config.linThresh).toBe(f(0.02));
    expect(config.angThresh).toBe(f(0.05));
    expect(config.timeToSleep).toBe(f(0.5));
    expect(config.wakeBias).toBe(f(1.5));
    expect(config.impulseWake).toBe(f(0.01));
  });

  test('should allow threshold configuration', () => {
    config.linThresh = f(0.01);
    config.angThresh = f(0.03);

    expect(config.linThresh).toBe(f(0.01));
    expect(config.angThresh).toBe(f(0.03));
  });

  test('should allow timing configuration', () => {
    config.timeToSleep = f(1.0);
    expect(config.timeToSleep).toBe(f(1.0));
  });

  test('should allow wake bias adjustment', () => {
    config.wakeBias = f(2.0);
    expect(config.wakeBias).toBe(f(2.0));
  });

  test('should allow impulse wake threshold adjustment', () => {
    config.impulseWake = f(0.005);
    expect(config.impulseWake).toBe(f(0.005));
  });

  test('should maintain configuration consistency', () => {
    config.linThresh = f(0.015);
    config.angThresh = f(0.04);
    config.timeToSleep = f(0.8);
    config.wakeBias = f(1.8);
    config.impulseWake = f(0.008);

    expect(config.linThresh).toBe(f(0.015));
    expect(config.angThresh).toBe(f(0.04));
    expect(config.timeToSleep).toBe(f(0.8));
    expect(config.wakeBias).toBe(f(1.8));
    expect(config.impulseWake).toBe(f(0.008));
  });
});