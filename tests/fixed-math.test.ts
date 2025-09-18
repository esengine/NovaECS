/**
 * Fixed-point mathematics unit tests
 * 定点数数学运算单元测试
 */

import { describe, test, expect } from 'vitest';
import {
  FP, ONE, HALF, MAX_FX, MIN_FX, ZERO, TWO, THREE, FOUR,
  HALF_PI, PI, TWO_PI, E,
  f, toFloat, fromInt, toInt,
  add, sub, neg, mul, div, mod,
  clamp, abs, min, max, sign,
  sqrt, lerp, madd, msub,
  isZero, isEqual,
  round, floor, ceil,
  dot, cross_r_v, cross_w_r, cross_r_n
} from '../src/math/fixed';

describe('Fixed-point Mathematics Library', () => {
  describe('Constants and Basic Conversions', () => {
    test('should have correct fixed point constants', () => {
      expect(FP).toBe(16);
      expect(ONE).toBe(1 << 16);
      expect(HALF).toBe(ONE >> 1);
      expect(ZERO).toBe(0);
      expect(TWO).toBe(ONE << 1);
      expect(THREE).toBe(ONE + TWO);
      expect(FOUR).toBe(ONE << 2);
    });

    test('should have accurate mathematical constants', () => {
      expect(Math.abs(toFloat(HALF_PI) - Math.PI / 2)).toBeLessThan(0.001);
      expect(Math.abs(toFloat(PI) - Math.PI)).toBeLessThan(0.001);
      expect(Math.abs(toFloat(TWO_PI) - 2 * Math.PI)).toBeLessThan(0.001);
      expect(Math.abs(toFloat(E) - Math.E)).toBeLessThan(0.001);
    });

    test('should convert float to fixed point correctly', () => {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(ONE);
      expect(f(2)).toBe(TWO);
      expect(f(0.5)).toBe(HALF);
      expect(f(-1)).toBe(-ONE);
      expect(f(1.5)).toBe(98304);
    });

    test('should convert fixed point to float correctly', () => {
      expect(toFloat(ZERO)).toBe(0);
      expect(toFloat(ONE)).toBe(1);
      expect(toFloat(TWO)).toBe(2);
      expect(toFloat(HALF)).toBe(0.5);
      expect(toFloat(-ONE)).toBe(-1);
      expect(Math.abs(toFloat(f(1.5)) - 1.5)).toBeLessThan(0.001);
    });

    test('should convert integers correctly', () => {
      expect(fromInt(0)).toBe(0);
      expect(fromInt(1)).toBe(ONE);
      expect(fromInt(5)).toBe(5 * ONE);
      expect(fromInt(-3)).toBe(-3 * ONE);

      expect(toInt(ZERO)).toBe(0);
      expect(toInt(ONE)).toBe(1);
      expect(toInt(5 * ONE)).toBe(5);
      expect(toInt(-3 * ONE)).toBe(-3);
      expect(toInt(f(2.7))).toBe(2);
    });
  });

  describe('Basic Arithmetic Operations', () => {
    test('should perform addition correctly', () => {
      expect(add(f(1), f(2))).toBe(f(3));
      expect(add(f(1.5), f(2.5))).toBe(f(4));
      expect(add(f(-1), f(3))).toBe(f(2));
      expect(add(ZERO, f(5))).toBe(f(5));
      expect(add(f(0.25), f(0.75))).toBe(ONE);
    });

    test('should perform subtraction correctly', () => {
      expect(sub(f(5), f(3))).toBe(f(2));
      expect(sub(f(1), f(0.5))).toBe(f(0.5));
      expect(sub(f(0), f(1))).toBe(f(-1));
      expect(sub(f(2.5), f(1.5))).toBe(ONE);
    });

    test('should perform negation correctly', () => {
      expect(neg(f(1))).toBe(f(-1));
      expect(neg(f(-2))).toBe(f(2));
      expect(neg(ZERO)).toBe(ZERO);
      expect(neg(f(3.5))).toBe(f(-3.5));
    });

    test('should perform multiplication correctly', () => {
      expect(mul(f(2), f(3))).toBe(f(6));
      expect(mul(f(1.5), f(2))).toBe(f(3));
      expect(mul(f(0.5), f(4))).toBe(f(2));
      expect(mul(f(-2), f(3))).toBe(f(-6));
      expect(mul(ZERO, f(100))).toBe(ZERO);
      expect(mul(ONE, f(5))).toBe(f(5));
    });

    test('should perform division correctly', () => {
      expect(div(f(6), f(2))).toBe(f(3));
      expect(div(f(3), f(2))).toBe(f(1.5));
      expect(div(f(1), f(4))).toBe(f(0.25));
      expect(div(f(-6), f(2))).toBe(f(-3));
      expect(div(ZERO, f(5))).toBe(ZERO);
    });

    test('should handle division by zero', () => {
      expect(div(f(5), ZERO)).toBe(0);
      expect(div(ZERO, ZERO)).toBe(ZERO);
    });

    test('should perform modulo correctly', () => {
      expect(mod(f(7), f(3))).toBe(f(1));
      expect(mod(f(10), f(4))).toBe(f(2));
      expect(mod(f(5), f(2))).toBe(f(1));
      expect(mod(f(-7), f(3))).toBe(f(-1));
    });

    test('should handle modulo by zero', () => {
      expect(mod(f(5), ZERO)).toBe(ZERO);
    });
  });

  describe('Mathematical Functions', () => {
    test('should calculate absolute value correctly', () => {
      expect(abs(f(5))).toBe(f(5));
      expect(abs(f(-5))).toBe(f(5));
      expect(abs(ZERO)).toBe(ZERO);
      expect(abs(f(3.5))).toBe(f(3.5));
      expect(abs(f(-3.5))).toBe(f(3.5));
    });

    test('should find minimum correctly', () => {
      expect(min(f(3), f(5))).toBe(f(3));
      expect(min(f(5), f(3))).toBe(f(3));
      expect(min(f(-1), f(1))).toBe(f(-1));
      expect(min(f(2.5), f(2.5))).toBe(f(2.5));
    });

    test('should find maximum correctly', () => {
      expect(max(f(3), f(5))).toBe(f(5));
      expect(max(f(5), f(3))).toBe(f(5));
      expect(max(f(-1), f(1))).toBe(f(1));
      expect(max(f(2.5), f(2.5))).toBe(f(2.5));
    });

    test('should calculate sign correctly', () => {
      expect(sign(f(5))).toBe(ONE);
      expect(sign(f(-5))).toBe(neg(ONE));
      expect(sign(ZERO)).toBe(ZERO);
      expect(sign(f(0.1))).toBe(ONE);
      expect(sign(f(-0.1))).toBe(neg(ONE));
    });

    test('should clamp values correctly', () => {
      expect(clamp(f(5), f(1), f(10))).toBe(f(5));
      expect(clamp(f(0), f(1), f(10))).toBe(f(1));
      expect(clamp(f(15), f(1), f(10))).toBe(f(10));
      expect(clamp(f(7), f(7), f(7))).toBe(f(7));
    });

    test('should calculate square root correctly', () => {
      expect(sqrt(ZERO)).toBe(ZERO);
      expect(sqrt(ONE)).toBe(ONE);
      expect(sqrt(f(4))).toBe(f(2));
      expect(sqrt(f(9))).toBe(f(3));
      expect(sqrt(f(16))).toBe(f(4));

      const sqrt2 = sqrt(f(2));
      expect(Math.abs(toFloat(sqrt2) - Math.sqrt(2))).toBeLessThan(0.01);

      expect(sqrt(f(-1))).toBe(ZERO);
    });
  });

  describe('Rounding Functions', () => {
    test('should round correctly', () => {
      expect(round(f(2.3))).toBe(f(2));
      expect(round(f(2.5))).toBe(f(3));
      expect(round(f(2.7))).toBe(f(3));
      expect(round(f(-2.3))).toBe(f(-2));
      expect(round(f(-2.5))).toBe(f(-2));
      expect(round(f(-2.7))).toBe(f(-3));
    });

    test('should floor correctly', () => {
      expect(floor(f(2.3))).toBe(f(2));
      expect(floor(f(2.7))).toBe(f(2));
      expect(floor(f(-2.3))).toBe(f(-3));
      expect(floor(f(-2.7))).toBe(f(-3));
      expect(floor(f(5))).toBe(f(5));
    });

    test('should ceil correctly', () => {
      expect(ceil(f(2.3))).toBe(f(3));
      expect(ceil(f(2.7))).toBe(f(3));
      expect(ceil(f(-2.3))).toBe(f(-2));
      expect(ceil(f(-2.7))).toBe(f(-2));
      expect(ceil(f(5))).toBe(f(5));
    });
  });

  describe('Interpolation and Compound Operations', () => {
    test('should perform linear interpolation correctly', () => {
      expect(lerp(f(0), f(10), f(0))).toBe(f(0));
      expect(lerp(f(0), f(10), f(1))).toBe(f(10));
      expect(lerp(f(0), f(10), f(0.5))).toBe(f(5));
      expect(lerp(f(2), f(8), f(0.25))).toBe(f(3.5));
      expect(lerp(f(-5), f(5), f(0.5))).toBe(f(0));
    });

    test('should perform multiply-add correctly', () => {
      expect(madd(f(1), f(2), f(3))).toBe(f(7));
      expect(madd(f(10), f(0.5), f(4))).toBe(f(12));
      expect(madd(f(0), f(7), f(8))).toBe(f(56));
    });

    test('should perform multiply-subtract correctly', () => {
      expect(msub(f(10), f(2), f(3))).toBe(f(4));
      expect(msub(f(5), f(0.5), f(4))).toBe(f(3));
      expect(msub(f(100), f(7), f(8))).toBe(f(44));
    });
  });

  describe('Comparison Functions', () => {
    test('should check if value is zero', () => {
      expect(isZero(ZERO)).toBe(true);
      expect(isZero(f(0))).toBe(true);
      expect(isZero(1)).toBe(true);
      expect(isZero(2)).toBe(false);
      expect(isZero(f(0.1))).toBe(false);

      expect(isZero(f(0.01), f(0.1))).toBe(true);
      expect(isZero(f(0.2), f(0.1))).toBe(false);
    });

    test('should check if values are equal', () => {
      expect(isEqual(f(5), f(5))).toBe(true);
      expect(isEqual(f(5), f(5.0001), f(0.01))).toBe(true);
      expect(isEqual(f(5), f(5.1), f(0.01))).toBe(false);
      expect(isEqual(f(-3), f(-3))).toBe(true);

      const val1 = f(2.5);
      const val2 = f(2.5) + 1;
      expect(isEqual(val1, val2)).toBe(true);
    });
  });

  describe('Boundary Values and Edge Cases', () => {
    test('should handle maximum and minimum values', () => {
      expect(MAX_FX).toBe(0x7fffffff);
      expect(MIN_FX).toBe(-0x80000000);

      expect(add(MAX_FX, ZERO)).toBe(MAX_FX);
      expect(sub(MIN_FX, ZERO)).toBe(MIN_FX);
    });

    test('should handle large value multiplication', () => {
      const large1 = f(100);
      const large2 = f(100);
      const result = mul(large1, large2);
      expect(Math.abs(toFloat(result) - 10000)).toBeLessThan(1);
    });

    test('should handle small value operations', () => {
      const small1 = f(0.001);
      const small2 = f(0.002);
      const result = add(small1, small2);
      expect(Math.abs(toFloat(result) - 0.003)).toBeLessThan(0.001);
    });

    test('should handle zero value operations', () => {
      expect(mul(ZERO, f(999))).toBe(ZERO);
      expect(add(ZERO, ZERO)).toBe(ZERO);
      expect(sub(ZERO, ZERO)).toBe(ZERO);
      expect(div(ZERO, f(5))).toBe(ZERO);
    });
  });

  describe('Precision and Consistency', () => {
    test('should maintain deterministic behavior', () => {
      const a = f(1.5);
      const b = f(2.7);

      const result1 = add(mul(a, b), div(a, b));
      const result2 = add(mul(a, b), div(a, b));
      const result3 = add(mul(a, b), div(a, b));

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    test('should maintain precision in complex operations', () => {
      const a = f(3.14);
      const b = f(2.86);
      const c = f(7.5);
      const d = f(1.5);

      const result = mul(add(a, b), sub(c, d));
      const expected = (3.14 + 2.86) * (7.5 - 1.5);

      expect(Math.abs(toFloat(result) - expected)).toBeLessThan(0.1);
    });

    test('should maintain square root precision across range', () => {
      const testValues = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];

      for (const val of testValues) {
        const fx = f(val);
        const sqrtFx = sqrt(fx);
        const expected = Math.sqrt(val);

        expect(Math.abs(toFloat(sqrtFx) - expected)).toBeLessThan(0.01);
      }
    });
  });

  describe('Vector and Physics Math', () => {
    test('should calculate 2D dot product correctly', () => {
      // Test basic dot product
      expect(dot(f(1), f(0), f(0), f(1))).toBe(ZERO); // Perpendicular vectors
      expect(dot(f(1), f(0), f(1), f(0))).toBe(ONE);  // Parallel vectors
      expect(dot(f(3), f(4), f(5), f(12))).toBe(f(63)); // 3*5 + 4*12 = 63

      // Test with negative values
      expect(dot(f(-1), f(2), f(3), f(-4))).toBe(f(-11)); // -1*3 + 2*(-4) = -11
    });

    test('should calculate cross product r × v correctly', () => {
      // Test basic cross product (returns scalar in 2D)
      expect(cross_r_v(f(1), f(0), f(0), f(1))).toBe(ONE);  // i × j = 1
      expect(cross_r_v(f(0), f(1), f(1), f(0))).toBe(neg(ONE)); // j × i = -1
      expect(cross_r_v(f(1), f(0), f(1), f(0))).toBe(ZERO); // Parallel vectors

      // Test with specific values
      expect(cross_r_v(f(2), f(3), f(4), f(5))).toBe(f(-2)); // 2*5 - 3*4 = -2
    });

    test('should calculate cross product w × r correctly', () => {
      // Test angular velocity cross radius
      const [x1, y1] = cross_w_r(f(1), f(2), f(3)); // w=1, r=(2,3)
      expect(x1).toBe(f(-3)); // -w * ry = -1 * 3 = -3
      expect(y1).toBe(f(2));  // w * rx = 1 * 2 = 2

      const [x2, y2] = cross_w_r(f(-2), f(1), f(0)); // w=-2, r=(1,0)
      expect(x2).toBe(ZERO);  // -(-2) * 0 = 0
      expect(y2).toBe(f(-2)); // -2 * 1 = -2
    });

    test('should have cross_r_n as alias for cross_r_v', () => {
      const rx = f(3);
      const ry = f(4);
      const nx = f(1);
      const ny = f(2);

      expect(cross_r_n(rx, ry, nx, ny)).toBe(cross_r_v(rx, ry, nx, ny));
    });

    test('should handle physics-relevant vector operations', () => {
      // Test relative velocity calculation scenario
      const r = { x: f(0.5), y: f(1.0) }; // Radius vector
      const w = f(2.0); // Angular velocity
      const [tangentVx, tangentVy] = cross_w_r(w, r.x, r.y);

      // Verify tangent velocity magnitude
      const tangentSpeed = sqrt(add(mul(tangentVx, tangentVx), mul(tangentVy, tangentVy)));
      const expectedSpeed = mul(w, sqrt(add(mul(r.x, r.x), mul(r.y, r.y))));

      expect(Math.abs(toFloat(tangentSpeed) - toFloat(expectedSpeed))).toBeLessThan(0.01);
    });
  });

  describe('Complex Expression Tests', () => {
    test('should calculate Pythagorean theorem correctly', () => {
      const a = f(3);
      const b = f(4);
      const result = sqrt(add(mul(a, a), mul(b, b)));
      expect(Math.abs(toFloat(result) - 5)).toBeLessThan(0.01);
    });

    test('should handle nested arithmetic operations', () => {
      const a = f(2);
      const b = f(3);
      const c = f(4);
      const d = f(10);
      const e = f(5);

      const result = div(mul(add(a, b), c), sub(d, e));
      const expected = ((2 + 3) * 4) / (10 - 5);

      expect(Math.abs(toFloat(result) - expected)).toBeLessThan(0.01);
    });

    test('should combine vector and scalar operations', () => {
      // Test physics scenario: impulse calculation
      const force = { x: f(10), y: f(5) };
      const position = { x: f(2), y: f(1) };

      // Linear impulse component
      const linearImpulse = sqrt(add(mul(force.x, force.x), mul(force.y, force.y)));

      // Angular impulse component
      const angularImpulse = cross_r_v(position.x, position.y, force.x, force.y);

      expect(toFloat(linearImpulse)).toBeCloseTo(Math.sqrt(10*10 + 5*5), 2);
      expect(toFloat(angularImpulse)).toBeCloseTo(2*5 - 1*10, 2);
    });
  });
});