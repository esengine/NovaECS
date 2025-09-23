"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
// Enable live reload for development
// 开发环境启用热重载
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit'
        });
    }
    catch {
        // electron-reload is optional
        console.log('electron-reload not available');
    }
}
let mainWindow = null;
/**
 * Create the main application window
 * 创建主应用程序窗口
 */
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'NovaECS Editor',
        icon: process.platform === 'win32'
            ? path.join(__dirname, '..', 'assets', 'icon.ico')
            : path.join(__dirname, '..', 'assets', 'icon.png')
    });
    // Load the development server or built files
    // 加载开发服务器或构建文件
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
    // Create application menu
    // 创建应用程序菜单
    createMenu();
    mainWindow.on('closed', () => {
        // Kill development server when main window closes
        // 主窗口关闭时终止开发服务器
        if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
            killDevServer();
        }
        mainWindow = null;
    });
}
/**
 * Create application menu
 * 创建应用程序菜单
 */
function createMenu(locale = 'en') {
    if (!mainWindow)
        return;
    // Import translation files
    const translations = {
        en: require('../locales/en/translation.json'),
        'zh-CN': require('../locales/zh-CN/translation.json')
    };
    const t = translations[locale] || translations.en;
    const template = [
        {
            label: t.menu.file,
            submenu: [
                {
                    label: t.menu.newProject,
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu-new-project');
                    }
                },
                {
                    label: t.menu.openProject,
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!mainWindow)
                            return;
                        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory'],
                            title: t.menu.openProject
                        });
                        if (!result.canceled) {
                            mainWindow.webContents.send('menu-open-project', result.filePaths[0]);
                        }
                    }
                },
                {
                    label: t.menu.saveScene,
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow?.webContents.send('menu-save-scene');
                    }
                },
                { type: 'separator' },
                {
                    role: 'quit'
                }
            ]
        },
        {
            label: t.menu.edit,
            submenu: [
                {
                    label: t.menu.undo,
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => {
                        mainWindow?.webContents.send('menu-undo');
                    }
                },
                {
                    label: t.menu.redo,
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    click: () => {
                        mainWindow?.webContents.send('menu-redo');
                    }
                },
                { type: 'separator' },
                {
                    label: t.menu.cut,
                    role: 'cut'
                },
                {
                    label: t.menu.copy,
                    role: 'copy'
                },
                {
                    label: t.menu.paste,
                    role: 'paste'
                }
            ]
        },
        {
            label: t.menu.view,
            submenu: [
                {
                    label: t.menu.reload,
                    role: 'reload'
                },
                {
                    label: t.menu.toggleDevTools,
                    role: 'toggleDevTools'
                },
                { type: 'separator' },
                {
                    label: t.menu.resetZoom,
                    role: 'resetZoom'
                },
                {
                    label: t.menu.zoomIn,
                    role: 'zoomIn'
                },
                {
                    label: t.menu.zoomOut,
                    role: 'zoomOut'
                },
                { type: 'separator' },
                {
                    label: t.menu.toggleFullscreen,
                    role: 'togglefullscreen'
                }
            ]
        },
        {
            label: t.menu.gameObject,
            submenu: [
                {
                    label: t.menu.createEmpty,
                    click: () => {
                        mainWindow?.webContents.send('menu-create-empty');
                    }
                },
                {
                    label: t.menu.createSprite,
                    click: () => {
                        mainWindow?.webContents.send('menu-create-sprite');
                    }
                },
                {
                    label: t.menu.createCamera,
                    click: () => {
                        mainWindow?.webContents.send('menu-create-camera');
                    }
                }
            ]
        },
        {
            label: t.menu.help,
            submenu: [
                {
                    label: t.menu.about,
                    click: () => {
                        if (!mainWindow)
                            return;
                        electron_1.dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About NovaECS Editor',
                            message: 'NovaECS Editor v0.1.0',
                            detail: 'Cross-platform game editor for NovaECS framework'
                        });
                    }
                }
            ]
        }
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
// App event handlers
// 应用程序事件处理器
electron_1.app.whenReady().then(() => {
    createWindow();
    createMenu('zh-CN'); // Default to Chinese
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    // Kill development server when closing
    // 关闭时终止开发服务器
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        killDevServer();
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    // Ensure dev server is killed before app quits
    // 确保应用退出前终止开发服务器
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        killDevServer();
    }
});
/**
 * Kill development server on port 5173
 * 终止5173端口上的开发服务器
 */
function killDevServer() {
    const isWindows = process.platform === 'win32';
    const command = isWindows
        ? 'npx kill-port 5173'
        : 'lsof -ti:5173 | xargs kill -9';
    (0, child_process_1.exec)(command, (error) => {
        if (error) {
            console.log('Dev server already stopped or not found');
        }
        else {
            console.log('Development server stopped');
        }
    });
}
electron_1.ipcMain.handle('save-file', async (_event, filePath, content) => {
    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('load-file', async (_event, filePath) => {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return { success: true, content };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('show-save-dialog', async (_event, options) => {
    if (!mainWindow)
        return { canceled: true };
    const result = await electron_1.dialog.showSaveDialog(mainWindow, options);
    return result;
});
electron_1.ipcMain.handle('show-open-dialog', async (_event, options) => {
    if (!mainWindow)
        return { canceled: true };
    const result = await electron_1.dialog.showOpenDialog(mainWindow, options);
    return result;
});
// Language change handler
// 语言切换处理器
electron_1.ipcMain.handle('change-language', async (_event, locale) => {
    createMenu(locale);
    return { success: true };
});
//# sourceMappingURL=main.js.map