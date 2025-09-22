/**
 * Advanced Batch Rendering System for Performance Optimization
 * 用于性能优化的高级批处理渲染系统
 *
 * Optimizes rendering performance through intelligent batching, state sorting,
 * and efficient GPU resource utilization. Reduces draw calls and state changes.
 * 通过智能批处理、状态排序和高效的GPU资源利用来优化渲染性能。
 * 减少绘制调用和状态变化。
 */

import { system, SystemContext } from '../core/System';
import { Camera2D } from '../components/Camera2D';
import { Sprite } from '../components/Sprite';
import { RenderLayer } from '../components/RenderLayer';
import { RenderMaterial } from '../components/RenderMaterial';
import { LocalTransform, WorldTransform } from '../components/Transform';
// import { Visible } from './CullingSystem';
import { IRenderDevice, DrawCallDescriptor } from '../render/IRenderDevice';
import { VertexBuffer, IndexBuffer, VertexLayouts, BufferUsage } from '../resources/RenderBuffers';
import { RenderTexture } from '../resources/RenderTexture';
import { ShaderProgram } from '../resources/ShaderProgram';

/**
 * Render batch key for grouping similar objects
 * 用于分组相似对象的渲染批次键
 */
interface BatchKey {
  /** Shader program ID 着色器程序ID */
  shaderId: string;
  /** Primary texture ID 主纹理ID */
  textureId: string;
  /** Blend mode 混合模式 */
  blendMode: number;
  /** Render queue priority 渲染队列优先级 */
  renderQueue: number;
  /** Layer for sorting 用于排序的层级 */
  layer: number;
}

/**
 * Renderable object descriptor
 * 可渲染对象描述符
 */
interface RenderableObject {
  entity: number;
  sprite: Sprite;
  material: RenderMaterial | null;
  renderLayer: RenderLayer;
  transform: LocalTransform | WorldTransform;
  batchKey: BatchKey;
  sortingKey: number;
  worldMatrix: number[];
}

/**
 * Render batch containing similar objects
 * 包含相似对象的渲染批次
 */
interface RenderBatch {
  key: BatchKey;
  objects: RenderableObject[];
  vertexCount: number;
  indexCount: number;
  shader: ShaderProgram | null;
  textures: Map<number, RenderTexture>;
  uniforms: Map<string, any>;
}

/**
 * Batch rendering statistics
 * 批处理渲染统计
 */
export interface BatchRenderStats {
  /** Objects submitted for rendering 提交渲染的对象数 */
  objectsSubmitted: number;
  /** Objects actually rendered 实际渲染的对象数 */
  objectsRendered: number;
  /** Number of batches created 创建的批次数 */
  batchesCreated: number;
  /** Number of draw calls issued 发出的绘制调用数 */
  drawCalls: number;
  /** Batching efficiency (objects per batch) 批处理效率（每批次对象数） */
  batchingEfficiency: number;
  /** State changes reduced 减少的状态变化 */
  stateChangesReduced: number;
}

/**
 * Advanced Batch Renderer for optimal performance
 * 用于最佳性能的高级批处理渲染器
 */
export class BatchRenderer {
  private device: IRenderDevice | null = null;
  private vertexBuffer: VertexBuffer | null = null;
  private indexBuffer: IndexBuffer | null = null;
  private stats: BatchRenderStats;

  // Batching state
  private renderableObjects: RenderableObject[] = [];
  private batches: Map<string, RenderBatch> = new Map();
  private sortedBatches: RenderBatch[] = [];

  // Dynamic buffers
  private vertices: Float32Array;
  private indices: Uint16Array;

  constructor(maxObjects: number = 50000) {
    this.vertices = new Float32Array(maxObjects * 4 * 8); // 4 vertices, 8 components
    this.indices = new Uint16Array(maxObjects * 6); // 6 indices per sprite

    this.stats = {
      objectsSubmitted: 0,
      objectsRendered: 0,
      batchesCreated: 0,
      drawCalls: 0,
      batchingEfficiency: 0,
      stateChangesReduced: 0,
    };
  }

  /**
   * Initialize batch renderer
   * 初始化批处理渲染器
   *
   * @param device Render device
   */
  async initialize(device: IRenderDevice): Promise<void> {
    this.device = device;

    // Create dynamic vertex buffer
    this.vertexBuffer = new VertexBuffer(
      'batch_vertices',
      VertexLayouts.PositionUVColor,
      BufferUsage.Stream
    );
    this.vertexBuffer.setData(this.vertices);
    await device.createVertexBuffer(this.vertexBuffer);

    // Create dynamic index buffer
    this.indexBuffer = new IndexBuffer('batch_indices', BufferUsage.Stream);
    this.indexBuffer.setData(this.indices);
    await device.createIndexBuffer(this.indexBuffer);
  }

  /**
   * Submit renderable object for batching
   * 提交可渲染对象进行批处理
   *
   * @param object Renderable object
   */
  submitObject(object: RenderableObject): void {
    this.renderableObjects.push(object);
    this.stats.objectsSubmitted++;
  }

  /**
   * Process all submitted objects and create optimized batches
   * 处理所有提交的对象并创建优化的批次
   */
  createBatches(): void {
    this.batches.clear();

    // Sort objects by batch key and depth
    this.renderableObjects.sort((a, b) => {
      // First sort by render queue
      if (a.batchKey.renderQueue !== b.batchKey.renderQueue) {
        return a.batchKey.renderQueue - b.batchKey.renderQueue;
      }
      // Then by layer
      if (a.batchKey.layer !== b.batchKey.layer) {
        return a.batchKey.layer - b.batchKey.layer;
      }
      // Then by material properties for batching
      const keyA = this.getBatchKeyString(a.batchKey);
      const keyB = this.getBatchKeyString(b.batchKey);
      if (keyA !== keyB) {
        return keyA.localeCompare(keyB);
      }
      // Finally by sorting key (depth)
      return a.sortingKey - b.sortingKey;
    });

    // Group objects into batches
    for (const obj of this.renderableObjects) {
      const keyString = this.getBatchKeyString(obj.batchKey);
      let batch = this.batches.get(keyString);

      if (!batch) {
        batch = {
          key: obj.batchKey,
          objects: [],
          vertexCount: 0,
          indexCount: 0,
          shader: null,
          textures: new Map(),
          uniforms: new Map(),
        };
        this.batches.set(keyString, batch);
        this.stats.batchesCreated++;
      }

      batch.objects.push(obj);
      batch.vertexCount += 4; // 4 vertices per sprite
      batch.indexCount += 6;  // 6 indices per sprite
    }

    // Convert to sorted array for rendering
    this.sortedBatches = Array.from(this.batches.values());
    this.sortedBatches.sort((a, b) => {
      if (a.key.renderQueue !== b.key.renderQueue) {
        return a.key.renderQueue - b.key.renderQueue;
      }
      return a.key.layer - b.key.layer;
    });

    // Calculate batching efficiency
    const totalBatches = this.sortedBatches.length;
    this.stats.batchingEfficiency = totalBatches > 0 ? this.stats.objectsSubmitted / totalBatches : 0;
    this.stats.stateChangesReduced = Math.max(0, this.stats.objectsSubmitted - totalBatches);
  }

  /**
   * Render all batches
   * 渲染所有批次
   *
   * @param camera Active camera
   */
  async renderBatches(camera: Camera2D): Promise<void> {
    if (!this.device || !this.vertexBuffer || !this.indexBuffer) {
      return;
    }

    for (const batch of this.sortedBatches) {
      await this.renderBatch(batch, camera);
    }
  }

  /**
   * Render a single batch
   * 渲染单个批次
   *
   * @param batch Render batch
   * @param camera Active camera
   */
  private async renderBatch(batch: RenderBatch, camera: Camera2D): Promise<void> {
    if (batch.objects.length === 0 || !this.device || !this.vertexBuffer || !this.indexBuffer) {
      return;
    }

    // Generate geometry for batch
    let vertexOffset = 0;
    let indexOffset = 0;

    for (const obj of batch.objects) {
      this.generateObjectGeometry(obj, vertexOffset, indexOffset);
      vertexOffset += 4 * 8; // 4 vertices, 8 components each
      indexOffset += 6;      // 6 indices per object
    }

    // Update buffers
    const vertexData = this.vertices.subarray(0, batch.vertexCount * 8);
    const indexData = this.indices.subarray(0, batch.indexCount);

    this.vertexBuffer.setData(vertexData);
    this.indexBuffer.setData(indexData);

    await this.device.updateVertexBuffer(this.vertexBuffer);
    await this.device.updateIndexBuffer(this.indexBuffer);

    // Prepare uniforms
    const uniforms = new Map(batch.uniforms);
    uniforms.set('u_viewProjection', camera.viewProjectionMatrix);

    // Create draw call
    if (!batch.shader) return;

    const drawCall: DrawCallDescriptor = {
      shader: batch.shader,
      vertexBuffer: this.vertexBuffer,
      indexBuffer: this.indexBuffer,
      count: batch.indexCount,
      offset: 0,
      instanceCount: 1,
      textures: batch.textures,
      uniforms,
    };

    // Execute draw call
    this.device.draw(drawCall);

    this.stats.drawCalls++;
    this.stats.objectsRendered += batch.objects.length;
  }

  /**
   * Generate geometry for a single object
   * 为单个对象生成几何体
   *
   * @param obj Renderable object
   * @param vertexOffset Vertex buffer offset
   * @param indexOffset Index buffer offset
   */
  private generateObjectGeometry(
    obj: RenderableObject,
    vertexOffset: number,
    indexOffset: number
  ): void {
    const { sprite, transform } = obj;

    // Extract transform data
    let x, y, rotation, scaleX, scaleY;
    if ('x' in transform) {
      x = transform.x;
      y = transform.y;
      rotation = transform.rot;
      scaleX = transform.sx;
      scaleY = transform.sy;
    } else {
      const m = transform.m;
      x = m[6];
      y = m[7];
      rotation = Math.atan2(m[1], m[0]);
      scaleX = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
      scaleY = Math.sqrt(m[3] * m[3] + m[4] * m[4]);
    }

    // Calculate sprite bounds
    const halfWidth = (sprite.width * scaleX) / 2;
    const halfHeight = (sprite.height * scaleY) / 2;
    const anchorX = -sprite.width * sprite.anchor[0] * scaleX;
    const anchorY = -sprite.height * sprite.anchor[1] * scaleY;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Generate vertices
    const corners = [
      [-halfWidth + anchorX, -halfHeight + anchorY], // Bottom-left
      [halfWidth + anchorX, -halfHeight + anchorY],  // Bottom-right
      [halfWidth + anchorX, halfHeight + anchorY],   // Top-right
      [-halfWidth + anchorX, halfHeight + anchorY],  // Top-left
    ];

    const color = sprite.color;
    const uv = sprite.uv;

    for (let i = 0; i < 4; i++) {
      const localX = corners[i][0];
      const localY = corners[i][1];

      // Apply transformation
      const worldX = x + localX * cos - localY * sin;
      const worldY = y + localX * sin + localY * cos;

      // Set vertex data
      const vIndex = vertexOffset + i * 8;

      this.vertices[vIndex] = worldX;
      this.vertices[vIndex + 1] = worldY;

      // UV coordinates
      const u = sprite.flipX ? uv[2] - (i % 2) * (uv[2] - uv[0]) : uv[0] + (i % 2) * (uv[2] - uv[0]);
      const v = sprite.flipY ? uv[3] - Math.floor(i / 2) * (uv[3] - uv[1]) : uv[1] + Math.floor(i / 2) * (uv[3] - uv[1]);

      this.vertices[vIndex + 2] = u;
      this.vertices[vIndex + 3] = v;

      // Color
      this.vertices[vIndex + 4] = color[0];
      this.vertices[vIndex + 5] = color[1];
      this.vertices[vIndex + 6] = color[2];
      this.vertices[vIndex + 7] = color[3];
    }

    // Generate indices
    const baseVertex = vertexOffset / 8;
    const baseIndex = indexOffset;

    this.indices[baseIndex] = baseVertex;
    this.indices[baseIndex + 1] = baseVertex + 1;
    this.indices[baseIndex + 2] = baseVertex + 2;
    this.indices[baseIndex + 3] = baseVertex;
    this.indices[baseIndex + 4] = baseVertex + 2;
    this.indices[baseIndex + 5] = baseVertex + 3;
  }

  /**
   * Clear all submitted objects and batches
   * 清除所有提交的对象和批次
   */
  clear(): void {
    this.renderableObjects.length = 0;
    this.batches.clear();
    this.sortedBatches.length = 0;
  }

  /**
   * Get rendering statistics
   * 获取渲染统计
   *
   * @returns Batch rendering statistics
   */
  getStats(): BatchRenderStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      objectsSubmitted: 0,
      objectsRendered: 0,
      batchesCreated: 0,
      drawCalls: 0,
      batchingEfficiency: 0,
      stateChangesReduced: 0,
    };
  }

  /**
   * Create batch key string for grouping
   * 创建用于分组的批次键字符串
   *
   * @param key Batch key
   * @returns String representation
   */
  private getBatchKeyString(key: BatchKey): string {
    return `${key.shaderId}|${key.textureId}|${key.blendMode}|${key.renderQueue}`;
  }

  /**
   * Cleanup resources
   * 清理资源
   */
  destroy(): void {
    if (this.device) {
      if (this.vertexBuffer) this.device.destroyVertexBuffer(this.vertexBuffer);
      if (this.indexBuffer) this.device.destroyIndexBuffer(this.indexBuffer);
    }
  }
}

/**
 * Batch Rendering System - advanced batching for optimal performance
 * 批处理渲染系统 - 用于最佳性能的高级批处理
 */
export const BatchRenderSystem = system(
  'render.batch',
  (_ctx: SystemContext) => {
    // This is a placeholder for the advanced batching system
    // In a real implementation, this would replace or enhance the basic sprite renderer
    // 这是高级批处理系统的占位符
    // 在实际实现中，这将替换或增强基本精灵渲染器
  }
)
  .stage('update')
  .after('render.culling.frustum')
  .before('render.sprite')
  .inSet('rendering')
  .build();