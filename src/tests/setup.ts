import { chromeMock } from './mocks/chrome';

// Install the chrome mock on the global scope for all tests.
// This runs before each test file (configured via setupFiles).
(globalThis as Record<string, unknown>).chrome = chromeMock;
