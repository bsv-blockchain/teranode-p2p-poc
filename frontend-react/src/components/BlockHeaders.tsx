import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { BlockHeader, Network } from '../types/Message';
import { NetworkSelector } from './NetworkSelector';

export const BlockHeaders: React.FC = () => {
  const [blockHeaders, setBlockHeaders] = useState<BlockHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | 'all'>('all');
  const [networks] = useState<Network[]>(['mainnet', 'testnet', 'teratestnet']);

  useEffect(() => {
    fetchBlockHeaders();
  }, [selectedNetwork]);

  const fetchBlockHeaders = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { limit: 50 };
      if (selectedNetwork !== 'all') {
        params.network = selectedNetwork;
      }
      const headers = await ApiService.getBlockHeaders(params);
      setBlockHeaders(headers);
    } catch (err) {
      setError('Failed to fetch block headers');
      console.error('Error fetching block headers:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Block Headers</h2>
      
      <div className="mb-6">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={setSelectedNetwork}
          networks={networks}
        />
      </div>

      {loading && <p className="text-gray-600">Loading block headers...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && blockHeaders.length === 0 && (
        <p className="text-gray-600">No block headers found</p>
      )}

      {!loading && !error && blockHeaders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Height
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nonce
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {blockHeaders.map((header) => (
                <tr key={header.ID}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {header.Network}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {header.Height.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono truncate max-w-xs" title={header.Hash}>
                    {header.Hash}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(header.Timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {header.Version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {header.Nonce}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};