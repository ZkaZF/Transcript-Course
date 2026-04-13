import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SubjectDetail from './pages/SubjectDetail';
import SessionDetail from './pages/SessionDetail';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './components/ThemeToggle';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subjects/:id" element={<SubjectDetail />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
          </Route>
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

