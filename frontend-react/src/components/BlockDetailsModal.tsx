import React, { useState, useEffect } from 'react';
import { BlockHeader } from '../types/Message';

interface BlockDetailsModalProps {
  blockHeader: BlockHeader | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BlockDetailsModal: React.FC<BlockDetailsModalProps> = ({ blockHeader, isOpen, onClose }) => {
  const [coinbaseData, setCoinbaseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (blockHeader && isOpen) {
      // TODO: Fetch coinbase transaction data when API is available
      // For now, we'll display the block header information
      setCoinbaseData(null);
    }
  }, [blockHeader, isOpen]);

  if (!isOpen || !blockHeader) return null;

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getTimeSince = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const calculateDifficulty = (bits: number) => {
    // Convert bits to difficulty
    const nShift = (bits >> 24) & 0xff;
    let dDiff = 0x0000ffff / (bits & 0x00ffffff);
    let nShiftAmount = 256 - nShift - 32;
    
    while (nShiftAmount > 0) {
      dDiff = dDiff * 256.0;
      nShiftAmount -= 8;
    }
    
    return dDiff.toExponential(2);
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'mainnet': return 'from-green-400 to-green-600';
      case 'testnet': return 'from-blue-400 to-blue-600';
      case 'teratestnet': return 'from-indigo-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
        </div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className={`bg-gradient-to-r ${getNetworkColor(blockHeader.Network)} px-6 py-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⛓️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Block #{blockHeader.Height.toLocaleString()}</h3>
                  <p className="text-white/80">{blockHeader.Network}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-gray-50 px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Block Information */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#1B1EA9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Block Header
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Hash</label>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-gray-900 break-all">{blockHeader.Hash}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(blockHeader.Hash)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Previous Hash</label>
                    <p className="font-mono text-sm text-gray-900 break-all">{blockHeader.PreviousHash}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Merkle Root</label>
                    <p className="font-mono text-sm text-gray-900 break-all">{blockHeader.MerkleRoot}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Version</label>
                      <p className="text-gray-900">{blockHeader.Version}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Nonce</label>
                      <p className="text-gray-900">{blockHeader.Nonce.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mining Information */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#FF2DAF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Mining Details
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Timestamp</label>
                    <p className="text-gray-900">{formatTimestamp(blockHeader.Timestamp)}</p>
                    <p className="text-sm text-gray-600">{getTimeSince(blockHeader.Timestamp)}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Difficulty</label>
                    <p className="text-gray-900">{calculateDifficulty(blockHeader.Bits)}</p>
                    <p className="text-sm text-gray-600">Bits: 0x{blockHeader.Bits.toString(16)}</p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Received At</label>
                    <p className="text-gray-900">{new Date(blockHeader.ReceivedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coinbase Transaction Section */}
            <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#1B1EA9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coinbase Transaction
              </h4>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1B1EA9] border-t-transparent"></div>
                </div>
              ) : coinbaseData ? (
                <div className="space-y-3">
                  {/* Coinbase data will be displayed here when API is available */}
                  <div className="text-gray-600">Coinbase transaction details will be available soon.</div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Coinbase transaction data not yet available</p>
                  <p className="text-sm text-gray-500 mt-2">This feature requires additional API endpoints</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] text-white rounded-lg hover:from-[#1515A0] hover:to-[#FF1FA0] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};