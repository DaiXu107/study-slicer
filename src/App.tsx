import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Library } from './pages/Library';
import { SettingsPage } from './pages/Settings';
import { Wizard } from './pages/Wizard';
import { AppProvider } from './store/AppContext';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="library" element={<Library />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="wizard" element={<Wizard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
