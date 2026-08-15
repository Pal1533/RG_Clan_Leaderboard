# When Spark quota resets

Do the publish steps first. Do not wait around — the old holes stay open until the new rules are live.

Leave App Check off until reCAPTCHA v3 is fixed.

---

## You

### 1. Publish the rules

Firebase Console → Firestore → Rules

Paste everything from:

`/Users/dawsonwilliams/code/firebase/firestore.rules`

Click **Publish**.

The file still says “DO NOT DEPLOY DURING THE ACTIVE CLAN EVENT”. Ignore that. You asked to ship this.

### 2. Add the kill switch field (so Pal can find it)

Firebase Console → Firestore → `admin` → `blacklist`

Add field:

- Name: `pauseWrites`
- Type: boolean
- Value: `false`

Save. Leave it false. Pal’s freeze card is at the bottom of this file.

### 3. Push the HUD

Repo: Tampermonkeys  
Branch: `main`  
File: `rg_hud.user.js` (now **19.8**)

Clients pick it up from the usual update URL.

Optional: on `admin/blacklist`, set `minVersion` to `19.8` if you want to force old HUDs to update. `19.6` still passes today.

### 4. Push the publisher

Same Tampermonkeys repo:

- `firebase/scripts/build-leaderboard-cache.mjs`
- `.github/workflows/publish-leaderboard-json.yml`
- the tests that go with them

This is the hold that keeps a new fake #1 off the public JSON.

### 5. Push both sites

**Clan** (`RG_Clan_Leaderboard`)

- `index.html`
- `js/app.js`
- `js/render.js`
- `css/clash.css`

**Player** (`rg_player_leaderboard`)

- `index.html`
- `js/app.js`
- `js/firebase.js`
- `js/config.js`
- `js/render.js`
- `js/read-dashboard.js`
- `js/publish-pipeline.js`
- `css/leaderboard.css`

### 6. Lock Tampermonkeys `main`

GitHub → `wiljdaws/Tampermonkeys` → Settings → Branches → `main`

Turn on **enforce admins**.  
Protection is already there (1 review, no force-push). This stops an admin from pushing straight to `main`.

### 7. Smoke test (same day, after publish)

As a normal visitor (signed out):

- Player site loads standings from the published JSON
- Clan site still shows `events/current` + clans
- Neither site should be scanning Firestore for the full leaderboard

On your own HUD account:

- 1v1 / 2v2 / 3v3 / wins still write
- Wait ~20 seconds between modes (rule interval is 15s)

### 8. Send Dawson usage

Firebase Console → Usage (first hour after reset)

Note or screenshot:

- reads used
- writes used
- denied requests
- new anonymous users

Then tell Dawson: **reset, go**

---

## Dawson (after you say “reset, go”)

1. Confirm the new rules are the ones live in the console.
2. Check whether the loop is dead:
   - unauth `list` on leaderboard / submissions
   - unauth `visitor_read_stats` writes
   - unauth clan creates
3. Check honest HUD writes. If Pal or a known player is getting permission-denied, fix that first (interval, clan auth, submissions path = uid).
4. Look for a new fake #1: new anonymous UIDs writing a high-MMR pair that matches the wins math. Confirm the publisher held them and they are not on the public JSON.
5. Check quota burn. After a healthy hour it should be thousands of reads, not tens of thousands. If it is still climbing fast, something is still scanning.
6. Confirm logged-out visitors are not hammering Firestore `list` after a CDN blip.
7. If you want, walk Pal through a 30-second freeze / unfreeze on a throwaway write so he has done it once.

Dawson does not need to wait on the reset to keep coding. He does need the rules published and a look at usage before he can say the attacker is gone.

---

## Pal’s freeze card (send him this)

Firebase Console → Firestore → `admin` → `blacklist`

**Freeze**

1. Set `pauseWrites` to `true` (boolean)
2. Save
3. Do not push the HUD or either site
4. Optional: GitHub → Actions → pause workflows on Tampermonkeys, rg_player_leaderboard, RG_Clan_Leaderboard

**Unfreeze**

1. Set `pauseWrites` to `false`
2. Save

What it stops: HUD writes, clan writes, site admin edits, the publisher cron.

What it does not stop: reading the last published standings, or anyone who can push GitHub. The Firebase console still works — that is how you flip the switch.

Only Pal and Jesus can change this field (`underflagfg@gmail.com`, `therootedengineer@gmail.com`).
