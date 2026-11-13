import { useEffect, useState } from 'react';
import Landing from './views/Landing';
import AssessmentApp from './views/assessment/AssessmentApp';
import { LegalDialog } from './views/LegalDialog';
import { legalTabForPath, openLegal, useLegal } from './lib/legal';

/** Routes: landing page and assessment. /imprint and /privacy open the legal dialog over the landing page. Vercel rewrites every path to index.html. */
export function navigate(path: string) {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export default function App() {
  const [path, setPath] = useState(() => location.pathname);
  const legal = useLegal();

  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  // A direct visit to /imprint or /privacy opens the dialog.
  useEffect(() => {
    const tab = legalTabForPath(path);
    if (tab) openLegal(tab);
  }, [path]);

  // Closing the dialog on a direct legal URL returns to the landing page address.
  useEffect(() => {
    if (!legal && legalTabForPath(location.pathname)) {
      history.replaceState(null, '', '/');
      setPath('/');
    }
  }, [legal]);

  // Any in-app link to /imprint or /privacy opens the dialog instead of leaving the page.
  // Ctrl/Cmd/Shift-click still opens the link in a new tab.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const tab = legalTabForPath(url.pathname);
      if (!tab) return;
      e.preventDefault();
      openLegal(tab);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <>
      {path.startsWith('/assessment') ? <AssessmentApp /> : <Landing />}
      <LegalDialog />
    </>
  );
}
