import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Dialog = styled.div`
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 500px;
  color: #cccccc;
`;

const DialogTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #ffffff;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #cccccc;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #007acc;
  }

  &::placeholder {
    color: #969696;
  }
`;

const PathDisplay = styled.div`
  padding: 8px 12px;
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #969696;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  word-break: break-all;
  min-height: 20px;
  display: flex;
  align-items: center;
`;

const PathSelectGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: end;
`;

const PathInput = styled.div`
  flex: 1;
`;

const BrowseButton = styled.button`
  padding: 8px 16px;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: #3e3e42;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 8px 16px;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background-color: ${props => props.primary ? '#007acc' : '#2d2d30'};
  color: ${props => props.primary ? '#ffffff' : '#cccccc'};

  &:hover {
    background-color: ${props => props.primary ? '#005a9e' : '#3e3e42'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface NewProjectDialogProps {
  isOpen: boolean;
  onConfirm: (projectName: string, projectPath: string) => void;
  onCancel: () => void;
}

function NewProjectDialog({ isOpen, onConfirm, onCancel }: NewProjectDialogProps) {
  const { t } = useTranslation();
  const [projectName, setProjectName] = useState('MyNovaProject');
  const [projectPath, setProjectPath] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim() && projectPath.trim()) {
      onConfirm(projectName.trim(), projectPath.trim());
    }
  };

  const handleSelectPath = async () => {
    try {
      if (!window.electronAPI?.showOpenDialog) {
        console.error('Electron API not available');
        return;
      }

      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: t('project.browse')
      });

      if (!result.canceled && result.filePaths[0]) {
        setProjectPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to select project path:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const finalProjectPath = projectPath ? `${projectPath}\\${projectName}` : '';

  return (
    <Overlay onClick={onCancel} onKeyDown={handleKeyDown}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{t('project.newProject')}</DialogTitle>

          <FormGroup>
            <Label htmlFor="projectName">{t('project.projectName')}</Label>
            <Input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t('project.projectName')}
              autoFocus
            />
          </FormGroup>

          <FormGroup>
            <Label>{t('project.projectPath')}</Label>
            <PathSelectGroup>
              <PathInput>
                <PathDisplay>
                  {projectPath || t('project.selectLocation') || 'Select a location...'}
                </PathDisplay>
              </PathInput>
              <BrowseButton type="button" onClick={handleSelectPath}>
                {t('project.browse')}
              </BrowseButton>
            </PathSelectGroup>
          </FormGroup>

          {finalProjectPath && (
            <FormGroup>
              <Label>Final Path:</Label>
              <PathDisplay style={{ color: '#cccccc' }}>{finalProjectPath}</PathDisplay>
            </FormGroup>
          )}

          <ButtonGroup>
            <Button type="button" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              primary
              disabled={!projectName.trim() || !projectPath.trim()}
            >
              {t('project.create')}
            </Button>
          </ButtonGroup>
        </form>
      </Dialog>
    </Overlay>
  );
}

export default NewProjectDialog;