import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LiveDot } from './HealthDot';
import { Theme } from './types';

const THEME_STORAGE_KEY = 'teranode-overview-theme';

interface OverviewPrefs {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const PrefsCtx = createContext<OverviewPrefs | null>(null);

export const useOverviewPrefs = (): OverviewPrefs => {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error('useOverviewPrefs must be used inside OverviewPrefsProvider');
  return ctx;
};

const readStored = <T extends string>(key: string, allowed: T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    if (v && allowed.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return fallback;
};

export const OverviewPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => readStored<Theme>(THEME_STORAGE_KEY, ['dark', 'light'], 'dark'));

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const value = useMemo<OverviewPrefs>(() => ({ theme, setTheme }), [theme]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
};

interface ShellProps {
  children: React.ReactNode;
  showFooter?: boolean;
  liveOverride?: boolean;
}

export const Shell: React.FC<ShellProps> = ({ children, showFooter = true, liveOverride }) => {
  const { theme } = useOverviewPrefs();
  return (
    <div className={`tn-root tn-${theme}`}>
      <Nav live={liveOverride} />
      {children}
      {showFooter && <Footer />}
    </div>
  );
};

const Nav: React.FC<{ live?: boolean }> = ({ live }) => {
  const { theme, setTheme } = useOverviewPrefs();
  const location = useLocation();
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="tn-nav">
      <div className="tn-nav-l">
        <div className="tn-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 L22 20 L2 20 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="14" r="2.5" fill="currentColor" />
          </svg>
        </div>
        <div>
          <div className="tn-nav-title">Teranode P2P Monitor</div>
          <div className="tn-nav-sub">BSV Blockchain · Network Intelligence</div>
        </div>
      </div>
      <nav className="tn-nav-c">
        <Link to="/" className={`tn-nav-link${isActive('/') ? ' tn-nav-active' : ''}`}>Overview</Link>
        <Link to="/networks" className={`tn-nav-link${isActive('/networks') ? ' tn-nav-active' : ''}`}>Networks</Link>
        <Link to="/peers" className={`tn-nav-link${isActive('/peers') ? ' tn-nav-active' : ''}`}>Peers</Link>
        <Link to="/stats" className={`tn-nav-link${isActive('/stats') ? ' tn-nav-active' : ''}`}>Messages</Link>
      </nav>
      <div className="tn-nav-r">
        {live !== undefined && (
          <div className="tn-live" title={live ? 'WebSocket connected' : 'WebSocket disconnected'}>
            <LiveDot />
            <span>{live ? 'Live' : 'Offline'}</span>
          </div>
        )}
        <button
          type="button"
          className="tn-theme-btn"
          onClick={() => setTheme(nextTheme)}
          title={`Switch to ${nextTheme} mode`}
          aria-label={`Switch to ${nextTheme} mode`}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};

const Footer: React.FC = () => (
  <footer className="tn-foot">
    <div>Teranode P2P Monitor · v2.1.0 · Maintained by the BSV Association</div>
    <div className="tn-foot-r">
      <a href="https://github.com/bsv-blockchain" rel="noreferrer" target="_blank">GitHub</a>
    </div>
  </footer>
);
