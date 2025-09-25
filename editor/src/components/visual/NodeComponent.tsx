import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import type { VisualNode, VisualMethodMetadata, Connection } from '@esengine/nova-ecs';
import { getCategoryColors } from '../../utils/categoryColors';
import { Settings } from '../../utils/icons';

// Node layout constants for accurate position calculation
// 节点布局常量，用于精确位置计算
export const NODE_LAYOUT = {
  MIN_WIDTH: 150,
  MAX_WIDTH: 220,
  HEADER_BASE_HEIGHT: 32, // Base header height without description
  DESCRIPTION_LINE_HEIGHT: 13,
  DESCRIPTION_CHARS_PER_LINE: 28, // Approximate characters per line
  BODY_PADDING: 8,
  PIN_ROW_HEIGHT: 24,
  PIN_SIZE: 16,
  PIN_MARGIN_LEFT: 8,
  PIN_MARGIN_RIGHT: 8,
  PIN_CENTER_OFFSET: 12 // Offset to pin center from row top
} as const;

// Utility functions for pin position calculation
// 引脚位置计算工具函数

/**
 * Calculate the actual header height including description
 * 计算包含描述的实际头部高度
 */
export const calculateHeaderHeight = (title: string, description?: string): number => {
  let height = NODE_LAYOUT.HEADER_BASE_HEIGHT;

  if (description) {
    const descriptionLines = Math.ceil(description.length / NODE_LAYOUT.DESCRIPTION_CHARS_PER_LINE);
    height += descriptionLines * NODE_LAYOUT.DESCRIPTION_LINE_HEIGHT;
  }

  return height;
};

/**
 * Calculate pin position relative to node position
 * 计算相对于节点位置的引脚位置
 */
export const calculatePinPosition = (
  nodePos: { x: number; y: number },
  headerHeight: number,
  pinIndex: number,
  pinType: 'input' | 'output',
  nodeWidth: number = NODE_LAYOUT.MIN_WIDTH
): { x: number; y: number } => {
  const pinY = nodePos.y + headerHeight + NODE_LAYOUT.BODY_PADDING +
               (pinIndex * NODE_LAYOUT.PIN_ROW_HEIGHT) + NODE_LAYOUT.PIN_CENTER_OFFSET;

  const pinX = pinType === 'output'
    ? nodePos.x + nodeWidth - NODE_LAYOUT.PIN_MARGIN_RIGHT - (NODE_LAYOUT.PIN_SIZE / 2)
    : nodePos.x + NODE_LAYOUT.PIN_MARGIN_LEFT + (NODE_LAYOUT.PIN_SIZE / 2);

  return { x: pinX, y: pinY };
};

const NodeContainer = styled.div<{
  selected: boolean;
  x: number;
  y: number;
  isDragging: boolean;
}>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  min-width: 150px;
  max-width: 220px;
  background-color: #2d2d30;
  border: 2px solid ${props => props.selected ? '#007acc' : '#3e3e42'};
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  cursor: ${props => props.isDragging ? 'grabbing' : 'grab'};
  user-select: none;
  transition: ${props => props.isDragging ? 'none' : 'border-color 0.2s'};

  &:hover {
    border-color: ${props => props.selected ? '#007acc' : '#6c6c6c'};
  }
`;

const NodeHeader = styled.div<{
  backgroundColor: string;
  hoverColor: string;
  textColor: string;
}>`
  background-color: ${props => props.backgroundColor};
  color: ${props => props.textColor};
  padding: 8px 12px;
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid #3e3e42;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.hoverColor};
  }
`;

const NodeTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const NodeDescription = styled.div`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4px;
  line-height: 1.3;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
  max-width: 100%;
`;

const NodeIcon = styled.span`
  font-size: 14px;
`;

const NodeBody = styled.div`
  padding: 8px;
`;

const PinList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PinRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
`;

const Pin = styled.div<{ type: 'input' | 'output'; connected: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: ${props => props.connected ? '#007acc' : '#6c6c6c'};
  border: 2px solid #2d2d30;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  box-sizing: border-box;

  /* Increase clickable area with pseudo-element */
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    border-radius: 50%;
    cursor: pointer;
  }

  &:hover {
    background-color: #007acc;
    transform: scale(1.3);
    border-width: 3px;
  }

  &:active {
    transform: scale(1.1);
  }

  ${props => props.type === 'input' && `
    margin-right: auto;
  `}

  ${props => props.type === 'output' && `
    margin-left: auto;
  `}
`;

const PinLabel = styled.span<{ type: 'input' | 'output' }>`
  font-size: 11px;
  color: #cccccc;
  ${props => props.type === 'input' ? 'margin-left: 8px;' : 'margin-right: 8px;'}
  display: flex;
  flex-direction: column;
  align-items: ${props => props.type === 'input' ? 'flex-start' : 'flex-end'};
  gap: 2px;
`;

const PinName = styled.span`
  font-weight: 500;
`;

const PinType = styled.span`
  font-size: 9px;
  color: #888;
  text-transform: uppercase;
`;

const InputField = styled.input<{ isReadOnly: boolean }>`
  background-color: ${props => props.isReadOnly ? '#2a2a2a' : '#3c3c3c'};
  border: 1px solid ${props => props.isReadOnly ? '#444' : '#3e3e42'};
  border-radius: 3px;
  color: ${props => props.isReadOnly ? '#888' : '#cccccc'};
  font-size: 11px;
  padding: 2px 6px;
  width: 60px;
  margin: 0 4px;
  cursor: ${props => props.isReadOnly ? 'not-allowed' : 'text'};

  &:focus {
    outline: none;
    border-color: ${props => props.isReadOnly ? '#444' : '#007acc'};
  }
`;

interface NodeComponentProps {
  node: VisualNode;
  selected: boolean;
  position: { x: number; y: number };
  viewTransform: { scale: number; translateX: number; translateY: number };
  isConnecting: boolean;
  category?: string; // Node category for color theming
  metadata?: VisualMethodMetadata; // Node metadata for displaying types and description
  connections?: Connection[]; // All connections to check for pin connections
  onSelect: (nodeId: string) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onInputChange: (nodeId: string, inputName: string, value: any) => void;
  onPinMouseDown: (nodeId: string, pinName: string, pinType: 'input' | 'output', event: React.MouseEvent) => void;
  onPinMouseUp: (nodeId: string, pinName: string, pinType: 'input' | 'output', event: React.MouseEvent) => void;
}

function NodeComponent({
  node,
  selected,
  position,
  viewTransform,
  isConnecting,
  category,
  metadata,
  connections = [],
  onSelect,
  onMove,
  onInputChange,
  onPinMouseDown,
  onPinMouseUp
}: NodeComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left click

    // Don't start dragging if we're in connecting mode
    if (isConnecting) {
      return;
    }

    // Check if the click target is a pin or input field - if so, don't start dragging
    const target = event.target as HTMLElement;
    if (target.closest('[data-pin]') || target.closest('input')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    onSelect(node.id);

    const canvas = nodeRef.current?.closest('[data-canvas]');
    const rect = nodeRef.current?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();

    if (rect && canvasRect) {
      // Calculate offset in world coordinates
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;
      const worldX = (canvasX - viewTransform.translateX) / viewTransform.scale;
      const worldY = (canvasY - viewTransform.translateY) / viewTransform.scale;

      setDragOffset({
        x: worldX - position.x,
        y: worldY - position.y
      });
    }

    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;

      const canvas = nodeRef.current?.closest('[data-canvas]');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();

      // Calculate position in canvas coordinates, considering view transform
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;

      // Convert to world coordinates (accounting for scale and translate)
      const worldX = (canvasX - viewTransform.translateX) / viewTransform.scale;
      const worldY = (canvasY - viewTransform.translateY) / viewTransform.scale;

      // Subtract the drag offset to get the node's top-left position
      const newX = worldX - dragOffset.x;
      const newY = worldY - dragOffset.y;

      onMove(node.id, newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, node.id, onMove, viewTransform]);

  // Check if this is a system node and use special colors
  const isSystemNode = node.id === '__system_start__' || node.id === '__system_end__';
  const systemColors = isSystemNode ? (
    node.id === '__system_start__' ? {
      primary: '#10B981',   // Green for start
      secondary: '#059669',
      border: '#059669',
      text: '#FFFFFF'
    } : {
      primary: '#EF4444',   // Red for end
      secondary: '#DC2626',
      border: '#DC2626',
      text: '#FFFFFF'
    }
  ) : null;

  // Get category colors (use system colors for system nodes)
  const categoryColors = systemColors || getCategoryColors(category || 'Uncategorized');

  // Check if a pin is connected
  const isPinConnected = (pinName: string, pinType: 'input' | 'output'): boolean => {
    return connections.some(conn => {
      if (pinType === 'input') {
        return conn.toNodeId === node.id && conn.toPin === pinName;
      } else {
        return conn.fromNodeId === node.id && conn.fromPin === pinName;
      }
    });
  };

  // Get pin type from metadata
  const getPinType = (pinName: string, pinType: 'input' | 'output'): string => {
    if (!metadata) return 'any';

    const pins = pinType === 'input' ? metadata.inputs : metadata.outputs;
    // The metadata should already be resolved by NodeGenerator.resolveI18nMetadata
    // So we just need to match by the resolved label
    const pinConfig = pins.find(p => p.label === pinName);
    return pinConfig?.type || 'any';
  };

  const handleInputChange = (inputName: string, value: string) => {
    // Try to parse as number if possible
    let parsedValue: any = value;
    if (!isNaN(Number(value)) && value !== '') {
      parsedValue = Number(value);
    } else if (value === 'true' || value === 'false') {
      parsedValue = value === 'true';
    }

    onInputChange(node.id, inputName, parsedValue);
  };

  const renderInputPin = (inputName: string, value: any) => {
    const hasConnection = isPinConnected(inputName, 'input');
    const pinType = getPinType(inputName, 'input');
    const showInputField = !hasConnection;

    return (
      <PinRow key={`input-${inputName}`}>
        <Pin
          type="input"
          connected={hasConnection}
          data-pin="input"
          data-node={node.id}
          data-pin-name={inputName}
          onMouseDown={(e) => {
            onPinMouseDown(node.id, inputName, 'input', e);
          }}
          onMouseUp={(e) => {
            onPinMouseUp(node.id, inputName, 'input', e);
          }}
        />
        <PinLabel type="input">
          <PinName>{inputName}</PinName>
          <PinType>{pinType}</PinType>
        </PinLabel>
        {showInputField && (
          <InputField
            type="text"
            value={value !== undefined ? String(value) : ''}
            isReadOnly={hasConnection}
            readOnly={hasConnection}
            onChange={(e) => !hasConnection && handleInputChange(inputName, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {hasConnection && (
          <div style={{
            fontSize: '10px',
            color: '#888',
            marginLeft: '4px',
            fontStyle: 'italic'
          }}>
            Connected
          </div>
        )}
      </PinRow>
    );
  };

  const renderOutputPin = (outputName: string) => {
    const hasConnection = isPinConnected(outputName, 'output');
    const pinType = getPinType(outputName, 'output');

    return (
      <PinRow key={`output-${outputName}`}>
        <PinLabel type="output">
          <PinName>{outputName}</PinName>
          <PinType>{pinType}</PinType>
        </PinLabel>
        <Pin
          type="output"
          connected={hasConnection}
          data-pin="output"
          data-node={node.id}
          data-pin-name={outputName}
          onMouseDown={(e) => {
            onPinMouseDown(node.id, outputName, 'output', e);
          }}
          onMouseUp={(e) => {
            onPinMouseUp(node.id, outputName, 'output', e);
          }}
        />
      </PinRow>
    );
  };

  return (
    <NodeContainer
      ref={nodeRef}
      selected={selected}
      x={position.x}
      y={position.y}
      isDragging={isDragging}
      onMouseDown={handleMouseDown}
      data-node-id={node.id}
    >
      <NodeHeader
        backgroundColor={categoryColors.primary}
        hoverColor={categoryColors.secondary}
        textColor={categoryColors.text}
      >
        <NodeTitle>
          <NodeIcon>{metadata?.icon || <Settings size={16} />}</NodeIcon>
          {metadata?.title || node.type}
        </NodeTitle>
        {metadata?.description && (
          <NodeDescription>
            {metadata.description}
          </NodeDescription>
        )}
      </NodeHeader>

      <NodeBody>
        <PinList>
          {/* Render input pins */}
          {Array.from(node.inputs.entries()).map(([inputName, value]: [string, any]) =>
            renderInputPin(inputName, value)
          )}

          {/* Render output pins */}
          {Array.from(node.outputs.keys()).map((outputName: string) =>
            renderOutputPin(outputName)
          )}
        </PinList>
      </NodeBody>
    </NodeContainer>
  );
}

export default NodeComponent;