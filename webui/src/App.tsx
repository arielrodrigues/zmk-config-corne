import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DocsViewer } from './components/DocsViewer';
import { Placeholder } from './components/Placeholder';
import { BuildPanel } from './components/BuildPanel';
import { RGBEditor } from './components/RGBEditor';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/docs/getting-started" replace />} />
          <Route path="docs/:slug" element={<DocsViewer />} />
          <Route path="rgb" element={<RGBEditor />} />
          <Route path="oled" element={<Placeholder title="OLED Editor — coming in Phase 3" />} />
          <Route
            path="vampire"
            element={<Placeholder title="Vampire Frame Editor — coming in Phase 4" />}
          />
          <Route path="keymap" element={<Placeholder title="Keymap Viewer — coming in Phase 5" />} />
          <Route path="build" element={<BuildPanel />} />
          <Route
            path="*"
            element={<div className="placeholder">Not found</div>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
