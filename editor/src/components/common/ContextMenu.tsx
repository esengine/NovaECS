import { useState, useEffect, useRef } from 'react';
import styled from '@emotion/styled';

const MenuContainer = styled.div<{ x: number; y: number; visible: boolean }>`
  position: fixed;
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  min-width: 180px;
  opacity: ${props => props.visible ? 1 : 0};
  visibility: ${props => props.visible ? 'visible' : 'hidden'};
  transition: opacity 0.15s ease-out, visibility 0.15s ease-out;
`;

const MenuItem = styled.div<{ disabled?: boolean }>`
  padding: 8px 16px;
  font-size: 13px;
  color: ${props => props.disabled ? '#6c6c6c' : '#cccccc'};
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  display: flex;
  align-items: center;

  &:hover {
    background-color: ${props => props.disabled ? 'transparent' : '#094771'};
  }

  &:first-of-type {
    border-radius: 4px 4px 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 4px 4px;
  }
`;

const MenuIcon = styled.span`
  margin-right: 8px;
  font-size: 14px;
  width: 16px;
  text-align: center;
`;

const MenuText = styled.span`
  flex: 1;
`;

const MenuSeparator = styled.div`
  height: 1px;
  background-color: #3e3e42;
  margin: 4px 0;
`;

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
}

function ContextMenu({ items, visible, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (visible && menuRef.current) {
      // Adjust position to keep menu within viewport
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x: adjustedX, y: adjustedY });
    }
  }, [visible, x, y]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && item.onClick) {
      item.onClick();
      onClose();
    }
  };

  return (
    <MenuContainer
      ref={menuRef}
      x={adjustedPosition.x}
      y={adjustedPosition.y}
      visible={visible}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <MenuSeparator key={`separator-${index}`} />;
        }

        return (
          <MenuItem
            key={item.id}
            disabled={item.disabled}
            onClick={() => handleItemClick(item)}
          >
            {item.icon && <MenuIcon>{item.icon}</MenuIcon>}
            <MenuText>{item.label}</MenuText>
          </MenuItem>
        );
      })}
    </MenuContainer>
  );
}

export default ContextMenu;