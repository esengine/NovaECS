import { IpcRendererEvent } from 'electron';

/**
 * Electron API interface for type safety
 * 用于类型安全的Electron API接口
 */
export interface ElectronAPI {
  // File operations 文件操作
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  loadFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  showInputDialog: (title: string, label: string, defaultValue?: string) => Promise<{ canceled: boolean; value: string }>;

  // Project file system operations 项目文件系统操作
  fileExists: (filePath: string) => Promise<boolean>;
  createDirectory: (dirPath: string) => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string>;
  readDirectory: (dirPath: string) => Promise<string[]>;
  getFileStats: (filePath: string) => Promise<{size: number; modified: Date; isDirectory: boolean}>;
  deleteFile: (filePath: string) => Promise<void>;

  // Language operations 语言操作
  changeLanguage: (locale: string) => Promise<{ success: boolean }>;
  initMenuLanguage: (locale: string) => Promise<{ success: boolean }>;

  // Menu operations 菜单操作
  setMenuVisible: (visible: boolean) => Promise<{ success: boolean }>;

  // Menu events 菜单事件
  onMenuEvent: (callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;

  // Path operations 路径操作
  pathJoin: (...parts: string[]) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}