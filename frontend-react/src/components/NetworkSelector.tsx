import React from 'react';
import { Network } from '../types/Message';

interface NetworkSelectorProps {
  selectedNetwork: Network | 'all';
  onNetworkChange: (network: Network | 'all') => void;
  networks: Network[];
}

const networkInfo: Record<Network | 'all', { label: string; color: string; bgColor: string; ringColor: string }> = {
  all: { label: 'All Networks', color: 'text-bsv-primary', bgColor: 'bg-bsv-50', ringColor: 'ring-bsv-primary' },
  mainnet: { label: 'Mainnet', color: 'text-orange-700', bgColor: 'bg-orange-100', ringColor: 'ring-orange-500' },
  testnet: { label: 'Testnet', color: 'text-green-700', bgColor: 'bg-green-100', ringColor: 'ring-green-500' },
  regtest: { label: 'Regtest', color: 'text-purple-700', bgColor: 'bg-purple-100', ringColor: 'ring-purple-500' },
  stn: { label: 'STN', color: 'text-bsv-secondary', bgColor: 'bg-blue-100', ringColor: 'ring-bsv-secondary' },
  teratestnet: { label: 'TeraTestnet', color: 'text-indigo-700', bgColor: 'bg-indigo-100', ringColor: 'ring-indigo-500' },
  tstn: { label: 'TSTN', color: 'text-bsv-accent', bgColor: 'bg-pink-100', ringColor: 'ring-bsv-accent' }
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
              ? `${networkInfo['all'].bgColor} ${networkInfo['all'].color} ring-2 ring-offset-2 ${networkInfo['all'].ringColor}`
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
                ? `${networkInfo[network].bgColor} ${networkInfo[network].color} ring-2 ring-offset-2 ${networkInfo[network].ringColor}`
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