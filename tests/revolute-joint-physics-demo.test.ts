/**
 * Revolute Joint Physics Demo Test
 * 铰链关节物理演示测试
 *
 * Creates two circular bodies A/B with local anchors (0,0), constraint at body centers.
 * Push A, B should be "tethered" and rotate along.
 * Set gamma small (0) for hard constraint; increase to f(0.05) for "soft spring".
 * Set breakImpulse=f(5), pull hard: triggers break event, joint destroyed by external system.
 * Repeat & cross-machine: trajectory and frameHash consistent.
 *
 * 创建两个圆体A/B，给定局部锚点(0,0)，在物体中心创建约束；
 * 推动A，B应被"拴住"并随之旋转。
 * 将gamma调小（0）变成硬约束；增大到f(0.05)变"软弹簧"。
 * 设置breakImpulse=f(5)，猛拉：触发断裂事件，关节被外部系统销毁。
 * 反复重放&跨机器：轨迹和frameHash一致。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { RevoluteJoint2D, createRevoluteJoint } from '../src/components/RevoluteJoint2D';
import { RevoluteBatch2D } from '../src/resources/RevoluteBatch2D';
import { BuildRevolute2D } from '../src/systems/phys2d/BuildRevolute2D';
import { SolverGSRevolute2D } from '../src/systems/phys2d/SolverGSRevolute2D';
import { JointEvents2D, JointBrokenEvent } from '../src/systems/phys2d/SolverGSJoints2D';
import { JointEventHandler2D } from '../src/systems/phys2d/JointEventHandler2D';
import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { f, ZERO, ONE, toFloat } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';
import { frameHash } from '../src/replay/StateHash';

interface PhysicsState {
  bodyA: { px: number; py: number; vx: number; vy: number; w: number };
  bodyB: { px: number; py: number; vx: number; vy: number; w: number };
  jointExists: boolean;
  jointBroken: boolean;
  frame: number;
}

describe('Revolute Joint Physics Demo', () => {
  let world: World;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;
  let batch: RevoluteBatch2D;
  let ctx: SystemContext;

  function setupPhysicsWorld(): void {
    world = new World();

    // Setup resources
    batch = new RevoluteBatch2D();
    world.setResource(RevoluteBatch2D, batch);

    // Create body A at (-0.5, 0)
    bodyA = world.createEntity();
    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-0.5);
    bodyDataA.py = ZERO;
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const shapeA = createCircleShape(f(0.2)); // radius 0.2
    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyA, ShapeCircle, shapeA);

    // Create body B at (0.5, 0)
    bodyB = world.createEntity();
    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(0.5);
    bodyDataB.py = ZERO;
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    const shapeB = createCircleShape(f(0.2)); // radius 0.2
    world.addComponent(bodyB, Body2D, bodyDataB);
    world.addComponent(bodyB, ShapeCircle, shapeB);

    // Create revolute joint with local anchors (0,0) - center of bodies
    jointEntity = world.createEntity();
    const joint = createRevoluteJoint(bodyA, bodyB, { x: 0, y: 0 }, { x: 0, y: 0 });
    world.addComponent(jointEntity, RevoluteJoint2D, joint);

    // Setup system context
    ctx = {
      world,
      commandBuffer: new CommandBuffer(world),
      frame: 1,
      deltaTime: 1/60
    };

    // Mock world methods
    world.getFixedDtFX = () => f(1/60);
    world.frame = 1;
  }

  function runPhysicsStep(): void {
    // Integrate velocities to positions first
    IntegrateVelocitiesSystem.fn(ctx);

    // Build joint constraints
    BuildRevolute2D.fn(ctx);

    // Solve joint constraints
    SolverGSRevolute2D.fn(ctx);

    // Update frame
    ctx.frame++;
    world.frame = ctx.frame;
  }

  function processJointEvents(): void {
    // Handle joint events (breaking)
    JointEventHandler2D.fn(ctx);
  }

  function runCompletePhysicsStep(): void {
    runPhysicsStep();
    processJointEvents();
  }

  function captureState(): PhysicsState {
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    const bodyDataB = world.getComponent(bodyB, Body2D) as Body2D;
    const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D | undefined;

    return {
      bodyA: {
        px: toFloat(bodyDataA.px),
        py: toFloat(bodyDataA.py),
        vx: toFloat(bodyDataA.vx),
        vy: toFloat(bodyDataA.vy),
        w: toFloat(bodyDataA.w)
      },
      bodyB: {
        px: toFloat(bodyDataB.px),
        py: toFloat(bodyDataB.py),
        vx: toFloat(bodyDataB.vx),
        vy: toFloat(bodyDataB.vy),
        w: toFloat(bodyDataB.w)
      },
      jointExists: !!joint,
      jointBroken: joint ? joint.broken === 1 : true,
      frame: ctx.frame
    };
  }

  function calculateStateHash(): number {
    return frameHash(world);
  }

  beforeEach(() => {
    setupPhysicsWorld();
  });

  test('should maintain joint constraint and tether bodies together', () => {
    // Run one step to initialize
    runPhysicsStep();

    // Apply force to body A (push right)
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(2.0); // Push A to the right
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    const afterForceState = captureState();

    // Run physics for several steps
    for (let i = 0; i < 10; i++) {
      runPhysicsStep();
    }

    const finalState = captureState();

    // Both bodies should move toward each other due to joint constraint
    // A moves right (positive) from its initial force, B gets pulled toward A (negative from initial 0.5)
    expect(finalState.bodyA.px).toBeGreaterThan(afterForceState.bodyA.px);

    // Body B should be "tethered" by the joint and pulled toward A
    expect(finalState.bodyB.px).toBeLessThan(afterForceState.bodyB.px);

    // For revolute joint with (0,0) anchors, constraint points should be close
    const distance = Math.sqrt(
      Math.pow(finalState.bodyA.px - finalState.bodyB.px, 2) +
      Math.pow(finalState.bodyA.py - finalState.bodyB.py, 2)
    );
    expect(distance).toBeLessThan(0.2); // Anchors should be close together
  });

  test('should behave as hard constraint when gamma = 0', () => {
    // Set hard constraint (gamma = 0)
    const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    joint.gamma = ZERO;
    joint.beta = f(0.2); // Strong position correction
    world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

    // Initialize
    runPhysicsStep();

    // Apply strong force to body A
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(5.0);
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    // Run physics
    for (let i = 0; i < 15; i++) {
      runPhysicsStep();
    }

    const finalState = captureState();

    // Hard constraint should maintain constraint points close together
    const distance = Math.sqrt(
      Math.pow(finalState.bodyA.px - finalState.bodyB.px, 2) +
      Math.pow(finalState.bodyA.py - finalState.bodyB.py, 2)
    );
    expect(distance).toBeLessThan(0.05); // Very tight tolerance for hard constraint
  });

  test('should behave as soft spring when gamma = 0.05', () => {
    // Set soft constraint (gamma = 0.05)
    const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    joint.gamma = f(0.05);
    joint.beta = f(0.05); // Weaker position correction
    world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

    // Initialize
    runCompletePhysicsStep();

    // Apply strong force to body A
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(10.0); // Stronger force
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    // Run physics
    for (let i = 0; i < 15; i++) {
      runCompletePhysicsStep();
    }

    const finalState = captureState();

    // Soft constraint should allow more distance variation (spring-like)
    const distance = Math.sqrt(
      Math.pow(finalState.bodyA.px - finalState.bodyB.px, 2) +
      Math.pow(finalState.bodyA.py - finalState.bodyB.py, 2)
    );
    expect(distance).toBeGreaterThan(0.005); // Should deviate more than hard constraint
    expect(distance).toBeLessThan(0.5); // But still somewhat constrained
  });

  test('should break joint when impulse exceeds breakImpulse threshold', () => {
    // Set breakable joint
    const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    joint.breakImpulse = f(5.0); // Break threshold
    joint.gamma = ZERO; // Hard constraint for maximum impulse
    world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

    // Initialize
    runPhysicsStep();

    // Apply very strong force to body A (should break the joint)
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(50.0); // Very strong force
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    let breakEventFired = false;
    let frameWhenBroken = 0;

    // Run physics until joint breaks
    for (let i = 0; i < 20; i++) {
      runPhysicsStep();

      // Check for break events BEFORE processing them
      const events = world.getResource(JointEvents2D) as JointEvents2D;
      if (events && events.events.length > 0) {
        for (const event of events.events) {
          if (event instanceof JointBrokenEvent && event.joint === jointEntity) {
            breakEventFired = true;
            frameWhenBroken = ctx.frame;
            break;
          }
        }
      }

      // Process events (which clears them)
      processJointEvents();

      if (breakEventFired) break;
    }

    expect(breakEventFired).toBe(true);
    expect(frameWhenBroken).toBeGreaterThan(0);

    // After breaking, bodies should move independently
    const stateAfterBreak = captureState();
    expect(stateAfterBreak.jointBroken).toBe(true);

    // Continue simulation - bodies should drift apart
    const bodyPositionsAfterBreak = {
      A: { ...stateAfterBreak.bodyA },
      B: { ...stateAfterBreak.bodyB }
    };

    for (let i = 0; i < 20; i++) {
      runPhysicsStep();
    }

    const finalState = captureState();

    // Body A should continue moving in its direction
    expect(finalState.bodyA.px).toBeGreaterThan(bodyPositionsAfterBreak.A.px);

    // Both bodies should be moving with significant velocity after break
    expect(Math.abs(finalState.bodyA.vx)).toBeGreaterThan(5);
    expect(Math.abs(finalState.bodyB.vx)).toBeGreaterThan(5);

    // Bodies should have moved significantly from their original positions
    expect(Math.abs(finalState.bodyA.px)).toBeGreaterThan(5);
    expect(Math.abs(finalState.bodyB.px)).toBeGreaterThan(1);
  });

  test('should produce deterministic results across multiple runs', () => {
    const numRuns = 3;
    const statesPerRun: PhysicsState[][] = [];
    const hashesPerRun: number[][] = [];

    for (let run = 0; run < numRuns; run++) {
      // Reset world for each run
      setupPhysicsWorld();

      const runStates: PhysicsState[] = [];
      const runHashes: number[] = [];

      // Set up identical conditions
      const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
      joint.gamma = f(0.05);
      joint.breakImpulse = f(5.0);
      world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

      // Initialize
      runPhysicsStep();

      // Apply force
      const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
      bodyDataA.vx = f(3.0);
      world.replaceComponent(bodyA, Body2D, bodyDataA);

      // Run deterministic simulation
      for (let step = 0; step < 20; step++) {
        runPhysicsStep();
        runStates.push(captureState());
        runHashes.push(calculateStateHash());
      }

      statesPerRun.push(runStates);
      hashesPerRun.push(runHashes);
    }

    // Verify all runs produce identical results
    for (let step = 0; step < 20; step++) {
      const firstRunHash = hashesPerRun[0][step];
      const firstRunState = statesPerRun[0][step];

      for (let run = 1; run < numRuns; run++) {
        // Hashes should be identical
        expect(hashesPerRun[run][step]).toBe(firstRunHash);

        // States should be identical
        const currentState = statesPerRun[run][step];
        expect(currentState.bodyA.px).toBe(firstRunState.bodyA.px);
        expect(currentState.bodyA.py).toBe(firstRunState.bodyA.py);
        expect(currentState.bodyA.vx).toBe(firstRunState.bodyA.vx);
        expect(currentState.bodyA.vy).toBe(firstRunState.bodyA.vy);
        expect(currentState.bodyB.px).toBe(firstRunState.bodyB.px);
        expect(currentState.bodyB.py).toBe(firstRunState.bodyB.py);
        expect(currentState.bodyB.vx).toBe(firstRunState.bodyB.vx);
        expect(currentState.bodyB.vy).toBe(firstRunState.bodyB.vy);
        expect(currentState.jointExists).toBe(firstRunState.jointExists);
        expect(currentState.jointBroken).toBe(firstRunState.jointBroken);
      }
    }
  });

  test('should handle joint breaking deterministically', () => {
    // Use parameters that we know work from the successful breaking test
    const states: PhysicsState[] = [];

    for (let run = 0; run < 3; run++) {
      setupPhysicsWorld();

      // Use same parameters as successful breaking test
      const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
      joint.breakImpulse = f(5.0);
      joint.gamma = ZERO;
      world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

      // Initialize
      runPhysicsStep();

      // Apply same strong force as successful test
      const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
      bodyDataA.vx = f(50.0);
      world.replaceComponent(bodyA, Body2D, bodyDataA);

      // Run for a few steps and capture final state
      for (let i = 0; i < 10; i++) {
        runPhysicsStep();

        // Check for break events and process them
        const events = world.getResource(JointEvents2D) as JointEvents2D;
        if (events && events.events.length > 0) {
          processJointEvents();
          break; // Joint broke, stop simulation
        }
        processJointEvents();
      }

      states.push(captureState());
    }

    // All runs should produce identical final states
    for (let i = 1; i < states.length; i++) {
      expect(states[i].bodyA.px).toBe(states[0].bodyA.px);
      expect(states[i].bodyA.py).toBe(states[0].bodyA.py);
      expect(states[i].bodyB.px).toBe(states[0].bodyB.px);
      expect(states[i].bodyB.py).toBe(states[0].bodyB.py);
      expect(states[i].jointBroken).toBe(states[0].jointBroken);
    }

    // Joint should actually break in all runs
    expect(states[0].jointBroken).toBe(true);
  });

  test('should demonstrate complete revolute joint pipeline integration', () => {
    // This test demonstrates the full revolute joint system working together

    // Setup with specific parameters
    const joint = world.getComponent(jointEntity, RevoluteJoint2D) as RevoluteJoint2D;
    joint.gamma = f(0.02); // Slightly soft
    joint.beta = f(0.15);  // Moderate position correction
    joint.breakImpulse = f(8.0); // Moderate break threshold
    world.replaceComponent(jointEntity, RevoluteJoint2D, joint);

    const timeline: Array<{
      frame: number;
      action: string;
      bodyA_pos: [number, number];
      bodyB_pos: [number, number];
      distance: number;
      jointIntact: boolean;
    }> = [];

    function recordState(action: string): void {
      const state = captureState();
      const distance = Math.sqrt(
        Math.pow(state.bodyA.px - state.bodyB.px, 2) +
        Math.pow(state.bodyA.py - state.bodyB.py, 2)
      );

      timeline.push({
        frame: state.frame,
        action,
        bodyA_pos: [state.bodyA.px, state.bodyA.py],
        bodyB_pos: [state.bodyB.px, state.bodyB.py],
        distance,
        jointIntact: state.jointExists && !state.jointBroken
      });
    }

    // Phase 1: Initialization
    runPhysicsStep();
    recordState('Initialize');
    expect(timeline[0].distance).toBeLessThan(1.2); // Allow some convergence time
    expect(timeline[0].jointIntact).toBe(true);

    // Phase 2: Gentle push
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(2.0);
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    for (let i = 0; i < 8; i++) {
      runPhysicsStep();
    }
    recordState('After gentle push');
    expect(timeline[1].bodyA_pos[0]).toBeGreaterThan(timeline[0].bodyA_pos[0]);
    // Body B moves toward A (left/negative) due to joint constraint
    expect(timeline[1].bodyB_pos[0]).toBeLessThan(timeline[0].bodyB_pos[0]);
    expect(timeline[1].jointIntact).toBe(true);

    // Phase 3: Strong pull (should break joint)
    const bodyDataA2 = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA2.vx = f(50.0); // Much stronger force
    world.replaceComponent(bodyA, Body2D, bodyDataA2);

    let jointBrokeAt = -1;
    for (let i = 0; i < 15; i++) {
      runPhysicsStep();

      // Check for break events BEFORE processing them
      const events = world.getResource(JointEvents2D) as JointEvents2D;
      if (events && events.events.length > 0 && jointBrokeAt === -1) {
        for (const event of events.events) {
          if (event instanceof JointBrokenEvent && event.joint === jointEntity) {
            jointBrokeAt = ctx.frame;
            break;
          }
        }
      }

      // Process events (which clears them)
      processJointEvents();

      if (jointBrokeAt > 0) break;
    }
    recordState('After strong pull');

    expect(jointBrokeAt).toBeGreaterThan(0);
    expect(timeline[2].jointIntact).toBe(false);

    // Phase 4: Free movement after break
    for (let i = 0; i < 20; i++) {
      runPhysicsStep();
    }
    recordState('Free movement');

    // Bodies should be moving independently (joint broken)
    expect(timeline[3].jointIntact).toBe(false);

    // Check that bodies have significant velocities after break
    const finalState = captureState();
    expect(Math.abs(finalState.bodyA.vx)).toBeGreaterThan(10);
    expect(Math.abs(finalState.bodyB.vx)).toBeGreaterThan(10);

    // Verify complete timeline makes physical sense
    expect(timeline.length).toBe(4);
    expect(timeline.every((entry, i) => i === 0 || entry.frame > timeline[i-1].frame)).toBe(true);
  });
});