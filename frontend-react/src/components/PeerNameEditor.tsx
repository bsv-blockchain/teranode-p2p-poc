import React, { useState, useRef, useEffect } from 'react';
import { usePeerName } from '../hooks/usePeerName';

interface PeerNameEditorProps {
  peerID: string;
  className?: string;
  buttonClassName?: string;
  showFullPeerID?: boolean;
}

export const PeerNameEditor: React.FC<PeerNameEditorProps> = ({ 
  peerID, 
  className = '',
  buttonClassName = '',
  showFullPeerID = false
}) => {
  const { friendlyName, setName } = usePeerName(peerID);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setInputValue(friendlyName || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && trimmedValue !== friendlyName) {
      setName(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const truncatePeerID = (id: string, maxLength: number = 16) => {
    if (id.length <= maxLength) return id;
    return `${id.substring(0, maxLength)}...`;
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter friendly name"
          className="px-3 py-1 text-sm text-current bg-white/20 border border-white/30 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent placeholder-current/50"
          maxLength={50}
        />
        <button
          onClick={handleSave}
          className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          title="Save"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm">
        {friendlyName ? (
          <span>
            <span className="font-medium text-gray-900">{friendlyName}</span>
            {showFullPeerID && (
              <span className="text-gray-500 ml-1">
                ({truncatePeerID(peerID)})
              </span>
            )}
          </span>
        ) : (
          <span className="font-mono text-gray-600">
            {showFullPeerID ? peerID : truncatePeerID(peerID)}
          </span>
        )}
      </span>
      <button
        onClick={handleEdit}
        className={`p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${buttonClassName}`}
        title={friendlyName ? "Edit friendly name" : "Add friendly name"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
};