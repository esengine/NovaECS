import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { SelectionProvider } from '../../store/SelectionContext';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import SceneView from './SceneView';
import Inspector from './Inspector';
import StatusBar from './StatusBar';

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

function EditorLayout() {
  const { t: _t } = useTranslation();

  return (
    <SelectionProvider>
      <LayoutContainer>
        <Toolbar />
        <MainContent>
          <Sidebar />
          <CenterPanel>
            <SceneView />
          </CenterPanel>
          <Inspector />
        </MainContent>
        <StatusBar />
      </LayoutContainer>
    </SelectionProvider>
  );
}

export default EditorLayout;