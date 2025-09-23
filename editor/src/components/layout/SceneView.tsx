import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import { LocalTransform, Sprite } from '@esengine/nova-ecs';

const SceneContainer = styled.div`
  flex: 1;
  background-color: #1e1e1e;
  position: relative;
  overflow: hidden;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
`;

const Overlay = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #cccccc;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
`;


function SceneView() {
  const { t } = useTranslation();
  const { world, mode, tool, entities } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera state
  const [camera, setCamera] = useState({
    x: 0,
    y: 0,
    zoom: 1
  });

  // Mouse interaction state
  const [mouseState, setMouseState] = useState({
    isMiddleMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple rendering loop
    let animationId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      if (world.editorState.showGrid) {
        drawGrid(ctx, canvas);
      }

      // Draw some sample content
      drawSampleContent(ctx, canvas);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [world, camera]);

  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const gridSize = world.editorState.gridSize * camera.zoom;
    const rect = canvas.getBoundingClientRect();

    // Don't draw grid if it's too small or too large
    if (gridSize < 5 || gridSize > 200) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate grid offset based on camera position
    const offsetX = (-camera.x * camera.zoom) % gridSize;
    const offsetY = (-camera.y * camera.zoom) % gridSize;

    // Vertical lines
    for (let x = offsetX; x < rect.width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < rect.height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // Draw coordinate axes (world origin)
    const originScreen = worldToScreen(0, 0);

    // X axis (red line through world origin)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(rect.width, originScreen.y);
    ctx.stroke();

    // Y axis (green line through world origin)
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, rect.height);
    ctx.stroke();

    // Draw origin point
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const worldToScreen = (worldX: number, worldY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    return {
      x: centerX + (worldX - camera.x) * camera.zoom,
      y: centerY + (worldY - camera.y) * camera.zoom
    };
  };

  const screenToWorld = (screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    return {
      x: camera.x + (screenX - centerX) / camera.zoom,
      y: camera.y + (screenY - centerY) / camera.zoom
    };
  };

  const drawSampleContent = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const selectedEntities = world.getSelectedEntities();

    // Draw all entities using their Transform and Sprite components
    entities.forEach(entity => {
      try {
        const transform = world.getComponent(entity, LocalTransform);
        const sprite = world.getComponent(entity, Sprite);

        if (transform && sprite) {
          // Convert world coordinates to screen coordinates
          const screenPos = worldToScreen(transform.x, transform.y);

          // Set sprite color
          const [r, g, b, a] = sprite.color;
          ctx.fillStyle = `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, ${a})`;

          // Draw sprite as rectangle
          const scaledWidth = sprite.width * camera.zoom;
          const scaledHeight = sprite.height * camera.zoom;
          const halfWidth = scaledWidth / 2;
          const halfHeight = scaledHeight / 2;
          ctx.fillRect(screenPos.x - halfWidth, screenPos.y - halfHeight, scaledWidth, scaledHeight);

          // Draw selection outline if selected
          if (selectedEntities.includes(entity)) {
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenPos.x - halfWidth - 2, screenPos.y - halfHeight - 2, scaledWidth + 4, scaledHeight + 4);

            // Draw gizmo if in appropriate tool mode
            if (tool !== 'select') {
              drawGizmo(ctx, screenPos.x, screenPos.y, tool);
            }
          }
        }
      } catch (error) {
        // Skip entities without required components
        console.debug('Entity missing Transform or Sprite component:', entity);
      }
    });
  };

  const drawGizmo = (ctx: CanvasRenderingContext2D, x: number, y: number, tool: string) => {
    const size = 30 * camera.zoom;

    switch (tool) {
      case 'move':
        // X axis (red)
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size, y);
        ctx.stroke();

        // Y axis (green)
        ctx.strokeStyle = '#00FF00';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + size);
        ctx.stroke();
        break;

      case 'rotate':
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'scale':
        ctx.strokeStyle = '#0000FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - size/2, y - size/2, size, size);
        break;
    }
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldPos = screenToWorld(clickX, clickY);

    // Check which entity was clicked
    let clickedEntity: number | null = null;

    entities.forEach(entity => {
      try {
        const transform = world.getComponent(entity, LocalTransform);
        const sprite = world.getComponent(entity, Sprite);

        if (transform && sprite) {
          // Check if click is within entity bounds
          const halfWidth = sprite.width / 2;
          const halfHeight = sprite.height / 2;

          if (worldPos.x >= transform.x - halfWidth && worldPos.x <= transform.x + halfWidth &&
              worldPos.y >= transform.y - halfHeight && worldPos.y <= transform.y + halfHeight) {
            clickedEntity = entity;
          }
        }
      } catch (error) {
        // Skip entities without required components
      }
    });

    // Handle selection
    if (clickedEntity !== null) {
      const multiSelect = event.ctrlKey || event.metaKey;
      if (multiSelect) {
        // Add to selection or remove if already selected
        const currentSelection = world.getSelectedEntities();
        if (currentSelection.includes(clickedEntity)) {
          world.deselectEntities([clickedEntity]);
        } else {
          world.selectEntities([clickedEntity], true); // additive selection
        }
      } else {
        // Replace selection
        world.selectEntities([clickedEntity], false);
      }
    } else {
      // Clicked empty space - clear selection unless holding ctrl/cmd
      if (!(event.ctrlKey || event.metaKey)) {
        world.clearSelection();
      }
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      setMouseState({
        isMiddleMouseDown: true,
        lastMouseX: event.clientX,
        lastMouseY: event.clientY
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (mouseState.isMiddleMouseDown) {
      const deltaX = event.clientX - mouseState.lastMouseX;
      const deltaY = event.clientY - mouseState.lastMouseY;

      setCamera(prev => ({
        ...prev,
        x: prev.x - deltaX / prev.zoom,
        y: prev.y - deltaY / prev.zoom
      }));

      setMouseState(prev => ({
        ...prev,
        lastMouseX: event.clientX,
        lastMouseY: event.clientY
      }));
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (event.button === 1) { // Middle mouse button
      setMouseState(prev => ({
        ...prev,
        isMiddleMouseDown: false
      }));
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to world coordinates before zoom
    const worldPos = screenToWorld(mouseX, mouseY);

    // Calculate zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, camera.zoom * zoomFactor));

    // Calculate new camera position to keep mouse position fixed
    const newWorldPos = {
      x: camera.x + (mouseX - rect.width / 2) / newZoom,
      y: camera.y + (mouseY - rect.height / 2) / newZoom
    };

    setCamera({
      x: camera.x + (worldPos.x - newWorldPos.x),
      y: camera.y + (worldPos.y - newWorldPos.y),
      zoom: newZoom
    });
  };

  const handleDoubleClick = () => {
    // Reset camera to origin
    setCamera({
      x: 0,
      y: 0,
      zoom: 1
    });
  };

  return (
    <SceneContainer>
      <Canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <Overlay>
        {t('panels.scene')} | {t(`toolbar.${tool}`)} | {mode.toUpperCase()} | {Math.round(camera.zoom * 100)}% |
        X: {Math.round(camera.x)} Y: {Math.round(camera.y)}
      </Overlay>
    </SceneContainer>
  );
}

export default SceneView;