import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { SelectionProvider } from '../../store/SelectionContext';
import { useEditor } from '../../store/EditorContext';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import SceneView from './SceneView';
import Inspector from './Inspector';
import StatusBar from './StatusBar';
import VisualEditor from '../visual/VisualEditor';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #2b2b2b;
  color: #cccccc;
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const CenterPanel = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const TabBar = styled.div`
  display: flex;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  min-height: 35px;
  overflow-x: auto;
`;

const Tab = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: ${props => props.active ? '#1e1e1e' : 'transparent'};
  border-right: 1px solid #3e3e42;
  cursor: pointer;
  font-size: 13px;
  color: ${props => props.active ? '#ffffff' : '#cccccc'};
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background-color: ${props => props.active ? '#1e1e1e' : '#2a2a2a'};
  }
`;

const TabCloseButton = styled.button`
  background: none;
  border: none;
  color: #6c6c6c;
  margin-left: 8px;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  font-size: 12px;

  &:hover {
    background-color: #3e3e42;
    color: #cccccc;
  }
`;

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

function EditorLayout() {
  const { t: _t } = useTranslation();
  const { openFiles, activeFileId, setActiveFile, closeFile, markFileClean } = useEditor();

  const activeFile = openFiles.find(f => f.id === activeFileId);

  const renderEditor = () => {
    if (!activeFile) {
      return <SceneView />;
    }

    switch (activeFile.type) {
      case 'visual':
        return (
          <VisualEditor
            filePath={activeFile.path}
            onSave={(_data) => {
              markFileClean(activeFile.id);
            }}
          />
        );
      case 'scene':
        return <SceneView />;
      default:
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#cccccc',
            backgroundColor: '#1e1e1e'
          }}>
            Editor for {activeFile.type} files not implemented yet
          </div>
        );
    }
  };

  return (
    <SelectionProvider>
      <LayoutContainer>
        <Toolbar />
        <MainContent>
          <Sidebar />
          <CenterPanel>
            {openFiles.length > 0 && (
              <TabBar>
                {openFiles.map(file => (
                  <Tab
                    key={file.id}
                    active={file.id === activeFileId}
                    onClick={() => setActiveFile(file.id)}
                  >
                    {file.name}{file.isDirty ? ' *' : ''}
                    <TabCloseButton
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(file.id);
                      }}
                    >
                      ✕
                    </TabCloseButton>
                  </Tab>
                ))}
              </TabBar>
            )}
            <EditorArea>
              {renderEditor()}
            </EditorArea>
          </CenterPanel>
          <Inspector />
        </MainContent>
        <StatusBar />
      </LayoutContainer>
    </SelectionProvider>
  );
}

export default EditorLayout;