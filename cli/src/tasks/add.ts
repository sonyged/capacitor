import { addAndroid, addAndroidChecks } from '../android/add';
import { editProjectSettingsAndroid } from '../android/common';
import c from '../colors';
import type { CheckFunction } from '../common';
import {
  check,
  checkAppConfig,
  checkPackage,
  checkWebDir,
  logFatal,
  resolvePlatform,
  runPlatformHook,
  runTask,
} from '../common';
import type { Config } from '../config';
import { OS } from '../definitions';
import { addIOS, addIOSChecks } from '../ios/add';
import { editProjectSettingsIOS } from '../ios/common';
import { logger } from '../log';

import { sync } from './sync';

export async function addCommand(
  config: Config,
  selectedPlatformName: string,
): Promise<void> {
  if (selectedPlatformName && !config.isValidPlatform(selectedPlatformName)) {
    const platformDir = resolvePlatform(config, selectedPlatformName);
    if (platformDir) {
      await runPlatformHook(platformDir, 'capacitor:add');
    } else {
      let msg = `Platform ${c.input(selectedPlatformName)} not found.`;

      if (config.knownCommunityPlatforms.includes(selectedPlatformName)) {
        msg += `\nTry installing ${c.strong(
          `@capacitor-community/${selectedPlatformName}`,
        )} and adding the platform again.`;
      }

      logger.error(msg);
    }
  } else {
    const platformName = await config.askPlatform(
      selectedPlatformName,
      `Please choose a platform to add:`,
    );

    if (platformName === config.web.name) {
      webWarning();
      return;
    }

    const existingPlatformDir = config.platformDirExists(platformName);
    if (existingPlatformDir) {
      logFatal(
        `${c.input(platformName)} platform already exists.\n` +
          `To re-add this platform, first remove ${existingPlatformDir}, then run this command again.\n` +
          `${c.strong(
            'WARNING',
          )}: Your native project will be completely removed.`,
      );
    }

    try {
      await check(config, [
        checkPackage,
        checkAppConfig,
        ...addChecks(config, platformName),
      ]);
      await check(config, [checkWebDir]);
      await doAdd(config, platformName);
      await editPlatforms(config, platformName);

      if (shouldSync(config, platformName)) {
        await sync(config, platformName, false);
      }

      if (
        platformName === config.ios.name ||
        platformName === config.android.name
      ) {
        logger.info(
          `Run ${c.input(`npx cap open ${platformName}`)} to launch ${
            platformName === config.ios.name ? 'Xcode' : 'Android Studio'
          }`,
        );
      }
    } catch (e) {
      logFatal(e.stack ?? e);
    }
  }
}

export function addChecks(
  config: Config,
  platformName: string,
): CheckFunction[] {
  if (platformName === config.ios.name) {
    return addIOSChecks;
  } else if (platformName === config.android.name) {
    return addAndroidChecks;
  } else if (platformName === config.web.name) {
    return [];
  } else {
    throw `Platform ${platformName} is not valid.`;
  }
}

export async function doAdd(
  config: Config,
  platformName: string,
): Promise<void> {
  await runTask(c.success(c.strong('add')), async () => {
    if (platformName === config.ios.name) {
      await addIOS(config);
    } else if (platformName === config.android.name) {
      await addAndroid(config);
    }
  });
}

async function editPlatforms(config: Config, platformName: string) {
  if (platformName === config.ios.name) {
    await editProjectSettingsIOS(config);
  } else if (platformName === config.android.name) {
    await editProjectSettingsAndroid(config);
  }
}

function shouldSync(config: Config, platformName: string) {
  // Don't sync if we're adding the iOS platform not on a mac
  if (config.cli.os !== OS.Mac && platformName === 'ios') {
    return false;
  }
  return true;
}

function webWarning() {
  logger.error(
    `Not adding platform ${c.strong('web')}.\n` +
      `In Capacitor, the web platform is just your web app! For example, if you have a React or Angular project, the web platform is that project.\n` +
      `To add Capacitor functionality to your web app, follow the Web Getting Started Guide: ${c.strong(
        'https://capacitorjs.com/docs/web',
      )}`,
  );
}
