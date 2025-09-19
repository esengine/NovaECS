/**
 * SAT Algorithm Debug Test
 */

import { describe, test, expect } from 'vitest';
import { f, add, sub, mul, div, ONE, ZERO } from '../src/math/fixed';
import type { FX } from '../src/math/fixed';

// Simple SAT test with manual data
describe('SAT Debug', () => {
  test('manual SAT test with two overlapping boxes', () => {
    // Box 1: centered at (0,0), size 2x2 (vertices: -1,-1 to 1,1)
    const box1Verts = [f(-1), f(-1), f(1), f(-1), f(1), f(1), f(-1), f(1)];
    const box1Normals = [f(0), f(-1), f(1), f(0), f(0), f(1), f(-1), f(0)]; // outward normals

    // Box 2: centered at (1.5,0), size 2x2 (vertices: 0.5,-1 to 2.5,1)
    const box2Verts = [f(0.5), f(-1), f(2.5), f(-1), f(2.5), f(1), f(0.5), f(1)];
    const box2Normals = [f(0), f(-1), f(1), f(0), f(0), f(1), f(-1), f(0)];

    const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

    // Test SAT for Box1's normals
    for (let i = 0; i < 4; i++) {
      const nx = box1Normals[i * 2];
      const ny = box1Normals[i * 2 + 1];

      console.log(`\nTesting Box1 normal ${i}: (${nx}, ${ny})`);

      // Project Box1 vertices
      let box1Min = f(1000), box1Max = f(-1000);
      for (let j = 0; j < 4; j++) {
        const vx = box1Verts[j * 2];
        const vy = box1Verts[j * 2 + 1];
        const proj = dot(nx, ny, vx, vy);
        console.log(`  Box1 vertex ${j}: (${vx}, ${vy}) -> projection: ${proj}`);
        if (proj < box1Min) box1Min = proj;
        if (proj > box1Max) box1Max = proj;
      }

      // Project Box2 vertices
      let box2Min = f(1000), box2Max = f(-1000);
      for (let j = 0; j < 4; j++) {
        const vx = box2Verts[j * 2];
        const vy = box2Verts[j * 2 + 1];
        const proj = dot(nx, ny, vx, vy);
        console.log(`  Box2 vertex ${j}: (${vx}, ${vy}) -> projection: ${proj}`);
        if (proj < box2Min) box2Min = proj;
        if (proj > box2Max) box2Max = proj;
      }

      console.log(`  Box1 range: [${box1Min}, ${box1Max}]`);
      console.log(`  Box2 range: [${box2Min}, ${box2Max}]`);

      // Check for separation
      const separated = box1Max < box2Min || box2Max < box1Min;
      console.log(`  Separated: ${separated}`);

      if (!separated) {
        // Calculate overlap
        const overlap1 = sub(box1Max, box2Min);
        const overlap2 = sub(box2Max, box1Min);
        const overlap = overlap1 < overlap2 ? overlap1 : overlap2;
        console.log(`  Overlap: ${overlap}`);
      }
    }

    // These boxes should overlap significantly (0.5 units)
    // Expected: no separation on any axis
  });
});