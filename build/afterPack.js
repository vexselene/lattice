const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  // Only execute when packaging macOS targets on a Darwin host
  if (context.electronPlatformName === 'darwin' && process.platform === 'darwin') {
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`[afterPack] Applying ad-hoc code signature to: ${appPath}`);
    try {
      // Re-sign all nested binaries, helpers, frameworks, and native addons with an ad-hoc signature (-).
      // This ensures the Mach-O code signatures and CodeResources hashes match the modified bundle,
      // resolving the macOS Gatekeeper error: "app is damaged as the signatures don't match".
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log('[afterPack] Ad-hoc code signature applied successfully.');
    } catch (err) {
      console.error('[afterPack] Failed to apply ad-hoc code signature:', err);
      throw err;
    }
  }
};
