/**
 * Tests for WorkerPool class
 * WorkerPool类的测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerPool, type KernelPayload, type KernelResult } from '../../src/parallel/WorkerPool';

// Mock Worker for testing
class MockWorker {
  private messageHandlers: ((event: MessageEvent) => void)[] = [];
  private errorHandlers: ((event: ErrorEvent) => void)[] = [];
  private messageErrorHandlers: ((event: MessageEvent) => void)[] = [];

  constructor(public url: string, public options?: any) {}

  postMessage(data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (data.fence) return; // Ignore fence messages

      const response = {
        runId: data.runId,
        id: data.id,
        result: { written: [0] } as KernelResult
      };

      const event = new MessageEvent('message', { data: response });
      this.messageHandlers.forEach(handler => handler(event));
    }, 10);
  }

  set onmessage(handler: (event: MessageEvent) => void) {
    this.messageHandlers = [handler];
  }

  set onerror(handler: (event: ErrorEvent) => void) {
    this.errorHandlers = [handler];
  }

  set onmessageerror(handler: (event: MessageEvent) => void) {
    this.messageErrorHandlers = [handler];
  }

  terminate() {
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.messageErrorHandlers = [];
  }

  simulateError(error: Error) {
    const event = {
      type: 'error',
      error,
      message: error.message,
      filename: '',
      lineno: 0,
      colno: 0
    } as ErrorEvent;
    this.errorHandlers.forEach(handler => handler(event));
  }

  simulateMessageError() {
    const event = {
      type: 'messageerror',
      data: null,
      origin: '',
      lastEventId: '',
      source: null,
      ports: []
    } as MessageEvent;
    this.messageErrorHandlers.forEach(handler => handler(event));
  }
}

// Mock VisibilityGuard
vi.mock('../../src/parallel/ConcurrencySafety', () => ({
  VisibilityGuard: {
    initFence: vi.fn(() => new ArrayBuffer(4))
  }
}));

describe('WorkerPool', () => {
  let originalWorker: any;

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as any;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  describe('constructor', () => {
    it('should create workers with correct pool size', () => {
      const pool = new WorkerPool('test-worker.js', 3);
      expect((pool as any).workers).toHaveLength(3);
      expect((pool as any).idle).toHaveLength(3);
      pool.dispose();
    });

    it('should use default pool size when not specified', () => {
      // Mock navigator if not available
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 8 },
        writable: true,
        configurable: true
      });

      const pool = new WorkerPool('test-worker.js');
      expect((pool as any).workers).toHaveLength(7); // Math.min(8, hardwareConcurrency-1)
      pool.dispose();

      // Restore navigator
      (globalThis as any).navigator = originalNavigator;
    });
  });

  describe('run', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = new WorkerPool('test-worker.js', 2);
    });

    afterEach(() => {
      pool.dispose();
    });

    it('should execute single payload successfully', async () => {
      const payload: KernelPayload = {
        kernelId: 'test',
        cols: [new Float32Array([1, 2, 3])],
        length: 3
      };

      const results = await pool.run([payload]);
      expect(results).toHaveLength(1);
      expect(results[0].written).toEqual([0]);
    });

    it('should execute multiple payloads in parallel', async () => {
      const payloads: KernelPayload[] = [
        { kernelId: 'test1', cols: [], length: 1 },
        { kernelId: 'test2', cols: [], length: 2 },
        { kernelId: 'test3', cols: [], length: 3 }
      ];

      const results = await pool.run(payloads);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.written).toEqual([0]);
      });
    });

    it('should return empty array for empty payloads', async () => {
      const results = await pool.run([]);
      expect(results).toEqual([]);
    });

    it('should reject concurrent run calls', async () => {
      const payload: KernelPayload = {
        kernelId: 'test',
        cols: [],
        length: 1
      };

      // Start first run
      const firstRun = pool.run([payload]);

      // Try to start second run
      await expect(pool.run([payload])).rejects.toThrow('WorkerPool.run is already in progress');

      // Wait for first run to complete
      await firstRun;
    });

    it('should handle timeout option', async () => {
      // Mock a slow worker that never responds
      const slowWorker = new MockWorker('slow-worker.js');
      slowWorker.postMessage = () => {}; // Never respond

      (globalThis.Worker as any) = function() { return slowWorker; };

      const slowPool = new WorkerPool('slow-worker.js', 1);
      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      await expect(
        slowPool.run([payload], { timeout: 50 })
      ).rejects.toThrow('WorkerPool.run timeout after 50ms');

      slowPool.dispose();
    });

    it('should handle AbortSignal', async () => {
      const controller = new AbortController();
      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Abort immediately
      controller.abort();

      await expect(
        pool.run([payload], { signal: controller.signal })
      ).rejects.toThrow('Operation aborted');
    });

    it('should handle worker errors', async () => {
      // Create a pool with a worker that will error
      const errorWorker = new MockWorker('error-worker.js');
      errorWorker.postMessage = (data: any) => {
        if (data.fence) return;
        // Simulate error instead of success response
        setTimeout(() => {
          errorWorker.simulateError(new Error('Worker crashed'));
        }, 5);
      };

      (globalThis.Worker as any) = function() { return errorWorker; };
      const errorPool = new WorkerPool('error-worker.js', 1);

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      await expect(errorPool.run([payload])).rejects.toThrow('Worker crashed');
      errorPool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should handle worker message errors', async () => {
      // Create a pool with a worker that will have message error
      const messageErrorWorker = new MockWorker('message-error-worker.js');
      messageErrorWorker.postMessage = (data: any) => {
        if (data.fence) return;
        // Simulate message error instead of success response
        setTimeout(() => {
          messageErrorWorker.simulateMessageError();
        }, 5);
      };

      (globalThis.Worker as any) = function() { return messageErrorWorker; };
      const messageErrorPool = new WorkerPool('message-error-worker.js', 1);

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      await expect(messageErrorPool.run([payload])).rejects.toThrow('Worker message error');
      messageErrorPool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });
  });

  describe('dispose', () => {
    it('should terminate all workers', () => {
      const pool = new WorkerPool('test-worker.js', 2);
      const workers = (pool as any).workers;

      const terminateSpies = workers.map((w: any) => vi.spyOn(w, 'terminate'));

      pool.dispose();

      terminateSpies.forEach((spy: any) => {
        expect(spy).toHaveBeenCalled();
      });

      expect((pool as any).workers).toHaveLength(0);
      expect((pool as any).idle).toHaveLength(0);
    });

    it('should reject pending run operations', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Mock worker that never responds
      const worker = (pool as any).workers[0];
      worker.postMessage = () => {};

      const runPromise = pool.run([payload]);
      pool.dispose();

      await expect(runPromise).rejects.toThrow('WorkerPool disposed during run');
    });

    it('should handle multiple dispose calls gracefully', () => {
      const pool = new WorkerPool('test-worker.js', 1);

      expect(() => {
        pool.dispose();
        pool.dispose();
      }).not.toThrow();
    });

    it('should reject new run calls after disposal', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      pool.dispose();

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      await expect(pool.run([payload])).rejects.toThrow('WorkerPool has been disposed');
    });
  });

  describe('message routing isolation', () => {
    it('should ignore messages from previous runs', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Mock worker to control message timing
      let savedPostMessage: any;
      worker.postMessage = (data: any) => {
        savedPostMessage = data;
      };

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Start first run (will not complete due to mocked postMessage)
      const firstRun = pool.run([payload]);

      // Cancel first run by disposing
      pool.dispose();

      try {
        await firstRun;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }

      // Create new pool
      const newPool = new WorkerPool('test-worker.js', 1);

      // Start second run
      const secondPayload: KernelPayload = { kernelId: 'test2', cols: [], length: 1 };
      const secondRun = newPool.run([secondPayload]);

      // Simulate late message from first run (should be ignored)
      const lateMessage = new MessageEvent('message', {
        data: {
          runId: savedPostMessage?.runId,
          id: savedPostMessage?.id,
          result: { written: [0] }
        }
      });

      // Send late message - should be ignored
      worker.messageHandlers.forEach((handler: any) => handler(lateMessage));

      // Second run should complete normally
      const results = await secondRun;
      expect(results).toHaveLength(1);

      newPool.dispose();
    });
  });

  describe('task distribution', () => {
    it('should distribute tasks evenly across workers', async () => {
      const pool = new WorkerPool('test-worker.js', 2);
      const workers = (pool as any).workers;

      // Track which worker gets which task
      const workerTasks: Array<{ worker: number; taskId: string }> = [];

      workers.forEach((worker: any, index: number) => {
        const originalPostMessage = worker.postMessage.bind(worker);
        worker.postMessage = (data: any) => {
          if (!data.fence && data.payload) {
            workerTasks.push({ worker: index, taskId: data.payload.kernelId });
          }
          originalPostMessage(data);
        };
      });

      const payloads: KernelPayload[] = [
        { kernelId: 'task1', cols: [], length: 1 },
        { kernelId: 'task2', cols: [], length: 1 },
        { kernelId: 'task3', cols: [], length: 1 },
        { kernelId: 'task4', cols: [], length: 1 }
      ];

      await pool.run(payloads);

      // Verify tasks were distributed to both workers
      const worker0Tasks = workerTasks.filter(t => t.worker === 0).length;
      const worker1Tasks = workerTasks.filter(t => t.worker === 1).length;

      expect(worker0Tasks).toBeGreaterThan(0);
      expect(worker1Tasks).toBeGreaterThan(0);
      expect(worker0Tasks + worker1Tasks).toBe(4);

      pool.dispose();
    });
  });

  describe('worker state management', () => {
    it('should return workers to idle after timeout', async () => {
      // Create pool with workers that never respond
      const slowWorker = new MockWorker('slow-worker.js');
      slowWorker.postMessage = () => {}; // Never respond

      (globalThis.Worker as any) = function() { return slowWorker; };
      const slowPool = new WorkerPool('slow-worker.js', 2);

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // All workers should be idle initially
      expect((slowPool as any).idle).toHaveLength(2);
      expect((slowPool as any).busy.size).toBe(0);

      // Create multiple tasks to engage all workers
      const payloads = [
        { kernelId: 'test1', cols: [], length: 1 },
        { kernelId: 'test2', cols: [], length: 1 }
      ];

      // Start run that will timeout
      const runPromise = slowPool.run(payloads, { timeout: 50 });

      // Wait for timeout
      await expect(runPromise).rejects.toThrow('timeout');

      // Workers should be returned to idle pool after timeout
      // Only workers that were actually used should be checked
      expect((slowPool as any).busy.size).toBe(0);
      expect((slowPool as any).idle.length).toBeGreaterThan(0);

      slowPool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should handle late messages from previous runs', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Mock worker to control message timing
      let savedMessages: any[] = [];
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any) => {
        if (data.fence) return;
        savedMessages.push(data);
        // Don't respond immediately
      };

      const payload: KernelPayload = { kernelId: 'test1', cols: [], length: 1 };

      // Start first run (will timeout)
      const firstRun = pool.run([payload], { timeout: 50 });
      await expect(firstRun).rejects.toThrow('timeout');

      // Worker should be back in idle
      expect((pool as any).idle).toHaveLength(1);
      expect((pool as any).busy.size).toBe(0);

      // Start second run
      worker.postMessage = originalPostMessage;
      const secondPayload: KernelPayload = { kernelId: 'test2', cols: [], length: 1 };
      const secondRun = pool.run([secondPayload]);

      // Simulate late message from first run
      if (savedMessages.length > 0) {
        const lateMessage = new MessageEvent('message', {
          data: {
            runId: savedMessages[0].runId,
            id: savedMessages[0].id,
            result: { written: [0] }
          }
        });
        worker.messageHandlers.forEach((handler: any) => handler(lateMessage));
      }

      // Second run should complete normally
      const results = await secondRun;
      expect(results).toHaveLength(1);

      // Worker should still be in correct state
      expect((pool as any).idle).toHaveLength(1);
      expect((pool as any).busy.size).toBe(0);

      pool.dispose();
    });

    it('should maintain worker state consistency after errors', async () => {
      // Create a pool with worker that will error
      const errorWorker = new MockWorker('error-worker.js');
      errorWorker.postMessage = (data: any) => {
        if (data.fence) return;
        setTimeout(() => {
          errorWorker.simulateError(new Error('Worker crashed'));
        }, 5);
      };

      (globalThis.Worker as any) = function() { return errorWorker; };
      const errorPool = new WorkerPool('error-worker.js', 2);

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // All workers should be idle initially
      expect((errorPool as any).idle).toHaveLength(2);
      expect((errorPool as any).busy.size).toBe(0);

      const payloads = [
        { kernelId: 'test1', cols: [], length: 1 },
        { kernelId: 'test2', cols: [], length: 1 }
      ];

      await expect(errorPool.run(payloads)).rejects.toThrow('Worker crashed');

      // Workers should be returned to idle pool after error
      expect((errorPool as any).busy.size).toBe(0);
      expect((errorPool as any).idle.length).toBeGreaterThan(0);

      errorPool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should recreate workers on failure to avoid dirty state', async () => {
      let workerCreateCount = 0;

      // Create workers that will timeout initially
      const slowWorker = class extends MockWorker {
        constructor(url: string, options?: any) {
          super(url, options);
          workerCreateCount++;
        }

        postMessage(data: any) {
          if (data.fence) return;
          // Don't respond to simulate timeout
        }
      };

      // Create workers that will work normally after recreation
      const workingWorker = class extends MockWorker {
        constructor(url: string, options?: any) {
          super(url, options);
          workerCreateCount++;
        }
      };

      // Initially use slow workers
      (globalThis.Worker as any) = slowWorker;
      const pool = new WorkerPool('test-worker.js', 2);

      // Initial workers created
      expect(workerCreateCount).toBe(2);

      // Store original workers for comparison
      const originalWorkers = [...(pool as any).workers];

      // Switch to working workers for recreation
      (globalThis.Worker as any) = workingWorker;

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // This will timeout and trigger worker recreation
      await expect(pool.run([payload], { timeout: 50 })).rejects.toThrow('timeout');

      // Workers should have been recreated (additional 2 workers created)
      expect(workerCreateCount).toBe(4);

      // Pool should have different worker instances
      const newWorkers = (pool as any).workers;
      expect(newWorkers).toHaveLength(2);
      expect(newWorkers[0]).not.toBe(originalWorkers[0]);
      expect(newWorkers[1]).not.toBe(originalWorkers[1]);

      // Pool should still be functional
      expect((pool as any).idle.length).toBeGreaterThan(0);
      expect((pool as any).busy.size).toBe(0);

      pool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should handle successful runs without recreating workers', async () => {
      let workerCreateCount = 0;
      const trackingWorker = class extends MockWorker {
        constructor(url: string, options?: any) {
          super(url, options);
          workerCreateCount++;
        }
      };

      (globalThis.Worker as any) = trackingWorker;
      const pool = new WorkerPool('test-worker.js', 2);

      // Initial workers created
      expect(workerCreateCount).toBe(2);

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Successful run should not recreate workers
      const results = await pool.run([payload]);
      expect(results).toHaveLength(1);

      // No additional workers should be created
      expect(workerCreateCount).toBe(2);

      pool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should maintain job ID counter across successful runs', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Track job IDs sent to worker
      const jobIds: number[] = [];
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any) => {
        if (data.fence) return originalPostMessage(data);
        if (data.id) jobIds.push(data.id);
        return originalPostMessage(data);
      };

      // First run
      const payload1: KernelPayload = { kernelId: 'test1', cols: [], length: 1 };
      await pool.run([payload1]);

      // Second run should continue job ID sequence
      const payload2: KernelPayload = { kernelId: 'test2', cols: [], length: 1 };
      await pool.run([payload2]);

      // Job IDs should be sequential
      expect(jobIds).toEqual([1, 2]);

      // Initial _nextJobId should be 0, after first run should be 1, after second should be 2
      expect((pool as any)._nextJobId).toBe(2);

      pool.dispose();
    });
  });

  describe('transfer list support', () => {
    it('should pass transfer list to postMessage for zero-copy transfer', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Track postMessage calls
      let capturedTransfer: Transferable[] | undefined;
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any, transfer?: Transferable[]) => {
        if (data.fence) return originalPostMessage(data, transfer);
        capturedTransfer = transfer;
        return originalPostMessage(data, transfer);
      };

      // Create ArrayBuffer for transfer
      const buffer = new ArrayBuffer(1024);
      const payload: KernelPayload = {
        kernelId: 'test',
        cols: [buffer],
        length: 1,
        transfer: [buffer]
      };

      await pool.run([payload]);

      // Verify transfer list was passed
      expect(capturedTransfer).toEqual([buffer]);

      pool.dispose();
    });

    it('should handle payloads without transfer list', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Track postMessage calls
      let capturedTransfer: Transferable[] | undefined;
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any, transfer?: Transferable[]) => {
        if (data.fence) return originalPostMessage(data, transfer);
        capturedTransfer = transfer;
        return originalPostMessage(data, transfer);
      };

      const payload: KernelPayload = {
        kernelId: 'test',
        cols: [],
        length: 1
        // no transfer list
      };

      await pool.run([payload]);

      // Verify empty transfer list was passed
      expect(capturedTransfer).toEqual([]);

      pool.dispose();
    });

    it('should handle multiple transferable objects', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Track postMessage calls
      let capturedTransfer: Transferable[] | undefined;
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any, transfer?: Transferable[]) => {
        if (data.fence) return originalPostMessage(data, transfer);
        capturedTransfer = transfer;
        return originalPostMessage(data, transfer);
      };

      // Create multiple ArrayBuffers for transfer
      const buffer1 = new ArrayBuffer(512);
      const buffer2 = new ArrayBuffer(256);
      const payload: KernelPayload = {
        kernelId: 'test',
        cols: [buffer1, buffer2],
        length: 1,
        transfer: [buffer1, buffer2]
      };

      await pool.run([payload]);

      // Verify all transferable objects were passed
      expect(capturedTransfer).toEqual([buffer1, buffer2]);

      pool.dispose();
    });

    it('should work with mixed SAB and transferable payloads', async () => {
      const pool = new WorkerPool('test-worker.js', 2);
      const workers = (pool as any).workers;

      // Track postMessage calls for all workers
      const capturedTransfers: Transferable[][] = [];
      workers.forEach((worker: any) => {
        const originalPostMessage = worker.postMessage.bind(worker);
        worker.postMessage = (data: any, transfer?: Transferable[]) => {
          if (data.fence) return originalPostMessage(data, transfer);
          capturedTransfers.push(transfer ?? []);
          return originalPostMessage(data, transfer);
        };
      });

      // Create payloads with different transfer characteristics
      const buffer = new ArrayBuffer(1024);
      const payloads: KernelPayload[] = [
        {
          kernelId: 'transferable',
          cols: [buffer],
          length: 1,
          transfer: [buffer]
        },
        {
          kernelId: 'no-transfer',
          cols: [],
          length: 1
          // no transfer list - should use empty array
        }
      ];

      await pool.run(payloads);

      // Verify transfer lists were captured (order may vary due to worker distribution)
      expect(capturedTransfers).toHaveLength(2);

      // One should have the buffer, one should be empty
      const hasBuffer = capturedTransfers.some(transfer => transfer.length === 1 && transfer[0] === buffer);
      const hasEmpty = capturedTransfers.some(transfer => transfer.length === 0);

      expect(hasBuffer).toBe(true);
      expect(hasEmpty).toBe(true);

      pool.dispose();
    });
  });

  describe('visibility fence coordination', () => {
    it('should attempt to initialize fence buffer during construction', () => {
      // Track fence-related messages sent to workers
      let fenceMessagesSent = 0;
      const trackingWorker = class extends MockWorker {
        postMessage(data: any) {
          if (data && typeof data === 'object' && 'fence' in data) {
            fenceMessagesSent++;
          }
          super.postMessage(data);
        }
      };

      (globalThis.Worker as any) = trackingWorker;
      const pool = new WorkerPool('test-worker.js', 2);

      // In environments with SAB support, fence messages should be sent
      // In environments without SAB support, no fence messages
      // 在支持SAB的环境中，应该发送栅栏消息
      // 在不支持SAB的环境中，不发送栅栏消息
      if (typeof SharedArrayBuffer !== 'undefined') {
        expect(fenceMessagesSent).toBe(2);
      } else {
        expect(fenceMessagesSent).toBe(0);
      }

      pool.dispose();

      // Restore original MockWorker
      globalThis.Worker = MockWorker as any;
    });

    it('should work correctly in both SAB and non-SAB environments', async () => {
      const pool = new WorkerPool('test-worker.js', 1);

      // Pool should work normally regardless of SAB support
      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };
      const results = await pool.run([payload]);
      expect(results).toHaveLength(1);
      expect(results[0].written).toEqual([0]);

      pool.dispose();
    });
  });

  describe('message cleanup and isolation', () => {
    it('should handle duplicate messages gracefully', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Override postMessage to simulate duplicate responses
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any) => {
        if (data.fence) return originalPostMessage(data);

        // Send normal response
        originalPostMessage(data);

        // Send duplicate response immediately after
        setTimeout(() => {
          const response = {
            runId: data.runId,
            id: data.id,
            result: { written: [0] }
          };
          const event = new MessageEvent('message', { data: response });
          worker.messageHandlers.forEach((handler: any) => handler(event));
        }, 5);
      };

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Should complete normally despite duplicate messages
      const results = await pool.run([payload]);
      expect(results).toHaveLength(1);
      expect(results[0].written).toEqual([0]);

      // Worker should be in correct state
      expect((pool as any).busy.size).toBe(0);
      expect((pool as any).idle.length).toBe(1);

      pool.dispose();
    });

    it('should ignore messages after disposal', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Store original message handlers
      const messageHandlers = [...worker.messageHandlers];

      // Dispose the pool
      pool.dispose();

      // Simulate delayed message after disposal
      const delayedMessage = new MessageEvent('message', {
        data: {
          runId: 1,
          id: 1,
          result: { written: [0] }
        }
      });

      // This should not throw or cause issues
      expect(() => {
        messageHandlers.forEach((handler: any) => handler(delayedMessage));
      }).not.toThrow();
    });

    it('should handle messages with invalid runId after run completion', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Complete a run first
      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };
      await pool.run([payload]);

      // Simulate a late message from the completed run
      const lateMessage = new MessageEvent('message', {
        data: {
          runId: 1, // Old runId
          id: 999,
          result: { written: [0] }
        }
      });

      // This should not cause issues
      expect(() => {
        worker.messageHandlers.forEach((handler: any) => handler(lateMessage));
      }).not.toThrow();

      // Worker state should remain correct
      expect((pool as any).busy.size).toBe(0);
      expect((pool as any).idle.length).toBe(1);

      pool.dispose();
    });

    it('should handle errors after disposal gracefully', () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Store original error handlers
      const errorHandlers = [...worker.errorHandlers];

      // Dispose the pool
      pool.dispose();

      // Simulate error after disposal
      const error = {
        type: 'error',
        error: new Error('Test error'),
        message: 'Test error',
        filename: '',
        lineno: 0,
        colno: 0
      } as ErrorEvent;

      // This should not throw or cause issues
      expect(() => {
        errorHandlers.forEach((handler: any) => handler(error));
      }).not.toThrow();
    });

    it('should clean up worker state for messages from settled runs', async () => {
      const pool = new WorkerPool('test-worker.js', 1);
      const worker = (pool as any).workers[0];

      // Mock postMessage to delay response
      let delayedHandler: () => void;
      const originalPostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (data: any) => {
        if (data.fence) return originalPostMessage(data);

        delayedHandler = () => {
          const response = {
            runId: data.runId,
            id: data.id,
            result: { written: [0] }
          };
          const event = new MessageEvent('message', { data: response });
          worker.messageHandlers.forEach((handler: any) => handler(event));
        };
      };

      const payload: KernelPayload = { kernelId: 'test', cols: [], length: 1 };

      // Start run but timeout to settle it
      const runPromise = pool.run([payload], { timeout: 50 });
      await expect(runPromise).rejects.toThrow('timeout');

      // Now send the delayed response (should be ignored)
      delayedHandler!();

      // Worker should be in correct state
      expect((pool as any).busy.size).toBe(0);
      expect((pool as any).idle.length).toBe(1);

      pool.dispose();
    });
  });
});