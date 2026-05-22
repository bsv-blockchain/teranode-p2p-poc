import { NodeView, NetworkView } from './types';

export const fmt = (n: number): string => n.toLocaleString('en-US');

export const fmtCompact = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};

export const fmtRate = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
};

export const fmtMs = (ms: number): string => {
  if (!ms || !isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return m + 'm ' + (rs < 10 ? '0' : '') + rs + 's';
};

export const fmtEta = (hours: number): string => {
  if (!isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return Math.round(hours * 60) + 'm';
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  return h ? d + 'd ' + h + 'h' : d + 'd';
};

export const networkHealth = (net: NetworkView): number => {
  if (!net.nodes.length) return 0;
  const atTip = net.nodes.filter(n => n.status === 'ok' || n.status === 'listen').length;
  return Math.round((atTip / net.nodes.length) * 100);
};

/** First-derivative of a 24h height series (96 samples) → blocks-per-hour series (95 samples). */
export const toBlocksPerHour = (spark: number[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < spark.length; i++) {
    out.push(Math.max(0, (spark[i] - spark[i - 1]) * 4));
  }
  return out;
};

/** Shortened BaseURL — full hostname only (scheme, port, path stripped). */
export const regionFromBaseURL = (baseURL?: string): string => {
  if (!baseURL) return '';
  try {
    return new URL(baseURL).hostname;
  } catch {
    return baseURL.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0] || '';
  }
};

/** Derive node sync status from FSMState + ListenMode + lag heuristics. */
export const deriveNodeStatus = (
  fsmState: string | undefined,
  listenMode: string | undefined,
  lag: number,
  recentlySeen: boolean
): NodeView['status'] => {
  if (!recentlySeen) return 'down';
  const state = (fsmState || '').toUpperCase();
  if (listenMode === 'listen_only' || listenMode === 'listen-only' || listenMode === 'listen') {
    return 'listen';
  }
  if (state === 'CATCHINGBLOCKS' || state === 'LEGACYSYNC' || state === 'CATCHING_BLOCKS') {
    return 'catchup';
  }
  if (state === 'RUNNING') {
    return lag > 2 ? 'catchup' : 'ok';
  }
  if (state === 'IDLE' || !state) return 'down';
  return 'ok';
};

export const statusLabel = (status: NodeView['status']): string => ({
  ok:      'In sync',
  catchup: 'Catching up',
  listen:  'Listen only',
  down:    'Behind',
}[status]);
