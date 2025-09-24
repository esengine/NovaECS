import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { VisualGraph, type VisualGraphData } from '@esengine/nova-ecs';
import { useEditor } from '../../store/EditorContext';
import NodePalette from './NodePalette';
import VisualCanvas from './VisualCanvas';

const EditorContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  overflow: hidden;
`;

const Sidebar = styled.div`
  width: 250px;
  min-width: 250px;
  background-color: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const MainArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Toolbar = styled.div`
  height: 40px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
`;

const ToolbarButton = styled.button`
  background: none;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #3e3e42;
    border-color: #6c6c6c;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #cccccc;
  margin-right: auto;
`;

const StatusBar = styled.div`
  height: 24px;
  background-color: #007acc;
  color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
`;

interface VisualEditorProps {
  filePath?: string;
  onSave?: (data: VisualGraphData) => void;
  onClose?: () => void;
}

function VisualEditor({ filePath, onSave, onClose }: VisualEditorProps) {
  const { t } = useTranslation();
  const { openFiles, markFileDirty, markFileClean } = useEditor();
  const [graph, setGraph] = useState<VisualGraph | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Find the current file in openFiles
  const currentFile = openFiles.find(f => f.path === filePath);

  // Load graph from file
  useEffect(() => {
    const loadGraph = async () => {
      if (!filePath || !window.electronAPI?.readFile) {
        // Create new empty graph
        const newGraph = new VisualGraph('Untitled', 'New Visual Script');
        setGraph(newGraph);
        return;
      }

      setIsLoading(true);
      try {
        const content = await window.electronAPI.readFile(filePath);
        const data: VisualGraphData = JSON.parse(content);
        const loadedGraph = VisualGraph.deserialize(data);
        setGraph(loadedGraph);
      } catch (error) {
        console.error('Failed to load visual script:', error);
        // Create new graph on error
        const newGraph = new VisualGraph('Untitled', 'New Visual Script');
        setGraph(newGraph);
      } finally {
        setIsLoading(false);
      }
    };

    loadGraph();
  }, [filePath]);

  const handleSave = async () => {
    if (!graph) return;

    const data = graph.serialize();

    if (onSave) {
      onSave(data);
    }

    if (filePath && window.electronAPI?.writeFile) {
      try {
        await window.electronAPI.writeFile(filePath, JSON.stringify(data, null, 2));
        setIsDirty(false);

        // Mark file as clean in editor context
        if (currentFile) {
          markFileClean(currentFile.id);
        }
      } catch (error) {
        console.error('Failed to save visual script:', error);
      }
    }
  };

  const handleGraphChange = () => {
    setIsDirty(true);

    // Mark file as dirty in editor context
    if (currentFile) {
      markFileDirty(currentFile.id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      handleSave();
    }
    // Handle node deletion
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Let VisualCanvas handle the deletion through a custom event
      const deleteEvent = new CustomEvent('visual-delete-nodes');
      document.dispatchEvent(deleteEvent);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [graph]);

  if (isLoading) {
    return (
      <EditorContainer>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#cccccc'
        }}>
          {t('common.loading')}
        </div>
      </EditorContainer>
    );
  }

  if (!graph) {
    return (
      <EditorContainer>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#cccccc'
        }}>
          {t('common.error')}
        </div>
      </EditorContainer>
    );
  }

  return (
    <EditorContainer>
      <Sidebar>
        <NodePalette onNodeSelect={(nodeType) => {
          // TODO: Add node creation logic
          console.log('Selected node type:', nodeType);
        }} />
      </Sidebar>

      <MainArea>
        <Toolbar>
          <Title>
            {graph.name}{isDirty ? ' *' : ''}
          </Title>

          <ToolbarButton onClick={handleSave} disabled={!isDirty}>
            💾 {t('visual.toolbar.save')}
          </ToolbarButton>

          <ToolbarButton onClick={() => {
            // TODO: Add run logic
            console.log('Running graph...');
          }}>
            ▶️ {t('visual.toolbar.run')}
          </ToolbarButton>

          {onClose && (
            <ToolbarButton onClick={onClose}>
              ✕ {t('common.close')}
            </ToolbarButton>
          )}
        </Toolbar>

        <VisualCanvas
          graph={graph}
          onChange={handleGraphChange}
        />

        <StatusBar>
          {graph.getAllNodes().length} {t('visual.nodes.nodes')}, {graph.getAllConnections().length} {t('visual.nodes.connections')}
        </StatusBar>
      </MainArea>
    </EditorContainer>
  );
}

export default VisualEditor;