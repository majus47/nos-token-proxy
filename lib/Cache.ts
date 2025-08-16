export class Cache {
  expiration: number;
  store: Map<any, any>;
  
  constructor(expiration: number) {
    this.store = new Map();
    this.expiration = expiration;
  }

  set(sessionId: string, value: number) {
    const now = Date.now();

    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, []);
    }

    const entries = this.store
      .get(sessionId)
      .filter((e: { timestamp: number; }) => now - e.timestamp < this.expiration);

    entries.push({ value, timestamp: now });

    this.store.set(sessionId, entries);

    setTimeout(() => {
      this._prune(sessionId);
    }, this.expiration);
  }

  get(sessionId:string) {
    this._prune(sessionId);
    const entries = this.store.get(sessionId);
    return entries ? entries.map((e: { value: number; }) => e.value) : [];
  }

  _prune(sessionId:string) {
    const now = Date.now();
    const entries = this.store.get(sessionId);
    if (!entries) return;
    const fresh = entries.filter((e: { timestamp: number; }) => now - e.timestamp < this.expiration);
    if (fresh.length > 0) {
      this.store.set(sessionId, fresh);
    } else {
      this.store.delete(sessionId);
    }
  }
}

