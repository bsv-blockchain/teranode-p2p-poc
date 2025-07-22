import React, { useState } from 'react';
import { SearchFilters } from '../types/Message';

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, onClear, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [peer, setPeer] = useState('');
  const [limit, setLimit] = useState('20');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filters: SearchFilters = {
      page: 1 // Reset to first page on new search
    };
    
    if (topic.trim()) filters.topic = topic.trim();
    if (peer.trim()) filters.peer = peer.trim();
    if (limit.trim()) {
      const limitNum = parseInt(limit, 10);
      if (limitNum > 0 && limitNum <= 100) {
        filters.limit = limitNum;
      }
    }
    
    onSearch(filters);
  };

  const handleClear = () => {
    setTopic('');
    setPeer('');
    setLimit('20');
    onClear();
  };

  const pageSizeOptions = [10, 20, 50, 100];

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Search Messages</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Topic</label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Filter by topic..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-blue-50/50 transition-all duration-300"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Peer</label>
            <div className="relative">
              <input
                type="text"
                value={peer}
                onChange={(e) => setPeer(e.target.value)}
                placeholder="Filter by peer ID..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-blue-50/50 transition-all duration-300"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Per page:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
            
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-600/25"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;