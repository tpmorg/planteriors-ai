module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx)'],
  clearMocks: true,
};
