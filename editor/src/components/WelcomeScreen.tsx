import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { ProjectService, type ProjectInfo } from '../services/ProjectService';
import NewProjectDialog from './dialogs/NewProjectDialog';
import { Folder, FolderOpen, FileText } from '../utils/icons';

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1;
  background-color: #1e1e1e;
  color: #cccccc;
`;

const WelcomeTitle = styled.h1`
  font-size: 48px;
  font-weight: 300;
  margin-bottom: 16px;
  color: #ffffff;
`;

const WelcomeSubtitle = styled.p`
  font-size: 18px;
  margin-bottom: 48px;
  color: #969696;
`;

const ActionsContainer = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 48px;
`;

const ActionButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  min-width: 180px;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  color: #cccccc;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #3e3e42;
    border-color: #007acc;
  }

  &:active {
    background-color: #094771;
  }
`;

const ActionIcon = styled.div`
  font-size: 48px;
  margin-bottom: 12px;
`;

const ActionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const ActionDescription = styled.p`
  font-size: 13px;
  color: #969696;
  text-align: center;
  line-height: 1.4;
`;

const RecentProjectsContainer = styled.div`
  width: 100%;
  max-width: 600px;
`;

const RecentProjectsTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
`;

const RecentProjectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RecentProjectItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #3e3e42;
    border-color: #007acc;
  }
`;

const ProjectIcon = styled.div`
  font-size: 24px;
  margin-right: 12px;
`;

const ProjectInfo = styled.div`
  flex: 1;
`;

const ProjectName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #cccccc;
  margin-bottom: 4px;
`;

const ProjectPath = styled.div`
  font-size: 12px;
  color: #969696;
`;

const EmptyRecentProjects = styled.div`
  text-align: center;
  color: #969696;
  font-size: 14px;
  padding: 24px;
`;

interface WelcomeScreenProps {
  onProjectSelected: (project: ProjectInfo) => void;
}

function WelcomeScreen({ onProjectSelected }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([]);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState('');
  const projectService = ProjectService.getInstance();

  useEffect(() => {
    // Load recent projects
    setRecentProjects(projectService.getRecentProjects());
  }, []);

  const handleNewProject = () => {
    // 直接显示新建项目对话框
    setShowNewProjectDialog(true);
  };

  const handleConfirmNewProject = async (projectName: string, projectPath: string) => {
    try {
      // Create the project
      const project = await projectService.createProject(projectPath, projectName);

      // Set as current project and notify parent
      projectService.setCurrentProject(project);
      onProjectSelected(project);

      setShowNewProjectDialog(false);

    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project: ' + (error as Error).message);
    }
  };

  const handleCancelNewProject = () => {
    setShowNewProjectDialog(false);
  };

  const handleOpenProject = async () => {
    try {
      if (!window.electronAPI?.showOpenDialog) {
        console.error('Electron API not available');
        return;
      }

      // Show directory picker for project
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: t('project.openProject')
      });

      if (result.canceled || !result.filePaths[0]) {
        return;
      }

      const projectPath = result.filePaths[0];

      // Open the project
      const project = await projectService.openProject(projectPath);
      onProjectSelected(project);

    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project: ' + (error as Error).message);
    }
  };

  const handleRecentProjectClick = async (project: ProjectInfo) => {
    try {
      // Try to open the recent project
      const openedProject = await projectService.openProject(project.path);
      onProjectSelected(openedProject);
    } catch (error) {
      console.error('Failed to open recent project:', error);
      alert('Failed to open project: ' + (error as Error).message);

      // Remove from recent projects if it failed to open
      const updatedRecents = recentProjects.filter(p => p.path !== project.path);
      setRecentProjects(updatedRecents);
    }
  };

  return (
    <>
      <WelcomeContainer>
        <WelcomeTitle>{t('app.title')}</WelcomeTitle>
        <WelcomeSubtitle>{t('welcome.subtitle')}</WelcomeSubtitle>

        <ActionsContainer>
          <ActionButton onClick={handleNewProject}>
            <ActionIcon><Folder size={48} /></ActionIcon>
            <ActionTitle>{t('project.newProject')}</ActionTitle>
            <ActionDescription>
              {t('welcome.newProjectDescription')}
            </ActionDescription>
          </ActionButton>

          <ActionButton onClick={handleOpenProject}>
            <ActionIcon><FolderOpen size={48} /></ActionIcon>
            <ActionTitle>{t('project.openProject')}</ActionTitle>
            <ActionDescription>
              {t('welcome.openProjectDescription')}
            </ActionDescription>
          </ActionButton>
        </ActionsContainer>

        {recentProjects.length > 0 && (
          <RecentProjectsContainer>
            <RecentProjectsTitle>{t('welcome.recentProjectsTitle')}</RecentProjectsTitle>
            <RecentProjectsList>
              {recentProjects.map((project, index) => (
                <RecentProjectItem
                  key={index}
                  onClick={() => handleRecentProjectClick(project)}
                >
                  <ProjectIcon><FileText size={24} /></ProjectIcon>
                  <ProjectInfo>
                    <ProjectName>{project.name}</ProjectName>
                    <ProjectPath>{project.path}</ProjectPath>
                  </ProjectInfo>
                </RecentProjectItem>
              ))}
            </RecentProjectsList>
          </RecentProjectsContainer>
        )}

        {recentProjects.length === 0 && (
          <EmptyRecentProjects>
            {t('project.noRecentProjects')}
          </EmptyRecentProjects>
        )}
      </WelcomeContainer>

      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onConfirm={handleConfirmNewProject}
        onCancel={handleCancelNewProject}
      />
    </>
  );
}

export default WelcomeScreen;