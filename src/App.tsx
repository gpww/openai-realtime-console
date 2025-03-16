import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ConsolePage } from './pages/ConsolePage';
import { CoqiPage } from './pages/CoqiPage';
import { DebugPage } from './pages/DebugPage';
import './App.scss';

function App() {
  return (
    <Router>
      <div data-component="App">
        <Routes>
          <Route path="/" element={<ConsolePage />} />
          <Route path="/coqi" element={<CoqiPage />} />
          <Route path="/debug" element={<DebugPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;