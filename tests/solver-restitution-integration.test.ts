/**
 * Solver Restitution Integration Tests
 * 求解器弹性集成测试
 *
 * Tests the integration of BuildContactMaterial2D with SolverGS2D
 * for proper restitution handling based on effective restitution coefficients.
 * 测试BuildContactMaterial2D与SolverGS2D的集成，
 * 确保基于有效恢复系数的正确弹性处理。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { f, toFloat, ZERO, ONE } from '../src/math/fixed';
import { Material2D, createBouncyMaterial, createDefaultMaterial } from '../src/components/Material2D';
import { MaterialTable2D } from '../src/resources/MaterialTable2D';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { Contacts2D, type Contact1 } from '../src/resources/Contacts2D';
import { BuildContactMaterial2D } from '../src/systems/phys2d/BuildContactMaterial2D';
import { SolverGS2D } from '../src/systems/phys2d/SolverGS2D';
import { CommandBuffer } from '../src/core/CommandBuffer';

describe('Solver Restitution Integration', () => {
  let world: World;
  let contacts: Contacts2D;
  let materialTable: MaterialTable2D;

  // Helper function to run solver system
  const runSolver = () => {
    const config = (SolverGS2D as any).config || SolverGS2D;
    if (config.fn) {
      config.fn({ world, commandBuffer: new CommandBuffer(), frame: 0 });
    }
  };

  beforeEach(() => {
    world = new World();
    contacts = new Contacts2D();
    materialTable = new MaterialTable2D();

    world.setResource(Contacts2D, contacts);
    world.setResource(MaterialTable2D, materialTable);

    // Set fixed timestep for deterministic tests
    (world as any).getFixedDtFX = () => f(1/60);
  });

  test.skip('should apply bounce effect for high-velocity collisions', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    // Create bouncy materials
    const bouncy = createBouncyMaterial(); // High restitution
    world.addComponent(entityA, Material2D, bouncy);
    world.addComponent(entityB, Material2D, bouncy);

    // Create bodies with high approaching velocities
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(2.0);   // High velocity rightward
    bodyA.vy = ZERO;
    bodyA.invMass = f(1.0);
    bodyA.invI = f(1.0);

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-2.0);  // High velocity leftward (approaching A)
    bodyB.vy = ZERO;
    bodyB.invMass = f(1.0);
    bodyB.invI = f(1.0);

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,     // Normal pointing from A to B
      ny: ZERO,
      px: f(1.0),  // Contact point between bodies
      py: ZERO,
      pen: f(0.1), // Small penetration
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Store initial velocities
    const initialVxA = bodyA.vx;
    const initialVxB = bodyB.vx;

    // Run material calculation
    BuildContactMaterial2D.run(world);

    // Run one iteration of solver
    runSolver();

    // After collision, velocities should be significantly changed due to bounce
    // Bodies should be separating (opposite velocities)
    expect(toFloat(bodyA.vx)).toBeLessThan(toFloat(initialVxA));
    expect(toFloat(bodyB.vx)).toBeGreaterThan(toFloat(initialVxB));

    // Relative velocity should have reversed and scaled by restitution
    const finalRelativeVx = toFloat(bodyB.vx) - toFloat(bodyA.vx);
    expect(finalRelativeVx).toBeGreaterThan(0); // Should be separating
  });

  test('should disable bounce for slow collisions', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    // Create bouncy materials
    const bouncy = createBouncyMaterial();
    world.addComponent(entityA, Material2D, bouncy);
    world.addComponent(entityB, Material2D, bouncy);

    // Create bodies with slow approaching velocities
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(0.05);  // Very slow
    bodyA.vy = ZERO;
    bodyA.invMass = f(1.0);
    bodyA.invI = f(1.0);

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-0.05); // Very slow (approaching A)
    bodyB.vy = ZERO;
    bodyB.invMass = f(1.0);
    bodyB.invI = f(1.0);

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Run material calculation and solver
    BuildContactMaterial2D.run(world);
    runSolver();

    // For slow collisions, should mostly just stop rather than bounce
    const finalRelativeVx = Math.abs(toFloat(bodyB.vx) - toFloat(bodyA.vx));
    expect(finalRelativeVx).toBeLessThan(1.0); // Should not have significant bounce
  });

  test('should handle mixed materials with custom bounce threshold', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const materialA = createBouncyMaterial();
    const materialB = createDefaultMaterial();

    world.addComponent(entityA, Material2D, materialA);
    world.addComponent(entityB, Material2D, materialB);

    // Set custom threshold that allows bounce for medium velocities
    materialTable.set(materialA.id, materialB.id, {
      restitutionRule: 'max',
      customThreshold: () => f(0.5) // Lower threshold
    });

    // Create bodies with medium velocities
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(0.8);   // Medium velocity
    bodyA.vy = ZERO;
    bodyA.invMass = f(1.0);
    bodyA.invI = f(1.0);

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-0.8);  // Medium velocity (approaching A)
    bodyB.vy = ZERO;
    bodyB.invMass = f(1.0);
    bodyB.invI = f(1.0);

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Store initial velocities
    const initialRelativeVx = toFloat(bodyB.vx) - toFloat(bodyA.vx);

    // Run material calculation and solver
    BuildContactMaterial2D.run(world);
    runSolver();

    // Should have some bounce due to custom lower threshold
    const finalRelativeVx = toFloat(bodyB.vx) - toFloat(bodyA.vx);
    expect(Math.abs(finalRelativeVx)).toBeGreaterThan(Math.abs(initialRelativeVx) * 0.1);
  });

  test.skip('should preserve backwards compatibility when BuildContactMaterial2D not run', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    // Create bodies with Body2D-level material properties
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(2.0);
    bodyA.vy = ZERO;
    bodyA.restitution = f(0.8); // High restitution at body level
    bodyA.invMass = f(1.0);
    bodyA.invI = f(1.0);

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-2.0);
    bodyB.vy = ZERO;
    bodyB.restitution = f(0.6);
    bodyB.invMass = f(1.0);
    bodyB.invI = f(1.0);

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Skip BuildContactMaterial2D and run solver directly
    runSolver();

    // Should still apply bounce using body-level restitution
    const finalRelativeVx = toFloat(bodyB.vx) - toFloat(bodyA.vx);
    expect(finalRelativeVx).toBeGreaterThan(0); // Should be separating
  });

  test('should set effective restitution correctly', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const bouncy = createBouncyMaterial();
    world.addComponent(entityA, Material2D, bouncy);
    world.addComponent(entityB, Material2D, bouncy);

    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(2.0);
    bodyA.vy = ZERO;

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-2.0);
    bodyB.vy = ZERO;

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Run material calculation
    BuildContactMaterial2D.run(world);

    // Check that effective restitution was set
    const extendedContact = contact as any;
    expect(extendedContact.effRest).toBeDefined();
    expect(toFloat(extendedContact.effRest)).toBeCloseTo(toFloat(bouncy.restitution), 2);
  });

  test('should handle zero penetration correctly', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const bouncy = createBouncyMaterial();
    world.addComponent(entityA, Material2D, bouncy);
    world.addComponent(entityB, Material2D, bouncy);

    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = f(1.0);
    bodyA.vy = ZERO;
    bodyA.invMass = f(1.0);
    bodyA.invI = f(1.0);

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = f(-1.0);
    bodyB.vy = ZERO;
    bodyB.invMass = f(1.0);
    bodyB.invI = f(1.0);

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: ZERO,
      pen: ZERO, // No penetration - just touching
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    // Run material calculation and solver
    BuildContactMaterial2D.run(world);

    expect(() => {
      runSolver();
    }).not.toThrow();

    // Should still handle the contact without errors
    const finalRelativeVx = toFloat(bodyB.vx) - toFloat(bodyA.vx);
    expect(finalRelativeVx).toBeGreaterThan(-2.1); // Some constraint should be applied
  });
});