/**
 * Project management service
 * 项目管理服务
 */


export interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  createdAt: string;
  lastModified: string;
  novaEcsVersion: string;
  settings: {
    defaultScene?: string;
    targetPlatform: string;
    buildOutput: string;
  };
}

export interface ProjectInfo {
  name: string;
  path: string;
  lastOpened: string;
  config: ProjectConfig;
}

export class ProjectService {
  private static instance: ProjectService;
  private currentProject: ProjectInfo | null = null;
  private recentProjects: ProjectInfo[] = [];

  private constructor() {
    this.loadRecentProjects();
  }

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  /**
   * Create a new project
   * 创建新项目
   */
  async createProject(projectPath: string, projectName: string): Promise<ProjectInfo> {
    const projectDir = await window.electronAPI.pathJoin(projectPath, projectName);

    // Create project directory structure
    // 创建项目目录结构
    await this.createProjectStructure(projectDir);

    // Create project config
    // 创建项目配置
    const config: ProjectConfig = {
      name: projectName,
      version: '1.0.0',
      description: `Nova ECS project: ${projectName}`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      novaEcsVersion: '0.1.0',
      settings: {
        targetPlatform: 'web',
        buildOutput: 'dist'
      }
    };

    // Save project config
    // 保存项目配置
    await this.saveProjectConfig(projectDir, config);

    const projectInfo: ProjectInfo = {
      name: projectName,
      path: projectDir,
      lastOpened: new Date().toISOString(),
      config
    };

    return projectInfo;
  }

  /**
   * Open an existing project
   * 打开现有项目
   */
  async openProject(projectPath: string): Promise<ProjectInfo> {
    const configPath = await window.electronAPI.pathJoin(projectPath, 'project.json');

    // Check if project.json exists
    // 检查project.json是否存在
    if (!await this.fileExists(configPath)) {
      throw new Error('Invalid project: project.json not found');
    }

    // Load project config
    // 加载项目配置
    const config = await this.loadProjectConfig(projectPath);

    // Update last modified
    // 更新最后修改时间
    config.lastModified = new Date().toISOString();
    await this.saveProjectConfig(projectPath, config);

    const projectInfo: ProjectInfo = {
      name: config.name,
      path: projectPath,
      lastOpened: new Date().toISOString(),
      config
    };

    this.currentProject = projectInfo;
    this.addToRecentProjects(projectInfo);
    this.saveRecentProjects();

    return projectInfo;
  }

  /**
   * Get current project
   * 获取当前项目
   */
  getCurrentProject(): ProjectInfo | null {
    return this.currentProject;
  }

  /**
   * Set current project
   * 设置当前项目
   */
  setCurrentProject(project: ProjectInfo | null): void {
    this.currentProject = project;
    if (project) {
      this.addToRecentProjects(project);
      this.saveRecentProjects();
    }
  }

  /**
   * Get recent projects
   * 获取最近项目
   */
  getRecentProjects(): ProjectInfo[] {
    return this.recentProjects;
  }

  /**
   * Create project directory structure
   * 创建项目目录结构
   */
  private async createProjectStructure(projectDir: string): Promise<void> {
    const dirs = [
      projectDir,
      await window.electronAPI.pathJoin(projectDir, 'Assets'),
      await window.electronAPI.pathJoin(projectDir, 'Assets', 'Textures'),
      await window.electronAPI.pathJoin(projectDir, 'Assets', 'Audio'),
      await window.electronAPI.pathJoin(projectDir, 'Assets', 'Scripts'),
      await window.electronAPI.pathJoin(projectDir, 'Assets', 'Scenes'),
      await window.electronAPI.pathJoin(projectDir, '.nova')
    ];

    for (const dir of dirs) {
      await this.createDirectory(dir);
    }

    // Create default scene
    // 创建默认场景
    const defaultScenePath = await window.electronAPI.pathJoin(projectDir, 'Assets', 'Scenes', 'Main.novascene');
    const defaultScene = {
      name: 'Main',
      entities: [],
      version: '1.0.0'
    };

    await this.writeFile(defaultScenePath, JSON.stringify(defaultScene, null, 2));
  }

  /**
   * Save project config
   * 保存项目配置
   */
  private async saveProjectConfig(projectDir: string, config: ProjectConfig): Promise<void> {
    const configPath = await window.electronAPI.pathJoin(projectDir, 'project.json');
    await this.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Load project config
   * 加载项目配置
   */
  private async loadProjectConfig(projectDir: string): Promise<ProjectConfig> {
    const configPath = await window.electronAPI.pathJoin(projectDir, 'project.json');
    const content = await this.readFile(configPath);
    return JSON.parse(content);
  }

  /**
   * Add project to recent projects list
   * 添加项目到最近项目列表
   */
  private addToRecentProjects(project: ProjectInfo): void {
    // Remove if already exists
    // 如果已存在则先移除
    this.recentProjects = this.recentProjects.filter(p => p.path !== project.path);

    // Add to beginning
    // 添加到开头
    this.recentProjects.unshift(project);

    // Keep only 10 recent projects
    // 只保留10个最近项目
    this.recentProjects = this.recentProjects.slice(0, 10);
  }

  /**
   * Load recent projects from localStorage
   * 从localStorage加载最近项目
   */
  private loadRecentProjects(): void {
    try {
      const stored = localStorage.getItem('nova-editor-recent-projects');
      if (stored) {
        this.recentProjects = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load recent projects:', error);
      this.recentProjects = [];
    }
  }

  /**
   * Save recent projects to localStorage
   * 保存最近项目到localStorage
   */
  private saveRecentProjects(): void {
    try {
      localStorage.setItem('nova-editor-recent-projects', JSON.stringify(this.recentProjects));
    } catch (error) {
      console.warn('Failed to save recent projects:', error);
    }
  }

  // File system helpers (these will use Electron's IPC in real implementation)
  // 文件系统辅助函数（实际实现中会使用Electron的IPC）

  private async fileExists(filePath: string): Promise<boolean> {
    if (window.electronAPI?.fileExists) {
      return await window.electronAPI.fileExists(filePath);
    }
    return false;
  }

  private async createDirectory(dirPath: string): Promise<void> {
    if (window.electronAPI?.createDirectory) {
      await window.electronAPI.createDirectory(dirPath);
    }
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    if (window.electronAPI?.writeFile) {
      await window.electronAPI.writeFile(filePath, content);
    }
  }

  private async readFile(filePath: string): Promise<string> {
    if (window.electronAPI?.readFile) {
      return await window.electronAPI.readFile(filePath);
    }
    return '';
  }
}