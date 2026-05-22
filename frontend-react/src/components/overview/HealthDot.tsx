import React from 'react';
import { NodeViewStatus } from './types';

const COLORS: Record<NodeViewStatus, string> = {
  ok:      '#22c55e',
  catchup: '#f97316',
  listen:  '#facc15',
  down:    '#ef4444',
};

interface HealthDotProps {
  status: NodeViewStatus;
  size?: number;
}

export const HealthDot: React.FC<HealthDotProps> = ({ status, size = 8 }) => {
  const c = COLORS[status] || '#6b7280';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        boxShadow: `0 0 0 3px ${c}22, 0 0 8px ${c}88`,
        flexShrink: 0,
      }}
    />
  );
};

export const LiveDot: React.FC = () => (
  <span className="tn-live-dot" aria-hidden="true">
    <span className="tn-live-pulse" />
    <span className="tn-live-core" />
  </span>
);
