import React from 'react';
import { NetworkView } from './types';
import { NodeCard } from './NodeCard';
import { fmt, networkHealth } from './utils';

interface KpiPillProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  tone?: 'ok' | 'warn' | 'down';
}

const KpiPill: React.FC<KpiPillProps> = ({ label, value, mono, tone }) => (
  <div className={`tn-kpi${tone ? ' tn-kpi-' + tone : ''}`}>
    <span className="tn-kpi-l">{label}</span>
    <span className={`tn-kpi-v${mono ? ' tn-mono' : ''}`}>{value}</span>
  </div>
);

interface NetworkSectionProps {
  net: NetworkView;
}

export const NetworkSection: React.FC<NetworkSectionProps> = ({ net }) => {
  const health = networkHealth(net);
  const tone: 'ok' | 'warn' | 'down' = health === 100 ? 'ok' : health >= 80 ? 'warn' : 'down';
  const styleVars = {
    '--net-accent': net.accent,
    '--net-rgb': net.accentRgb,
  } as React.CSSProperties;

  return (
    <section className="tn-net" style={styleVars}>
      <header className="tn-net-head">
        <div className="tn-net-head-l">
          <span className="tn-net-tag">
            <span className="tn-net-dot" />
            {net.name}
          </span>
          <span className="tn-net-tip">
            <span className="tn-net-tip-label">CHAIN TIP</span>
            <span className="tn-net-tip-v">{net.tip ? fmt(net.tip) : '—'}</span>
          </span>
        </div>
        <div className="tn-net-head-r">
          <KpiPill label="Nodes" value={net.nodes.length} />
          <KpiPill label="Health" value={`${health}%`} tone={net.nodes.length ? tone : 'down'} />
        </div>
      </header>

      {net.nodes.length === 0 ? (
        <div className="tn-net-empty">No nodes reporting on this network yet.</div>
      ) : (
        <div className="tn-grid">
          {net.nodes.map(node => (
            <NodeCard key={node.id} node={node} net={net} />
          ))}
        </div>
      )}
    </section>
  );
};
