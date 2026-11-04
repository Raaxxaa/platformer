# M16: iPhone and Mac App (personal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**URGENT:** the user's paid Apple developer membership ends **Saturday 2026-11-07**. Do this plan **before anything else**, so the user can install the app on their iPhone and Mac before then.

**Goal:** RUSHBLADE as a real app on the user's **iPhone** and **MacBook**, for the user only (not the App Store): full screen, landscape, works offline, no browser bars. The same game build as the website.

**How:** [Capacitor](https://capacitorjs.com) wraps the built game (`dist/`) in a native iOS app. The **Mac** runs that same iOS app: on an Apple Silicon Mac (M1 or later), Xcode can install an iPhone/iPad app directly ("My Mac (Designed for iPad)"); keyboard and gamepad work there. (An Intel Mac can't do that; for an Intel Mac use the installed web app from M12 instead, or add Mac Catalyst later.)

**The user must do the last part on their Mac** (Xcode, signing, plugging in the phone), because building and signing iOS apps needs macOS. This chat prepares everything so that part is a few clicks, and writes a plain-words guide.

**Starting point:** current `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints
- The website build and GitHub Pages deploy are unchanged.
- No App Store submission. App id `com.raaxxaa.rushblade`, name `RUSHBLADE`.
- Saves inside the app are separate from the website's; the existing export/import code (06 §15.3) moves a save between them.

## Tasks

### Task 1: App build of the game
- [ ] An app build: `npm run build:app` builds with Vite `base: './'` (the website keeps `/platformer/`) into `dist/`.
- [ ] Inside the app (`window.Capacitor` present): **don't register the service worker** (the app has its own files), hide the "Add to Home Screen" hints, and skip the update toast.
- [ ] **Tests:** the app build's `index.html` uses relative asset paths; the service worker isn't registered when `Capacitor` is present (unit test on the registration helper).
- [ ] **Commit.**

### Task 2: Capacitor iOS project
- [ ] Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` (current stable versions), `capacitor.config.ts` (`appId: 'com.raaxxaa.rushblade'`, `appName: 'RUSHBLADE'`, `webDir: 'dist'`, iOS `contentInset: 'never'`, background `#0d0b14`).
- [ ] Generate the `ios/` project (`npx cap add ios`; if that step needs macOS in this environment, commit everything else and make the guide's first Mac step run it).
- [ ] In the iOS project: landscape only (both sides), status bar hidden, home indicator auto-hidden, full screen, the ART10 app icons (`public/assets/app/`) as the app icon set, a dark launch screen.
- [ ] Scripts: `npm run app:ios` = `build:app` + `npx cap sync ios` + `npx cap open ios`.
- [ ] **Commit.**

### Task 3: The guide for the user (`docs/apple-app.md`)
Plain words, numbered, with what they'll see. It must say:
1. **Install Xcode today** from the Mac App Store (it's big, ~15 GB; start the download first). Open it once and accept everything it asks.
2. Install Node.js 22 (nodejs.org) if not there. In Terminal: `git clone https://github.com/Raaxxaa/platformer.git`, `cd platformer`, `npm install`, `npm run app:ios`. Xcode opens the project.
3. In Xcode: click **App** in the left list → **Signing & Capabilities** → **Team**: pick your Apple developer account (sign in with Xcode → Settings → Accounts if it's not there). Leave "Automatically manage signing" on.
4. **iPhone:** plug it in with a cable, unlock it, tap *Trust*. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on (it restarts). In Xcode's top bar pick your iPhone, press ▶ (Run). The game opens on the phone and stays installed.
5. **Mac** (Apple Silicon only): in the top bar pick **My Mac (Designed for iPad)**, press ▶. It appears in Launchpad and Applications.
6. **After Saturday:** apps installed with the paid account keep working until their certificate/profile expires or Apple revokes it (we can't promise how long once the membership ends). If one stops opening, re-run step 4 with a **free** Apple ID as the Team: free signing works too but expires every 7 days. The website app (Safari → Share → *Add to Home Screen*) never expires.
7. **Moving your progress:** in the website game, Settings → Export, copy the code; in the app, Settings → Import.
8. **Updating the app later:** `git pull`, `npm run app:ios`, press ▶ again.
- [ ] **Commit and push to `main`.** Tell the user it's ready and send them the guide link. Do this as early as possible (Thursday at the latest).

## Done when
`main` has the app build, the `ios/` project (or the one-command way to create it on the Mac), and the guide; the user has the app on their iPhone and Mac.
