module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/**/*.test.js',
        '!server/**/__tests__/**',
    ],
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/*.test.js'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/mocks/',
        '/__tests__/setup.js',
    ],
    setupFiles: [
        '<rootDir>/server/__tests__/setup.js'
    ],
    verbose: true,
    testTimeout: 10000,
};
