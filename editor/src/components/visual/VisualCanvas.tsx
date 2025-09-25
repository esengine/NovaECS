import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { VisualGraph, BaseVisualNode, NodeGenerator, Connection } from '@esengine/nova-ecs';
import NodeComponent, { NODE_LAYOUT, calculateHeaderHeight, calculatePinPosition } from './NodeComponent';
import { useSelection } from '../../store/SelectionContext';

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

const ConnectionSVG = styled.svg<{
  svgWidth: number;
  svgHeight: number;
  svgLeft: number;
  svgTop: number;
}>`
  position: absolute;
  top: ${props => props.svgTop}px;
  left: ${props => props.svgLeft}px;
  width: ${props => props.svgWidth}px;
  height: ${props => props.svgHeight}px;
  pointer-events: none;
  z-index: 1;

  path {
    pointer-events: stroke;
  }
`;

const ConnectionPath = styled.path<{ selected?: boolean; isHovered?: boolean }>`
  fill: none;
  stroke: ${props => props.selected ? '#FFD700' : props.isHovered ? '#00AAFF' : '#007acc'};
  stroke-width: ${props => props.selected ? 3 : 2};
  stroke-linecap: round;
  cursor: pointer;

  &:hover {
    stroke: ${props => props.selected ? '#FFD700' : '#00AAFF'};
    stroke-width: 3;
  }
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
    const { selectedConnection, selectConnection, clearSelection } = useSelection();
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

    // Calculate SVG bounds to cover all nodes
    const calculateSVGBounds = () => {
      if (nodePositions.size === 0) {
        return { left: 0, top: 0, width: 1000, height: 1000 };
      }

      let minX = 0, minY = 0, maxX = 1000, maxY = 1000;

      // Find the bounds of all nodes
      for (const [nodeId, pos] of nodePositions.entries()) {
        minX = Math.min(minX, pos.x - 100); // Add padding
        minY = Math.min(minY, pos.y - 100);
        maxX = Math.max(maxX, pos.x + 300); // Add node width + padding
        maxY = Math.max(maxY, pos.y + 200); // Add node height + padding
      }

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    };

    // Store node categories for color theming
    const [nodeCategories, setNodeCategories] = useState<Map<string, string>>(new Map());

    // Handle node and connection deletion
    useEffect(() => {
      const handleDeleteNodes = () => {
        if (selectedNodes.size > 0) {
          // Delete all selected nodes
          for (const nodeId of selectedNodes) {
            graph.removeNode(nodeId);
            setNodeCategories(prev => {
              const newCategories = new Map(prev);
              newCategories.delete(nodeId);
              return newCategories;
            });
          }
          setSelectedNodes(new Set());
          onChange();
        }
      };

      const handleDeleteConnections = () => {
        if (selectedConnection) {
          // Delete the selected connection
          graph.removeConnection(selectedConnection.id);
          clearSelection();
          onChange();
        }
      };

      const handleDelete = () => {
        // Handle connection deletion first, then node deletion
        if (selectedConnection) {
          handleDeleteConnections();
        } else if (selectedNodes.size > 0) {
          handleDeleteNodes();
        }
      };

      document.addEventListener('visual-delete-nodes', handleDeleteNodes);
      document.addEventListener('visual-delete-connections', handleDeleteConnections);
      document.addEventListener('visual-delete', handleDelete);

      return () => {
        document.removeEventListener('visual-delete-nodes', handleDeleteNodes);
        document.removeEventListener('visual-delete-connections', handleDeleteConnections);
        document.removeEventListener('visual-delete', handleDelete);
      };
    }, [selectedNodes, selectedConnection, graph, onChange, clearSelection]);


    // Get pin position using pure DOM queries
    const getPinPosition = (nodeId: string, pinName: string, pinType: 'input' | 'output') => {
      const pinSelector = `[data-pin="${pinType}"][data-node="${nodeId}"][data-pin-name="${pinName}"]`;
      const pinElement = document.querySelector(pinSelector) as HTMLElement;

      if (pinElement && canvasRef.current) {
        const pinRect = pinElement.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();

        const pinCenterX = (pinRect.left + pinRect.width / 2 - canvasRect.left - viewTransform.translateX) / viewTransform.scale;
        const pinCenterY = (pinRect.top + pinRect.height / 2 - canvasRect.top - viewTransform.translateY) / viewTransform.scale;

        return { x: pinCenterX, y: pinCenterY };
      }

      // Fallback to calculated position if DOM element not found
      return calculateNodePinPosition(nodeId, pinName, pinType);
    };

    // Calculate pin position using dynamic layout calculation
    const calculateNodePinPosition = (nodeId: string, pinName: string, pinType: 'input' | 'output') => {
      const node = graph.getNode(nodeId);
      const nodePos = nodePositions.get(nodeId) ||
                    (node && node.position ? { x: node.position.x, y: node.position.y } : null);

      if (!node || !nodePos) return { x: 0, y: 0 };

      // Get node metadata for accurate size calculation
      let nodeMetadata = undefined;
      if (node.getMetadata) {
        try {
          const rawMetadata = node.getMetadata();
          if (rawMetadata) {
            nodeMetadata = NodeGenerator.resolveI18nMetadata(rawMetadata);
          }
        } catch (e) {
          // Ignore metadata errors
        }
      }

      const pins = pinType === 'input' ? Array.from(node.inputs.keys()) : Array.from(node.outputs.keys());
      const pinIndex = pins.indexOf(pinName);
      if (pinIndex === -1) return { x: 0, y: 0 };

      // Calculate header height based on node content
      const title = nodeMetadata?.title || node.type;
      const description = nodeMetadata?.description;
      const headerHeight = calculateHeaderHeight(title, description);

      // Estimate node width based on content
      const estimateNodeWidth = (title: string, description?: string, inputCount = 0, outputCount = 0): number => {
        // Calculate width based on title
        let titleWidth = title.length * 7 + 50; // 7px per char + margins + icon

        // Consider description width
        if (description) {
          const maxDescWidth = Math.max(...description.split(' ').map(word => word.length * 6));
          titleWidth = Math.max(titleWidth, maxDescWidth + 40);
        }

        // Consider pin labels (they affect minimum width)
        const maxPinWidth = Math.max(inputCount, outputCount) * 80; // rough estimate

        return Math.min(
          NODE_LAYOUT.MAX_WIDTH,
          Math.max(NODE_LAYOUT.MIN_WIDTH, Math.max(titleWidth, maxPinWidth))
        );
      };

      const inputCount = Array.from(node.inputs.keys()).length;
      const outputCount = Array.from(node.outputs.keys()).length;
      let nodeWidth = estimateNodeWidth(title, description, inputCount, outputCount);

      // Try to get actual node width from DOM
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        const actualWidth = rect.width / viewTransform.scale;
        if (actualWidth > 0 && actualWidth < NODE_LAYOUT.MAX_WIDTH * 2) {
          nodeWidth = actualWidth;
        }
      }

      // Calculate accurate pin position
      return calculatePinPosition(nodePos, headerHeight, pinIndex, pinType, nodeWidth);
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
        const rawData = event.dataTransfer.getData('application/json');

        if (!rawData || rawData.trim() === '') {
          console.warn('Drop operation failed: No drag data available');
          return;
        }

        const data = JSON.parse(rawData);

        if (!data || typeof data !== 'object') {
          console.warn('Drop operation failed: Invalid data format');
          return;
        }

        if (data.type === 'node') {
          if (!data.nodeType || typeof data.nodeType !== 'object' || !data.nodeType.id) {
            console.warn('Drop operation failed: Invalid node type data');
            return;
          }

          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;

          const x = (event.clientX - rect.left - viewTransform.translateX) / viewTransform.scale;
          const y = (event.clientY - rect.top - viewTransform.translateY) / viewTransform.scale;

          const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Create node using NodeGenerator for proper type registration
          let node: BaseVisualNode;

          // Create node using NodeGenerator (handles ECS nodes properly via metadata)
          node = NodeGenerator.createNode(data.nodeType.id, nodeId);

          graph.addNode(node);
          setNodePositions(prev => new Map(prev.set(nodeId, { x, y })));

          // Store node category for color theming
          if (data.nodeType.category) {
            setNodeCategories(prev => new Map(prev.set(nodeId, data.nodeType.category)));
          }

          onChange();
        } else {
          console.warn('Drop operation failed: Unsupported data type:', data.type);
        }
      } catch (error) {
        console.error('Failed to handle drop:', error);
        console.error('Raw drag data was:', event.dataTransfer.getData('application/json'));
      }
    };

    const createConnectionPath = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;

      // Adjust control point distance based on connection direction and distance
      let controlOffset = Math.max(80, Math.abs(dx) * 0.3);

      // For reverse connections (left to right pin), reduce curve intensity
      if (dx < 0) {
        controlOffset = Math.min(controlOffset, 120);
      }

      // For very close connections, reduce curve
      if (Math.abs(dx) < 100) {
        controlOffset = Math.max(30, Math.abs(dx) * 0.5);
      }

      const cpx1 = x1 + controlOffset;
      const cpx2 = x2 - controlOffset;

      return `M ${x1} ${y1} C ${cpx1} ${y1}, ${cpx2} ${y2}, ${x2} ${y2}`;
    };

    // Handle connection click
    const handleConnectionClick = (connection: Connection, event: React.MouseEvent) => {
      event.stopPropagation();
      selectConnection(connection);
    };

    const svgBounds = calculateSVGBounds();

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
          <ConnectionSVG
            svgWidth={svgBounds.width}
            svgHeight={svgBounds.height}
            svgLeft={svgBounds.left}
            svgTop={svgBounds.top}
          >
            {graph.getAllConnections().map((connection: any) => {
              const fromNode = graph.getNode(connection.fromNodeId);
              const toNode = graph.getNode(connection.toNodeId);

              if (!fromNode || !toNode) return null;

              // Get actual pin positions (DOM lookup with fallback to calculation)
              const fromPos = getPinPosition(connection.fromNodeId, connection.fromPin, 'output');
              const toPos = getPinPosition(connection.toNodeId, connection.toPin, 'input');

              // Adjust coordinates relative to SVG bounds
              const adjustedFromX = fromPos.x - svgBounds.left;
              const adjustedFromY = fromPos.y - svgBounds.top;
              const adjustedToX = toPos.x - svgBounds.left;
              const adjustedToY = toPos.y - svgBounds.top;

              const isSelected = selectedConnection?.id === connection.id;

              return (
                <ConnectionPath
                  key={connection.id}
                  d={createConnectionPath(adjustedFromX, adjustedFromY, adjustedToX, adjustedToY)}
                  selected={isSelected}
                  onClick={(e) => handleConnectionClick(connection, e)}
                />
              );
            })}

            {/* Temporary connection while dragging */}
            {connecting.active && connecting.dragging && (
              <TempConnectionPath
                d={createConnectionPath(
                  connecting.startX - svgBounds.left,
                  connecting.startY - svgBounds.top,
                  connecting.currentX - svgBounds.left,
                  connecting.currentY - svgBounds.top
                )}
              />
            )}
          </ConnectionSVG>

          {/* Render nodes */}
          {graph.getAllNodes().map((node: any) => {
            // Check if we have a stored position, otherwise use node's position property or default
            const position = nodePositions.get(node.id) ||
                           (node.position ? { x: node.position.x, y: node.position.y } : { x: 100, y: 100 });

            // Try to get node metadata if available and resolve i18n
            let nodeMetadata = undefined;
            if (node.getMetadata) {
              try {
                const rawMetadata = node.getMetadata();
                if (rawMetadata) {
                  // Resolve i18n keys to actual text
                  nodeMetadata = NodeGenerator.resolveI18nMetadata(rawMetadata);
                }
              } catch (e) {
                // Ignore errors when getting metadata
              }
            }

            return (
              <NodeComponent
                key={node.id}
                node={node}
                selected={selectedNodes.has(node.id)}
                position={position}
                viewTransform={viewTransform}
                isConnecting={connecting.active}
                category={nodeCategories.get(node.id)}
                metadata={nodeMetadata}
                connections={graph.getAllConnections()}
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