import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import type { DocContent } from '../types';

export function DocsViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setDoc(null);
    setError(null);
    api
      .getDoc(slug)
      .then(setDoc)
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <div style={{ color: 'var(--danger)' }}>Failed to load: {error}</div>;
  if (!doc) return <div className="placeholder">Loading…</div>;

  return (
    <article>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown}</ReactMarkdown>
    </article>
  );
}
