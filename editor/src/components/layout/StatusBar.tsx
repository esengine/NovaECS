import { useTranslation } from 'react-i18next';
import styled from '@emotion/styled';
import { useEditor } from '../../store/EditorContext';

const StatusBarContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  background-color: #007acc;
  color: white;
  padding: 0 8px;
  font-size: 12px;
`;

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const StatusRight = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const StatusItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const LanguageButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 2px;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

function StatusBar() {
  const { t, i18n } = useTranslation();
  const { selectedEntities, mode, entities } = useEditor();

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'zh-CN' : 'en';
    await i18n.changeLanguage(newLang);

    // Notify Electron to update menu language
    // 通知Electron更新菜单语言
    if (window.electronAPI?.changeLanguage) {
      await window.electronAPI.changeLanguage(newLang);
    }
  };

  return (
    <StatusBarContainer>
      <StatusLeft>
        <StatusItem>
          {t('status.ready')}
        </StatusItem>
        <StatusItem>
          {t('panels.scene')}: {selectedEntities.length} {t('status.selected')}
        </StatusItem>
        <StatusItem>
          {t('status.mode')}: {mode.toUpperCase()}
        </StatusItem>
      </StatusLeft>
      <StatusRight>
        <StatusItem>
          {t('status.fps')}: 60
        </StatusItem>
        <StatusItem>
          {t('status.objects')}: {entities.length}
        </StatusItem>
        <LanguageButton onClick={toggleLanguage} title={t('settings.toggleLanguage')}>
          {i18n.language === 'en' ? '中' : 'EN'}
        </LanguageButton>
      </StatusRight>
    </StatusBarContainer>
  );
}

export default StatusBar;