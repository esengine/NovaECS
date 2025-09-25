"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 * 暴露受保护的方法，允许渲染进程使用ipcRenderer而不暴露整个对象
 */
const electronAPI = {
    // File operations 文件操作
    saveFile: (filePath, content) => electron_1.ipcRenderer.invoke('save-file', filePath, content),
    loadFile: (filePath) => electron_1.ipcRenderer.invoke('load-file', filePath),
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    showInputDialog: (title, label, defaultValue) => electron_1.ipcRenderer.invoke('show-input-dialog', title, label, defaultValue),
    // Project file system operations 项目文件系统操作
    fileExists: (filePath) => electron_1.ipcRenderer.invoke('file-exists', filePath),
    createDirectory: (dirPath) => electron_1.ipcRenderer.invoke('create-directory', dirPath),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('write-file', filePath, content),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    readDirectory: (dirPath) => electron_1.ipcRenderer.invoke('read-directory', dirPath),
    getFileStats: (filePath) => electron_1.ipcRenderer.invoke('get-file-stats', filePath),
    deleteFile: (filePath) => electron_1.ipcRenderer.invoke('delete-file', filePath),
    // Language operations 语言操作
    changeLanguage: (locale) => electron_1.ipcRenderer.invoke('change-language', locale),
    initMenuLanguage: (locale) => electron_1.ipcRenderer.invoke('init-menu-language', locale),
    // Menu operations 菜单操作
    setMenuVisible: (visible) => electron_1.ipcRenderer.invoke('set-menu-visible', visible),
    // Menu events 菜单事件
    onMenuEvent: (callback) => {
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
            electron_1.ipcRenderer.on(channel, (event, ...args) => {
                // Create a custom event object with channel information
                const customEvent = Object.assign({}, event, { channel });
                callback(customEvent, ...args);
            });
        });
    },
    // Remove listeners 移除监听器
    removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
    // Path operations 路径操作
    pathJoin: (...parts) => electron_1.ipcRenderer.invoke('path-join', ...parts)
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map