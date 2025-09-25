import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EditorLayout from './components/layout/EditorLayout';
import WelcomeScreen from './components/WelcomeScreen';
import WelcomeStatusBar from './components/WelcomeStatusBar';
import { EditorProvider } from './store/EditorContext';
import { ProjectService, ProjectInfo } from './services/ProjectService';
import i18n from './i18n';

function App() {
  const { t } = useTranslation();
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to restore last opened project
    const projectService = ProjectService.getInstance();
    const lastProject = projectService.getCurrentProject();

    if (lastProject) {
      setCurrentProject(lastProject);
    }

    setIsLoading(false);

    // Initialize menu language based on current i18n language
    if (window.electronAPI?.initMenuLanguage) {
      window.electronAPI.initMenuLanguage(i18n.language).catch(console.error);
    }

    // Set up menu event listeners
    if (window.electronAPI?.onMenuEvent) {
      const handleMenuEvent = async (event: any, ...args: any[]) => {
        const channel = event.channel;

        if (channel === 'menu-new-project') {
          handleMenuNewProject();
        } else if (channel === 'menu-open-project') {
          // If args[0] is a path, use it; otherwise show dialog
          if (args.length > 0 && typeof args[0] === 'string') {
            handleMenuOpenProject(args[0]);
          } else {
            handleMenuOpenProject();
          }
        }
      };

      window.electronAPI.onMenuEvent(handleMenuEvent);
    }

    return () => {
      // Clean up listeners
      if (window.electronAPI) {
        ['menu-new-project', 'menu-open-project'].forEach(channel => {
          window.electronAPI.removeAllListeners(channel);
        });
      }
    };
  }, []);

  // Control menu visibility based on project state
  useEffect(() => {
    if (window.electronAPI?.setMenuVisible) {
      // Show menu when project is loaded, hide when on welcome screen
      window.electronAPI.setMenuVisible(!!currentProject);
    }
  }, [currentProject]);

  const handleProjectSelected = (project: ProjectInfo) => {
    setCurrentProject(project);
  };

  const handleCloseProject = () => {
    setCurrentProject(null);
    const projectService = ProjectService.getInstance();
    projectService.setCurrentProject(null);
  };

  const handleMenuNewProject = async () => {
    try {
      if (!window.electronAPI?.showOpenDialog) {
        console.error('Electron API not available');
        return;
      }

      // If we already have a project open, close it first
      if (currentProject) {
        setCurrentProject(null);
      }

      // Show directory picker for project location
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Location'
      });

      if (result.canceled || !result.filePaths[0]) {
        return;
      }

      const projectLocation = result.filePaths[0];

      // Simple project name input (in a real app, this would be a proper dialog)
      const result2 = await window.electronAPI.showInputDialog(
        t('dialogs.createNewProject'),
        t('dialogs.enterProjectName'),
        'MyNovaProject'
      );

      if (result2.canceled || !result2.value || result2.value.trim() === '') {
        return;
      }

      const projectName = result2.value;

      // Create the project
      const projectService = ProjectService.getInstance();
      const project = await projectService.createProject(projectLocation, projectName.trim());

      // Set as current project
      projectService.setCurrentProject(project);
      setCurrentProject(project);

    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project: ' + (error as Error).message);
    }
  };

  const handleMenuOpenProject = async (projectPath?: string) => {
    try {
      let selectedPath = projectPath;

      if (!selectedPath) {
        if (!window.electronAPI?.showOpenDialog) {
          console.error('Electron API not available');
          return;
        }

        // Show directory picker for project
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Open Project'
        });

        if (result.canceled || !result.filePaths[0]) {
          return;
        }

        selectedPath = result.filePaths[0];
      }

      // If we already have a project open, close it first
      if (currentProject) {
        setCurrentProject(null);
      }

      // Open the project
      const projectService = ProjectService.getInstance();
      const project = await projectService.openProject(selectedPath);
      setCurrentProject(project);

    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project: ' + (error as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#cccccc'
      }}>
        Loading...
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <WelcomeScreen onProjectSelected={handleProjectSelected} />
        <WelcomeStatusBar />
      </div>
    );
  }

  return (
    <EditorProvider project={currentProject} onCloseProject={handleCloseProject}>
      <div className="app">
        <EditorLayout />
      </div>
    </EditorProvider>
  );
}

export default App;