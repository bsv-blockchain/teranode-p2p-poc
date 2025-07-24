export class PeerNamesService {
  private static readonly STORAGE_KEY = 'teranode-peer-names';
  private static cache: Map<string, string> = new Map();
  private static initialized = false;

  // Initialize the cache from localStorage
  private static init() {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading peer names from localStorage:', error);
    }
    
    this.initialized = true;
  }

  // Save the cache to localStorage
  private static save() {
    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving peer names to localStorage:', error);
    }
  }

  // Set a friendly name for a peer
  static setName(peerID: string, name: string) {
    this.init();
    
    if (!peerID) return;
    
    // If name is empty, remove the entry
    if (!name || name.trim() === '') {
      this.removeName(peerID);
      return;
    }
    
    this.cache.set(peerID, name.trim());
    this.save();
    
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('peer-name-changed', { 
      detail: { peerID, name: name.trim() } 
    }));
  }

  // Get the friendly name for a peer
  static getName(peerID: string): string | null {
    this.init();
    return this.cache.get(peerID) || null;
  }

  // Remove a peer's friendly name
  static removeName(peerID: string) {
    this.init();
    this.cache.delete(peerID);
    this.save();
    
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('peer-name-changed', { 
      detail: { peerID, name: null } 
    }));
  }

  // Get all peer names
  static getAllNames(): Map<string, string> {
    this.init();
    return new Map(this.cache);
  }

  // Clear all peer names
  static clearAll() {
    this.cache.clear();
    this.save();
    
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent('peer-names-cleared'));
  }

  // Format a peer display with friendly name if available
  static formatPeerDisplay(peerID: string, options?: { 
    showBoth?: boolean; 
    truncate?: boolean;
    maxLength?: number;
  }): string {
    const friendlyName = this.getName(peerID);
    
    if (!friendlyName) {
      if (options?.truncate && options?.maxLength && peerID.length > options.maxLength) {
        return peerID.substring(0, options.maxLength) + '...';
      }
      return peerID;
    }
    
    if (options?.showBoth) {
      const truncatedID = options?.truncate && options?.maxLength && peerID.length > options.maxLength
        ? peerID.substring(0, options.maxLength) + '...'
        : peerID;
      return `${friendlyName} (${truncatedID})`;
    }
    
    return friendlyName;
  }
}