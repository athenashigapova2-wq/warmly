import { createClient, SupabaseClient } from '@supabase/supabase-js';
export interface Profile { id: string; username: string; name: string }
export interface Chat { id: string; kind: 'direct' | 'group'; title: string; owner: string; created_at: string }
export interface Message { id: number; conversation_id: string; sender_id: string; body: string; created_at: string }
export interface Friendship { id: string; sender: string; recipient: string; status: 'pending' | 'accepted' }
export interface Membership { conversation_id: string; user_id: string }
export class MessengerApi {
  client!: SupabaseClient;
  configure(url: string, key: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('Use the HTTPS Project URL from Supabase.');
    let publicKey = key.startsWith('sb_publishable_');
    if (key.startsWith('eyJ')) { try { publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { publicKey = false; } }
    if (!publicKey) throw new Error('Use a publishable key or the legacy anon key. Never use a secret or service_role key.');
    this.client = createClient(parsed.origin, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    localStorage.setItem('warmly.public-config', JSON.stringify({url: parsed.origin,key}));
  }
  async rpc(action: string, payload = {}): Promise<any> {
    const {data,error} = await this.client.rpc('messenger', {action,payload});
    if (error) throw new Error(error.message.includes('Could not find') ? 'Apply the messenger SQL migration in Supabase first.' : error.message);
    return data;
  }
  async table<T>(name: string): Promise<T[]> {
    const {data,error} = await this.client.from(name).select('*');
    if (error) throw new Error(error.message);
    return data as T[];
  }
}
