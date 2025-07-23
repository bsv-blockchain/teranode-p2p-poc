import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PeerDetail as PeerDetailType } from '../types/Message';
import { ApiService } from '../services/api';

const PeerDetail: React.FC = () => {
  const { peerID } = useParams<{ peerID: string }>();
  const [peerDetail, setPeerDetail] = useState<PeerDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (peerID) {
      fetchPeerDetail();
    }
  }, [peerID]);

  const fetchPeerDetail = async () => {
    if (!peerID) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const detail = await ApiService.getPeerDetail(peerID);
      setPeerDetail(detail);
    } catch (err) {
      setError('Failed to load peer details');
      console.error('Error fetching peer detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !peerDetail) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Link to="/peers" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Peers
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600">{error || 'Peer not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <Link to="/peers" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Peers
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Peer Details</h1>
          <p className="text-gray-600 font-mono text-sm break-all">
            {peerDetail.peerID}
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Messages</h3>
            <p className="text-2xl font-bold text-gray-900">
              {peerDetail.totalMessages.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Active Duration</h3>
            <p className="text-2xl font-bold text-gray-900">
              {getTimeDuration(peerDetail.firstSeen, peerDetail.lastSeen)}
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Networks</h3>
            <div className="flex flex-wrap gap-1 mt-2">
              {peerDetail.networks.map((network) => (
                <span
                  key={network}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    network === 'mainnet' ? 'bg-green-100 text-green-800' :
                    network === 'testnet' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {network}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Time Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">First Seen</p>
              <p className="text-sm font-medium text-gray-900">{formatTime(peerDetail.firstSeen)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Seen</p>
              <p className="text-sm font-medium text-gray-900">{formatTime(peerDetail.lastSeen)}</p>
            </div>
          </div>
        </div>

        {/* Message Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Types</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(peerDetail.messageTypes).map(([type, count]) => (
              <div key={type} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-600">{type}</p>
                <p className="text-lg font-bold text-gray-900">{count.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Handshakes */}
        {peerDetail.handshakes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Handshakes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User Agent</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Best Height</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {peerDetail.handshakes.map((handshake, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{handshake.Type}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate" title={handshake.UserAgent}>
                        {handshake.UserAgent}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{handshake.BestHeight.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatTime(handshake.ReceivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Blocks */}
        {peerDetail.recentBlocks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Blocks</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Height</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {peerDetail.recentBlocks.map((block, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{block.Height.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                        {block.Hash.substring(0, 16)}...
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          block.Network === 'mainnet' ? 'bg-green-100 text-green-800' :
                          block.Network === 'testnet' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {block.Network}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatTime(block.ReceivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Mining */}
        {peerDetail.recentMining.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Mining Activity</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Height</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Miner</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tx Count</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {peerDetail.recentMining.map((mining, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{mining.Height.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{mining.Miner}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {(mining.SizeInBytes / 1024 / 1024).toFixed(2)} MB
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{mining.TxCount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatTime(mining.ReceivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeerDetail;