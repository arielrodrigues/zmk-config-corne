import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DocSummary } from '../types';

type Group = { name: string; items: { to: string; label: string }[] };

const STATIC_GROUPS: Group[] = [
  {
    name: 'Editors',
    items: [
      { to: '/rgb', label: 'RGB Underglow' },
      { to: '/oled', label: 'OLED Display' },
      { to: '/vampire', label: 'Vampire Frames' },
      { to: '/keymap', label: 'Keymap' },
    ],
  },
  {
    name: 'Build',
    items: [{ to: '/build', label: 'Rebuild & KLE' }],
  },
];

export function Layout() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDocs()
      .then((r) => setDocs(r.items))
      .catch((e: Error) => setDocsError(e.message));
  }, []);

  const docGroups = new Map<string, DocSummary[]>();
  if (docs) {
    for (const d of docs) {
      const g = docGroups.get(d.group) ?? [];
      g.push(d);
      docGroups.set(d.group, g);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>ZMK Corne Config</h1>
        {STATIC_GROUPS.map((g) => (
          <div key={g.name}>
            <h2>{g.name}</h2>
            <nav>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {it.label}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        {[...docGroups.entries()].map(([group, items]) => (
          <div key={group}>
            <h2>{group}</h2>
            <nav>
              {items.map((d) => (
                <NavLink
                  key={d.slug}
                  to={`/docs/${d.slug}`}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {d.title}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        {docsError && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12, padding: 4 }}>
            Failed to load docs: {docsError}
          </div>
        )}
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
