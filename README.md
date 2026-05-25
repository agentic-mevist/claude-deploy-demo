# Airport Baggage Tycoon

A small endless tycoon game where you manage airport baggage check-in counters,
hire agents, upgrade equipment, and try to survive as long as possible before
your reputation drops to zero.

- **Stack**: plain HTML5 Canvas + vanilla JS (no build step)
- **Host**: Cloudflare Pages
- **View**: isometric 2.5D, cartoon style

## Gameplay

- Passengers arrive at the entrance and queue at one of your counters.
- Four passenger types: tourist, business, family, late.
- Three counter types: regular, **priority** (faster), **drop-off** (only for 0-1 bags).
- Each counter can be upgraded (level) and its agent trained (skill).
- Patience meter ticks down while passengers wait. Angry walk-outs cost reputation.
- Endless: spawn rate ramps up with time.

## Local preview

```sh
python3 -m http.server 8080
# open http://localhost:8080
```
