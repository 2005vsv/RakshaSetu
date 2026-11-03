const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const root = path.resolve(__dirname).replace(/^[a-z]:/i, (m) => m.toUpperCase());
const config = getDefaultConfig(root);

config.projectRoot = root;
config.watchFolders = [root];

module.exports = config;
