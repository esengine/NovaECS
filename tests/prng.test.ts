/**
 * Tests for deterministic PRNG
 * 确定性PRNG测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { PRNG } from '../src/determinism/PRNG';
import { World } from '../src/core/World';

describe('PRNG', () => {
  let prng: PRNG;

  beforeEach(() => {
    prng = new PRNG();
  });

  test('should be deterministic with same seed', () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(12345);

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 10; i++) {
      values1.push(prng1.nextFloat());
      values2.push(prng2.nextFloat());
    }

    expect(values1).toEqual(values2);
  });

  test('should produce different sequences with different seeds', () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(54321);

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 10; i++) {
      values1.push(prng1.nextFloat());
      values2.push(prng2.nextFloat());
    }

    expect(values1).not.toEqual(values2);
  });

  test('should allow re-seeding', () => {
    prng.seed(12345);
    const value1 = prng.nextFloat();
    const value2 = prng.nextFloat();

    prng.seed(12345);
    const value3 = prng.nextFloat();
    const value4 = prng.nextFloat();

    expect(value1).toBe(value3);
    expect(value2).toBe(value4);
  });

  test('should generate floats in range [0,1)', () => {
    for (let i = 0; i < 1000; i++) {
      const value = prng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test('should generate consistent U32 values', () => {
    prng.seed(42);

    const actual: number[] = [];
    for (let i = 0; i < 10; i++) {
      actual.push(prng.nextU32());
    }

    // Reset and generate again
    prng.seed(42);
    const actual2: number[] = [];
    for (let i = 0; i < 10; i++) {
      actual2.push(prng.nextU32());
    }

    expect(actual).toEqual(actual2);
    expect(actual).toHaveLength(10);
  });

  test('should generate integers in specified range', () => {
    prng.seed(12345);

    for (let i = 0; i < 100; i++) {
      const value = prng.nextInt(5, 15);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(15);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  test('should generate booleans', () => {
    prng.seed(12345);

    const results: boolean[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(prng.nextBool());
    }

    const trueCount = results.filter(x => x).length;
    const falseCount = results.filter(x => !x).length;

    expect(trueCount).toBeGreaterThan(0);
    expect(falseCount).toBeGreaterThan(0);
    expect(trueCount + falseCount).toBe(100);
  });

  test('should choose from array deterministically', () => {
    const array = ['a', 'b', 'c', 'd', 'e'];

    prng.seed(12345);
    const choices1: string[] = [];
    for (let i = 0; i < 10; i++) {
      choices1.push(prng.nextChoice(array));
    }

    prng.seed(12345);
    const choices2: string[] = [];
    for (let i = 0; i < 10; i++) {
      choices2.push(prng.nextChoice(array));
    }

    expect(choices1).toEqual(choices2);
    choices1.forEach(choice => {
      expect(array).toContain(choice);
    });
  });

  test('should throw on empty array choice', () => {
    expect(() => prng.nextChoice([])).toThrow('Cannot choose from empty array');
  });

  test('should shuffle arrays deterministically', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    prng.seed(12345);
    const shuffled1 = prng.shuffle(original);

    prng.seed(12345);
    const shuffled2 = prng.shuffle(original);

    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).toHaveLength(original.length);
    expect([...shuffled1].sort()).toEqual([...original].sort());
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // Original unchanged
  });

  test('should save and restore state', () => {
    prng.seed(12345);
    prng.nextFloat();
    prng.nextFloat();

    const state = prng.getState();
    const nextValue = prng.nextFloat();

    prng.setState(state);
    const restoredValue = prng.nextFloat();

    expect(nextValue).toBe(restoredValue);
  });

  test('should work with default constructor', () => {
    const prng1 = new PRNG();
    const prng2 = new PRNG();

    const value1 = prng1.nextFloat();
    const value2 = prng2.nextFloat();

    expect(value1).toBe(value2);
  });

  describe('World Integration', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    test('should work as World resource', () => {
      const prng = new PRNG(12345);
      world.setResource(PRNG, prng);

      const retrieved = world.getResource(PRNG);
      expect(retrieved).toBe(prng);
    });

    test('should maintain determinism across systems', () => {
      world.setResource(PRNG, new PRNG(12345));

      const values1: number[] = [];
      const values2: number[] = [];

      // Simulate system 1
      const prng1 = world.getResource(PRNG)!;
      for (let i = 0; i < 5; i++) {
        values1.push(prng1.nextFloat());
      }

      // Reset and simulate again
      world.setResource(PRNG, new PRNG(12345));
      const prng2 = world.getResource(PRNG)!;
      for (let i = 0; i < 5; i++) {
        values2.push(prng2.nextFloat());
      }

      expect(values1).toEqual(values2);
    });

    test('should provide consistent randomness for game logic', () => {
      world.setResource(PRNG, new PRNG(42));
      const prng = world.getResource(PRNG)!;

      // Simulate game logic that needs random numbers
      const criticalHits: boolean[] = [];
      const damages: number[] = [];

      for (let i = 0; i < 10; i++) {
        criticalHits.push(prng.nextFloat() < 0.1); // 10% crit chance
        damages.push(prng.nextInt(10, 20)); // 10-20 damage
      }

      // Reset and do same logic
      world.setResource(PRNG, new PRNG(42));
      const prng2 = world.getResource(PRNG)!;

      const criticalHits2: boolean[] = [];
      const damages2: number[] = [];

      for (let i = 0; i < 10; i++) {
        criticalHits2.push(prng2.nextFloat() < 0.1);
        damages2.push(prng2.nextInt(10, 20));
      }

      expect(criticalHits).toEqual(criticalHits2);
      expect(damages).toEqual(damages2);
    });
  });

  describe('Statistical Properties', () => {
    test('should have reasonable distribution for floats', () => {
      prng.seed(12345);

      const bins = Array(10).fill(0);
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        const value = prng.nextFloat();
        const bin = Math.floor(value * 10);
        if (bin >= 0 && bin < 10) {
          bins[bin]++;
        }
      }

      // Each bin should have roughly samples/10 values (within 20% tolerance)
      const expected = samples / 10;
      const tolerance = expected * 0.2;

      bins.forEach(count => {
        expect(count).toBeGreaterThan(expected - tolerance);
        expect(count).toBeLessThan(expected + tolerance);
      });
    });

    test('should have reasonable distribution for integers', () => {
      prng.seed(54321);

      const min = 1;
      const max = 6; // Dice roll
      const counts = new Map<number, number>();

      for (let i = min; i <= max; i++) {
        counts.set(i, 0);
      }

      const samples = 6000;
      for (let i = 0; i < samples; i++) {
        const value = prng.nextInt(min, max);
        counts.set(value, counts.get(value)! + 1);
      }

      // Each value should appear roughly samples/(max-min+1) times
      const expected = samples / (max - min + 1);
      const tolerance = expected * 0.2;

      counts.forEach(count => {
        expect(count).toBeGreaterThan(expected - tolerance);
        expect(count).toBeLessThan(expected + tolerance);
      });
    });
  });
});