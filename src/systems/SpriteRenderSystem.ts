/**
 * Sprite Rendering System for 2D Graphics
 * 用于2D图形的精灵渲染系统
 *
 * Renders visible sprite entities using the render device abstraction.
 * Handles sprite batching, texture management, and efficient GPU rendering.
 * 使用渲染设备抽象渲染可见的精灵实体。
 * 处理精灵批处理、纹理管理和高效的GPU渲染。
 */

import { system, SystemContext } from '../core/System';
import { Camera2D } from '../components/Camera2D';
import { Sprite } from '../components/Sprite';
import { RenderLayer } from '../components/RenderLayer';
import { RenderMaterial } from '../components/RenderMaterial';
import { LocalTransform, WorldTransform } from '../components/Transform';
import { Visible, VisibilityResult } from './CullingSystem';
import { IRenderDevice, DrawCallDescriptor } from '../render/IRenderDevice';
import { VertexBuffer, IndexBuffer, VertexLayouts, BufferUsage } from '../resources/RenderBuffers';
import { RenderTexture } from '../resources/RenderTexture';
import { ShaderProgram, createUnlitShader } from '../resources/ShaderProgram';

/**
 * Sprite vertex data structure
 * 精灵顶点数据结构
 */
interface SpriteVertex {
  x: number;
  y: number;
  u: number;
  v: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Render command for sprite batching
 * 用于精灵批处理的渲染命令
 */
interface SpriteRenderCommand {
  entity: number;
  sprite: Sprite;
  material: RenderMaterial | null;
  layer: RenderLayer;
  transform: LocalTransform | WorldTransform;
  depth: number;
  vertices: SpriteVertex[];
}

/**
 * Sprite rendering statistics
 * 精灵渲染统计
 */
export interface SpriteRenderStats {
  /** Number of sprites processed 处理的精灵数 */
  spritesProcessed: number;
  /** Number of sprites rendered 渲染的精灵数 */
  spritesRendered: number;
  /** Number of draw calls issued 发出的绘制调用数 */
  drawCalls: number;
  /** Number of vertices generated 生成的顶点数 */
  verticesGenerated: number;
  /** Number of texture switches 纹理切换数 */
  textureSwitches: number;
}

/**
 * Sprite Render System Resource - manages rendering resources and state
 * 精灵渲染系统资源 - 管理渲染资源和状态
 */
export class SpriteRenderer {
  private device: IRenderDevice | null = null;
  private vertexBuffer: VertexBuffer | null = null;
  private indexBuffer: IndexBuffer | null = null;
  private defaultShader: ShaderProgram | null = null;
  private whiteTexture: RenderTexture | null = null;
  private stats: SpriteRenderStats;

  // Rendering buffers
  private vertices: Float32Array;
  private indices: Uint16Array;
  private maxSprites: number;
  private spriteCount: number = 0;

  constructor(maxSprites: number = 10000) {
    this.maxSprites = maxSprites;
    this.vertices = new Float32Array(maxSprites * 4 * 8); // 4 vertices, 8 components each
    this.indices = new Uint16Array(maxSprites * 6); // 6 indices per sprite (2 triangles)

    this.stats = {
      spritesProcessed: 0,
      spritesRendered: 0,
      drawCalls: 0,
      verticesGenerated: 0,
      textureSwitches: 0,
    };

    this.generateIndices();
  }

  /**
   * Initialize sprite renderer with render device
   * 使用渲染设备初始化精灵渲染器
   *
   * @param device Render device instance
   */
  async initialize(device: IRenderDevice): Promise<void> {
    this.device = device;

    // Create vertex buffer
    this.vertexBuffer = new VertexBuffer(
      'sprite_vertices',
      VertexLayouts.PositionUVColor,
      BufferUsage.Dynamic
    );
    this.vertexBuffer.setData(this.vertices);
    await device.createVertexBuffer(this.vertexBuffer);

    // Create index buffer
    this.indexBuffer = new IndexBuffer('sprite_indices', BufferUsage.Static);
    this.indexBuffer.setData(this.indices);
    await device.createIndexBuffer(this.indexBuffer);

    // Create default shader
    this.defaultShader = createUnlitShader();
    await device.createShader(this.defaultShader);

    // Create white texture for untextured sprites
    this.whiteTexture = new RenderTexture('white', 1, 1);
    const whiteData = new Uint8Array([255, 255, 255, 255]);
    this.whiteTexture.setData(whiteData);
    await device.createTexture(this.whiteTexture);
  }

  /**
   * Begin sprite rendering for a camera
   * 开始为相机进行精灵渲染
   *
   * @param camera Camera to render for
   */
  beginRender(_camera: Camera2D): void {
    this.spriteCount = 0;
    this.resetStats();
  }

  /**
   * Add sprite to render batch
   * 向渲染批次添加精灵
   *
   * @param command Sprite render command
   */
  addSprite(command: SpriteRenderCommand): void {
    if (this.spriteCount >= this.maxSprites) {
      void this.flush(); // Flush current batch if full
    }

    // Generate sprite vertices
    this.generateSpriteVertices(command);
    this.spriteCount++;
    this.stats.spritesProcessed++;
  }

  /**
   * Flush current render batch
   * 刷新当前渲染批次
   */
  async flush(): Promise<void> {
    if (this.spriteCount === 0 || !this.device || !this.vertexBuffer || !this.indexBuffer) {
      return;
    }

    // Update vertex buffer with new data
    const vertexData = this.vertices.subarray(0, this.spriteCount * 4 * 8);
    this.vertexBuffer.setData(vertexData);
    await this.device.updateVertexBuffer(this.vertexBuffer);

    // Create draw call descriptor
    if (!this.defaultShader || !this.whiteTexture) return;

    const drawCall: DrawCallDescriptor = {
      shader: this.defaultShader,
      vertexBuffer: this.vertexBuffer,
      indexBuffer: this.indexBuffer,
      count: this.spriteCount * 6, // 6 indices per sprite
      offset: 0,
      instanceCount: 1,
      textures: new Map([[0, this.whiteTexture]]),
      uniforms: new Map([
        ['u_color', [1, 1, 1, 1]],
        ['u_viewProjection', [1, 0, 0, 0, 1, 0, 0, 0, 1]], // Will be set by camera
      ]),
    };

    // Execute draw call
    this.device.draw(drawCall);

    this.stats.drawCalls++;
    this.stats.spritesRendered += this.spriteCount;
    this.stats.verticesGenerated += this.spriteCount * 4;

    this.spriteCount = 0;
  }

  /**
   * Get rendering statistics
   * 获取渲染统计
   *
   * @returns Sprite rendering statistics
   */
  getStats(): SpriteRenderStats {
    return { ...this.stats };
  }

  /**
   * Reset rendering statistics
   * 重置渲染统计
   */
  resetStats(): void {
    this.stats = {
      spritesProcessed: 0,
      spritesRendered: 0,
      drawCalls: 0,
      verticesGenerated: 0,
      textureSwitches: 0,
    };
  }

  /**
   * Generate sprite vertices for a render command
   * 为渲染命令生成精灵顶点
   *
   * @param command Sprite render command
   */
  private generateSpriteVertices(command: SpriteRenderCommand): void {
    const { sprite, transform } = command;
    const baseIndex = this.spriteCount * 4 * 8; // 4 vertices, 8 components each

    // Get transform values
    let x, y, rotation, scaleX, scaleY;
    if ('x' in transform) {
      // LocalTransform
      x = transform.x;
      y = transform.y;
      rotation = transform.rot;
      scaleX = transform.sx;
      scaleY = transform.sy;
    } else {
      // WorldTransform - extract from matrix
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

    // Apply anchor offset
    const anchorOffsetX = -sprite.width * sprite.anchor[0] * scaleX;
    const anchorOffsetY = -sprite.height * sprite.anchor[1] * scaleY;

    // Calculate corners relative to center
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const corners = [
      [-halfWidth + anchorOffsetX, -halfHeight + anchorOffsetY], // Bottom-left
      [halfWidth + anchorOffsetX, -halfHeight + anchorOffsetY],  // Bottom-right
      [halfWidth + anchorOffsetX, halfHeight + anchorOffsetY],   // Top-right
      [-halfWidth + anchorOffsetX, halfHeight + anchorOffsetY],  // Top-left
    ];

    // Transform corners and set vertex data
    const color = sprite.color;
    const uv = sprite.uv;

    for (let i = 0; i < 4; i++) {
      const localX = corners[i][0];
      const localY = corners[i][1];

      // Apply rotation and translation
      const worldX = x + localX * cos - localY * sin;
      const worldY = y + localX * sin + localY * cos;

      // Set vertex data
      const vertexIndex = baseIndex + i * 8;

      this.vertices[vertexIndex] = worldX;     // Position X
      this.vertices[vertexIndex + 1] = worldY; // Position Y

      // UV coordinates (handle flipping)
      const u = sprite.flipX ? uv[2] - (i % 2) * (uv[2] - uv[0]) : uv[0] + (i % 2) * (uv[2] - uv[0]);
      const v = sprite.flipY ? uv[3] - Math.floor(i / 2) * (uv[3] - uv[1]) : uv[1] + Math.floor(i / 2) * (uv[3] - uv[1]);

      this.vertices[vertexIndex + 2] = u;
      this.vertices[vertexIndex + 3] = v;

      // Color
      this.vertices[vertexIndex + 4] = color[0]; // R
      this.vertices[vertexIndex + 5] = color[1]; // G
      this.vertices[vertexIndex + 6] = color[2]; // B
      this.vertices[vertexIndex + 7] = color[3]; // A
    }
  }

  /**
   * Generate index buffer for sprite quads
   * 为精灵四边形生成索引缓冲区
   */
  private generateIndices(): void {
    for (let i = 0; i < this.maxSprites; i++) {
      const baseVertex = i * 4;
      const baseIndex = i * 6;

      // First triangle (bottom-left, bottom-right, top-right)
      this.indices[baseIndex] = baseVertex;
      this.indices[baseIndex + 1] = baseVertex + 1;
      this.indices[baseIndex + 2] = baseVertex + 2;

      // Second triangle (bottom-left, top-right, top-left)
      this.indices[baseIndex + 3] = baseVertex;
      this.indices[baseIndex + 4] = baseVertex + 2;
      this.indices[baseIndex + 5] = baseVertex + 3;
    }
  }

  /**
   * Cleanup resources
   * 清理资源
   */
  destroy(): void {
    if (this.device) {
      if (this.vertexBuffer) this.device.destroyVertexBuffer(this.vertexBuffer);
      if (this.indexBuffer) this.device.destroyIndexBuffer(this.indexBuffer);
      if (this.defaultShader) this.device.destroyShader(this.defaultShader);
      if (this.whiteTexture) this.device.destroyTexture(this.whiteTexture);
    }
  }
}

/**
 * Sprite Rendering System - renders all visible sprites
 * 精灵渲染系统 - 渲染所有可见的精灵
 */
export const SpriteRenderSystem = system(
  'render.sprite',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get sprite renderer resource
    const renderer = world.getResource(SpriteRenderer);
    if (!renderer) {
      // Renderer not initialized yet
      return;
    }

    // Get all active cameras sorted by priority
    const cameras: Array<{ entity: number; camera: Camera2D; transform?: LocalTransform | WorldTransform }> = [];

    world.query(Camera2D, LocalTransform).forEach((entity, camera, transform) => {
      if (camera.layerMask !== 0) {
        cameras.push({ entity, camera, transform });
      }
    });

    world.query(Camera2D, WorldTransform).without(LocalTransform).forEach((entity, camera, worldTransform) => {
      if (camera.layerMask !== 0) {
        cameras.push({ entity, camera, transform: worldTransform });
      }
    });

    // Sort cameras by priority
    cameras.sort((a, b) => a.camera.priority - b.camera.priority);

    // Render for each camera
    for (const cameraInfo of cameras) {
      renderer.beginRender(cameraInfo.camera);

      // Collect all visible sprites
      const renderCommands: SpriteRenderCommand[] = [];

      world.query(Sprite, RenderLayer, Visible).forEach((entity, sprite, layer, visible) => {
        // Skip if not visible or wrong layer
        if (visible.result === VisibilityResult.Culled ||
            (cameraInfo.camera.layerMask & (1 << layer.layer)) === 0) {
          return;
        }

        // Get transform
        const localTransform = world.getComponent(entity, LocalTransform);
        const worldTransform = world.getComponent(entity, WorldTransform);
        const transform = localTransform || worldTransform;

        if (!transform) {
          return; // No transform
        }

        // Get material (optional)
        const material = world.getComponent(entity, RenderMaterial) || null;

        // Create render command
        renderCommands.push({
          entity,
          sprite,
          material,
          layer,
          transform,
          depth: layer.depth + layer.sortingOrder,
          vertices: [], // Will be generated during rendering
        });
      });

      // Sort by depth and layer
      renderCommands.sort((a, b) => {
        if (a.layer.layer !== b.layer.layer) {
          return a.layer.layer - b.layer.layer;
        }
        return a.depth - b.depth;
      });

      // Add sprites to renderer
      for (const command of renderCommands) {
        renderer.addSprite(command);
      }

      // Flush remaining sprites
      void renderer.flush();
    }
  }
)
  .stage('update')
  .after('render.culling.frustum')
  .inSet('rendering')
  .build();