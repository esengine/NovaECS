import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Electron API interface for type safety
 * 用于类型安全的Electron API接口
 */
interface ElectronAPI {
  // File operations 文件操作
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  loadFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;

  // Language operations 语言操作
  changeLanguage: (locale: string) => Promise<{ success: boolean }>;

  // Menu events 菜单事件
  onMenuEvent: (callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 * 暴露受保护的方法，允许渲染进程使用ipcRenderer而不暴露整个对象
 */
const electronAPI: ElectronAPI = {
  // File operations 文件操作
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-file', filePath, content),

  loadFile: (filePath: string) =>
    ipcRenderer.invoke('load-file', filePath),

  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('show-save-dialog', options),

  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('show-open-dialog', options),

  // Language operations 语言操作
  changeLanguage: (locale: string) =>
    ipcRenderer.invoke('change-language', locale),

  // Menu events 菜单事件
  onMenuEvent: (callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    const menuChannels = [
      'menu-new-project',
      'menu-open-project',
      'menu-save-scene',
      'menu-undo',
      'menu-redo',
      'menu-create-empty',
      'menu-create-sprite',
      'menu-create-camera'
    ];

    menuChannels.forEach(channel => {
      ipcRenderer.on(channel, callback);
    });
  },

  // Remove listeners 移除监听器
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the global electronAPI
// 全局electronAPI的类型声明
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}