import { useEffect, useState } from 'react';
import Landing from './views/Landing';
import AssessmentApp from './views/assessment/AssessmentApp';
import { Imprint, Privacy } from './views/Legal';

/** Routes: landing page, assessment, imprint and privacy notice. Vercel rewrites every path to index.html. */
export function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export default function App() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  if (path.startsWith('/assessment')) return <AssessmentApp />;
  if (path.startsWith('/imprint')) return <Imprint />;
  if (path.startsWith('/privacy')) return <Privacy />;
  return <Landing />;
}
