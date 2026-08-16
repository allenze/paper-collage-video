import {Config} from '@remotion/cli/config';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const configuredBrowserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE?.trim();

if (configuredBrowserExecutable) {
  Config.setBrowserExecutable(configuredBrowserExecutable);
  Config.setChromeMode('chrome-for-testing');
} else {
  const headlessShellPath = path.join(
    os.homedir(),
    '.cache',
    'remotion',
    'binaries',
    'chrome-headless-shell-linux64',
    'chrome-headless-shell',
  );
  if (fs.existsSync(headlessShellPath)) {
    Config.setBrowserExecutable(headlessShellPath);
  }
}
