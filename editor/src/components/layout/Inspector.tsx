import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import { useSelection } from '../../store/SelectionContext';

const InspectorContainer = styled.div`
  width: 300px;
  background-color: #252526;
  border-left: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const InspectorHeader = styled.div`
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

const InspectorContent = styled.div`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.h4`
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EmptyState = styled.div`
  color: #969696;
  font-size: 12px;
  text-align: center;
  padding: 20px;
`;

const EntityInfo = styled.div`
  padding: 8px;
  background-color: #2a2a2a;
  border-radius: 4px;
  margin-bottom: 8px;
`;

const EntityLabel = styled.div`
  color: #cccccc;
  font-size: 13px;
  margin-bottom: 8px;
`;

const ComponentList = styled.div`
  margin-top: 8px;
`;

const ComponentItem = styled.div`
  padding: 6px 8px;
  background-color: #1e1e1e;
  border-radius: 3px;
  margin-bottom: 4px;
  font-size: 11px;
  color: #cccccc;
`;

const MultiSelectInfo = styled.div`
  color: #969696;
  font-size: 12px;
  text-align: center;
  padding: 20px;
`;

const PropertyRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
`;

const PropertyLabel = styled.span`
  color: #969696;
`;

const PropertyValue = styled.span`
  color: #cccccc;
`;

function Inspector() {
  const { t } = useTranslation();
  const { selectedEntities, world } = useEditor();
  const { selectionType, selectedAsset } = useSelection();

  const renderSingleEntityInspector = (entity: number) => {
    return (
      <Section>
        <EntityInfo>
          <EntityLabel>
            {t('entities.entity')}: {entity}
          </EntityLabel>
          <div style={{ color: '#969696', fontSize: '12px' }}>
            {t('components.addComponent')}
          </div>
          <ComponentList>
            <ComponentItem>LocalTransform</ComponentItem>
            <ComponentItem>Sprite</ComponentItem>
          </ComponentList>
        </EntityInfo>
      </Section>
    );
  };

  const renderAssetInspector = () => {
    if (!selectedAsset) return null;

    const getFileSize = () => {
      // Mock file sizes based on type
      const sizeMB = Math.random() * 10 + 0.1;
      return `${sizeMB.toFixed(1)} MB`;
    };

    const getAssetDimensions = () => {
      if (selectedAsset.type === 'texture') {
        return `${Math.floor(Math.random() * 512 + 256)}x${Math.floor(Math.random() * 512 + 256)}`;
      }
      return null;
    };

    return (
      <Section>
        <EntityInfo>
          <EntityLabel>
            {selectedAsset.icon} {selectedAsset.name}
          </EntityLabel>
          <div style={{ marginTop: '8px' }}>
            <PropertyRow>
              <PropertyLabel>{t('properties.name')}:</PropertyLabel>
              <PropertyValue>{selectedAsset.name}</PropertyValue>
            </PropertyRow>
            <PropertyRow>
              <PropertyLabel>Type:</PropertyLabel>
              <PropertyValue>{selectedAsset.type}</PropertyValue>
            </PropertyRow>
            <PropertyRow>
              <PropertyLabel>Size:</PropertyLabel>
              <PropertyValue>{getFileSize()}</PropertyValue>
            </PropertyRow>
            {getAssetDimensions() && (
              <PropertyRow>
                <PropertyLabel>Dimensions:</PropertyLabel>
                <PropertyValue>{getAssetDimensions()}</PropertyValue>
              </PropertyRow>
            )}
          </div>
        </EntityInfo>
      </Section>
    );
  };

  const renderInspectorContent = () => {
    // Priority: Asset selection > Entity selection > Empty
    if (selectionType === 'asset' && selectedAsset) {
      return renderAssetInspector();
    }

    if (selectedEntities.length === 0) {
      return (
        <EmptyState>
          {t('entities.noEntitySelected')}
        </EmptyState>
      );
    }

    if (selectedEntities.length === 1) {
      return renderSingleEntityInspector(selectedEntities[0]);
    }

    return (
      <MultiSelectInfo>
        {selectedEntities.length} {t('entities.entitiesSelected')}
      </MultiSelectInfo>
    );
  };

  return (
    <InspectorContainer>
      <InspectorHeader>
        <HeaderTitle>{t('panels.inspector')}</HeaderTitle>
      </InspectorHeader>
      <InspectorContent>
        {renderInspectorContent()}
      </InspectorContent>
    </InspectorContainer>
  );
}

export default Inspector;