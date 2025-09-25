import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import type { AssetData, FolderData } from '../../types/assets';
import ContextMenu, { type ContextMenuItem } from '../common/ContextMenu';
import { File, FileText, Image, Video, Volume2, Circle, Link, Folder, FolderOpen, Trash2 } from '../../utils/icons';

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


interface ProjectAssetsProps {
  onAssetSelect?: (asset: AssetData | null) => void;
}

function ProjectAssets({ onAssetSelect }: ProjectAssetsProps) {
  const { t } = useTranslation();
  const { project, openFile } = useEditor();
  const [selectedFolder, setSelectedFolder] = useState<string>('assets');
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetPath: string;
    targetType: 'folder' | 'asset' | 'empty';
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetPath: '',
    targetType: 'empty'
  });

  // File type detection
  const getFileType = (fileName: string): AssetData['type'] => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'].includes(ext)) return 'texture';
    if (['.js', '.ts', '.jsx', '.tsx', '.cs', '.cpp', '.c', '.py'].includes(ext)) return 'script';
    if (['.novascene', '.scene'].includes(ext)) return 'scene';
    if (['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext)) return 'audio';
    if (['.mat', '.material'].includes(ext)) return 'material';
    if (['.nova'].includes(ext)) return 'visual';
    return 'unknown';
  };

  const getFileIcon = (type: AssetData['type']) => {
    switch (type) {
      case 'texture': return <Image size={16} />;
      case 'script': return <FileText size={16} />;
      case 'scene': return <Video size={16} />;
      case 'audio': return <Volume2 size={16} />;
      case 'material': return <Circle size={16} />;
      case 'visual': return <Link size={16} />;
      default: return <File size={16} />;
    }
  };

  // Load project assets from file system
  const loadProjectAssets = async () => {
    if (!project || !window.electronAPI?.readDirectory) {
      return;
    }

    setLoading(true);
    try {
      const assetsPath = await window.electronAPI.pathJoin(project.path, 'Assets');
      const assetTree = await loadDirectoryTree(assetsPath, 'Assets');
      setFolders([assetTree]);

      // Load assets for the initially selected folder
      await loadAssetsForFolder(assetsPath);
    } catch (error) {
      console.error('Failed to load project assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectoryTree = async (dirPath: string, name: string): Promise<FolderData> => {
    const folder: FolderData = {
      name,
      path: dirPath,
      icon: <Folder size={16} />,
      expanded: name === 'Assets'
    };

    try {
      const entries = await window.electronAPI!.readDirectory(dirPath);
      const children: FolderData[] = [];

      for (const entry of entries) {
        const entryPath = await window.electronAPI.pathJoin(dirPath, entry);
        // Check if it's a directory using file stats
        try {
          const stats = await window.electronAPI.getFileStats(entryPath);
          if (stats.isDirectory) {
            const childFolder = await loadDirectoryTree(entryPath, entry);
            children.push(childFolder);
          }
        } catch {
          // Failed to get stats, skip
        }
      }

      if (children.length > 0) {
        folder.children = children;
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }

    return folder;
  };

  const loadAssetsForFolder = async (folderPath: string) => {
    if (!window.electronAPI?.readDirectory) {
      return;
    }

    try {
      const entries = await window.electronAPI.readDirectory(folderPath);
      const assetList: AssetData[] = [];

      for (const entry of entries) {
        const entryPath = await window.electronAPI.pathJoin(folderPath, entry);
        // Check if it's a file using file stats
        try {
          const stats = await window.electronAPI.getFileStats(entryPath);
          if (!stats.isDirectory) {
            // It's a file
            const type = getFileType(entry);
            const asset: AssetData = {
              name: entry,
              path: entryPath,
              type,
              icon: getFileIcon(type)
          };

          // Load file stats if possible
          try {
            if (window.electronAPI?.getFileStats) {
              const stats = await window.electronAPI.getFileStats(entryPath);
              asset.size = stats.size;
              asset.modified = new Date(stats.modified);
            }
          } catch (error) {
            console.warn(`Failed to get stats for ${entryPath}:`, error);
          }

            assetList.push(asset);
          }
        } catch {
          // Failed to get stats, skip
        }
      }

      setAssets(assetList);
    } catch (error) {
      console.error(`Failed to load assets for folder ${folderPath}:`, error);
      setAssets([]);
    }
  };

  useEffect(() => {
    loadProjectAssets();
  }, [project]);

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
    const handleClick = async () => {
      toggleFolder(folder.name, level);
      setSelectedFolder(folder.path);
      await loadAssetsForFolder(folder.path);
    };

    return (
      <div key={folder.name}>
        <FolderItem
          level={level}
          expanded={folder.expanded}
          onClick={handleClick}
          onContextMenu={(e) => handleContextMenu(e, folder.path, 'folder')}
          className={selectedFolder === folder.path ? 'selected' : ''}
        >
          <FolderIcon>
            {folder.children ? (folder.expanded ? <FolderOpen size={16} /> : <Folder size={16} />) : folder.icon}
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

  const handleAssetDoubleClick = (asset: AssetData) => {
    if (asset.type === 'visual' || asset.type === 'scene' || asset.type === 'script') {
      openFile(asset.path);
    }
  };

  const createVisualScript = async (folderPath: string, fileName: string) => {
    if (!window.electronAPI?.writeFile || !window.electronAPI?.pathJoin) {
      console.error('Electron API not available');
      return;
    }

    try {
      const filePath = await window.electronAPI.pathJoin(folderPath, `${fileName}.nova`);

      // Create default visual graph data
      const defaultGraphData = {
        name: fileName,
        description: 'New Visual Script',
        version: '1.0.0',
        nodes: [],
        connections: [],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          author: 'NovaECS Editor'
        }
      };

      await window.electronAPI.writeFile(filePath, JSON.stringify(defaultGraphData, null, 2));

      // Refresh the assets list to show the new file
      await loadAssetsForFolder(folderPath);
    } catch (error) {
      console.error('Failed to create visual script:', error);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      // Show confirmation dialog
      const confirmed = await window.electronAPI.showInputDialog(
        t('dialogs.confirmDelete'),
        t('dialogs.deleteMessage'),
        ''
      );

      if (confirmed.canceled) return;

      // Delete the file
      await window.electronAPI.deleteFile(filePath);

      // Refresh the assets list
      await loadAssetsForFolder(selectedFolder);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, targetPath: string, targetType: 'folder' | 'asset' | 'empty') => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetPath,
      targetType
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (contextMenu.targetType === 'folder' || contextMenu.targetType === 'empty') {
      items.push({
        id: 'create-visual-script',
        label: t('contextMenu.createVisualScript'),
        icon: <Link size={14} />,
        onClick: async () => {
          const result = await window.electronAPI.showInputDialog(
            t('dialogs.createVisualScript'),
            t('dialogs.enterFileName'),
            'NewScript'
          );
          if (!result.canceled && result.value) {
            createVisualScript(contextMenu.targetPath, result.value);
          }
        }
      });
    }

    if (contextMenu.targetType === 'asset' || contextMenu.targetType === 'folder') {
      items.push({
        id: 'delete',
        label: t('contextMenu.delete'),
        icon: <Trash2 size={14} />,
        onClick: async () => {
          await handleDeleteFile(contextMenu.targetPath);
        }
      });
    }

    return items;
  };

  if (loading) {
    return (
      <AssetsContainer>
        <AssetsHeader>
          <HeaderTitle>{t('project.assets')}</HeaderTitle>
        </AssetsHeader>
        <AssetsContent>
          <div style={{ textAlign: 'center', padding: '20px', color: '#969696' }}>
            {t('common.loading') || 'Loading...'}
          </div>
        </AssetsContent>
      </AssetsContainer>
    );
  }

  return (
    <AssetsContainer>
      <AssetsHeader>
        <HeaderTitle>{t('project.assets')}</HeaderTitle>
      </AssetsHeader>
      <AssetsContent>
        <FolderTree>
          {folders.map(folder => renderFolder(folder))}
        </FolderTree>

        <AssetList
          onContextMenu={(e) => handleContextMenu(e, selectedFolder, 'empty')}
        >
          {assets.map((asset, index) => (
            <AssetItem
              key={index}
              selected={selectedAsset === asset}
              onClick={() => handleAssetClick(asset)}
              onDoubleClick={() => handleAssetDoubleClick(asset)}
              onContextMenu={(e) => {
                e.stopPropagation();
                handleContextMenu(e, asset.path, 'asset');
              }}
            >
              <AssetIcon>{asset.icon}</AssetIcon>
              <AssetName>{asset.name}</AssetName>
            </AssetItem>
          ))}
        </AssetList>
      </AssetsContent>
      <ContextMenu
        items={getContextMenuItems()}
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleContextMenuClose}
      />
    </AssetsContainer>
  );
}

export default ProjectAssets;