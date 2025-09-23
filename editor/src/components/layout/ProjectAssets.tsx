import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';

const AssetsContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #252526;
  border-top: 1px solid #3e3e42;
`;

const AssetsHeader = styled.div`
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

const AssetsContent = styled.div`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
`;

const FolderTree = styled.div`
  margin-bottom: 16px;
`;

const FolderItem = styled.div<{ level?: number; expanded?: boolean }>`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  padding-left: ${props => (props.level || 0) * 16 + 8}px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #cccccc;

  &:hover {
    background-color: #2a2a2a;
  }

  &.selected {
    background-color: #094771;
  }
`;

const FolderIcon = styled.span`
  margin-right: 8px;
  font-size: 12px;
  width: 16px;
  text-align: center;
`;

const FolderName = styled.span`
  flex: 1;
`;

const AssetList = styled.div`
  padding: 8px 0;
`;

const AssetItem = styled.div<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #cccccc;
  background-color: ${props => props.selected ? '#094771' : 'transparent'};

  &:hover {
    background-color: ${props => props.selected ? '#094771' : '#2a2a2a'};
  }
`;

const AssetIcon = styled.span`
  margin-right: 8px;
  font-size: 14px;
  width: 16px;
  text-align: center;
`;

const AssetName = styled.span`
  flex: 1;
`;

interface FolderData {
  name: string;
  icon: string;
  expanded: boolean;
  children?: FolderData[];
}

interface AssetData {
  name: string;
  type: 'texture' | 'script' | 'scene' | 'audio' | 'material';
  icon: string;
}

interface ProjectAssetsProps {
  onAssetSelect?: (asset: AssetData | null) => void;
}

function ProjectAssets({ onAssetSelect }: ProjectAssetsProps) {
  const { t } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState<string>('textures');
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [folders, setFolders] = useState<FolderData[]>([
    {
      name: 'Assets',
      icon: '📁',
      expanded: true,
      children: [
        { name: 'Textures', icon: '🖼️', expanded: false },
        { name: 'Scripts', icon: '📜', expanded: false },
        { name: 'Scenes', icon: '🎬', expanded: false },
        { name: 'Audio', icon: '🔊', expanded: false },
        { name: 'Materials', icon: '⚫', expanded: false }
      ]
    }
  ]);

  const [assets] = useState<AssetData[]>([
    { name: 'player.png', type: 'texture', icon: '🖼️' },
    { name: 'enemy.png', type: 'texture', icon: '🖼️' },
    { name: 'background.png', type: 'texture', icon: '🖼️' },
    { name: 'PlayerScript.ts', type: 'script', icon: '📜' },
    { name: 'GameManager.ts', type: 'script', icon: '📜' },
    { name: 'MainScene.scene', type: 'scene', icon: '🎬' },
    { name: 'MenuScene.scene', type: 'scene', icon: '🎬' },
    { name: 'bgm.mp3', type: 'audio', icon: '🔊' },
    { name: 'jump.wav', type: 'audio', icon: '🔊' }
  ]);

  const toggleFolder = (folderName: string, level: number = 0) => {
    const updateFolders = (items: FolderData[]): FolderData[] => {
      return items.map(folder => {
        if (folder.name === folderName) {
          return { ...folder, expanded: !folder.expanded };
        }
        if (folder.children) {
          return { ...folder, children: updateFolders(folder.children) };
        }
        return folder;
      });
    };
    setFolders(updateFolders(folders));
  };

  const renderFolder = (folder: FolderData, level: number = 0) => {
    const handleClick = () => {
      toggleFolder(folder.name, level);
      setSelectedFolder(folder.name.toLowerCase());
    };

    return (
      <div key={folder.name}>
        <FolderItem
          level={level}
          expanded={folder.expanded}
          onClick={handleClick}
          className={selectedFolder === folder.name.toLowerCase() ? 'selected' : ''}
        >
          <FolderIcon>
            {folder.children ? (folder.expanded ? '📂' : '📁') : folder.icon}
          </FolderIcon>
          <FolderName>{t(`project.${folder.name.toLowerCase()}`) || folder.name}</FolderName>
        </FolderItem>
        {folder.expanded && folder.children && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleAssetClick = (asset: AssetData) => {
    setSelectedAsset(asset);
    onAssetSelect?.(asset);
  };

  const getFilteredAssets = () => {
    const typeMap: Record<string, AssetData['type']> = {
      'textures': 'texture',
      'scripts': 'script',
      'scenes': 'scene',
      'audio': 'audio',
      'materials': 'material'
    };

    const filterType = typeMap[selectedFolder];
    return filterType ? assets.filter(asset => asset.type === filterType) : assets;
  };

  return (
    <AssetsContainer>
      <AssetsHeader>
        <HeaderTitle>{t('project.assets')}</HeaderTitle>
      </AssetsHeader>
      <AssetsContent>
        <FolderTree>
          {folders.map(folder => renderFolder(folder))}
        </FolderTree>

        <AssetList>
          {getFilteredAssets().map((asset, index) => (
            <AssetItem
              key={index}
              selected={selectedAsset === asset}
              onClick={() => handleAssetClick(asset)}
            >
              <AssetIcon>{asset.icon}</AssetIcon>
              <AssetName>{asset.name}</AssetName>
            </AssetItem>
          ))}
        </AssetList>
      </AssetsContent>
    </AssetsContainer>
  );
}

export default ProjectAssets;