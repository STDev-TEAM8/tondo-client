import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import VisualizerPage from './pages/VisualizerPage';
import WaitingPage from './pages/WaitingPage';
import ResultPage from './pages/ResultPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/visualizer" element={<VisualizerPage />} />
        <Route path="/waiting" element={<WaitingPage />} />
        <Route path="/result/:taskId" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
