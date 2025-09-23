import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import { useSelection } from '../../store/SelectionContext';
import ProjectAssets from './ProjectAssets';

const SidebarContainer = styled.div`
  width: 300px;
  background-color: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  display: flex;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  padding: 8px 12px;
`;

const HeaderTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const HierarchyPanel = styled.div`
  flex: 0 0 35%; /* 固定占比35% */
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #3e3e42;
`;

const HierarchyContent = styled.div`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
`;

const AssetsPanel = styled.div`
  flex: 1; /* 剩余空间，约65% */
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EntityItem = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background-color: #2a2a2a;
  }

  &.selected {
    background-color: #094771;
  }
`;

const EntityIcon = styled.span`
  margin-right: 8px;
  font-size: 14px;
`;

const EntityName = styled.span`
  font-size: 13px;
  color: #cccccc;
`;

function Sidebar() {
  const { t } = useTranslation();
  const { entities, selectedEntities, selectEntity } = useEditor();
  const { selectAsset } = useSelection();

  const getEntityIcon = (entityIndex: number) => {
    const icons = ['📷', '💡', '🎮', '🏗️', '🌟'];
    return icons[entityIndex % icons.length];
  };

  const getEntityName = (entity: number, index: number) => {
    const nameKeys = ['entities.mainCamera', 'entities.directionalLight', 'entities.player', 'entities.gameObject', 'entities.entity'];
    const nameKey = nameKeys[index % nameKeys.length];
    return t(nameKey) + ` (${entity})`;
  };

  const handleEntityClick = (entity: number, event: React.MouseEvent) => {
    const multiSelect = event.ctrlKey || event.metaKey;
    selectEntity(entity, multiSelect);
  };

  const renderHierarchy = () => (
    <Section>
      <SectionTitle>{t('panels.hierarchy')}</SectionTitle>
      {entities.length === 0 ? (
        <div style={{ color: '#969696', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
          {t('entities.noEntities')}
        </div>
      ) : (
        entities.map((entity, index) => (
          <EntityItem
            key={entity}
            className={selectedEntities.includes(entity) ? 'selected' : ''}
            onClick={(e) => handleEntityClick(entity, e)}
          >
            <EntityIcon>{getEntityIcon(index)}</EntityIcon>
            <EntityName>{getEntityName(entity, index)}</EntityName>
          </EntityItem>
        ))
      )}
    </Section>
  );


  return (
    <SidebarContainer>
      <HierarchyPanel>
        <SidebarHeader>
          <HeaderTitle>{t('panels.hierarchy')}</HeaderTitle>
        </SidebarHeader>
        <HierarchyContent>
          {renderHierarchy()}
        </HierarchyContent>
      </HierarchyPanel>

      <AssetsPanel>
        <ProjectAssets onAssetSelect={selectAsset} />
      </AssetsPanel>
    </SidebarContainer>
  );
}

export default Sidebar;