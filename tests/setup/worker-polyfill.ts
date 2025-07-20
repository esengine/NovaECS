/**
 * Worker polyfill for Jest testing environment
 * Jest 测试环境的 Worker polyfill
 */

// Mock Worker for testing
class MockWorker {
  onmessage: ((ev: any) => any) | null = null;
  onmessageerror: ((ev: any) => any) | null = null;
  onerror: ((ev: any) => any) | null = null;

  constructor(private scriptURL: string | URL, _options?: any) {
    console.log(`🔧 MockWorker created with script: ${this.scriptURL.toString().substring(0, 50)}...`);
  }

  postMessage(message: any, _transfer?: any): void {
    console.log(`📤 MockWorker received message:`, {
      id: message.id,
      systemName: message.systemName,
      entityCount: message.entities?.length || 0,
      deltaTime: message.deltaTime
    });

    // Simulate async worker execution
    setTimeout(() => {
      try {
        // Simulate the worker script execution
        const result = this.simulateWorkerExecution(message);
        
        if (this.onmessage) {
          this.onmessage({
            data: result
          });
        }
      } catch (error) {
        if (this.onerror) {
          this.onerror({
            message: error instanceof Error ? error.message : 'Unknown error',
            error: error
          } as any);
        }
      }
    }, 5); // Simulate small async delay
  }

  private simulateWorkerExecution(message: any): any {
    const startTime = performance.now();
    const { id, systemName, entities, deltaTime } = message;

    // Simulate the actual worker script logic
    const componentUpdates: Array<{
      entityId: number;
      componentType: string;
      data: Record<string, unknown>;
    }> = [];

    // Process entities like the real worker would
    entities.forEach((entity: any) => {
      if (entity.components) {
        entity.components.forEach((component: any) => {
          const updatedData = this.processComponent(component, deltaTime, systemName);

          if (updatedData) {
            componentUpdates.push({
              entityId: entity.id,
              componentType: component.type,
              data: updatedData
            });
          }
        });
      }
    });

    const executionTime = performance.now() - startTime;

    console.log(`📊 MockWorker processed ${entities.length} entities in ${executionTime.toFixed(2)}ms`);
    console.log(`📊 Generated ${componentUpdates.length} component updates`);

    return {
      id,
      success: true,
      executionTime,
      componentUpdates
    };
  }

  private processComponent(component: any, deltaTime: number, systemName: string): Record<string, unknown> | null {
    const data = { ...component.data };
    let modified = false;

    // Simulate different system behaviors (same as real worker)
    if (component.type === 'Position') {
      // For any system that has Position components, apply some transformation
      if (data.x !== undefined && data.y !== undefined) {
        if (systemName.toLowerCase().includes('physics') ||
            systemName.toLowerCase().includes('compute') ||
            systemName.toLowerCase().includes('intensive')) {
          // Complex transformation for intensive systems
          const angle = Math.atan2(data.y, data.x);
          const magnitude = Math.sqrt(data.x * data.x + data.y * data.y);
          data.x = magnitude * Math.cos(angle + deltaTime * 0.001);
          data.y = magnitude * Math.sin(angle + deltaTime * 0.001);
          modified = true;
        } else {
          // Simple transformation for other systems (like SimpleTestSystem)
          data.x += deltaTime * 0.1;
          data.y += deltaTime * 0.1;
          modified = true;
        }
      }
    }

    if (component.type === 'Velocity') {
      if (systemName.toLowerCase().includes('physics')) {
        // Simulate velocity updates
        if (data.dx !== undefined && data.dy !== undefined) {
          data.dx += Math.sin(deltaTime * 0.01) * 0.1;
          data.dy += Math.cos(deltaTime * 0.01) * 0.1;
          modified = true;
        }
      }
    }

    // Simulate computational work
    if (systemName.toLowerCase().includes('intensive') ||
        systemName.toLowerCase().includes('compute')) {
      // Heavy computation simulation
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i * deltaTime);
      }
    } else {
      // Light computation simulation
      for (let i = 0; i < 100; i++) {
        Math.sqrt(i * deltaTime);
      }
    }

    return modified ? data : null;
  }

  terminate(): void {
    console.log('🔧 MockWorker terminated');
  }

  addEventListener(_type: string, _listener: any, _options?: any): void {
    // Mock implementation
  }

  removeEventListener(_type: string, _listener: any, _options?: any): void {
    // Mock implementation
  }

  dispatchEvent(_event: any): boolean {
    return true;
  }
}

// Set up the mock Worker in the global scope
if (typeof global !== 'undefined') {
  (global as any).Worker = MockWorker;
}

if (typeof window !== 'undefined') {
  (window as any).Worker = MockWorker;
}

// Mock URL.createObjectURL for jsdom environment
if (typeof global !== 'undefined' && !global.URL) {
  (global as any).URL = {
    createObjectURL: (_blob: any) => {
      return `blob:mock-url-${Date.now()}-${Math.random()}`;
    },
    revokeObjectURL: (_url: string) => {
      // Mock implementation
    }
  };
}

if (typeof window !== 'undefined' && !window.URL) {
  (window as any).URL = {
    createObjectURL: (_blob: any) => {
      return `blob:mock-url-${Date.now()}-${Math.random()}`;
    },
    revokeObjectURL: (_url: string) => {
      // Mock implementation
    }
  };
}

// Mock Blob for jsdom environment
if (typeof global !== 'undefined' && !global.Blob) {
  (global as any).Blob = class MockBlob {
    constructor(public parts: any[], public options?: any) {}
  };
}

if (typeof window !== 'undefined' && !window.Blob) {
  (window as any).Blob = class MockBlob {
    constructor(public parts: any[], public options?: any) {}
  };
}

console.log('🔧 Worker polyfill loaded for testing');

export { MockWorker };
