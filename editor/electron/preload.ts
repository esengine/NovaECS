import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ElectronAPI } from '../src/types/electron';

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

  showInputDialog: (title: string, label: string, defaultValue?: string) =>
    ipcRenderer.invoke('show-input-dialog', title, label, defaultValue),

  // Project file system operations 项目文件系统操作
  fileExists: (filePath: string) =>
    ipcRenderer.invoke('file-exists', filePath),

  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke('create-directory', dirPath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('read-file', filePath),

  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke('read-directory', dirPath),

  getFileStats: (filePath: string) =>
    ipcRenderer.invoke('get-file-stats', filePath),

  // Language operations 语言操作
  changeLanguage: (locale: string) =>
    ipcRenderer.invoke('change-language', locale),

  // Menu operations 菜单操作
  setMenuVisible: (visible: boolean) =>
    ipcRenderer.invoke('set-menu-visible', visible),

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
      ipcRenderer.on(channel, (event, ...args) => {
        // Create a custom event object with channel information
        const customEvent = Object.assign({}, event, { channel });
        callback(customEvent as IpcRendererEvent, ...args);
      });
    });
  },

  // Remove listeners 移除监听器
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // Path operations 路径操作
  pathJoin: (...parts: string[]) =>
    ipcRenderer.invoke('path-join', ...parts)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);