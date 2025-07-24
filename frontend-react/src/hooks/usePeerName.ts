import { useState, useEffect } from 'react';
import { PeerNamesService } from '../services/peerNames';

export const usePeerName = (peerID: string) => {
  const [friendlyName, setFriendlyName] = useState<string | null>(null);

  useEffect(() => {
    // Load initial name
    setFriendlyName(PeerNamesService.getName(peerID));

    // Listen for changes
    const handleNameChange = (event: CustomEvent) => {
      if (event.detail.peerID === peerID) {
        setFriendlyName(event.detail.name);
      }
    };

    const handleNamesCleared = () => {
      setFriendlyName(null);
    };

    window.addEventListener('peer-name-changed', handleNameChange as any);
    window.addEventListener('peer-names-cleared', handleNamesCleared);

    return () => {
      window.removeEventListener('peer-name-changed', handleNameChange as any);
      window.removeEventListener('peer-names-cleared', handleNamesCleared);
    };
  }, [peerID]);

  const setName = (name: string) => {
    PeerNamesService.setName(peerID, name);
  };

  const removeName = () => {
    PeerNamesService.removeName(peerID);
  };

  return { friendlyName, setName, removeName };
};