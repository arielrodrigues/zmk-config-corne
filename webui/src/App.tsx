import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DocsViewer } from './components/DocsViewer';
import { BuildPanel } from './components/BuildPanel';
import { RGBEditor } from './components/RGBEditor';
import { OLEDEditor } from './components/OLEDEditor';
import { VampireFrameEditor } from './components/VampireFrameEditor';
import { KeymapViewer } from './components/KeymapViewer';

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
          <Route path="keymap" element={<KeymapViewer />} />
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
