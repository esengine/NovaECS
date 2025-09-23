/**
 * Asset data interface for project files
 * 项目文件的资源数据接口
 */
export interface AssetData {
  name: string;
  path: string;
  type: 'texture' | 'script' | 'scene' | 'audio' | 'material' | 'unknown';
  icon: string;
  size?: number;
  modified?: Date;
}

/**
 * Folder data interface for project directory tree
 * 项目目录树的文件夹数据接口
 */
export interface FolderData {
  name: string;
  path: string;
  icon: string;
  expanded: boolean;
  children?: FolderData[];
}