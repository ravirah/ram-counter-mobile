const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro anchored to the real project root during Android release bundling.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

module.exports = config;
