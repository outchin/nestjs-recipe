import { useState } from 'react';
import { Link } from 'react-router';
import { call } from '../api';

// One entry per lab endpoint. New labs just append here.
const endpoints = [
  { label: 'Health (shows DB driver)', method: 'GET', path: '/health' },
];

// One entry per lab page (see routes in App.tsx).
export const labPages = [
  { path: '/labs/inventory/idempotency', title: 'Inventory · Idempotency', blurb: 'Same key → same order. Buy twice, get charged once.' },
];

export function HomePage() {
  const [result, setResult] = useState<string>('Pick an endpoint.');

  async function run(method: string, path: string) {
    try {
      const r = await call(method, path);
      setResult(`${method} ${path} → ${r.status}\n\n${JSON.stringify(r.data, null, 2)}`);
    } catch (e) {
      setResult(`Request failed: ${(e as Error).message}\nIs the API running on :3000?`);
    }
  }

  return (
    <>
      <h1>Labs</h1>
      <p className="lead">Backend concepts, each with runnable code, tests and a small page to poke at it.</p>
      <ul className="lab-list">
        {labPages.map((l) => (
          <li key={l.path}>
            <Link to={l.path}>{l.title}</Link> <span className="muted">— {l.blurb}</span>
            <span className="path">{l.path}</span>
          </li>
        ))}
      </ul>

      <h2>Endpoints</h2>
      <div className="row">
        {endpoints.map((e) => (
          <button key={e.path} onClick={() => run(e.method, e.path)}>
            <span className="mono">{e.method}</span> {e.label}
          </button>
        ))}
      </div>
      <pre className="output">{result}</pre>
    </>
  );
}
