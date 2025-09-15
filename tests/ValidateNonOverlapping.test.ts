/**
 * Test validateNonOverlappingChunks archetype-based validation (legacy behavior)
 * 测试validateNonOverlappingChunks基于原型的验证（传统行为）
 */

import { validateNonOverlappingChunks } from '../src/parallel/ConcurrencySafety';
import type { ChunkView } from '../src/core/ChunkedQuery';

describe('validateNonOverlappingChunks', () => {
  test('应该允许不同原型的相同行范围', () => {
    const chunks: ChunkView[] = [
      {
        entities: [1, 2, 3],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Velocity',
        startRow: 0,
        endRow: 3
      },
      {
        entities: [4, 5, 6],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Health',
        startRow: 0, // Same row range as previous, but different archetype
        endRow: 3
      }
    ];

    // Different archetypes can have overlapping row ranges without conflict
    // 不同原型可以有重叠的行范围而不冲突
    expect(validateNonOverlappingChunks(chunks)).toBe(true);
  });

  test('应该检测同一原型内的重叠', () => {
    const chunks: ChunkView[] = [
      {
        entities: [1, 2, 3],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Velocity',
        startRow: 0,
        endRow: 5
      },
      {
        entities: [4, 5, 6],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Velocity', // Same archetype
        startRow: 3, // Overlaps with previous: [0,5) and [3,6)
        endRow: 6
      }
    ];

    expect(validateNonOverlappingChunks(chunks)).toBe(false);
  });

  test('应该允许同一原型内的非重叠块', () => {
    const chunks: ChunkView[] = [
      {
        entities: [1, 2, 3],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Velocity',
        startRow: 0,
        endRow: 3
      },
      {
        entities: [4, 5, 6],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'Position+Velocity', // Same archetype
        startRow: 3, // Non-overlapping: [0,3) and [3,6)
        endRow: 6
      }
    ];

    expect(validateNonOverlappingChunks(chunks)).toBe(true);
  });

  test('应该处理边界情况：相邻块', () => {
    const chunks: ChunkView[] = [
      {
        entities: [1, 2],
        cols: [],
        rawCols: [],
        length: 2,
        archetypeKey: 'TestArch',
        startRow: 0,
        endRow: 2
      },
      {
        entities: [3, 4],
        cols: [],
        rawCols: [],
        length: 2,
        archetypeKey: 'TestArch',
        startRow: 2, // Exactly at boundary: [0,2) and [2,4)
        endRow: 4
      }
    ];

    // Adjacent chunks should be valid (endRow of first = startRow of second)
    // 相邻块应该有效（第一个的endRow = 第二个的startRow）
    expect(validateNonOverlappingChunks(chunks)).toBe(true);
  });

  test('应该处理复杂的多原型场景', () => {
    const chunks: ChunkView[] = [
      // Archetype A
      { entities: [1], cols: [], rawCols: [], length: 1, archetypeKey: 'A', startRow: 0, endRow: 10 },
      { entities: [2], cols: [], rawCols: [], length: 1, archetypeKey: 'A', startRow: 10, endRow: 20 },
      
      // Archetype B (can overlap with A's rows)
      { entities: [3], cols: [], rawCols: [], length: 1, archetypeKey: 'B', startRow: 5, endRow: 15 },
      { entities: [4], cols: [], rawCols: [], length: 1, archetypeKey: 'B', startRow: 15, endRow: 25 },
      
      // Archetype C (can overlap with both A and B's rows)
      { entities: [5], cols: [], rawCols: [], length: 1, archetypeKey: 'C', startRow: 0, endRow: 30 }
    ];

    expect(validateNonOverlappingChunks(chunks)).toBe(true);
  });

  test('应该检测无序输入的重叠', () => {
    const chunks: ChunkView[] = [
      {
        entities: [4, 5, 6],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'TestArch',
        startRow: 10, // This chunk comes first but has higher startRow
        endRow: 15
      },
      {
        entities: [1, 2, 3],
        cols: [],
        rawCols: [],
        length: 3,
        archetypeKey: 'TestArch',
        startRow: 5,
        endRow: 12 // Overlaps with first chunk: [10,15) and [5,12)
      }
    ];

    // Should detect overlap even when chunks are not in sorted order
    // 即使块不是按顺序排列，也应该检测到重叠
    expect(validateNonOverlappingChunks(chunks)).toBe(false);
  });

  test('应该处理空输入', () => {
    expect(validateNonOverlappingChunks([])).toBe(true);
  });

  test('应该处理单个块', () => {
    const chunks: ChunkView[] = [
      {
        entities: [1],
        cols: [],
        rawCols: [],
        length: 1,
        archetypeKey: 'Solo',
        startRow: 0,
        endRow: 1
      }
    ];

    expect(validateNonOverlappingChunks(chunks)).toBe(true);
  });
});