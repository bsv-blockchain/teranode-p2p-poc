import React from 'react';
import { NodeView, NetworkView } from './types';
import { HealthDot } from './HealthDot';
import { fmt, fmtCompact, fmtRate, fmtEta, statusLabel } from './utils';

interface NodeCardProps {
  node: NodeView;
  net: NetworkView;
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, net }) => {
  const baseline = Math.round(3600 / Math.max(1, net.blockTimeSec));
  const eta = node.lag / Math.max(1, node.blocksPerHour);
  const showPeers = node.peers > 0;
  const lagAtTip = node.lag === 0;
  const hot = node.blocksPerHour > baseline * 2;
  const status = statusLabel(node.status);

  return (
    <article className={`tn-card tn-card-${node.status}`}>
      <header className="tn-card-head">
        <div className="tn-card-id">
          <HealthDot status={node.status} />
          <span className="tn-card-id-text" title={node.label}>{node.label}</span>
        </div>
        <span className="tn-card-region">{node.region || '—'}</span>
      </header>

      <div className="tn-card-height">
        <div className="tn-card-height-v">{fmt(node.height)}</div>
        <div className="tn-card-height-l">block height</div>
      </div>

      <div className="tn-card-stats">
        <div className="tn-card-stat">
          <div className="tn-card-stat-l">blocks/hr</div>
          <div className={`tn-card-stat-v tn-mono${hot ? ' tn-card-stat-hot' : ''}`}>
            {fmtRate(node.blocksPerHour)}
          </div>
          <div className="tn-card-stat-sub">&nbsp;</div>
        </div>
        <div className="tn-card-stat">
          <div className="tn-card-stat-l">lag</div>
          {lagAtTip ? (
            <>
              <div className="tn-card-stat-v tn-card-stat-ok">at tip</div>
              <div className="tn-card-stat-sub">&nbsp;</div>
            </>
          ) : (
            <>
              <div className="tn-card-stat-v tn-mono tn-card-stat-warn">−{fmtCompact(node.lag)}</div>
              <div className="tn-card-stat-sub">{isFinite(eta) && eta > 0 ? `ETA ${fmtEta(eta)}` : <>&nbsp;</>}</div>
            </>
          )}
        </div>
      </div>

      <footer className="tn-card-foot">
        <span className={`tn-card-status tn-card-status-${node.status}`}>
          {status}{node.lag ? ' · −' + fmt(node.lag) : ''}
        </span>
        <span className="tn-card-meta">
          {showPeers ? `${node.peers} peers · ` : ''}{node.version || '—'}
        </span>
      </footer>
    </article>
  );
};
