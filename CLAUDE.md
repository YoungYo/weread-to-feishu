# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that syncs WeRead (微信读书) highlights, comments, and reading progress to Feishu Docx documents using an overwrite strategy. Built with WXT + Svelte 4 + TypeScript.

## Commands

```bash
npm install          # Install deps (postinstall runs `wxt prepare` for types)
npm run dev          # Dev mode with HMR (Chrome)
npm run dev:firefox  # Dev mode (Firefox)
npm run build        # Production build → .output/chrome-mv3/
npm run check        # TypeScript type checking via svelte-check
npm run zip          # Build + package Chrome zip
```

No test framework or linter is configured.

## Architecture

All core logic lives under `src/entrypoints/popup/`:

- **App.svelte** — Root component. Checks WeRead login status on mount, routes to List or Login.
- **List.svelte** — Main UI: Feishu config form, book selection, sync orchestration. Contains `syncToFeishu()` which coordinates the full flow.
- **weread.ts** — WeRead API client. `fetchNotebookBooks()` gets the book list; `fetchBookMarkdown()` pulls highlights/comments/progress and merges them into a Markdown string.
- **feishu.ts** — Feishu Open API client. Handles token acquisition (`getTenantAccessToken`), document clearing (`listRootBlocks` → `deleteBlocksByIndexRange`), Markdown-to-blocks conversion, and content writing (`appendBlocks`).
- **storage.ts** — Config persistence via `browser.storage.local` / `chrome.storage.local` with `localStorage` fallback. Key: `weread_feishu_sync_config`.
- **types.ts** — Shared types: `BookBrief`, `FeishuConfig`, `SyncState`.

`background.ts` and `content.ts` are placeholder entry points (currently empty).

## Sync Data Flow

```
App.svelte (login check)
  → List.svelte (load config + fetch book list)
    → user selects books + configures Feishu credentials
      → syncToFeishu():
        1. feishu.getTenantAccessToken()     // if using AppId+AppSecret
        2. weread.fetchBookMarkdown()        // parallel: highlights + comments + progress → Markdown
        3. feishu.overwriteDocWithMarkdown()  // clear doc → convert MD → append blocks
```

## Key Details

- **Auth modes**: Two mutually exclusive Feishu auth approaches — direct `tenant_access_token` or `AppId + AppSecret` (token is auto-fetched). Token takes priority.
- **Host permissions**: `weread.qq.com/*` and `open.feishu.cn/*`.
- **Build framework**: WXT v0.17 (Vite-based). Config in `wxt.config.ts`, `srcDir` set to `src/`.
- **Path aliases**: `@` and `~` both resolve to `src/`.
- **Legacy files**: `utils.js`, `model/mock.js`, and `gulpfile.js` are remnants from an earlier version and are not used by the current WXT build.
