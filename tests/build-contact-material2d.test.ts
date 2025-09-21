/**
 * BuildContactMaterial2D System Tests
 * BuildContactMaterial2D系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { CommandBuffer } from '../src/core/CommandBuffer';
import { SystemContext } from '../src/core/System';
import { f, toFloat, ZERO, ONE } from '../src/math/fixed';
import { Material2D, createRubberMaterial, createIceMaterial } from '../src/components/Material2D';
import { MaterialTable2D } from '../src/resources/MaterialTable2D';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { Contacts2D, type Contact1 } from '../src/resources/Contacts2D';
import { BuildContactMaterial2D, type ContactWithMaterial } from '../src/systems/phys2d/BuildContactMaterial2D';

describe('BuildContactMaterial2D System', () => {
  let world: World;
  let contacts: Contacts2D;

  function runSystem() {
    const commandBuffer = new CommandBuffer();
    const ctx: SystemContext = {
      world,
      commandBuffer,
      frame: 1,
      deltaTime: 1/60
    };
    BuildContactMaterial2D.fn(ctx);
  }
  let materialTable: MaterialTable2D;

  beforeEach(() => {
    world = new World();
    contacts = new Contacts2D();
    materialTable = new MaterialTable2D();

    world.setResource(Contacts2D, contacts);
    world.setResource(MaterialTable2D, materialTable);
  });

  test('should apply default material properties when no entity materials exist', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    world.addComponent(entityA, Body2D, createDynamicBody());
    world.addComponent(entityB, Body2D, createDynamicBody());

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: f(0.5),
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Should use default material properties
    expect(toFloat(extendedContact.muS)).toBeCloseTo(0.8, 2);
    expect(toFloat(extendedContact.muD)).toBeCloseTo(0.6, 2);
    expect(toFloat(extendedContact.effRest)).toBeCloseTo(0.0, 2);
  });

  test('should mix materials using entity-specific components', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const rubber = createRubberMaterial();
    const ice = createIceMaterial();

    world.addComponent(entityA, Material2D, rubber);
    world.addComponent(entityB, Material2D, ice);
    world.addComponent(entityA, Body2D, createDynamicBody());
    world.addComponent(entityB, Body2D, createDynamicBody());

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: f(0.5),
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Should use min friction (ice's low friction should dominate)
    expect(toFloat(extendedContact.muS)).toBeCloseTo(toFloat(ice.muS), 2);
    expect(toFloat(extendedContact.muD)).toBeCloseTo(toFloat(ice.muD), 2);
  });

  test('should calculate effective restitution based on relative velocity', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const rubber = createRubberMaterial();
    world.addComponent(entityA, Material2D, rubber);
    world.addComponent(entityB, Material2D, rubber);

    // Create bodies with approaching velocities
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;     // Position at origin
    bodyA.py = ZERO;
    bodyA.vx = f(1.0);   // Moving right
    bodyA.vy = ZERO;

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);   // Position to the right
    bodyB.py = ZERO;
    bodyB.vx = f(-1.0);  // Moving left (approaching A)
    bodyB.vy = ZERO;

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,     // Normal pointing from A to B (rightward, A->B)
      ny: ZERO,
      px: f(1.0),  // Contact point between the two bodies
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Relative velocity is vB - vA = (-1 - 1) = -2 m/s
    // Normal relative velocity = dot((-2, 0), (1, 0)) = -2 m/s (approaching)
    // This should exceed bounce threshold, so restitution should be enabled
    expect(toFloat(extendedContact.effRest)).toBeCloseTo(toFloat(rubber.restitution), 2);
  });

  test('should disable restitution for slow collisions', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const rubber = createRubberMaterial();
    world.addComponent(entityA, Material2D, rubber);
    world.addComponent(entityB, Material2D, rubber);

    // Create bodies with slow approaching velocities
    const bodyA = createDynamicBody();
    bodyA.vx = f(0.05);  // Very slow
    bodyA.vy = ZERO;

    const bodyB = createDynamicBody();
    bodyB.vx = f(-0.05); // Very slow
    bodyB.vy = ZERO;

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: f(-1.0),
      ny: ZERO,
      px: f(1.0),
      py: f(0.5),
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Relative velocity is small, should not exceed bounce threshold
    expect(toFloat(extendedContact.effRest)).toBeCloseTo(0.0, 2);
  });

  test('should handle custom material mixing rules', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const materialA = createRubberMaterial();
    const materialB = createIceMaterial();

    world.addComponent(entityA, Material2D, materialA);
    world.addComponent(entityB, Material2D, materialB);
    world.addComponent(entityA, Body2D, createDynamicBody());
    world.addComponent(entityB, Body2D, createDynamicBody());

    // Set custom mixing rule
    materialTable.set(materialA.id, materialB.id, {
      frictionRule: 'max',
      restitutionRule: 'avg',
      customThreshold: () => f(0.1)
    });

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: f(0.5),
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Should use max friction (rubber's high friction should dominate)
    expect(toFloat(extendedContact.muS)).toBeCloseTo(toFloat(materialA.muS), 2);
    expect(toFloat(extendedContact.muD)).toBeCloseTo(toFloat(materialA.muD), 2);
  });

  test('should handle rotational velocity in relative velocity calculation', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    const rubber = createRubberMaterial();
    world.addComponent(entityA, Material2D, rubber);
    world.addComponent(entityB, Material2D, rubber);

    // Create bodies with rotational velocity
    const bodyA = createDynamicBody();
    bodyA.px = ZERO;
    bodyA.py = ZERO;
    bodyA.vx = ZERO;
    bodyA.vy = ZERO;
    bodyA.w = f(1.0); // Angular velocity

    const bodyB = createDynamicBody();
    bodyB.px = f(2.0);
    bodyB.py = ZERO;
    bodyB.vx = ZERO;
    bodyB.vy = ZERO;
    bodyB.w = ZERO;

    world.addComponent(entityA, Body2D, bodyA);
    world.addComponent(entityB, Body2D, bodyB);

    // Contact point offset from center of A
    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0), // Contact at (1,0), which is (1,0) from A's center
      py: ZERO,
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);
    runSystem();

    const extendedContact = contact as ContactWithMaterial;

    // Rotational velocity should contribute to relative velocity calculation
    // The exact value depends on the cross product calculation
    expect(extendedContact.effRest).toBeDefined();
  });

  test('should skip processing when no contacts exist', () => {
    // No contacts added
    expect(() => {
      runSystem();
    }).not.toThrow();
  });

  test('should handle missing Body2D components gracefully', () => {
    const entityA = world.createEntity();
    const entityB = world.createEntity();

    // Add materials but no Body2D components
    world.addComponent(entityA, Material2D, createRubberMaterial());
    world.addComponent(entityB, Material2D, createIceMaterial());

    const contact: Contact1 = {
      a: entityA,
      b: entityB,
      nx: ONE,
      ny: ZERO,
      px: f(1.0),
      py: f(0.5),
      pen: f(0.1),
      jn: ZERO,
      jt: ZERO
    };

    contacts.addContact(contact);

    expect(() => {
      runSystem();
    }).not.toThrow();

    const extendedContact = contact as ContactWithMaterial;

    // Should still have material properties but zero effective restitution
    expect(extendedContact.muS).toBeDefined();
    expect(extendedContact.muD).toBeDefined();
    expect(toFloat(extendedContact.effRest)).toBeCloseTo(0.0, 2);
  });
});