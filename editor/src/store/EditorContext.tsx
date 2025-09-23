import React, { createContext, useContext, useEffect, useState } from 'react';
import { EditorWorld, EditorMode, EditorTool } from '../core/EditorWorld';
import type { Entity } from '@esengine/nova-ecs';
import { LocalTransform, Sprite, createColorSprite } from '@esengine/nova-ecs';
import { ProjectInfo } from '../services/ProjectService';

interface EditorContextType {
  world: EditorWorld;
  mode: EditorMode;
  tool: EditorTool;
  selectedEntities: Entity[];
  entities: Entity[];
  project: ProjectInfo | null;
  onCloseProject?: () => void;
  selectEntity: (entity: Entity, multiSelect?: boolean) => void;
  deselectEntity: (entity: Entity) => void;
  clearSelection: () => void;
  setMode: (mode: EditorMode) => void;
  setTool: (tool: EditorTool) => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

interface EditorProviderProps {
  children: React.ReactNode;
  project: ProjectInfo | null;
  onCloseProject?: () => void;
}

export function EditorProvider({ children, project, onCloseProject }: EditorProviderProps) {
  const [world] = useState(() => new EditorWorld());
  const [mode, setModeState] = useState<EditorMode>(EditorMode.Edit);
  const [tool, setToolState] = useState<EditorTool>(EditorTool.Select);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  const setMode = (newMode: EditorMode) => {
    world.setMode(newMode);
    setModeState(newMode);
  };

  const setTool = (newTool: EditorTool) => {
    world.setTool(newTool);
    setToolState(newTool);
  };

  const selectEntity = (entity: Entity, multiSelect = false) => {
    if (multiSelect) {
      world.selectEntities([entity], true); // additive selection
    } else {
      world.selectEntities([entity], false); // replace selection
    }
  };

  const deselectEntity = (entity: Entity) => {
    world.deselectEntities([entity]);
  };

  const clearSelection = () => {
    world.clearSelection();
  };

  useEffect(() => {
    // Initialize with existing entities and create some default ones if needed
    const initEntities = () => {
      let existingEntities = world.getAllEntities();
      if (existingEntities.length === 0) {
        // Create camera entity with components (editor camera already exists but add sprite for visualization)
        const camera = world.createEntity();
        const cameraTransform = new LocalTransform();
        cameraTransform.x = -100;
        cameraTransform.y = -100;
        world.addComponent(camera, LocalTransform, cameraTransform);
        world.addComponent(camera, Sprite, createColorSprite(0.3, 0.3, 1.0, 1.0, 50, 50)); // Blue camera

        // Create light entity
        const light = world.createEntity();
        const lightTransform = new LocalTransform();
        lightTransform.x = 100;
        lightTransform.y = -100;
        world.addComponent(light, LocalTransform, lightTransform);
        world.addComponent(light, Sprite, createColorSprite(1.0, 1.0, 0.3, 1.0, 40, 40)); // Yellow light

        // Create player entity
        const player = world.createEntity();
        const playerTransform = new LocalTransform();
        playerTransform.x = 0;
        playerTransform.y = 0;
        world.addComponent(player, LocalTransform, playerTransform);
        world.addComponent(player, Sprite, createColorSprite(0.3, 1.0, 0.3, 1.0, 60, 60)); // Green player

        existingEntities = world.getAllEntities();
      }
      setEntities(existingEntities);
    };

    initEntities();

    const handleSelectionChanged = (event: any) => {
      const newSelection = Array.from(world.getSelectedEntities());
      setSelectedEntities(newSelection);
    };

    const handleEntityCreated = () => {
      setEntities(world.getAllEntities());
    };

    const handleEntityDestroyed = () => {
      setEntities(world.getAllEntities());
    };

    world.addEventListener('selection-changed', handleSelectionChanged);
    world.addEventListener('entity-created', handleEntityCreated);
    world.addEventListener('entity-destroyed', handleEntityDestroyed);

    return () => {
      world.removeEventListener('selection-changed', handleSelectionChanged);
      world.removeEventListener('entity-created', handleEntityCreated);
      world.removeEventListener('entity-destroyed', handleEntityDestroyed);
    };
  }, [world]);

  const value: EditorContextType = {
    world,
    mode,
    tool,
    selectedEntities,
    entities,
    project,
    onCloseProject,
    selectEntity,
    deselectEntity,
    clearSelection,
    setMode,
    setTool
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}