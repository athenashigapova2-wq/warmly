export function projectRef(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw Error('Expected a Supabase project HTTPS URL.');
  return parsed.hostname.split('.')[0];
}

export function stagingTarget(env) {
  const staging = env.STAGING_SUPABASE_PROJECT_REF;
  const production = env.PRODUCTION_SUPABASE_PROJECT_REF;
  if (!staging || !production || staging === production) throw Error('Set distinct STAGING_SUPABASE_PROJECT_REF and PRODUCTION_SUPABASE_PROJECT_REF.');
  if (projectRef(env.STAGING_SUPABASE_URL || '') !== staging) throw Error('Staging URL does not match the approved staging project ref.');
  return staging;
}

export function deploymentConfig(env) {
  if (env.VERCEL === '1' && !env.VERCEL_ENV) throw Error('Vercel environment is unknown. Enable system environment variables before building.');
  if (env.VERCEL_ENV === 'preview') {
    stagingTarget(env);
    if (!env.STAGING_SUPABASE_PUBLISHABLE_KEY) throw Error('Set STAGING_SUPABASE_PUBLISHABLE_KEY for Preview. Production credentials are never a fallback.');
    return {url:env.STAGING_SUPABASE_URL,key:env.STAGING_SUPABASE_PUBLISHABLE_KEY,environment:'staging'};
  }
  if (env.VERCEL_ENV && !['production','development'].includes(env.VERCEL_ENV)) throw Error('Unsupported deployment environment.');
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings > Environment Variables, then redeploy.');
  if (env.VERCEL_ENV === 'production' && env.PRODUCTION_SUPABASE_PROJECT_REF && projectRef(env.SUPABASE_URL) !== env.PRODUCTION_SUPABASE_PROJECT_REF) throw Error('Production URL does not match the production project ref.');
  return {url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY};
}
