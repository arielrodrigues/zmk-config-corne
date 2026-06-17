import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DocsViewer } from './components/DocsViewer';
import { Placeholder } from './components/Placeholder';
import { BuildPanel } from './components/BuildPanel';
import { RGBEditor } from './components/RGBEditor';
import { OLEDEditor } from './components/OLEDEditor';
import { VampireFrameEditor } from './components/VampireFrameEditor';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/docs/getting-started" replace />} />
          <Route path="docs/:slug" element={<DocsViewer />} />
          <Route path="rgb" element={<RGBEditor />} />
          <Route path="oled" element={<OLEDEditor />} />
          <Route path="vampire" element={<VampireFrameEditor />} />
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
