# Pier Nine

A round-based tactical shooter on a wharf at night. You attack: plant the charge on site A or site B
and hold it until it goes off. Four defenders patrol the lanes, hold the angles, walk to what they
hear, and take the service corridor behind the sites when they know where you are.

[![threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/flavyn/makefun-pier-nine/rank.svg)](https://make.fun/bounty/threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/flavyn/makefun-pier-nine/reward.svg)](https://make.fun/bounty/threejs-fps-02)

## Play it

```
node serve.ts            # http://127.0.0.1:8080/
```

Desktop Chrome, keyboard and mouse: `W A S D` move, mouse look, left click fire, right click aim,
`C` crouch, `R` reload, `1 2 3` weapons, `G` flash charge, `E` plant the charge, `M` mute.

## What the round asks of you

A round opens with a buy phase and 800 dollars. The three weapons are roles, not prices: the sidearm
is one tap with a tight cone, the SMG holds a lane with a wide one, the rifle kills on a single head
hit but only pays when you stop to aim. The cone is arithmetic — `spreadStill` while still,
`spreadMove` while moving, `×0.45` crouched, `×0.4` aimed — so standing still and crouching is
strictly better than strafing while firing. Hits are checked against head, torso and legs: the head
multiplier is 2.6 on the sidearm and rifle, 2.2 on the SMG.

Money buys more than a gun: a flash charge blinds every defender inside 9 metres for 2.6 seconds, and
a vest halves what reaches your health. Rounds are won by the charge detonating, by clearing the site,
or by the clock; the first side to three rounds takes the match.

## Files

```
game/index.html        the page, the HUD and the four screens
game/src/main.js       bootstrap, the fixed step, the firing pipeline
game/src/tuning.js     weapon profiles, economy, bomb timings, the map data
game/src/map.js        the wharf's boxes, the two sites, and the sight test
game/src/player.js     acceleration, crouch, aim speed, collision, noise radius
game/src/weapons.js    magazines, reserve, reload, burst fire, recoil, spread, hit spheres
game/src/enemies.js    patrol, hold, investigate, engage, flank, defuse
game/src/rounds.js     buy phase, live phase, the planted charge, money and score
game/src/hud.js        the bars and numbers, written only when they change
game/src/audio.js      every sound, synthesised in WebAudio
game/src/input.js      keyboard, mouse and pointer lock
```

## Handing it in

```
node main.ts             # copies game/ and screenshots/ to $MAKEFUN_OUTPUT_DIR and writes dossier.json
```

`main.ts` uses `buildDossier` from `vendor/makefun-threejs.ts`, the kit's own copy. three.js 0.187.0 is
vendored byte for byte under `game/vendor/three/`, and the page's single import map points `"three"` at
it. MIT licensed; see `LICENSE`.
