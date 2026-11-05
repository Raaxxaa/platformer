# RUSHBLADE on your iPhone and Mac

This puts RUSHBLADE on your **iPhone** and your **MacBook** as a real app: full screen, sideways, works with no internet, no browser bars. It's just for you (not the App Store).

You do this on your **Mac**. It takes about 30 minutes, plus the time Xcode takes to download.

> **Do it before Saturday 7 November**, while your paid Apple developer membership is still active.

## Already done on your Mac (4 November 2026)

A Claude Code chat on your Mac did steps 1–5 for you:

- The app is signed with your **free Personal Team** (Team ID `7X49PRWGVF`, saved in the project, so step 3 is already done). Xcode didn't list a paid team on this Mac.
- **Free signing lasts 7 days.** If the app stops opening, plug in the phone and run the update steps in section 8 again (a new 7 days starts each time).
- RUSHBLADE was installed on your **iPhone 15 Pro** and on this **Mac** (in **Applications**, as *RUSHBLADE*).
- If you find your paid team later (Xcode → Settings → Accounts), pick it in step 3 and press ▶ again: that version lasts much longer.

---

## 1. Install Xcode (start this first, it's big)

1. On your Mac, open the **App Store**, search **Xcode**, and press **Get**. It is about 15 GB, so it can take an hour.
2. When it's done, **open Xcode once**. It asks to install extra parts ("components", "iOS platform"): say **yes / Install** to everything and wait until it finishes.
3. You can close Xcode again.

## 2. Get the game onto your Mac

1. Install **Node.js** if you don't have it: go to **nodejs.org**, download the **LTS** version (22 or newer) and run the installer.
2. Open **Terminal** (press ⌘ Space, type *Terminal*, Enter).
3. Copy these lines into Terminal one at a time and press Enter after each:

   ```
   git clone https://github.com/Raaxxaa/platformer.git
   cd platformer
   npm install
   npm run app:ios
   ```

   - The first line may ask to install "command line developer tools". Say **Install**, wait, then run the line again.
   - The last line builds the game and **opens the project in Xcode**. The first time, Xcode spends a minute or two "Resolving packages" at the top. Wait until it's done.

## 3. Sign the app with your Apple account (one time)

1. In Xcode's left column, click the blue **App** icon at the very top.
2. In the middle, click **Signing & Capabilities**.
3. Next to **Team**, pick your Apple developer account.
   - If it isn't in the list: menu **Xcode → Settings → Accounts**, press **+**, choose **Apple ID**, sign in, close the window, then pick it.
4. Leave **Automatically manage signing** ticked. Any red error should go away after a few seconds.

## 4. Put it on your iPhone

1. Plug the iPhone into the Mac with a cable. **Unlock** the phone. If it asks *Trust This Computer?*, tap **Trust** and enter your passcode.
2. Turn on **Developer Mode** on the iPhone: **Settings → Privacy & Security → Developer Mode** (it's near the bottom) → **On**. The phone restarts; after it starts, tap **Turn On** and enter your passcode.
   - If you don't see Developer Mode, do step 3 first once; it appears after Xcode has seen the phone.
3. At the top of Xcode, click the device name next to the ▶ button and pick **your iPhone**.
4. Press **▶** (Run). The first time takes a few minutes. RUSHBLADE opens on your phone.
   - If the phone says *Untrusted Developer*: **Settings → General → VPN & Device Management**, tap your account, tap **Trust**, then press ▶ again.
5. Unplug it. The app stays on your home screen.

## 5. Put it on your Mac (Apple Silicon Macs only)

This works on a Mac with an **M1, M2, M3 or newer** chip ( → About This Mac → *Chip*). An Intel Mac can't do this; use the website app on it instead (Safari → File → *Add to Dock*).

1. At the top of Xcode, click the device name and pick **My Mac (Designed for iPad)**.
2. Press **▶**. RUSHBLADE opens in a window on your Mac and appears in **Launchpad** and **Applications**. Keyboard and gamepad work.

## 6. After Saturday (when the paid membership ends)

(Right now the app uses the free Personal Team, so the 7-day rule below already applies.)

- Apps you installed with the paid account **keep working until their signature expires** or Apple turns it off. We can't promise how long that is once the membership ends; it could be days or months.
- If the app ever **stops opening**, do step 3 again but pick your **free Apple ID** (Personal Team) as the Team, then step 4 or 5 again. Free signing works too, but it **expires every 7 days**, so you'd re-run it weekly.
- The **website app never expires**: on the iPhone open **raaxxaa.github.io/platformer** in Safari → Share → **Add to Home Screen**.

## 7. Moving your progress between the website and the app

Saves in the app are separate from the website's. To move them:

1. In the game you're moving **from**: **Settings → Export save**, then **Copy**.
2. Send the text to yourself (Notes, AirDrop or email).
3. In the game you're moving **to**: **Settings → Import save**, paste, **Import**, **Confirm**.

## 8. Updating the app later

When the game gets new things, in Terminal:

```
cd platformer
git pull
npm install
npm run app:ios
```

Then pick the iPhone (or My Mac) at the top of Xcode and press **▶** again. Your progress stays.

---

### If something goes wrong

| What you see | What to do |
|---|---|
| `npm: command not found` | Install Node.js (step 2.1), then close and reopen Terminal. |
| Xcode: *"No account for team"* or a red signing error | Step 3 again: pick your Team; make sure you're signed in under Xcode → Settings → Accounts. |
| Xcode: *"Failed to register bundle identifier"* | Change **Bundle Identifier** (same page as Team) to something unique, e.g. `com.yourname.rushblade`, and press ▶ again. |
| iPhone not in the device list | Unlock the phone, re-plug the cable, tap Trust; check Developer Mode is on. |
| The app opens to a black screen | In Terminal run `npm run app:ios` again (it rebuilds the game), then ▶. |
| Packages won't resolve in Xcode | Check the Mac is online; menu **File → Packages → Reset Package Caches**. |
