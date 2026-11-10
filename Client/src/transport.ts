import { io } from 'socket.io-client';

export const hosted = Boolean((window as unknown as { __WARMLY_HOSTED__?: boolean }).__WARMLY_HOSTED__);
type Listener = (...args: any[]) => void;
type Reply = (error: Error | null, result?: any) => void;
interface Transport {
  on(event: string, listener: Listener): unknown;
  connect(): unknown;
  disconnect(): unknown;
  timeout(ms: number): { emit(event: string, payload: unknown, reply: Reply): unknown };
}

// Sites hosts a stateless Worker: poll shared D1 state instead of keeping a Node socket alive.
class HostedTransport implements Transport {
  private listeners = new Map<string, Listener[]>();
  private token = '';
  private active = false;
  private online = false;
  private generation = 0;
  private seen = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), listener]);
  }
  private dispatch(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(listener => listener(...args));
  }
  connect() {
    if (this.active) return;
    this.active = true;
    this.generation++;
    this.dispatch('connect');
  }
  disconnect() {
    const token = this.token;
    this.active = false; this.online = false; this.token = ''; this.generation++;
    clearTimeout(this.timer);
    if (token) void fetch('/api/chat/session', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
    this.dispatch('disconnect');
  }
  private async request(path: string, method = 'GET', payload?: unknown, timeout = 8000) {
    const response = await fetch(`/api/chat/${path}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Something went wrong. Please try again.'), { status: response.status });
    return result;
  }
  timeout(ms: number) {
    return { emit: (event: string, payload: unknown, reply: Reply) => {
      const generation = this.generation;
      const path = event === 'join' ? 'session' : 'messages';
      void this.request(path, 'POST', payload, Math.max(ms, 8000)).then(result => {
        if (!this.active || generation !== this.generation) return;
        if (event === 'join') {
          this.token = result.token; this.online = true;
          this.seen = new Set(result.messages.map((message: any) => message.id));
          reply(null, result); this.dispatch('presence', result.members); this.schedule();
        } else {
          this.seen.add(result.message.id); this.dispatch('message:new', result.message); reply(null, result);
        }
      }).catch((error: Error) => {
        if (this.active && generation === this.generation) reply(null, { error: error.message });
      });
    } };
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.active && this.token) this.timer = setTimeout(() => void this.poll(), 1500);
  }
  private async poll() {
    const generation = this.generation;
    try {
      const result = await this.request('state');
      if (!this.active || generation !== this.generation) return;
      if (!this.online) { this.online = true; this.dispatch('recovered'); }
      this.dispatch('presence', result.members);
      for (const message of result.messages) if (!this.seen.has(message.id)) this.dispatch('message:new', message);
      this.seen = new Set(result.messages.map((message: any) => message.id));
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      if (this.online) { this.online = false; this.dispatch('disconnect'); }
      if ((error as { status?: number }).status === 401) {
        this.token = ''; this.dispatch('connect'); return;
      }
    }
    this.schedule();
  }
}

export function createChatTransport(): Transport {
  return hosted ? new HostedTransport() : io({ autoConnect: false });
}
