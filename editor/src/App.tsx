import { useTranslation } from 'react-i18next';
import EditorLayout from './components/layout/EditorLayout';
import { EditorProvider } from './store/EditorContext';

function App() {
  const { t: _t } = useTranslation();

  return (
    <EditorProvider>
      <div className="app">
        <EditorLayout />
      </div>
    </EditorProvider>
  );
}

export default App;