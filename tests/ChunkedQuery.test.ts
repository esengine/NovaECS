import { World } from '../src/core/World';
import { ChunkedQuery, chunked, type ChunkView } from '../src/core/ChunkedQuery';
import { registerComponent } from '../src/core/ComponentRegistry';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Health {
  constructor(public hp: number = 100) {}
}

describe('ChunkedQuery', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
  });

  test('应该按chunk大小分块遍历实体', () => {
    for (let i = 0; i < 10; i++) {
      const entity = world.createEntity();
      world.add(entity, Position, { x: i, y: i * 2 });
      world.add(entity, Velocity, { dx: i * 0.5, dy: i * 0.3 });
    }

    const chunks: ChunkView[] = [];
    const query = new ChunkedQuery(world, [Position, Velocity]);
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    }, 4);

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(4);
    expect(chunks[1].length).toBe(4);
    expect(chunks[2].length).toBe(2);

    expect(chunks[0].startRow).toBe(0);
    expect(chunks[0].endRow).toBe(4);
    expect(chunks[1].startRow).toBe(4);
    expect(chunks[1].endRow).toBe(8);
    expect(chunks[2].startRow).toBe(8);
    expect(chunks[2].endRow).toBe(10);
  });

  test('应该返回正确的列数据', () => {
    const entity1 = world.createEntity();
    world.add(entity1, Position, { x: 10, y: 20 });
    world.add(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.add(entity2, Position, { x: 30, y: 40 });
    world.add(entity2, Velocity, { dx: 3, dy: 4 });

    const chunks: ChunkView[] = [];
    const query = new ChunkedQuery(world, [Position, Velocity]);
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    });

    expect(chunks.length).toBe(1);
    const chunk = chunks[0];
    
    expect(chunk.entities).toEqual([entity1, entity2]);
    expect(chunk.cols).toHaveLength(2);
    
    const [positionCol, velocityCol] = chunk.cols;
    expect(positionCol[0]).toEqual(expect.objectContaining({ x: 10, y: 20 }));
    expect(positionCol[1]).toEqual(expect.objectContaining({ x: 30, y: 40 }));
    expect(velocityCol[0]).toEqual(expect.objectContaining({ dx: 1, dy: 2 }));
    expect(velocityCol[1]).toEqual(expect.objectContaining({ dx: 3, dy: 4 }));
  });

  test('应该过滤without组件', () => {
    const entity1 = world.createEntity();
    world.add(entity1, Position, { x: 10, y: 20 });
    world.add(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.add(entity2, Position, { x: 30, y: 40 });
    world.add(entity2, Velocity, { dx: 3, dy: 4 });
    world.add(entity2, Health, { hp: 50 });

    const chunks: ChunkView[] = [];
    const query = new ChunkedQuery(world, [Position, Velocity], [Health]);
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    });

    expect(chunks.length).toBe(1);
    expect(chunks[0].entities).toEqual([entity1]);
  });

  test('便捷构造函数应该工作', () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 1, y: 2 });
    world.add(entity, Velocity, { dx: 3, dy: 4 });

    const chunks: ChunkView[] = [];
    chunked(world, Position, Velocity).forEachChunk((chunk) => {
      chunks.push(chunk);
    });

    expect(chunks.length).toBe(1);
    expect(chunks[0].entities).toEqual([entity]);
  });

  test('空查询应该不返回任何chunk', () => {
    const chunks: ChunkView[] = [];
    const query = new ChunkedQuery(world, [Position]);
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    });

    expect(chunks.length).toBe(0);
  });

  test('应该包含archetype元数据', () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 1, y: 2 });
    world.add(entity, Velocity, { dx: 3, dy: 4 });

    const chunks: ChunkView[] = [];
    const query = new ChunkedQuery(world, [Position, Velocity]);
    
    query.forEachChunk((chunk) => {
      chunks.push(chunk);
    });

    expect(chunks.length).toBe(1);
    expect(chunks[0].archetypeKey).toBeDefined();
    expect(typeof chunks[0].archetypeKey).toBe('string');
  });
});