import React from 'react';
import { useOverviewData } from './overview/useOverviewData';
import { NetworkSection } from './overview/NetworkSection';
import { fmt, fmtCompact } from './overview/utils';
import '../styles/teranode-overview.css';

export const Dashboard: React.FC = () => {
  const { networks, totalNodes, totalHealthy, totalMessages, totalPeers, loading, error } = useOverviewData();

  return (
    <>
      <Hero />
      <Strip
        networks={networks.length}
        totalNodes={totalNodes}
        totalHealthy={totalHealthy}
        totalPeers={totalPeers}
        totalMessages={totalMessages}
      />
      {error && (
        <div style={{ margin: '0 32px 12px', padding: '12px 16px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', borderRadius: 10, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}
      <div className="tn-stack">
        {loading && networks.every(n => n.nodes.length === 0) ? (
          <div className="tn-net-empty" style={{ padding: '64px 0' }}>Loading network state…</div>
        ) : (
          networks.map(net => (
            <NetworkSection key={net.id} net={net} />
          ))
        )}
      </div>
    </>
  );
};

const Hero: React.FC = () => (
  <section className="tn-hero">
    <div className="tn-hero-l">
      <div className="tn-eyebrow">Live · 24h window · all networks</div>
      <h1 className="tn-h1">
        Teranode <span className="tn-h1-accent">overview</span>
      </h1>
      <p className="tn-lede">
        Block heights, sync state and peer activity across Mainnet, Testnet and Teratestnet — sourced from the P2P gossip layer.
      </p>
    </div>
  </section>
);

interface StripProps {
  networks: number;
  totalNodes: number;
  totalHealthy: number;
  totalPeers: number;
  totalMessages: number;
}

const Strip: React.FC<StripProps> = ({ networks, totalNodes, totalHealthy, totalPeers, totalMessages }) => {
  const items = [
    { k: 'Networks', v: String(networks), meta: 'tracked' },
    { k: 'Teranodes online', v: `${totalHealthy}/${totalNodes}`, meta: 'healthy / total' },
    { k: 'Active peers', v: totalPeers ? fmt(totalPeers) : '—', meta: 'across all nets' },
    { k: 'P2P messages', v: totalMessages ? fmtCompact(totalMessages) : '—', meta: 'all-time' },
  ];
  return (
    <section className="tn-strip">
      {items.map(it => (
        <div key={it.k} className="tn-strip-cell">
          <div className="tn-strip-k">{it.k}</div>
          <div className="tn-strip-v">{it.v}</div>
          <div className="tn-strip-meta">{it.meta}</div>
        </div>
      ))}
    </section>
  );
};
