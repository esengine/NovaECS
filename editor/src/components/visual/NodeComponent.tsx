import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import type { VisualNode } from '@esengine/nova-ecs';

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

const NodeHeader = styled.div`
  background-color: #094771;
  padding: 8px 12px;
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid #3e3e42;
`;

const NodeTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
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
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.connected ? '#007acc' : '#6c6c6c'};
  border: 2px solid #2d2d30;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background-color: #007acc;
    transform: scale(1.2);
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
`;

const InputField = styled.input`
  background-color: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #cccccc;
  font-size: 11px;
  padding: 2px 6px;
  width: 60px;
  margin: 0 4px;

  &:focus {
    outline: none;
    border-color: #007acc;
  }
`;

interface NodeComponentProps {
  node: VisualNode;
  selected: boolean;
  position: { x: number; y: number };
  viewTransform: { scale: number; translateX: number; translateY: number };
  isConnecting: boolean;
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
    const hasConnection = false; // TODO: Check if pin has connection
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
        <PinLabel type="input">{inputName}</PinLabel>
        {showInputField && (
          <InputField
            type="text"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleInputChange(inputName, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </PinRow>
    );
  };

  const renderOutputPin = (outputName: string) => {
    const hasConnection = false; // TODO: Check if pin has connection

    return (
      <PinRow key={`output-${outputName}`}>
        <PinLabel type="output">{outputName}</PinLabel>
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
    >
      <NodeHeader>
        <NodeTitle>
          <NodeIcon>⚙️</NodeIcon>
          {node.type}
        </NodeTitle>
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