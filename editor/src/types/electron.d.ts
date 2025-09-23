/**
 * Electron API type definitions
 * Electron API类型定义
 */

export interface ElectronAPI {
  // File operations 文件操作
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;

  // Menu operations 菜单操作
  changeLanguage: (locale: string) => Promise<{ success: boolean }>;

  // Menu event listeners 菜单事件监听器
  onMenuAction: (callback: (action: string, ...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}