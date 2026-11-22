import { Link, Route, Routes, useLocation } from 'react-router';
import { HomePage } from './pages/HomePage';
import { IdempotencyPage } from './pages/IdempotencyPage';
import { IndexesPage } from './pages/IndexesPage';
import { LABS_HOME, PUBLISHED } from './site';

/**
 * One route per lab page, so a page can be linked directly
 * (e.g. http://localhost:5173/labs/inventory/idempotency).
 * New lab page: add a <Route> here and an entry in labPages (HomePage.tsx).
 */
export function App() {
  const { pathname } = useLocation();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          {PUBLISHED ? (
            <>
              {/* a plain link: "/" is the portfolio, not this app */}
              <a href="/" className="brand">zawwaisoe.dev</a>
              <Link to={LABS_HOME} className="crumb">labs</Link>
            </>
          ) : (
            <Link to="/" className="brand">nestjs-recipe</Link>
          )}
          {pathname !== LABS_HOME && <span className="crumb">{pathname}</span>}
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/labs" element={<HomePage />} />
          <Route path="/labs/inventory/idempotency" element={<IdempotencyPage />} />
          <Route path="/labs/indexes" element={<IndexesPage />} />
          <Route path="*" element={<p>Page not found. <Link to={LABS_HOME}>Back to labs</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
