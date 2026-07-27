/**
 * Regression test for the fake-login hardening.
 *
 * Historical bug: LoginPage's `handleSubmit` swallowed /api/auth/token
 * failures (network errors, 5xx) and silently fell back to a synthetic
 * JWT signed with the literal string "demo_signature", leaving the user
 * in a fake logged-in state with no DB account. Subsequent BMI saves /
 * chat / notes silently failed at the real backend.
 *
 * This test pins the new contract. Any future PR that re-introduces
 * the fake-token path will fail because:
 *   1. localStorage.cw_token must stay null (no synthetic JWT written)
 *   2. The unified retry banner must surface instead
 *   3. isLoading must flip back to false
 *   4. Form fields must stay populated so the user can retry without
 *      re-typing
 *   5. The parent onLogin() must never be invoked
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'

// ThemeContext is imported by LoginPage (via useTheme) and ThemeToggle.
// Replace it with a permissive stub so we don't need a real Provider in
// jsdom and so setTheme/toggleTheme don't explode.
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('LoginPage — fake-token regression', () => {
  beforeEach(() => {
    // Each test starts with a clean slate: no leftover tokens from a
    // previous run could mask a regression that re-introduces
    // demo-token writing.
    localStorage.clear()
    // vi.stubGlobal installs a tracked stub that vi.unstubAllGlobals()
    // can actually undo. Raw `global.fetch = vi.fn()` would NOT be
    // tracked by vitest and would leak between tests.
    vi.unstubAllGlobals()
  })

  it('does not synthesize a fake JWT when /api/auth/token returns 500', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    )
    // vi.stubGlobal is vitest's documented way to mock globals; the
    // stub is registered so vi.unstubAllGlobals() (in beforeEach)
    // properly restores the original jsdom polyfill between tests.
    vi.stubGlobal('fetch', fetchMock)

    render(
      <LoginPage
        onLogin={onLogin}
        onSwitchToSignup={vi.fn()}
      />,
    )

    // Selectors: labels are now `htmlFor`-linked to inputs, so use
    // getByLabelText for an accessible and robust query.
    const usernameInput = screen.getByLabelText(/^Username$/i)
    const passwordInput = screen.getByLabelText(/^Password$/i)

    // Fill in clearly-fictional fixture values and submit.
    await user.type(usernameInput, 'test_user_fixture')
    await user.type(passwordInput, 'not-a-real-password')

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).not.toBeDisabled() // pre-submit sanity
    await user.click(submitButton)

    // (2) Error banner must show the unified retry message.
    //   findBy* is waitable — setError() runs after the awaited fetch.
    const banner = await screen.findByText(/cannot reach the server/i)
    expect(banner).toBeInTheDocument()

    // (1) No fake token was written to localStorage at any point.
    //   This is the load-bearing assertion: a regression that
    //   re-adds the createDemoToken fallback will fail here.
    expect(localStorage.getItem('cw_token')).toBeNull()

    // (3) isLoading must have flipped back to false. Re-query the
    // submit button — the original reference may have been removed
    // from the DOM by the time setIsLoading(false) re-renders.
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).not.toBeDisabled()

    // (4) Form fields stay populated — the user can retry without
    //     re-typing.
    expect(usernameInput).toHaveValue('test_user_fixture')
    expect(passwordInput).toHaveValue('not-a-real-password')

    // (5) Parent's onLogin never invoked (no fake-login success).
    expect(onLogin).not.toHaveBeenCalled()

    // And the only fetch call was the original /api/auth/token POST —
    // there must be NO second call against /users/me or anything else,
    // because nothing got far enough to need it.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl] = fetchMock.mock.calls[0]
    expect(String(calledUrl)).toContain('/api/auth/token')
  })
})
