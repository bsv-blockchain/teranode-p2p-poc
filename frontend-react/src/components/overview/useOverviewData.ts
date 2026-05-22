import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Message, Network, NodeStatus } from '../../types/Message';
import { ApiService } from '../../services/api';
import { nodeStatusStore } from '../../services/nodeStatusStore';
import { MessageParser } from '../../utils/messageParser';
import { useWebSocket } from '../../hooks/useWebSocket';
import { PeerNamesService } from '../../services/peerNames';
import { NetworkView, NodeView, NETWORK_META } from './types';
import { deriveNodeStatus, regionFromBaseURL } from './utils';

const NETWORKS_LIST: Network[] = NETWORK_META.map(m => m.id);
const STALE_AFTER_MS = 5 * 60 * 1000;
const SPARK_SAMPLES = 96;
const REFRESH_MS = 30_000;
const RATE_WINDOW_MINS = 60;

function synthesizeSpark(currentHeight: number, blockTimeSec: number): number[] {
  if (!currentHeight) return [];
  const blocksPer15m = Math.max(1, Math.round((15 * 60) / Math.max(1, blockTimeSec)));
  const start = Math.max(0, currentHeight - blocksPer15m * (SPARK_SAMPLES - 1));
  const out: number[] = [];
  for (let i = 0; i < SPARK_SAMPLES; i++) {
    out.push(start + Math.round(((currentHeight - start) * i) / (SPARK_SAMPLES - 1)));
  }
  return out;
}

function buildNodeView(
  s: NodeStatus,
  tip: number,
  peerRates: Map<string, number>,
  blockTimeSec: number,
  now: number
): NodeView {
  const peerId = s.PeerID;
  const lag = Math.max(0, tip - (s.BestHeight || 0));
  const measured = peerRates.get(peerId) ?? 0;

  const recvAge = now - new Date(s.ReceivedAt).getTime();
  const recent = recvAge < STALE_AFTER_MS;
  const status = deriveNodeStatus(s.FSMState, s.ListenMode, lag, recent);

  // At-tip nodes that haven't yet accumulated a server-measured rate assume the
  // network baseline — they're keeping pace with the chain by definition.
  const baseline = 3600 / Math.max(1, blockTimeSec);
  let blocksPerHour: number;
  if (measured > 0) blocksPerHour = measured;
  else if (status === 'ok' || status === 'listen') blocksPerHour = baseline;
  else blocksPerHour = 0;

  const labelBase = PeerNamesService.getName(peerId) || s.ClientName || peerId;
  const label = labelBase.length > 24 ? labelBase.slice(0, 22) + '…' : labelBase;
  return {
    id: peerId,
    label,
    region: regionFromBaseURL(s.BaseURL),
    version: s.Version || '',
    status,
    height: s.BestHeight || 0,
    lag,
    blocksPerHour: Math.round(blocksPerHour),
    peers: 0,
    uptimeDays: Math.floor((s.Uptime || 0) / 86400),
    spark: synthesizeSpark(s.BestHeight || 0, blockTimeSec),
  };
}

export interface OverviewData {
  networks: NetworkView[];
  totalNodes: number;
  totalHealthy: number;
  totalPeers: number;
  totalMessages: number;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
}

export function useOverviewData(): OverviewData {
  const [stats, setStats] = useState({ totalMessages: 0, uniquePeers: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const peerRates = useRef<Map<string, number>>(new Map());

  const handleMessage = useCallback((message: Message) => {
    const topic = message.Topic || '';
    if (!topic.includes('node_status')) return;
    try {
      const parsed: any = MessageParser.parseWebSocketMessage(message);
      if (parsed && 'FSMState' in parsed) {
        const ns = parsed as NodeStatus;
        const networkPart = topic.split('/')[3]?.split('-')[0];
        if (networkPart) ns.Network = networkPart;
        nodeStatusStore.updateNodeStatus(ns);
      }
    } catch {
      /* ignore parse errors */
    }
  }, []);

  const { status: wsStatus } = useWebSocket(handleMessage);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [rates, ...statusResults] = await Promise.all([
          ApiService.getPeerRates(RATE_WINDOW_MINS).catch(() => []),
          ...NETWORKS_LIST.map(net =>
            ApiService.getLatestNodeStatuses(net).then(arr => ({ net, arr }))
          ),
        ]);
        if (cancelled) return;
        const next = new Map<string, number>();
        rates.forEach(r => {
          if (r.blocks_per_hour > 0) next.set(r.peer_id, r.blocks_per_hour);
        });
        peerRates.current = next;
        statusResults.forEach(({ net, arr }) => nodeStatusStore.setNodeStatuses(net, arr));
        try {
          const s = await ApiService.getMessageStats();
          if (!cancelled) {
            setStats({ totalMessages: s.totalMessages || 0, uniquePeers: s.uniquePeers || 0 });
          }
        } catch {
          /* stats are optional */
        }
        if (!cancelled) {
          setError(null);
          setTick(t => t + 1);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load node statuses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const unsub = nodeStatusStore.subscribe(() => setTick(t => t + 1));
    const bump = () => setTick(t => t + 1);
    window.addEventListener('peer-name-changed', bump);
    window.addEventListener('peer-names-cleared', bump);
    return () => {
      unsub();
      window.removeEventListener('peer-name-changed', bump);
      window.removeEventListener('peer-names-cleared', bump);
    };
  }, []);

  const networks = useMemo<NetworkView[]>(() => {
    const now = Date.now();
    return NETWORK_META.map(meta => {
      const statuses = nodeStatusStore.getNodeStatuses(meta.id);
      const tip = statuses.reduce((max, s) => Math.max(max, s.BestHeight || 0), 0);
      const nodes = statuses
        .map(s => buildNodeView(s, tip, peerRates.current, meta.blockTimeSec, now))
        .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
      return {
        id: meta.id,
        name: meta.name,
        accent: meta.accent,
        accentRgb: meta.accentRgb,
        blockTimeSec: meta.blockTimeSec,
        tip,
        avgBlockMs: meta.blockTimeSec * 1000,
        hashrate: '—',
        nodes,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const totalNodes = networks.reduce((s, n) => s + n.nodes.length, 0);
  const totalHealthy = networks.reduce(
    (s, n) => s + n.nodes.filter(x => x.status === 'ok' || x.status === 'listen').length,
    0
  );

  return {
    networks,
    totalNodes,
    totalHealthy,
    totalPeers: stats.uniquePeers,
    totalMessages: stats.totalMessages,
    loading,
    error,
    wsConnected: wsStatus === 'connected',
  };
}
