# Clan Clash Cup — Live Standings

Live clan standings for the Rocket Goal Clan Clash Cup. ATLAS locks each
member's baseline and this site shows the event score.

**[Open the board](https://pal1533.github.io/RG_Clan_Leaderboard/)**
· [Player board](https://pal1533.github.io/rg_player_leaderboard/)
· [Install ATLAS](https://github.com/Pal1533/Tampermonkeys)
· [Discord](https://discord.gg/MDz7hsrh9m)

The page listens to `events/current` and `clans` in the same Firebase project
ATLAS writes to. Admins sign in with Google to manage the event.

## Scoring

Ported from ATLAS (`computeClanEventScore`, `clanBaselineForCurrentEvent`,
`eventPhase`) so the HUD and this site stay on the same number:

- Contribution = current MMR − member `eventBaseline`
- Legacy clan-level `eventBaseline[userId]` is a fallback
- Newer `memberStats[userId]` wins over stale member MMR
- A clan only scores if its `eventId` matches `String(events/current.startTime)`
- Members without a locked baseline show “no baseline” and count zero
- Clan score = sum across all baselined members (negatives count)

If you change this math, change ATLAS in the same window and run `npm test`.

## Local history

The Archive tab stores small event-scoped snapshots in this browser only. It
does not write to Firebase and never feeds live scoring. Use “Clear this event”
to drop one saved event.

## Local setup

```bash
npm test
```

No build step. Push to `main` and GitHub Pages updates.

## Layout

```
index.html        page shell
privacy.html      privacy policy
terms.html        terms of use
css/clash.css     design tokens and layout
js/app.js         boot + Firestore listeners
js/scoring.js     ATLAS-identical event math
js/members.js     legacy-array / current-map members
js/render.js      standings and clan views
js/live-state.js  snapshot readiness and visibility
js/history.js     event-scoped local archive
```

## Related

- [ATLAS HUD](https://github.com/Pal1533/Tampermonkeys)
- [Player leaderboard](https://github.com/Pal1533/rg_player_leaderboard)

## Community

This is a fan project. It is not affiliated with Rocket Goal.

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [MIT License](LICENSE)
- [Privacy](https://pal1533.github.io/RG_Clan_Leaderboard/privacy.html)
- [Terms](https://pal1533.github.io/RG_Clan_Leaderboard/terms.html)
