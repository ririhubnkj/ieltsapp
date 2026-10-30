import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from '../context/AppDataContext';
import { SpeakingExamScreen } from '../components/screens/SpeakingExamScreen';

function renderAt(path: string) {
  return render(
    <AppDataProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/speaking-exam" element={<SpeakingExamScreen />} />
          <Route path="/speaking-exam/:presetId" element={<SpeakingExamScreen />} />
        </Routes>
      </MemoryRouter>
    </AppDataProvider>,
  );
}

it('choose view', () => {
  renderAt('/speaking-exam');
  expect(screen.getByText('Hometown')).toBeInTheDocument();
  expect(screen.getAllByText('ランダム')).toHaveLength(3);
  console.log('badges', screen.queryAllByText('モデル').length);
});

it('part 1 flow without mic', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new Error('denied')) }, configurable: true });
  (globalThis as any).MediaRecorder = class { static isTypeSupported() { return true; } };
  renderAt('/speaking-exam/speaking-l3-1');
  await act(async () => { fireEvent.click(screen.getByText('始める')); });
  expect(screen.getByText('Where is your hometown?')).toBeInTheDocument();
  expect(screen.getByText(/マイクが許可されなかった/)).toBeInTheDocument();
  for (let i = 0; i < 3; i++) await act(async () => { fireEvent.click(screen.getByText('次の質問')); });
  await act(async () => { fireEvent.click(screen.getByText('終える')); });
  expect(screen.getByText('セルフチェック')).toBeInTheDocument();
  expect(screen.getAllByText('録音なし')).toHaveLength(4);
  console.log('model btn', !!screen.queryByText('モデルアンサーを聞く'), !!screen.queryByText('モデルアンサーを見る'));
  console.log(localStorage.getItem('ielts_activity_v1'));
});

it('part 2 flow with timers', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  renderAt('/speaking-exam/speaking-5');
  await act(async () => { fireEvent.click(screen.getByText('始める')); });
  expect(screen.getByText('トピックカード')).toBeInTheDocument();
  expect(screen.getByText('1:00')).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(61_000); });
  expect(screen.getByText('話す時間')).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(121_000); });
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('セルフチェック')).toBeInTheDocument();
  vi.useRealTimers();
});
