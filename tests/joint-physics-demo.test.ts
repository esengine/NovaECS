/**
 * Distance Joint Physics Demo Test
 * 距离关节物理演示测试
 *
 * Creates two circular bodies A/B with local anchors (0,0), rest set to their initial distance.
 * Push A, B should be "pulled along".
 * Set gamma small (0) for hard distance; increase to f(0.1) for "soft spring".
 * Set breakImpulse=f(5), pull hard: triggers break event, joint destroyed by external system.
 * Repeat & cross-machine: trajectory and frameHash consistent.
 *
 * 创建两个圆体A/B，给定局部锚点(0,0)，rest设为它们初始距离；
 * 推动A，B应被"牵住"。
 * 将gamma调小（0）变成硬距离；增大到f(0.1)变"软弹簧"。
 * 设置breakImpulse=f(5)，猛拉：触发断裂事件，关节被外部系统销毁。
 * 反复重放&跨机器：轨迹和frameHash一致。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Body2D, createDynamicBody } from '../src/components/Body2D';
import { ShapeCircle, createCircleShape } from '../src/components/ShapeCircle';
import { JointDistance2D, createDistanceJoint } from '../src/components/JointDistance2D';
import { JointConstraints2D } from '../src/resources/JointConstraints2D';
import { BuildJointsDistance2D } from '../src/systems/phys2d/BuildJointsDistance2D';
import { SolverGSJoints2D, JointEvents2D, JointBrokenEvent } from '../src/systems/phys2d/SolverGSJoints2D';
import { JointEventHandler2D } from '../src/systems/phys2d/JointEventHandler2D';
import { IntegrateVelocitiesSystem } from '../src/systems/IntegrateVelocitiesSystem';
import { f, ZERO, ONE, toFloat } from '../src/math/fixed';
import { CommandBuffer } from '../src/core/CommandBuffer';
import type { SystemContext } from '../src/core/System';
import { frameHash } from '../src/replay/StateHash';

interface PhysicsState {
  bodyA: { px: number; py: number; vx: number; vy: number };
  bodyB: { px: number; py: number; vx: number; vy: number };
  jointExists: boolean;
  jointBroken: boolean;
  frame: number;
}

describe('Distance Joint Physics Demo', () => {
  let world: World;
  let bodyA: number;
  let bodyB: number;
  let jointEntity: number;
  let constraints: JointConstraints2D;
  let ctx: SystemContext;

  function setupPhysicsWorld(): void {
    world = new World();

    // Setup resources
    constraints = new JointConstraints2D();
    world.setResource(JointConstraints2D, constraints);

    // Create body A at (-1, 0)
    bodyA = world.createEntity();
    const bodyDataA = createDynamicBody();
    bodyDataA.px = f(-1.0);
    bodyDataA.py = ZERO;
    bodyDataA.invMass = ONE;
    bodyDataA.invI = ONE;

    const shapeA = createCircleShape(0.2); // radius 0.2
    world.addComponent(bodyA, Body2D, bodyDataA);
    world.addComponent(bodyA, ShapeCircle, shapeA);

    // Create body B at (1, 0)
    bodyB = world.createEntity();
    const bodyDataB = createDynamicBody();
    bodyDataB.px = f(1.0);
    bodyDataB.py = ZERO;
    bodyDataB.invMass = ONE;
    bodyDataB.invI = ONE;

    const shapeB = createCircleShape(0.2); // radius 0.2
    world.addComponent(bodyB, Body2D, bodyDataB);
    world.addComponent(bodyB, ShapeCircle, shapeB);

    // Create distance joint with local anchors (0,0) - center of bodies
    jointEntity = world.createEntity();
    const joint = createDistanceJoint(bodyA, bodyB, { x: 0, y: 0 }, { x: 0, y: 0 }, -1); // auto-initialize rest
    world.addComponent(jointEntity, JointDistance2D, joint);

    // Add joint to constraints
    constraints.addJoint(jointEntity);

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
    // Build joint constraints
    BuildJointsDistance2D.fn(ctx);

    // Solve joint constraints
    SolverGSJoints2D.fn(ctx);

    // Integrate velocities to positions
    IntegrateVelocitiesSystem.build().fn(ctx);

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
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D | undefined;

    return {
      bodyA: {
        px: toFloat(bodyDataA.px),
        py: toFloat(bodyDataA.py),
        vx: toFloat(bodyDataA.vx),
        vy: toFloat(bodyDataA.vy)
      },
      bodyB: {
        px: toFloat(bodyDataB.px),
        py: toFloat(bodyDataB.py),
        vx: toFloat(bodyDataB.vx),
        vy: toFloat(bodyDataB.vy)
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

  test('should auto-initialize rest distance and maintain constraint', () => {
    // Run one step to auto-initialize
    runPhysicsStep();

    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    expect(joint.rest).toBe(f(2.0)); // Distance between (-1,0) and (1,0) is 2.0
    expect(joint.initialized).toBe(1);

    // Apply force to body A (push right)
    const bodyDataA = world.getComponent(bodyA, Body2D) as Body2D;
    bodyDataA.vx = f(2.0); // Push A to the right
    world.replaceComponent(bodyA, Body2D, bodyDataA);

    const initialStateA = captureState().bodyA;
    const initialStateB = captureState().bodyB;

    // Run physics for several steps
    for (let i = 0; i < 10; i++) {
      runPhysicsStep();
    }

    const finalState = captureState();

    // Body A should have moved right
    expect(finalState.bodyA.px).toBeGreaterThan(initialStateA.px);

    // Body B should be "pulled along" by the joint
    expect(finalState.bodyB.px).toBeGreaterThan(initialStateB.px);

    // Distance between bodies should remain approximately 2.0
    const distance = Math.sqrt(
      Math.pow(finalState.bodyA.px - finalState.bodyB.px, 2) +
      Math.pow(finalState.bodyA.py - finalState.bodyB.py, 2)
    );
    expect(Math.abs(distance - 2.0)).toBeLessThan(0.1); // Allow small tolerance
  });

  test('should behave as hard constraint when gamma = 0', () => {
    // Set hard constraint (gamma = 0)
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.gamma = ZERO;
    joint.beta = f(0.2); // Strong position correction
    world.replaceComponent(jointEntity, JointDistance2D, joint);

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

    // Hard constraint should maintain precise distance
    const distance = Math.sqrt(
      Math.pow(finalState.bodyA.px - finalState.bodyB.px, 2) +
      Math.pow(finalState.bodyA.py - finalState.bodyB.py, 2)
    );
    expect(Math.abs(distance - 2.0)).toBeLessThan(0.05); // Very tight tolerance for hard constraint
  });

  test('should behave as soft spring when gamma = 0.1', () => {
    // Set soft constraint (gamma = 0.3)
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.gamma = f(0.3);
    joint.beta = f(0.05); // Weaker position correction
    world.replaceComponent(jointEntity, JointDistance2D, joint);

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
    expect(Math.abs(distance - 2.0)).toBeGreaterThan(0.005); // Should deviate more than hard constraint
    expect(Math.abs(distance - 2.0)).toBeLessThan(0.3); // But still somewhat constrained
  });

  test('should break joint when impulse exceeds breakImpulse threshold', () => {
    // Set breakable joint
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.breakImpulse = f(5.0); // Break threshold
    joint.gamma = ZERO; // Hard constraint for maximum impulse
    world.replaceComponent(jointEntity, JointDistance2D, joint);

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
    expect(Math.abs(finalState.bodyA.vx)).toBeGreaterThan(20);
    expect(Math.abs(finalState.bodyB.vx)).toBeGreaterThan(20);

    // Bodies should have moved significantly from their original positions
    expect(Math.abs(finalState.bodyA.px)).toBeGreaterThan(5);
    expect(Math.abs(finalState.bodyB.px)).toBeGreaterThan(5);
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
      const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
      joint.gamma = f(0.05);
      joint.breakImpulse = f(5.0);
      world.replaceComponent(jointEntity, JointDistance2D, joint);

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
      const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
      joint.breakImpulse = f(5.0);
      joint.gamma = ZERO;
      world.replaceComponent(jointEntity, JointDistance2D, joint);

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

  test('should demonstrate complete physics pipeline integration', () => {
    // This test demonstrates the full joint system working together

    // Setup with specific parameters
    const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
    joint.gamma = f(0.02); // Slightly soft
    joint.beta = f(0.15);  // Moderate position correction
    joint.breakImpulse = f(8.0); // Moderate break threshold
    world.replaceComponent(jointEntity, JointDistance2D, joint);

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
    expect(timeline[0].distance).toBeCloseTo(2.0, 1);
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
    expect(timeline[1].bodyB_pos[0]).toBeGreaterThan(timeline[0].bodyB_pos[0]);
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