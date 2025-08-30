export default {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'middleware/**/*.js',
    'controller/**/*.js',
    'model/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/disabled/"
  ],
  testMatch: [
    "**/tests/unit/**/*.test.js"
  ],
  transform: {},
  verbose: true
};
