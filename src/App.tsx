import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { HomeScreen } from './components/screens/HomeScreen';
import { EntryCreateScreen } from './components/screens/EntryCreateScreen';
import { MarkingScreen } from './components/screens/MarkingScreen';
import { EntryEditScreen } from './components/screens/EntryEditScreen';
import { StudyDetailScreen } from './components/screens/StudyDetailScreen';
import { QuizScreen } from './components/screens/QuizScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { ReadingScreen } from './components/screens/ReadingScreen';
import { TemplatesScreen } from './components/screens/TemplatesScreen';
import { WritingExamScreen } from './components/screens/WritingExamScreen';
import { SpeakingExamScreen } from './components/screens/SpeakingExamScreen';
import { ReadingMockScreen } from './components/screens/ReadingMockScreen';
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
          <Route path="/reading/:id" element={<ReadingScreen />} />
          <Route path="/templates/:task" element={<TemplatesScreen />} />
          <Route path="/writing-exam" element={<WritingExamScreen />} />
          <Route path="/speaking-exam" element={<SpeakingExamScreen />} />
          <Route path="/speaking-exam/:presetId" element={<SpeakingExamScreen />} />
          <Route path="/reading-mock" element={<ReadingMockScreen />} />
        </Routes>
      </Router>
    </AppDataProvider>
  );
}
