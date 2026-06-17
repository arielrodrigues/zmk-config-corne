import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DocsViewer } from './components/DocsViewer';
import { Placeholder } from './components/Placeholder';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/docs/getting-started" replace />} />
          <Route path="docs/:slug" element={<DocsViewer />} />
          <Route path="rgb" element={<Placeholder title="RGB Editor — coming in Phase 2" />} />
          <Route path="oled" element={<Placeholder title="OLED Editor — coming in Phase 3" />} />
          <Route
            path="vampire"
            element={<Placeholder title="Vampire Frame Editor — coming in Phase 4" />}
          />
          <Route path="keymap" element={<Placeholder title="Keymap Viewer — coming in Phase 5" />} />
          <Route path="build" element={<Placeholder title="Build Panel — coming in Phase 1" />} />
          <Route
            path="*"
            element={<div className="placeholder">Not found</div>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
