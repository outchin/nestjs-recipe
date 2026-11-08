import { Link, Route, Routes, useLocation } from 'react-router';
import { HomePage } from './pages/HomePage';
import { IdempotencyPage } from './pages/IdempotencyPage';

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
          <Link to="/" className="brand">nestjs-recipe</Link>
          {pathname !== '/' && <span className="crumb">{pathname}</span>}
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/labs/inventory/idempotency" element={<IdempotencyPage />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Back to labs</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
