import { useState, useRef } from 'react';
import styled from '@emotion/styled';
import { VisualGraph, BaseVisualNode, NodeGenerator } from '@esengine/nova-ecs';
import NodeComponent from './NodeComponent';

const CanvasContainer = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #1e1e1e;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0);
  background-size: 20px 20px;
`;

const CanvasViewport = styled.div<{
  scale: number;
  translateX: number;
  translateY: number;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: scale(${props => props.scale}) translate(${props => props.translateX}px, ${props => props.translateY}px);
  transform-origin: 0 0;
`;

const SelectionBox = styled.div<{
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  border: 2px dashed #007acc;
  background-color: rgba(0, 122, 204, 0.1);
  pointer-events: none;
  display: ${props => props.visible ? 'block' : 'none'};
`;

const ConnectionSVG = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
`;

const ConnectionPath = styled.path`
  fill: none;
  stroke: #007acc;
  stroke-width: 2;
  stroke-linecap: round;
`;

const TempConnectionPath = styled.path`
  fill: none;
  stroke: #6c6c6c;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 5, 5;
`;

interface NodePosition {
  x: number;
  y: number;
}

interface VisualCanvasProps {
  graph: VisualGraph;
  onChange: () => void;
}

function VisualCanvas({ graph, onChange }: VisualCanvasProps) {
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
    const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [viewTransform, setViewTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
    const [selectionBox, setSelectionBox] = useState({
      visible: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    });
    const [connecting, setConnecting] = useState<{
      active: boolean;
      dragging: boolean;
      fromNode: string;
      fromPin: string;
      fromType: 'input' | 'output';
      fromPinIndex: number;
      currentX: number;
      currentY: number;
      startX: number;
      startY: number;
    }>({
      active: false,
      dragging: false,
      fromNode: '',
      fromPin: '',
      fromType: 'input',
      fromPinIndex: 0,
      currentX: 0,
      currentY: 0,
      startX: 0,
      startY: 0
    });

    const canvasRef = useRef<HTMLDivElement>(null);

    // Get pin position from DOM if possible, fallback to calculation
    const getPinPosition = (nodeId: string, pinName: string, pinType: 'input' | 'output') => {
      // Try to find the pin DOM element
      const pinSelector = `[data-pin="${pinType}"][data-node="${nodeId}"][data-pin-name="${pinName}"]`;
      const pinElement = document.querySelector(pinSelector) as HTMLElement;

      if (pinElement && canvasRef.current) {
        const pinRect = pinElement.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();

        const pinCenterX = (pinRect.left + pinRect.width / 2 - canvasRect.left - viewTransform.translateX) / viewTransform.scale;
        const pinCenterY = (pinRect.top + pinRect.height / 2 - canvasRect.top - viewTransform.translateY) / viewTransform.scale;

        return { x: pinCenterX, y: pinCenterY };
      }

      // Fallback to calculation if DOM lookup fails
      return calculatePinPosition(nodeId, pinName, pinType);
    };

    // Calculate pin position as fallback when DOM lookup fails
    const calculatePinPosition = (nodeId: string, pinName: string, pinType: 'input' | 'output') => {
      const node = graph.getNode(nodeId);
      const nodePos = nodePositions.get(nodeId);

      if (!node || !nodePos) return { x: 0, y: 0 };

      const pins = pinType === 'input' ? Array.from(node.inputs.keys()) : Array.from(node.outputs.keys());
      const pinIndex = pins.indexOf(pinName);
      if (pinIndex === -1) return { x: 0, y: 0 };

      // Simplified calculation
      const pinY = nodePos.y + 40 + (pinIndex * 24);
      const pinX = pinType === 'output' ? nodePos.x + 142 : nodePos.x + 8;

      return { x: pinX, y: pinY };
    };

    const handleCanvasMouseDown = (event: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (event.clientX - rect.left - viewTransform.translateX) / viewTransform.scale;
      const y = (event.clientY - rect.top - viewTransform.translateY) / viewTransform.scale;

      if (event.button === 1) {
        // Middle mouse button - pan canvas
        event.preventDefault();
        setIsPanning(true);
        setPanStart({ x: event.clientX, y: event.clientY });
      } else if (event.button === 0) {
        // Left click
        if (event.ctrlKey || event.metaKey) {
          // Start selection box
          setSelectionBox({
            visible: true,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
          });
        } else {
          // Clear selection when clicking on empty canvas
          setSelectedNodes(new Set());
        }
      }
    };

    const handleCanvasMouseMove = (event: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (event.clientX - rect.left - viewTransform.translateX) / viewTransform.scale;
      const y = (event.clientY - rect.top - viewTransform.translateY) / viewTransform.scale;

      if (connecting.active) {
        // Check if we've started dragging (moved more than a threshold in world coordinates)
        const threshold = 3;  // Reduced threshold for more responsive dragging
        const dx = Math.abs(x - connecting.startX);
        const dy = Math.abs(y - connecting.startY);
        const isDragging = dx > threshold || dy > threshold;


        setConnecting(prev => ({
          ...prev,
          currentX: x,
          currentY: y,
          dragging: isDragging || prev.dragging
        }));
      } else if (selectionBox.visible) {
        setSelectionBox(prev => ({ ...prev, currentX: x, currentY: y }));
      } else if (isPanning) {
        const deltaX = event.clientX - panStart.x;
        const deltaY = event.clientY - panStart.y;
        setViewTransform(prev => ({
          ...prev,
          translateX: prev.translateX + deltaX,
          translateY: prev.translateY + deltaY
        }));
        setPanStart({ x: event.clientX, y: event.clientY });
      }
    };

    const handleCanvasMouseUp = () => {
      setIsPanning(false);
      setSelectionBox(prev => ({ ...prev, visible: false }));

      // Cancel connection if releasing outside of a pin
      if (connecting.active) {
        setConnecting(prev => ({ ...prev, active: false, dragging: false }));
      }
    };

    const handleNodeSelect = (nodeId: string) => {
      setSelectedNodes(new Set([nodeId]));
    };

    const handleNodeMove = (nodeId: string, x: number, y: number) => {
      setNodePositions(prev => new Map(prev.set(nodeId, { x, y })));
    };

    const handleInputChange = (nodeId: string, inputName: string, value: any) => {
      const node = graph.getNode(nodeId);
      if (node) {
        node.setInput(inputName, value);
        onChange();
      }
    };

    const handlePinMouseDown = (
      nodeId: string,
      pinName: string,
      pinType: 'input' | 'output',
      event: React.MouseEvent
    ) => {
      event.preventDefault();
      event.stopPropagation();

      // Get actual pin position from DOM
      const pinElement = event.currentTarget as HTMLElement;
      const pinRect = pinElement.getBoundingClientRect();
      const canvasRect = canvasRef.current?.getBoundingClientRect();

      if (!canvasRect) return;

      // Calculate pin center in world coordinates
      const pinCenterX = (pinRect.left + pinRect.width / 2 - canvasRect.left - viewTransform.translateX) / viewTransform.scale;
      const pinCenterY = (pinRect.top + pinRect.height / 2 - canvasRect.top - viewTransform.translateY) / viewTransform.scale;

      console.log(`Pin ${nodeId}.${pinName} (${pinType}) actual DOM position: (${pinCenterX}, ${pinCenterY})`);

      // Start connection with actual pin position
      setConnecting({
        active: true,
        dragging: false,
        fromNode: nodeId,
        fromPin: pinName,
        fromType: pinType,
        fromPinIndex: 0,
        currentX: pinCenterX,
        currentY: pinCenterY,
        startX: pinCenterX,
        startY: pinCenterY
      });
    };

    const handlePinMouseUp = (
      nodeId: string,
      pinName: string,
      pinType: 'input' | 'output',
      event: React.MouseEvent
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (connecting.active && connecting.dragging) {
        // Complete connection if types are different and we actually dragged
        if (connecting.fromType !== pinType) {
          const connectionId = `conn_${Date.now()}`;

          const connection = {
            id: connectionId,
            fromNodeId: connecting.fromType === 'output' ? connecting.fromNode : nodeId,
            fromPin: connecting.fromType === 'output' ? connecting.fromPin : pinName,
            toNodeId: connecting.fromType === 'input' ? connecting.fromNode : nodeId,
            toPin: connecting.fromType === 'input' ? connecting.fromPin : pinName
          };

          try {
            graph.addConnection(connection);
            onChange();
          } catch (error) {
            console.warn('Failed to create connection:', error);
          }
        }
        setConnecting(prev => ({ ...prev, active: false, dragging: false }));
      } else if (connecting.active) {
        // Cancel connection if we didn't drag
        setConnecting(prev => ({ ...prev, active: false, dragging: false }));
      }
    };

    const handleCanvasDrop = (event: React.DragEvent) => {
      event.preventDefault();

      try {
        const data = JSON.parse(event.dataTransfer.getData('application/json'));
        if (data.type === 'node') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;

          const x = (event.clientX - rect.left - viewTransform.translateX) / viewTransform.scale;
          const y = (event.clientY - rect.top - viewTransform.translateY) / viewTransform.scale;

          const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Create node using NodeGenerator for proper type registration
          let node: BaseVisualNode;

          try {
            // Try to create using NodeGenerator first (for ECS nodes)
            node = NodeGenerator.createNode(data.nodeType.id, nodeId);
          } catch (error) {
            // Fall back to creating built-in nodes manually
            node = new (class extends BaseVisualNode {
              constructor() {
                super(nodeId, data.nodeType.id);
                // Add inputs/outputs based on node type
                if (data.nodeType.id.includes('math')) {
                  this.setInput('a', 0);
                  this.setInput('b', 0);
                  this.setOutput('result', 0);
                } else if (data.nodeType.id.includes('flow')) {
                  this.setOutput('exec', null);
                }
              }

              execute() {
                // Simple execution logic
                if (this.type.includes('add')) {
                  const a = this.getInput('a') || 0;
                  const b = this.getInput('b') || 0;
                  this.setOutput('result', a + b);
                } else if (this.type.includes('multiply')) {
                  const a = this.getInput('a') || 0;
                  const b = this.getInput('b') || 0;
                  this.setOutput('result', a * b);
                }
              }
            })();
          }

          graph.addNode(node);
          setNodePositions(prev => new Map(prev.set(nodeId, { x, y })));
          onChange();
        }
      } catch (error) {
        console.error('Failed to handle drop:', error);
      }
    };

    const createConnectionPath = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const cpx1 = x1 + Math.abs(dx) * 0.5;
      const cpx2 = x2 - Math.abs(dx) * 0.5;

      return `M ${x1} ${y1} C ${cpx1} ${y1}, ${cpx2} ${y2}, ${x2} ${y2}`;
    };

    return (
      <CanvasContainer
        ref={canvasRef}
        data-canvas
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDrop={handleCanvasDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <CanvasViewport
          scale={viewTransform.scale}
          translateX={viewTransform.translateX}
          translateY={viewTransform.translateY}
        >
          {/* Render connections */}
          <ConnectionSVG>
            {graph.getAllConnections().map((connection: any) => {
              const fromNode = graph.getNode(connection.fromNodeId);
              const toNode = graph.getNode(connection.toNodeId);

              if (!fromNode || !toNode) return null;

              // Get actual pin positions (DOM lookup with fallback to calculation)
              const fromPos = getPinPosition(connection.fromNodeId, connection.fromPin, 'output');
              const toPos = getPinPosition(connection.toNodeId, connection.toPin, 'input');

              return (
                <ConnectionPath
                  key={connection.id}
                  d={createConnectionPath(fromPos.x, fromPos.y, toPos.x, toPos.y)}
                />
              );
            })}

            {/* Temporary connection while dragging */}
            {connecting.active && connecting.dragging && (
              <TempConnectionPath
                d={createConnectionPath(
                  connecting.startX,
                  connecting.startY,
                  connecting.currentX,
                  connecting.currentY
                )}
              />
            )}
          </ConnectionSVG>

          {/* Render nodes */}
          {graph.getAllNodes().map((node: any) => {
            const position = nodePositions.get(node.id) || { x: 100, y: 100 };
            return (
              <NodeComponent
                key={node.id}
                node={node}
                selected={selectedNodes.has(node.id)}
                position={position}
                viewTransform={viewTransform}
                isConnecting={connecting.active}
                onSelect={handleNodeSelect}
                onMove={handleNodeMove}
                onInputChange={handleInputChange}
                onPinMouseDown={handlePinMouseDown}
                onPinMouseUp={handlePinMouseUp}
              />
            );
          })}

          {/* Selection box */}
          <SelectionBox
            visible={selectionBox.visible}
            x={Math.min(selectionBox.startX, selectionBox.currentX)}
            y={Math.min(selectionBox.startY, selectionBox.currentY)}
            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
          />
        </CanvasViewport>
      </CanvasContainer>
    );
}

export default VisualCanvas;