/**
 * Vitest setup file. Runs before every test in this directory.
 *
 * Pulling in jest-dom's vitest-aware subpath registers custom matchers like
 * `toBeInTheDocument`, `toBeDisabled`, `toHaveValue` — used heavily by the
 * regression tests for the fake-login hardening. The `vitest` subpath does
 * the same registration for `expect` as vitest internally exposes it.
 */
import '@testing-library/jest-dom/vitest'
