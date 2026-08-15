---
name: dev-browser
description: >-
  Drives official Chrome or Playwright Chromium from sandboxed scripts with
  persistent pages. Use when navigating sites, filling forms, taking
  screenshots, scraping JS pages, working in a logged-in session, or Google
  shows "this browser or app may not be secure". Human types the Google
  password in official chrome.exe on an isolated profile with no debug flags;
  then --channel chrome. Trigger phrases: "go to [url]", "click", "screenshot",
  "scrape", "log into", "browser may not be secure", "official Chrome".
  Not for writing Playwright test files or raw HTTP status checks.
---

# Dev Browser

> **Core Insight:** Official Chrome plus an isolated profile is the Google login path. Playwright launch is not. The CLI is a heredoc against a daemon, not a test file you commit.

A CLI for controlling browsers with sandboxed JavaScript scripts. Pages behave like Playwright Page objects, driven from a background daemon.

## Installation

```bash
npm install -g dev-browser
dev-browser install
```

Do not run `dev-browser install-skill`. Removed. It overwrote local mined skill copies.

## Official Chrome vs Playwright Chromium

Terms: **official Chrome** = Program Files `chrome.exe`. **isolated profile** = `~/.dev-browser/browsers/<name>/chrome-profile`. Not daily **Profile 1**. Avoid "real Chrome" / "my Chrome".

Default `--browser` launches Playwright Chromium (Chrome for Testing). Google blocks that.

`--channel chrome` OS-spawns official Chrome on the isolated profile and attaches over CDP (debug port on). Playwright does not launch that binary. `--channel msedge` is the Edge sibling.

**Google password step — Phase 1.** Human types it. Agent does not. Detached official Chrome, no debug flags, no Playwright, no `--channel chrome`.

```powershell
$profile = Join-Path $env:USERPROFILE ".dev-browser/browsers/<name>/chrome-profile"
Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList @(
  "--user-data-dir=$profile",
  "--no-first-run",
  "--no-default-browser-check",
  "https://accounts.google.com/"
)
```

If the window dies with the agent Job Object, spawn the same command line via WMI `Win32_Process.Create`.

**Done when:** the isolated window shows the Google account and does not show "This browser or app may not be secure". Then close that window (cookies stay) or enable `chrome://inspect/#remote-debugging`.

**Phase 2.** Only then:

```bash
dev-browser --browser <name> --channel chrome --idle-timeout 0 --timeout 60 <<'EOF'
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 660 });
await page.goto("https://business.google.com/locations", { waitUntil: "domcontentloaded", timeout: 45000 });
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

Do not start a second `chrome.exe` with `--remote-debugging-port`. `--channel chrome` already does that. If CDP fails, the Phase 1 window is still holding the profile; close it and retry Phase 2.

`--connect` attaches to a Chrome already running with remote debugging. Named pages do **not** persist across `--connect` scripts.

## The canonical script

```bash
dev-browser --timeout 60 <<'EOF'
const page = await browser.getPage("main");
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

## Method ladder

Work down this list only as each rung fails.

1. **Known selector → a Playwright locator.** `getByRole`, `getByText`, `getByLabel`, `locator()`.
2. **Unknown page → `page.snapshotForAI()` once**, then locators.
3. **After 2 failed locator attempts → `page.domCua`**.
4. **Canvas / no DOM → `page.cua`**.
5. **`page.evaluate()` → read-only.** Never to click, scroll, or find.

## Timeouts

- `--timeout N` is the whole script. It does not raise Playwright's per-action timeout.
- Each `goto` / `click` / `screenshot` has its own ~30s default. Raise it on the call: `page.goto(url, { timeout: 45000, waitUntil: "domcontentloaded" })`.
- The outer shell has a separate kill clock. Shorten the script; do not only raise `--timeout`.
- Use `waitUntil: "domcontentloaded"`, not `"networkidle"`.

## Named pages and one daemon

- `getPage("checkout")` is the same tab next script. Reuse it.
- `getPage("typo")` silently creates a blank page. Treat `about:blank` as a wrong name.
- Never fire two dev-browser calls at once. Per-agent `--browser <name>`. Never global `dev-browser stop`.

## Sandbox

- No `require` / `import` / `process` / `fs` / `fetch` at the top level.
- `document` / `window` only inside `page.evaluate(() => ...)`.
- `setInputFiles(path)` fails. Generate the file in-page (canvas → `File` → `DataTransfer`).
- `readFile()` is UTF-8. Use `readFile(name, "base64")` for binary.

## Anti-patterns

| Don't | Do |
|---|---|
| Type the Google password in `--channel chrome` | Phase 1 detached official Chrome; human types it |
| `Start-Process` a second Chrome with a debug port after sign-in | Close the sign-in window or enable inspect, then `--channel chrome` |
| `page.evaluate()` to find/click/scroll | Locator first |
| Escalate `--timeout` for a 30000ms `goto` | `{ timeout }` on that call |
| `waitUntil: "networkidle"` | `"domcontentloaded"` |
| Parallel calls or global `stop` | One script; per-agent `--browser` |

## Usage

`dev-browser --help` is the API. `--idle-timeout 5m` closes idle daemon-launched browsers and keeps the profile. It never closes `--connect` Chrome. `--idle-timeout 0` disables cleanup.
