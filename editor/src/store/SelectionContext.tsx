import React, { createContext, useContext, useState } from 'react';
import type { Entity } from '@esengine/nova-ecs';
import type { AssetData } from '../types/assets';

type SelectionType = 'entity' | 'asset' | null;

interface SelectionContextType {
  selectionType: SelectionType;
  selectedEntity: Entity | null;
  selectedAsset: AssetData | null;
  selectEntity: (entity: Entity | null) => void;
  selectAsset: (asset: AssetData | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectionType, setSelectionType] = useState<SelectionType>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);

  const selectEntity = (entity: Entity | null) => {
    setSelectedEntity(entity);
    setSelectedAsset(null);
    setSelectionType(entity ? 'entity' : null);
  };

  const selectAsset = (asset: AssetData | null) => {
    setSelectedAsset(asset);
    setSelectedEntity(null);
    setSelectionType(asset ? 'asset' : null);
  };

  const clearSelection = () => {
    setSelectedEntity(null);
    setSelectedAsset(null);
    setSelectionType(null);
  };

  const value: SelectionContextType = {
    selectionType,
    selectedEntity,
    selectedAsset,
    selectEntity,
    selectAsset,
    clearSelection
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

export type { AssetData };