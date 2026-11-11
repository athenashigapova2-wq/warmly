export function createSupabaseStore(env, request = fetch) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch {}
  if (!url || url.protocol !== 'https:' || url.username || url.password || !key || (!key.startsWith('sb_secret_') && !key.startsWith('eyJ'))) {
    throw Object.assign(new Error('The chat is temporarily offline. Please try again later.'), { status: 503 });
  }
  const endpoint = new URL('/rest/v1/rpc/warmly_chat', url);
  return {
    async call(action, payload = {}, tokenHash = null, ipHash = null) {
      let response;
      try {
        response = await request(endpoint, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(7000),
          headers: { 'Content-Type': 'application/json', apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({ p_action: action, p_payload: payload, p_token_hash: tokenHash, p_ip_hash: ipHash }),
        });
      } catch { throw Object.assign(new Error('Chat storage is temporarily unavailable. Please try again.'), { status: 503 }); }
      if (!response.ok) throw Object.assign(new Error('Chat storage is temporarily unavailable. Please try again.'), { status: 503 });
      let result;
      try { result = await response.json(); } catch { throw Object.assign(new Error('Invalid storage response. Please try again.'), { status: 503 }); }
      if (result?.error) throw Object.assign(new Error(result.error), { status: [400, 401, 403, 404, 413, 429].includes(result.status) ? result.status : 503 });
      if (!result || typeof result !== 'object') throw Object.assign(new Error('Invalid storage response. Please try again.'), { status: 503 });
      return result;
    },
  };
}
