// Account identifiers must come from the actual Apple / Expo project.
module.exports = ({ config }) => {
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER || config.ios?.bundleIdentifier;
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (process.env.EAS_BUILD_PROFILE === 'production' && (!bundleIdentifier || !projectId)) {
    throw new Error('Set the real IOS_BUNDLE_IDENTIFIER and EAS_PROJECT_ID before a production build. See docs/testflight.md.');
  }
  return {
    ...config,
    ios: { ...config.ios, ...(bundleIdentifier ? { bundleIdentifier } : {}) },
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
};
