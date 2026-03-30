import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock nanoid for predictable IDs in tests
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9)),
}))

// Global test utilities
declare global {
  namespace Vi {
    // Extend vitest types if needed
  }
}
