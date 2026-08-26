# When Spark quota resets

Rules are already live. HUD 19.8, the publisher hold, and both sites are already pushed. Tampermonkeys `main` now enforces admins.

Leave App Check off until reCAPTCHA v3 is fixed.

---

## You — already done

- ~~Publish the rules~~ — deployed to `rgleaderboard` on 2026-08-15
- ~~Add `pauseWrites: false` on `admin/blacklist`~~ — field is there, left off
- ~~Push HUD 19.8~~ — Tampermonkeys `main` (`rg_hud.user.js`)
- ~~Push the publisher + workflow~~ — same repo
- ~~Push both sites~~ — clan + player `main`
- ~~Turn on enforce admins~~ — `Pal1533/Tampermonkeys` `main`

Optional, still your call: set `admin/blacklist.minVersion` to `19.8` if you want to force old HUDs to update. `19.6` still passes today.

---

## You — when quota comes back

### 1. Smoke test

As a normal visitor (signed out):

- Player site loads standings from the published JSON
- Clan site still shows `events/current` + clans
- Neither site should be scanning Firestore for the full leaderboard

On your own HUD account:

- 1v1 / 2v2 / 3v3 / wins still write
- Wait ~20 seconds between modes (rule interval is 15s)

### 2. Send Dawson usage

Firebase Console → Usage (first hour after reset)

Note or screenshot:

- reads used
- writes used
- denied requests
- new anonymous users

Then tell Dawson: **reset, go**

---

## Dawson (after you say “reset, go”)

1. Confirm the live rules still match `/Users/dawsonwilliams/code/firebase/firestore.rules`.
2. Check whether the loop is dead:
   - unauth `list` on leaderboard / submissions
   - unauth `visitor_read_stats` writes
   - unauth clan creates
3. Check honest HUD writes. If Pal or a known player is getting permission-denied, fix that first (interval, clan auth, submissions path = uid).
4. Look for a new fake #1: new anonymous UIDs writing a high-MMR pair that matches the wins math. Confirm the publisher held them and they are not on the public JSON.
5. Check quota burn. After a healthy hour it should be thousands of reads, not tens of thousands. If it is still climbing fast, something is still scanning.
6. Confirm logged-out visitors are not hammering Firestore `list` after a CDN blip.
7. If you want, walk Pal through a 30-second freeze / unfreeze on a throwaway write so he has done it once.

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
