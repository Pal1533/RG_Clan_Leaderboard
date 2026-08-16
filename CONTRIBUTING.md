# Contributing to the Clan Clash site

This is the public Clan Clash Cup board. It reads `events/current` and `clans`
from the same Firebase project ATLAS writes to.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Talk first on bigger changes

Open an issue or ping Pal / JesusDied4U in the
[Championship Discord](https://discord.gg/MDz7hsrh9m) before you:

- Change scoring math (`js/scoring.js` must stay aligned with ATLAS)
- Add new Firestore listeners or visitor telemetry
- Change clan admin writes
- Reshape `clans/{id}.members` (array vs map)

UI fixes, tests, and docs are fine as a pull request.

## Hard limits

The site shares the Firebase **Spark** free plan with ATLAS (50k reads /
20k writes a day).

Do not:

- Add collection scans the Clash view does not need
- Turn visitor read-telemetry back into a default write
- Gate clan reads or writes on the HUD allow list
- Commit `.cursor/`, `Untitled`, secrets, or service-account JSON
- Enable App Check

## How to work

1. Fork the repo and branch from `main`.
2. Run `npm test` before you open a pull request.
3. If you change event scoring, update the tests in `tests/scoring.test.mjs`
   and call out the matching ATLAS change in the PR.

GitHub Pages serves `main`.

## Related repos

- ATLAS HUD: [wiljdaws/Tampermonkeys](https://github.com/wiljdaws/Tampermonkeys)
- Player board: [wiljdaws/rg_player_leaderboard](https://github.com/wiljdaws/rg_player_leaderboard)

## Security

Do not file a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
