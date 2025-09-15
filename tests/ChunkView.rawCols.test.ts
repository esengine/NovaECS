/**
 * Test ChunkView rawCols mechanism for SAB buildSliceDescriptor
 * 测试ChunkView rawCols机制用于SAB buildSliceDescriptor
 */

import { vi } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { ChunkedQuery } from '../src/core/ChunkedQuery';
import { isSABColumn } from '../src/parallel/TypeGuards';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

// Mock SAB Column for testing
class MockSABColumn {
  private _storage: any[] = [];
  
  buildSliceDescriptor(start: number, end: number): any {
    return { type: 'sab-descriptor', start, end, data: this._storage.slice(start, end) };
  }
  
  length() { return this._storage.length; }
  capacity() { return this._storage.length; }
  ensureCapacity() {}
  swapRemove() {}
  pushDefault() { return this._storage.push({}) - 1; }
  writeFromObject(row: number, obj: any) { this._storage[row] = obj; }
  readToObject(row: number) { return this._storage[row]; }
  
  // SAB column characteristics (needed for isSABColumn type guard)
  buffers = {};
  views = {};
  // Note: no 'data' property (ColumnArray has 'data', SAB columns don't)
}

describe('ChunkView rawCols mechanism', () => {
  let world: World;
  
  beforeEach(() => {
    world = new World();
    registerComponent(Position);
  });
  
  test('应该在rawCols中保留原始IColumn实例', () => {
    // Create entities
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    world.add(entity1, Position, { x: 10, y: 20 });
    world.add(entity2, Position, { x: 30, y: 40 });
    
    const query = new ChunkedQuery(world, [Position]);
    const chunks: any[] = [];
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    }, 10);
    
    expect(chunks).toHaveLength(1);
    const chunk = chunks[0];
    
    // Should have both cols (processed) and rawCols (original)
    expect(chunk.cols).toBeDefined();
    expect(chunk.rawCols).toBeDefined();
    expect(chunk.cols.length).toBe(1);
    expect(chunk.rawCols.length).toBe(1);
    
    // rawCols should contain the original IColumn instance
    const originalColumn = chunk.rawCols[0];
    expect(originalColumn).toBeDefined();
    expect(typeof originalColumn).toBe('object');
  });
  
  test('应该在SAB模式下正确检测原始列类型', () => {
    // Mock a SAB column in archetype
    const mockSABColumn = new MockSABColumn();
    
    // Verify our mock SAB column is detected correctly
    expect(isSABColumn(mockSABColumn)).toBe(true);
    
    // Verify that sliced array is not detected as SAB column
    const slicedArray = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(isSABColumn(slicedArray)).toBe(false);
  });
  
  test('应该在混合列类型场景下正确处理', () => {
    // This test demonstrates the importance of rawCols
    // 此测试展示rawCols的重要性
    
    const entity = world.createEntity();
    world.add(entity, Position, { x: 5, y: 10 });
    
    const query = new ChunkedQuery(world, [Position]);
    const chunks: any[] = [];
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
      
      // Simulate buildKernelPayloadsSAB logic
      const sourceColumns = chunk.rawCols || chunk.cols;
      
      for (let i = 0; i < sourceColumns.length; i++) {
        const rawCol = sourceColumns[i];
        const slicedCol = chunk.cols[i];
        
        if (isSABColumn(rawCol)) {
          // For SAB columns, we'd use buildSliceDescriptor on rawCol
          console.log('Would use SAB descriptor for column', i);
        } else {
          // For Array columns, we'd use the pre-sliced data from cols
          console.log('Would use sliced array data for column', i, slicedCol);
          expect(Array.isArray(slicedCol)).toBe(true);
        }
      }
    }, 5);
    
    expect(chunks).toHaveLength(1);
  });
});