import React from 'react';
import { Network } from '../types/Message';

interface NetworkSelectorProps {
  selectedNetwork: Network | 'all';
  onNetworkChange: (network: Network | 'all') => void;
  networks: Network[];
}

const networkInfo: Record<Network | 'all', { label: string; color: string; bgColor: string }> = {
  all: { label: 'All Networks', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  mainnet: { label: 'Mainnet', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  testnet: { label: 'Testnet', color: 'text-green-700', bgColor: 'bg-green-100' },
  regtest: { label: 'Regtest', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  stn: { label: 'STN', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  teratestnet: { label: 'TeraTestnet', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  tstn: { label: 'TSTN', color: 'text-pink-700', bgColor: 'bg-pink-100' }
};

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ 
  selectedNetwork, 
  onNetworkChange, 
  networks 
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Network</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button
          key="all"
          onClick={() => onNetworkChange('all')}
          className={`
            px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
            ${selectedNetwork === 'all'
              ? `${networkInfo['all'].bgColor} ${networkInfo['all'].color} ring-2 ring-offset-2 ring-gray-400`
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }
          `}
        >
          {networkInfo['all'].label}
        </button>
        {networks.map(network => (
          <button
            key={network}
            onClick={() => onNetworkChange(network)}
            className={`
              px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
              ${selectedNetwork === network
                ? `${networkInfo[network].bgColor} ${networkInfo[network].color} ring-2 ring-offset-2 ring-offset-white`
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }
            `}
          >
            {networkInfo[network].label}
          </button>
        ))}
      </div>
    </div>
  );
};