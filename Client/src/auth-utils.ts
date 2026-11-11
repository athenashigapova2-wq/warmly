export const NATIVE_CALLBACK = 'app.warmly.messenger://auth/callback';

export function publicConfig(url: string, key: string) {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('Use the HTTPS Project URL from Supabase.');
  key = key.trim();
  let allowed = /^sb_publishable_[\w-]+$/.test(key);
  if (key.startsWith('eyJ')) {
    try { allowed = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { allowed = false; }
  }
  if (!allowed) throw new Error('Use a publishable or anon key. Secret and service_role keys must never be bundled.');
  return {url:parsed.origin,key};
}

export function authFeedback(error: {message?:string; code?:string; status?:number}) {
  const text = error.message || '';
  const seconds = text.match(/after\s+(\d+)\s+seconds?/i)?.[1];
  if (seconds) return {message:'A confirmation email was requested recently. Check your inbox and spam folder before requesting another.',retrySeconds:Math.min(3600,Math.max(1,Number(seconds)))};
  if (error.code==='over_email_send_rate_limit') return {message:'The email delivery limit has been reached. Continue with Google or try email again later.',retrySeconds:0};
  if (error.status===429 || error.code==='over_request_rate_limit') return {message:'Too many attempts. Please wait a little before trying again.',retrySeconds:60};
  if (error.code==='email_not_confirmed') return {message:'Confirm your email first. Check your inbox and spam folder, then sign in.',retrySeconds:0};
  if (error.code==='invalid_credentials') return {message:'The email or password is incorrect.',retrySeconds:0};
  if (error.code==='provider_disabled' || /provider.*not enabled|unsupported provider/i.test(text)) return {message:'Google sign-in is not available yet. Please use email for now.',retrySeconds:0};
  if (/fetch|network/i.test(text)) return {message:'Cannot reach the sign-in service. Check your connection and try again.',retrySeconds:0};
  return {message:text || 'Could not sign in. Please try again.',retrySeconds:0};
}

export function oauthCallback(raw: string, expected: string) {
  const url = new URL(raw); const target = new URL(expected);
  if (url.protocol!==target.protocol || url.host!==target.host || url.pathname!==target.pathname || url.username || url.password) return null;
  if (url.searchParams.has('error')) return {error:url.searchParams.get('error')!,code:null};
  const code=url.searchParams.get('code');
  return code ? {error:null,code} : null;
}

// Remember only the address. Passwords remain under Supabase/browser control.
export function rememberedEmail(storage: Pick<Storage,'getItem'>): string {
  try {return storage.getItem('warmly.auth.email') || '';} catch {return '';}
}
export function rememberEmail(storage: Pick<Storage,'setItem'>, email:string) {
  try {if(email.trim())storage.setItem('warmly.auth.email',email.trim());} catch {}
}
export async function restoreAuth(auth:{getSession:()=>Promise<any>}, callback:()=>Promise<unknown>) {
  let callbackError:unknown;
  try {await callback();} catch(error){callbackError=error;}
  const {data,error}=await auth.getSession();
  // A stale confirmation link must not discard an existing valid session.
  if(data?.session)return data.session;
  if(callbackError)throw callbackError;
  if(error)throw error;
  return null;
}
