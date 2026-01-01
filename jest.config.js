module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/**/*.test.js',
        '!server/**/__tests__/**',
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/*.test.js'
    ],
    verbose: true,
    testTimeout: 10000,
};
