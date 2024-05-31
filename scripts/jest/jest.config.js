const { defaults } = require('jest-config');

// 提示：jest 会自动读取项目目录下的 babel.config.js

module.exports = {
    ...defaults,
    rootDir: process.cwd(),
    modulePathIgnorePatterns: ['<rootDir>/.history'],
    moduleDirectories: [
        // 对于 React、ReactDOM
        'dist/node_modules',
        // 对于第三方依赖
        ...defaults.moduleDirectories
    ],
    testEnvironment: 'jsdom' // 测试环境
};
