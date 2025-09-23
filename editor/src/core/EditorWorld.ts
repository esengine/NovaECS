/**
 * EditorWorld - Extended World class for editor-specific functionality
 * EditorWorld - 扩展的World类，用于编辑器特定功能
 */

import { World } from '@esengine/nova-ecs';
import type { Entity, ComponentCtor } from '@esengine/nova-ecs';
import { EditorSelection } from '../components/EditorSelection';
import { EditorCamera } from '../components/EditorCamera';
// import { Gizmo } from '../components/Gizmo';
// import { GridSnap } from '../components/GridSnap';

/**
 * Editor mode enumeration
 * 编辑器模式枚举
 */
export enum EditorMode {
  Edit = 'edit',
  Play = 'play',
  Pause = 'pause'
}

/**
 * Editor tool enumeration
 * 编辑器工具枚举
 */
export enum EditorTool {
  Select = 'select',
  Move = 'move',
  Rotate = 'rotate',
  Scale = 'scale'
}

/**
 * Editor state interface
 * 编辑器状态接口
 */
export interface EditorState {
  mode: EditorMode;
  currentTool: EditorTool;
  selectedEntities: Set<Entity>;
  cameraEntity: Entity | null;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showGizmos: boolean;
  playStartTime: number;
}

/**
 * Editor event interface
 * 编辑器事件接口
 */
export interface EditorEvent {
  type: string;
  data?: any;
  timestamp: number;
}

/**
 * EditorWorld extends the base World with editor-specific functionality
 * EditorWorld扩展基础World类，添加编辑器特定功能
 */
export class EditorWorld extends World {
  private _editorState: EditorState;
  private _eventListeners = new Map<string, Array<(event: EditorEvent) => void>>();
  private _undoStack: EditorEvent[] = [];
  private _redoStack: EditorEvent[] = [];
  private _maxHistorySize = 100;
  private _trackedEntities: Entity[] = [];

  constructor() {
    super();

    this._editorState = {
      mode: EditorMode.Edit,
      currentTool: EditorTool.Select,
      selectedEntities: new Set(),
      cameraEntity: null,
      showGrid: true,
      gridSize: 32,
      snapToGrid: false,
      showGizmos: true,
      playStartTime: 0
    };

    // Initialize editor camera
    // 初始化编辑器相机
    this.initializeEditorCamera();
  }

  /**
   * Get current editor state
   * 获取当前编辑器状态
   */
  get editorState(): Readonly<EditorState> {
    return this._editorState;
  }

  /**
   * Set editor mode (edit/play/pause)
   * 设置编辑器模式（编辑/播放/暂停）
   */
  setMode(mode: EditorMode): void {
    if (this._editorState.mode === mode) return;

    const previousMode = this._editorState.mode;
    this._editorState.mode = mode;

    // Handle mode transitions
    // 处理模式转换
    if (mode === EditorMode.Play && previousMode === EditorMode.Edit) {
      this._editorState.playStartTime = performance.now();
      this.emitEvent('play-start', { previousMode });
    } else if (mode === EditorMode.Edit && previousMode !== EditorMode.Edit) {
      this.emitEvent('play-stop', { previousMode });
    }

    this.emitEvent('mode-changed', { mode, previousMode });
  }

  /**
   * Set current editing tool
   * 设置当前编辑工具
   */
  setTool(tool: EditorTool): void {
    if (this._editorState.currentTool === tool) return;

    const previousTool = this._editorState.currentTool;
    this._editorState.currentTool = tool;
    this.emitEvent('tool-changed', { tool, previousTool });
  }

  /**
   * Select entities
   * 选择实体
   */
  selectEntities(entities: Entity[], addToSelection = false): void {
    if (!addToSelection) {
      this.clearSelection();
    }

    const newSelections: Entity[] = [];
    for (const entity of entities) {
      if (entity && !this._editorState.selectedEntities.has(entity)) {
        this._editorState.selectedEntities.add(entity);
        this.addComponent(entity, EditorSelection);
        newSelections.push(entity);
      }
    }

    if (newSelections.length > 0) {
      this.emitEvent('selection-changed', {
        added: newSelections,
        selected: Array.from(this._editorState.selectedEntities)
      });
    }
  }

  /**
   * Deselect entities
   * 取消选择实体
   */
  deselectEntities(entities: Entity[]): void {
    const removed: Entity[] = [];
    for (const entity of entities) {
      if (this._editorState.selectedEntities.has(entity)) {
        this._editorState.selectedEntities.delete(entity);
        this.removeComponent(entity, EditorSelection);
        removed.push(entity);
      }
    }

    if (removed.length > 0) {
      this.emitEvent('selection-changed', {
        removed,
        selected: Array.from(this._editorState.selectedEntities)
      });
    }
  }

  /**
   * Clear all selections
   * 清除所有选择
   */
  clearSelection(): void {
    const previousSelection = Array.from(this._editorState.selectedEntities);
    for (const entity of Array.from(this._editorState.selectedEntities)) {
      this.removeComponent(entity, EditorSelection);
    }
    this._editorState.selectedEntities.clear();

    if (previousSelection.length > 0) {
      this.emitEvent('selection-changed', {
        removed: previousSelection,
        selected: []
      });
    }
  }

  /**
   * Get selected entities
   * 获取选中的实体
   */
  getSelectedEntities(): Entity[] {
    return Array.from(this._editorState.selectedEntities);
  }

  /**
   * Get all entities in the world
   * 获取世界中的所有实体
   */
  getAllEntities(): Entity[] {
    // For now, we'll track entities manually since we need to provide a simple interface
    // In the real implementation, this should be replaced with proper ECS entity iteration
    return this._trackedEntities || [];
  }

  /**
   * Check if entity is selected
   * 检查实体是否被选中
   */
  isSelected(entity: Entity): boolean {
    return this._editorState.selectedEntities.has(entity);
  }

  /**
   * Set grid properties
   * 设置网格属性
   */
  setGridSettings(showGrid: boolean, gridSize?: number, snapToGrid?: boolean): void {
    this._editorState.showGrid = showGrid;
    if (gridSize !== undefined) this._editorState.gridSize = gridSize;
    if (snapToGrid !== undefined) this._editorState.snapToGrid = snapToGrid;

    this.emitEvent('grid-settings-changed', {
      showGrid: this._editorState.showGrid,
      gridSize: this._editorState.gridSize,
      snapToGrid: this._editorState.snapToGrid
    });
  }

  /**
   * Initialize editor camera
   * 初始化编辑器相机
   */
  private initializeEditorCamera(): void {
    const camera = this.createEntity();
    this.addComponent(camera, EditorCamera, {
      zoom: 1.0,
      panSpeed: 1.0,
      zoomSpeed: 0.1,
      minZoom: 0.1,
      maxZoom: 10.0
    });
    this._editorState.cameraEntity = camera;
  }

  /**
   * Add event listener
   * 添加事件监听器
   */
  addEventListener(type: string, listener: (event: EditorEvent) => void): void {
    if (!this._eventListeners.has(type)) {
      this._eventListeners.set(type, []);
    }
    this._eventListeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   * 移除事件监听器
   */
  removeEventListener(type: string, listener: (event: EditorEvent) => void): void {
    const listeners = this._eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit editor event
   * 发射编辑器事件
   */
  private emitEvent(type: string, data?: any): void {
    const event: EditorEvent = {
      type,
      data,
      timestamp: performance.now()
    };

    const listeners = this._eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${type}:`, error);
        }
      }
    }
  }

  /**
   * Execute command with undo/redo support
   * 执行支持撤销/重做的命令
   */
  executeCommand(command: EditorEvent): void {
    // Clear redo stack when executing new command
    // 执行新命令时清除重做栈
    this._redoStack.length = 0;

    // Add to undo stack
    // 添加到撤销栈
    this._undoStack.push(command);
    if (this._undoStack.length > this._maxHistorySize) {
      this._undoStack.shift();
    }

    // Execute command
    // 执行命令
    this.emitEvent(command.type, command.data);
  }

  /**
   * Undo last command
   * 撤销上一个命令
   */
  undo(): boolean {
    const command = this._undoStack.pop();
    if (!command) return false;

    this._redoStack.push(command);
    this.emitEvent('undo', command);
    return true;
  }

  /**
   * Redo last undone command
   * 重做上一个撤销的命令
   */
  redo(): boolean {
    const command = this._redoStack.pop();
    if (!command) return false;

    this._undoStack.push(command);
    this.emitEvent('redo', command);
    return true;
  }

  /**
   * Check if undo is available
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Create entity with editor-specific logic
   * 创建实体并处理编辑器特定逻辑
   */
  createEntity(): Entity {
    const entity = super.createEntity();

    // Track the entity
    this._trackedEntities.push(entity);

    // Auto-select newly created entities in edit mode
    // 在编辑模式下自动选择新创建的实体
    if (this._editorState.mode === EditorMode.Edit) {
      this.selectEntities([entity]);
    }

    this.emitEvent('entity-created', { entity });
    return entity;
  }

  /**
   * Destroy entity with editor-specific cleanup
   * 销毁实体并处理编辑器特定清理
   */
  destroyEntity(entity: Entity): void {
    // Remove from selection if selected
    // 如果被选中则从选择中移除
    if (this._editorState.selectedEntities.has(entity)) {
      this.deselectEntities([entity]);
    }

    // Remove from tracked entities
    const index = this._trackedEntities.indexOf(entity);
    if (index !== -1) {
      this._trackedEntities.splice(index, 1);
    }

    this.emitEvent('entity-destroyed', { entity });
    super.destroyEntity(entity);
  }

  /**
   * Add component and emit events
   * 添加组件并发射事件
   */
  addComponent<T>(entity: Entity, ctor: ComponentCtor<T>, data?: Partial<T>): void {
    super.addComponent(entity, ctor, data);
    this.emitEvent('component-added', { entity, componentType: ctor, data });
  }

  /**
   * Remove component and emit events
   * 移除组件并发射事件
   */
  removeComponent<T>(entity: Entity, ctor: ComponentCtor<T>): void {
    const component = this.getComponent(entity, ctor);
    super.removeComponent(entity, ctor);
    this.emitEvent('component-removed', { entity, componentType: ctor, component });
  }
}