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
    "/tests/disabled/",
    // Exclude database-dependent integration tests for CI
    "**/database-schema-integrity.test.js",
    "**/booking-management.test.js", 
    "**/user-management.test.js",
    "**/hotel-platform-e2e.test.js",
    "**/payment-gateway-workflow.test.js"
  ],
  testMatch: [
    "**/tests/unit/**/*.test.js",
    // Include only integration tests that don't require database
    "**/tests/integration/hotelController.test.js"
  ],
  transform: {},
  verbose: true
};
