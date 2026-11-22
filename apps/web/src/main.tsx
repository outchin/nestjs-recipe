import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { PUBLISHED } from './site';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* published build: routes already start with /labs, so the router stays at the root */}
    <BrowserRouter basename={PUBLISHED ? '/' : import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
