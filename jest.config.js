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
  transform: {},
  verbose: true
};