# OMNI Leaderboard

A fan-made workout tracker + leaderboard MVP inspired by
[OMNI Wellness Club](https://www.omni.club/) in Bali Seseh / Canggu.

- **Stack**: plain HTML / CSS / JS (no build step, no auth, no backend)
- **Host**: Cloudflare Pages
- **State**: `localStorage` — mock users seeded so the leaderboards feel alive

## Features

- Boards per discipline: Overall, Legs, Push, Pull, Cardio, Group Classes
- Live workout session: log sets × reps (strength) or minutes (cardio / classes)
- Finishing a session credits the relevant board and bumps your rank
- Editable display name so your row stands out on the leaderboards

## Local preview

```sh
python3 -m http.server 8080
# open http://localhost:8080
```
