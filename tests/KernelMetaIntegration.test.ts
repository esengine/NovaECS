/**
 * Test kernel metadata integration with chunk validation and parallel processing
 * 测试内核元数据与块验证和并行处理的集成
 */

import { vi } from 'vitest';
import { validateNonOverlappingChunks } from '../src/parallel/ConcurrencySafety';
import type { ChunkView } from '../src/core/ChunkedQuery';

describe('KernelMeta Integration', () => {
  describe('validateNonOverlappingChunks with write columns', () => {
    test('应该在无写入列参数时使用原有验证逻辑', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [],
          length: 3,
          archetypeKey: 'Position+Velocity',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [4, 5, 6],
          cols: [],
          length: 3,
          archetypeKey: 'Position+Velocity',
          startRow: 2, // Overlapping
          endRow: 5
        }
      ];

      // Without write columns parameter - should detect overlap
      expect(validateNonOverlappingChunks(chunks)).toBe(false);
      
      // With empty write columns array - should detect overlap
      expect(validateNonOverlappingChunks(chunks, [])).toBe(false);
    });

    test('应该只验证有写入列的块的重叠', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [[], [], []], // 3 columns: [0, 1, 2]
          length: 3,
          archetypeKey: 'Position+Velocity+Health',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [4, 5, 6],
          cols: [[], [], []], // 3 columns: [0, 1, 2]
          length: 3,
          archetypeKey: 'Position+Velocity+Health',
          startRow: 2, // Overlapping rows
          endRow: 5
        }
      ];

      // If kernel only writes to column 5 (non-existent), no overlap check needed
      expect(validateNonOverlappingChunks(chunks, [5])).toBe(true);
      
      // If kernel writes to existing columns, overlap should be detected
      expect(validateNonOverlappingChunks(chunks, [0])).toBe(false);
      expect(validateNonOverlappingChunks(chunks, [1, 2])).toBe(false);
    });

    test('应该允许不同原型的重叠即使有写入列', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2, 3],
          cols: [[], []], // 2 columns: [0, 1]
          length: 3,
          archetypeKey: 'Position+Velocity',
          startRow: 0,
          endRow: 3
        },
        {
          entities: [4, 5, 6],
          cols: [[], []], // 2 columns: [0, 1]
          length: 3,
          archetypeKey: 'Position+Health', // Different archetype
          startRow: 1, // Overlapping rows but different archetype
          endRow: 4
        }
      ];

      // Different archetypes can overlap even with write columns
      expect(validateNonOverlappingChunks(chunks, [0, 1])).toBe(true);
    });

    test('应该正确处理rawCols优先级', () => {
      const chunks: ChunkView[] = [
        {
          entities: [1, 2],
          cols: [[], []], // 2 columns in processed cols
          rawCols: [null, null, null], // 3 columns in raw cols (should be used for detection)
          length: 2,
          archetypeKey: 'TestArch',
          startRow: 0,
          endRow: 2
        },
        {
          entities: [3, 4],
          cols: [[], []], // 2 columns in processed cols
          rawCols: [null, null, null], // 3 columns in raw cols
          length: 2,
          archetypeKey: 'TestArch',
          startRow: 1, // Overlapping
          endRow: 3
        }
      ];

      // Should use rawCols length for write column detection
      expect(validateNonOverlappingChunks(chunks, [2])).toBe(false); // Column 2 exists in rawCols
      expect(validateNonOverlappingChunks(chunks, [3])).toBe(true); // Column 3 doesn't exist
    });

    test('应该优化验证：跳过无写入列的原型', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const chunks: ChunkView[] = [
        // Archetype 1: has write column
        {
          entities: [1],
          cols: [[], []], // 2 columns: [0, 1]
          length: 1,
          archetypeKey: 'WithWriteCol',
          startRow: 0,
          endRow: 1
        },
        {
          entities: [2],
          cols: [[], []], // 2 columns: [0, 1]
          length: 1,
          archetypeKey: 'WithWriteCol',
          startRow: 0, // Same rows - should conflict
          endRow: 1
        },
        // Archetype 2: no write column
        {
          entities: [3],
          cols: [[]], // 1 column: [0] (write column 2 doesn't exist)
          length: 1,
          archetypeKey: 'NoWriteCol',
          startRow: 0,
          endRow: 1
        },
        {
          entities: [4],
          cols: [[]], // 1 column: [0]
          length: 1,
          archetypeKey: 'NoWriteCol',
          startRow: 0, // Same rows but no conflict since no write column
          endRow: 1
        }
      ];

      // Only write to column 1 - should only validate 'WithWriteCol' archetype
      expect(validateNonOverlappingChunks(chunks, [1])).toBe(false);
      
      // Should have warned about the overlapping archetype with write columns
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overlapping chunks detected in archetype WithWriteCol for write columns [1]')
      );

      consoleSpy.mockRestore();
    });

    test('应该处理复杂的多原型多写入列场景', () => {
      const chunks: ChunkView[] = [
        // Type A - has columns [0,1,2,3]
        { entities: [1], cols: [[], [], [], []], length: 1, archetypeKey: 'TypeA', startRow: 0, endRow: 5 },
        { entities: [2], cols: [[], [], [], []], length: 1, archetypeKey: 'TypeA', startRow: 5, endRow: 10 }, // No overlap
        
        // Type B - has columns [0,1] only
        { entities: [3], cols: [[], []], length: 1, archetypeKey: 'TypeB', startRow: 0, endRow: 8 },
        { entities: [4], cols: [[], []], length: 1, archetypeKey: 'TypeB', startRow: 7, endRow: 12 }, // Overlap in TypeB
        
        // Type C - has columns [0,1,2] but doesn't have column 3
        { entities: [5], cols: [[], [], []], length: 1, archetypeKey: 'TypeC', startRow: 0, endRow: 100 },
        { entities: [6], cols: [[], [], []], length: 1, archetypeKey: 'TypeC', startRow: 50, endRow: 150 } // Would overlap but no write column 3
      ];

      // Write only to columns [0,1] - both TypeA and TypeB should be validated, TypeC ignored for column 3
      expect(validateNonOverlappingChunks(chunks, [0, 1])).toBe(false); // TypeB has overlap

      // Write only to column 3 - only TypeA should be validated, no overlaps in TypeA
      expect(validateNonOverlappingChunks(chunks, [3])).toBe(true); // Only TypeA has column 3, no overlaps there

      // Write to column 2 - TypeA and TypeC should be validated
      expect(validateNonOverlappingChunks(chunks, [2])).toBe(false); // TypeC has overlapping chunks
    });

    test('应该处理边界情况', () => {
      // Empty chunks
      expect(validateNonOverlappingChunks([], [0, 1])).toBe(true);

      // Chunks without cols or rawCols
      const emptyChunks: ChunkView[] = [
        {
          entities: [1],
          cols: [],
          length: 1,
          archetypeKey: 'Empty',
          startRow: 0,
          endRow: 1
        }
      ];
      
      expect(validateNonOverlappingChunks(emptyChunks, [0])).toBe(true);

      // Single chunk
      const singleChunk: ChunkView[] = [
        {
          entities: [1],
          cols: [[]],
          length: 1,
          archetypeKey: 'Single',
          startRow: 0,
          endRow: 1
        }
      ];
      
      expect(validateNonOverlappingChunks(singleChunk, [0])).toBe(true);
    });
  });
});