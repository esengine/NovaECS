/**
 * MaterialTable2D Tests
 * MaterialTable2D测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  MaterialTable2D,
  MixRule,
  PairRule,
  mix,
  resolveFriction,
  resolveRestitution,
  resolveBounceThreshold
} from '../src/resources/MaterialTable2D';
import {
  Material2D,
  createRubberMaterial,
  createIceMaterial,
  createMetalMaterial
} from '../src/components/Material2D';
import { f, toFloat } from '../src/math/fixed';

describe('MaterialTable2D', () => {
  let table: MaterialTable2D;
  let rubber: Material2D;
  let ice: Material2D;
  let metal: Material2D;

  beforeEach(() => {
    table = new MaterialTable2D();
    rubber = createRubberMaterial();
    ice = createIceMaterial();
    metal = createMetalMaterial();
  });

  test('should use default rules when no specific rule is set', () => {
    const rule = table.getRule(rubber, ice);

    expect(rule.frictionRule).toBe('min');
    expect(rule.restitutionRule).toBe('max');
    expect(rule.thresholdRule).toBe('max');
    expect(rule.customFriction).toBeUndefined();
    expect(rule.customRestitution).toBeUndefined();
    expect(rule.customThreshold).toBeUndefined();
  });

  test('should set and retrieve pair-specific rules', () => {
    const customRule: PairRule = {
      frictionRule: 'avg',
      restitutionRule: 'min',
      thresholdRule: 'avg'
    };

    table.set(rubber.id, ice.id, customRule);
    const retrievedRule = table.getRule(rubber, ice);

    expect(retrievedRule.frictionRule).toBe('avg');
    expect(retrievedRule.restitutionRule).toBe('min');
    expect(retrievedRule.thresholdRule).toBe('avg');
  });

  test('should handle material order independence', () => {
    const customRule: PairRule = {
      frictionRule: 'avg',
      restitutionRule: 'geo'
    };

    // Set rule for rubber-ice
    table.set(rubber.id, ice.id, customRule);

    // Should get same rule regardless of order
    const rule1 = table.getRule(rubber, ice);
    const rule2 = table.getRule(ice, rubber);

    expect(rule1.frictionRule).toBe(rule2.frictionRule);
    expect(rule1.restitutionRule).toBe(rule2.restitutionRule);
  });

  test('should check rule existence', () => {
    expect(table.hasRule(rubber, ice)).toBe(false);

    table.set(rubber.id, ice.id, { frictionRule: 'avg' });
    expect(table.hasRule(rubber, ice)).toBe(true);
    expect(table.hasRule(ice, rubber)).toBe(true); // Order independence
  });

  test('should remove rules', () => {
    table.set(rubber.id, ice.id, { frictionRule: 'avg' });
    expect(table.hasRule(rubber, ice)).toBe(true);

    const removed = table.removeRule(rubber.id, ice.id);
    expect(removed).toBe(true);
    expect(table.hasRule(rubber, ice)).toBe(false);

    // Should fall back to defaults
    const rule = table.getRule(rubber, ice);
    expect(rule.frictionRule).toBe('min');
  });

  test('should clear all rules', () => {
    table.set(rubber.id, ice.id, { frictionRule: 'avg' });
    table.set(rubber.id, metal.id, { frictionRule: 'max' });
    expect(table.size()).toBe(2);

    table.clear();
    expect(table.size()).toBe(0);
    expect(table.hasRule(rubber, ice)).toBe(false);
    expect(table.hasRule(rubber, metal)).toBe(false);
  });

  test('should get all pair keys', () => {
    table.set(rubber.id, ice.id, { frictionRule: 'avg' });
    table.set(rubber.id, metal.id, { frictionRule: 'max' });

    const pairs = table.getAllPairs();
    expect(pairs).toHaveLength(2);
    expect(pairs).toContain('ice|rubber');
    expect(pairs).toContain('metal|rubber');
  });

  test('should support custom friction function', () => {
    const customRule: PairRule = {
      customFriction: (a: Material2D, b: Material2D) => ({
        muS: f(0.99),
        muD: f(0.88)
      })
    };

    table.set(rubber.id, ice.id, customRule);
    const rule = table.getRule(rubber, ice);

    const friction = resolveFriction(rubber, ice, rule);
    expect(toFloat(friction.muS)).toBeCloseTo(0.99, 2);
    expect(toFloat(friction.muD)).toBeCloseTo(0.88, 2);
  });

  test('should support custom restitution function', () => {
    const customRule: PairRule = {
      customRestitution: (a: Material2D, b: Material2D) => f(0.555)
    };

    table.set(rubber.id, ice.id, customRule);
    const rule = table.getRule(rubber, ice);

    const restitution = resolveRestitution(rubber, ice, rule);
    expect(toFloat(restitution)).toBeCloseTo(0.555, 2);
  });

  test('should support custom threshold function', () => {
    const customRule: PairRule = {
      customThreshold: (a: Material2D, b: Material2D) => f(1.234)
    };

    table.set(rubber.id, ice.id, customRule);
    const rule = table.getRule(rubber, ice);

    const threshold = resolveBounceThreshold(rubber, ice, rule);
    expect(toFloat(threshold)).toBeCloseTo(1.234, 2);
  });
});

describe('mix function', () => {
  const a = f(0.8);
  const b = f(0.3);

  test('should handle min rule', () => {
    const result = mix(a, b, 'min');
    expect(toFloat(result)).toBeCloseTo(0.3, 2);
  });

  test('should handle max rule', () => {
    const result = mix(a, b, 'max');
    expect(toFloat(result)).toBeCloseTo(0.8, 2);
  });

  test('should handle avg rule', () => {
    const result = mix(a, b, 'avg');
    expect(toFloat(result)).toBeCloseTo(0.55, 2);
  });

  test('should handle mul rule', () => {
    const result = mix(a, b, 'mul');
    expect(toFloat(result)).toBeCloseTo(0.24, 2);
  });

  test('should handle geo rule', () => {
    const result = mix(a, b, 'geo');
    // sqrt(0.8 * 0.3) = sqrt(0.24) ≈ 0.49
    expect(toFloat(result)).toBeCloseTo(0.49, 1);
  });

  test('should handle a rule', () => {
    const result = mix(a, b, 'a');
    expect(toFloat(result)).toBeCloseTo(0.8, 2);
  });

  test('should handle b rule', () => {
    const result = mix(a, b, 'b');
    expect(toFloat(result)).toBeCloseTo(0.3, 2);
  });

  test('should fallback to min for unknown rule', () => {
    const result = mix(a, b, 'unknown' as MixRule);
    expect(toFloat(result)).toBeCloseTo(0.3, 2);
  });
});

describe('material resolution functions', () => {
  let rubber: Material2D;
  let ice: Material2D;

  beforeEach(() => {
    rubber = createRubberMaterial(); // High friction, high restitution
    ice = createIceMaterial();       // Low friction, low restitution
  });

  test('should resolve friction with standard rules', () => {
    const rule: PairRule = { frictionRule: 'min' };
    const friction = resolveFriction(rubber, ice, rule);

    // Should use ice's lower friction values
    expect(toFloat(friction.muS)).toBeCloseTo(toFloat(ice.muS), 2);
    expect(toFloat(friction.muD)).toBeCloseTo(toFloat(ice.muD), 2);
  });

  test('should resolve restitution with standard rules', () => {
    const rule: PairRule = { restitutionRule: 'max' };
    const restitution = resolveRestitution(rubber, ice, rule);

    // Should use rubber's higher restitution
    expect(toFloat(restitution)).toBeCloseTo(toFloat(rubber.restitution), 2);
  });

  test('should resolve bounce threshold with standard rules', () => {
    const rule: PairRule = { thresholdRule: 'min' };
    const threshold = resolveBounceThreshold(rubber, ice, rule);

    // Should use ice's lower threshold
    expect(toFloat(threshold)).toBeCloseTo(toFloat(ice.bounceThreshold), 2);
  });

  test('should prioritize custom functions over standard rules', () => {
    const rule: PairRule = {
      frictionRule: 'max', // Should be ignored
      customFriction: () => ({ muS: f(0.123), muD: f(0.456) }),

      restitutionRule: 'min', // Should be ignored
      customRestitution: () => f(0.789),

      thresholdRule: 'avg', // Should be ignored
      customThreshold: () => f(1.111)
    };

    const friction = resolveFriction(rubber, ice, rule);
    const restitution = resolveRestitution(rubber, ice, rule);
    const threshold = resolveBounceThreshold(rubber, ice, rule);

    expect(toFloat(friction.muS)).toBeCloseTo(0.123, 2);
    expect(toFloat(friction.muD)).toBeCloseTo(0.456, 2);
    expect(toFloat(restitution)).toBeCloseTo(0.789, 2);
    expect(toFloat(threshold)).toBeCloseTo(1.111, 2);
  });

  test('should use fallback defaults when rule properties are undefined', () => {
    const rule: PairRule = {}; // Empty rule

    const friction = resolveFriction(rubber, ice, rule);
    const restitution = resolveRestitution(rubber, ice, rule);
    const threshold = resolveBounceThreshold(rubber, ice, rule);

    // Should use default 'min' for friction
    expect(toFloat(friction.muS)).toBeCloseTo(toFloat(ice.muS), 2);
    expect(toFloat(friction.muD)).toBeCloseTo(toFloat(ice.muD), 2);

    // Should use default 'max' for restitution
    expect(toFloat(restitution)).toBeCloseTo(toFloat(rubber.restitution), 2);

    // Should use default 'max' for threshold
    expect(toFloat(threshold)).toBeCloseTo(toFloat(rubber.bounceThreshold), 2);
  });
});