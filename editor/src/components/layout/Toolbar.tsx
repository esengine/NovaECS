import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import { EditorMode, EditorTool } from '../../core/EditorWorld';

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
  background-color: #3c3c3c;
  border-bottom: 1px solid #555;
  padding: 0 8px;
  gap: 8px;
`;

const ToolGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
`;

const ToolButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${props => props.active ? '#007acc' : '#555'};
  background-color: ${props => props.active ? '#0e639c' : '#404040'};
  color: #cccccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background-color: ${props => props.active ? '#1177bb' : '#4a4a4a'};
  }

  &:active {
    background-color: #2a2a2a;
  }
`;

const PlayButton = styled(ToolButton)<{ playing?: boolean }>`
  background-color: ${props => props.playing ? '#228b22' : '#404040'};

  &:hover {
    background-color: ${props => props.playing ? '#32cd32' : '#4a4a4a'};
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 24px;
  background-color: #555;
  margin: 0 8px;
`;

function Toolbar() {
  const { t } = useTranslation();
  const { mode, tool, setMode, setTool } = useEditor();

  const handlePlayToggle = () => {
    if (mode === EditorMode.Play) {
      setMode(EditorMode.Edit);
    } else {
      setMode(EditorMode.Play);
    }
  };

  const handlePause = () => {
    setMode(mode === EditorMode.Pause ? EditorMode.Play : EditorMode.Pause);
  };

  const handleStop = () => {
    setMode(EditorMode.Edit);
  };

  return (
    <ToolbarContainer>
      {/* Transform Tools */}
      <ToolGroup>
        <ToolButton
          active={tool === EditorTool.Select}
          onClick={() => setTool(EditorTool.Select)}
          title={t('toolbar.select')}
        >
          ⬚
        </ToolButton>
        <ToolButton
          active={tool === EditorTool.Move}
          onClick={() => setTool(EditorTool.Move)}
          title={t('toolbar.move')}
        >
          ✥
        </ToolButton>
        <ToolButton
          active={tool === EditorTool.Rotate}
          onClick={() => setTool(EditorTool.Rotate)}
          title={t('toolbar.rotate')}
        >
          ↻
        </ToolButton>
        <ToolButton
          active={tool === EditorTool.Scale}
          onClick={() => setTool(EditorTool.Scale)}
          title={t('toolbar.scale')}
        >
          ⤡
        </ToolButton>
      </ToolGroup>

      <Separator />

      {/* Playback Controls */}
      <ToolGroup>
        <PlayButton
          playing={mode === EditorMode.Play}
          onClick={handlePlayToggle}
          title={t('toolbar.play')}
        >
          {mode === EditorMode.Play ? '⏸' : '▶'}
        </PlayButton>
        <ToolButton
          active={mode === EditorMode.Pause}
          onClick={handlePause}
          title={t('toolbar.pause')}
          disabled={mode === EditorMode.Edit}
        >
          ⏸
        </ToolButton>
        <ToolButton
          onClick={handleStop}
          title={t('toolbar.stop')}
          disabled={mode === EditorMode.Edit}
        >
          ⏹
        </ToolButton>
      </ToolGroup>
    </ToolbarContainer>
  );
}

export default Toolbar;