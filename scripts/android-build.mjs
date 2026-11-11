import { spawnSync } from 'node:child_process';
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'cmd.exe' : './gradlew', windows ? ['/d','/c','gradlew.bat assembleDebug'] : ['assembleDebug'], {cwd: new URL('../android/',import.meta.url),stdio:'inherit'});
process.exit(result.status ?? 1);
