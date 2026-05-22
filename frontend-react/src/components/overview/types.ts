import { Network } from '../../types/Message';

export type NodeViewStatus = 'ok' | 'catchup' | 'listen' | 'down';

export interface NodeView {
  id: string;
  label: string;
  region: string;
  version: string;
  status: NodeViewStatus;
  height: number;
  lag: number;
  blocksPerHour: number;
  peers: number;
  uptimeDays: number;
  spark: number[];
}

export interface NetworkView {
  id: Network;
  name: string;
  accent: string;
  accentRgb: string;
  blockTimeSec: number;
  tip: number;
  avgBlockMs: number;
  hashrate: string;
  nodes: NodeView[];
}

export const NETWORK_META: Array<{
  id: Network;
  name: string;
  accent: string;
  accentRgb: string;
  blockTimeSec: number;
}> = [
  { id: 'mainnet',     name: 'Mainnet',     accent: '#003FFF', accentRgb: '0,63,255',     blockTimeSec: 600 },
  { id: 'testnet',     name: 'Testnet',     accent: '#22c55e', accentRgb: '34,197,94',    blockTimeSec: 600 },
  { id: 'teratestnet', name: 'Teratestnet', accent: '#6366f1', accentRgb: '99,102,241',   blockTimeSec: 600 },
];

export type Theme = 'dark' | 'light';
