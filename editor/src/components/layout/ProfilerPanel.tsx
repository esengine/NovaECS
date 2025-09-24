import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';
import { Profiler, SysStat } from '@esengine/nova-ecs';

const PanelContainer = styled.div<{ visible: boolean }>`
  position: absolute;
  top: 40px;
  right: 8px;
  width: 400px;
  max-height: 500px;
  background-color: rgba(30, 30, 30, 0.95);
  border: 1px solid #555;
  border-radius: 4px;
  overflow: hidden;
  display: ${props => props.visible ? 'block' : 'none'};
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #cccccc;
  z-index: 100;
`;

const PanelHeader = styled.div`
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderTitle = styled.h3`
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  padding: 2px;

  &:hover {
    color: #ffffff;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #3e3e42;
`;

const StatCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const StatLabel = styled.span`
  font-size: 10px;
  color: #969696;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.span<{ color?: string }>`
  font-size: 16px;
  font-weight: bold;
  color: ${props => props.color || '#cccccc'};
`;

const SystemList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  padding: 0;
`;

const SystemHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 60px 60px 60px 50px;
  gap: 8px;
  padding: 8px 12px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  font-size: 10px;
  font-weight: 600;
  color: #969696;
  text-transform: uppercase;
`;

const SystemRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 60px 60px 60px 50px;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #3e3e42;
  transition: background-color 0.15s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const SystemName = styled.span<{ stage?: string }>`
  color: ${props => {
    switch (props.stage) {
      case 'preUpdate': return '#FFB74D';
      case 'update': return '#4FC3F7';
      case 'postUpdate': return '#81C784';
      case 'render': return '#F06292';
      default: return '#cccccc';
    }
  }};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SystemStat = styled.span<{ highlight?: boolean }>`
  text-align: right;
  color: ${props => props.highlight ? '#FF9800' : '#cccccc'};
  font-weight: ${props => props.highlight ? 'bold' : 'normal'};
`;

interface ProfilerPanelProps {
  visible: boolean;
  onClose: () => void;
}

function ProfilerPanel({ visible, onClose }: ProfilerPanelProps) {
  const { t } = useTranslation();
  const { world } = useEditor();
  const [stats, setStats] = useState<SysStat[]>([]);
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);

  // FPS calculation
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let lastFrameTime = 0;

    const updateFps = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      frameCount++;

      // Update FPS every second
      if (deltaTime >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / deltaTime);
        setFps(currentFps);
        frameCount = 0;
        lastTime = currentTime;
      }

      // Track frame time
      if (lastFrameTime > 0) {
        setFrameTime(currentTime - lastFrameTime);
      }
      lastFrameTime = currentTime;

      if (visible) {
        requestAnimationFrame(updateFps);
      }
    };

    if (visible) {
      updateFps();
    }
  }, [visible]);

  // Update profiler stats
  useEffect(() => {
    if (!visible) return;

    const updateStats = () => {
      try {
        const profiler = world.getResource(Profiler);
        if (profiler) {
          const allStats = profiler.topByAvg(20); // Top 20 systems
          setStats(allStats);
        }
      } catch (error) {
        console.warn('Failed to get profiler stats:', error);
      }
    };

    // Update stats every 500ms
    const interval = setInterval(updateStats, 500);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [visible, world]);

  const totalSystemTime = stats.reduce((sum, stat) => sum + stat.avgMs, 0);
  const slowestSystem = stats.length > 0 ? stats[0] : null;

  return (
    <PanelContainer visible={visible}>
      <PanelHeader>
        <HeaderTitle>{t('profiler.title')}</HeaderTitle>
        <CloseButton onClick={onClose}>✕</CloseButton>
      </PanelHeader>

      <StatsGrid>
        <StatCard>
          <StatLabel>{t('profiler.fps')}</StatLabel>
          <StatValue color={fps < 30 ? '#ff5722' : fps < 50 ? '#ff9800' : '#4caf50'}>
            {fps}
          </StatValue>
        </StatCard>

        <StatCard>
          <StatLabel>{t('profiler.frameTime')}</StatLabel>
          <StatValue color={frameTime > 33 ? '#ff5722' : frameTime > 20 ? '#ff9800' : '#4caf50'}>
            {frameTime.toFixed(1)}ms
          </StatValue>
        </StatCard>

        <StatCard>
          <StatLabel>{t('profiler.systemTime')}</StatLabel>
          <StatValue>
            {totalSystemTime.toFixed(2)}ms
          </StatValue>
        </StatCard>

        <StatCard>
          <StatLabel>{t('profiler.systems')}</StatLabel>
          <StatValue>
            {stats.length}
          </StatValue>
        </StatCard>
      </StatsGrid>

      <SystemList>
        <SystemHeader>
          <span>{t('profiler.system')}</span>
          <span>{t('profiler.last')}</span>
          <span>{t('profiler.avg')}</span>
          <span>{t('profiler.max')}</span>
          <span>{t('profiler.calls')}</span>
        </SystemHeader>

        {stats.map((stat, index) => (
          <SystemRow key={`${stat.stage}:${stat.name}`}>
            <SystemName stage={stat.stage} title={`${stat.stage}:${stat.name}`}>
              {stat.name}
            </SystemName>
            <SystemStat>{stat.lastMs.toFixed(2)}</SystemStat>
            <SystemStat highlight={index === 0}>
              {stat.avgMs.toFixed(2)}
            </SystemStat>
            <SystemStat highlight={stat.maxMs === slowestSystem?.maxMs}>
              {stat.maxMs.toFixed(2)}
            </SystemStat>
            <SystemStat>{stat.calls}</SystemStat>
          </SystemRow>
        ))}

        {stats.length === 0 && (
          <SystemRow>
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: '#969696',
              padding: '20px'
            }}>
              {t('profiler.noData')}
            </div>
          </SystemRow>
        )}
      </SystemList>
    </PanelContainer>
  );
}

export default ProfilerPanel;