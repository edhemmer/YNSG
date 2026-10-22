'use client';

import {useState, type ReactNode} from 'react';

// Mount on first use, then retain drafts and uncertain command recovery while closed.
export default function DeferredTool({label, children}: {label: string; children: ReactNode}) {
  const [visited, setVisited] = useState(false);
  return <details className="card money-tools" onToggle={event => {
    if (event.currentTarget.open) setVisited(true);
  }}>
    <summary>{label}</summary>
    {visited ? children : null}
  </details>;
}
