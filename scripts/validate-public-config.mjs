import {publicConfig} from '../Client/src/auth-utils.ts';
export function validatePublicConfig(config) {
  publicConfig(config.url, config.key);
  if (Object.keys(config).some(key=>!['url','key','environment'].includes(key))) throw Error('Only url, key and environment are allowed in public config.');
  if ('environment' in config && config.environment !== 'staging') throw Error('Public environment must be staging when present.');
}
