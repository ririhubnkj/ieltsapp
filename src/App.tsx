import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { HomeScreen } from './components/screens/HomeScreen';
import { EntryCreateScreen } from './components/screens/EntryCreateScreen';
import { MarkingScreen } from './components/screens/MarkingScreen';
import { EntryEditScreen } from './components/screens/EntryEditScreen';
import { StudyDetailScreen } from './components/screens/StudyDetailScreen';
import { QuizScreen } from './components/screens/QuizScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { IS_PERSONAL } from './lib/target';

// アーティファクトの枠内ではURLのハッシュを使わず、画面の移動をメモリ上で持つ
const Router = IS_PERSONAL ? MemoryRouter : HashRouter;

export function App() {
  return (
    <AppDataProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/new" element={<EntryCreateScreen />} />
          <Route path="/entries/:id" element={<StudyDetailScreen />} />
          <Route path="/entries/:id/mark" element={<MarkingScreen />} />
          <Route path="/entries/:id/edit" element={<EntryEditScreen />} />
          <Route path="/entries/:id/quiz" element={<QuizScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </Router>
    </AppDataProvider>
  );
}
