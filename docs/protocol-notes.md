# Protocol notes — Xiaomi Mijia Rice Cooker mini (`chunmi.cooker.tw1`)

[繁體中文](protocol-notes.zh-TW.md)

Everything below was measured on one Taiwan-model unit via the `xiaomi_miot` integration (local miIO polling,
UDP 54321). Treat it as observations, not as a specification.

MIoT spec: <https://home.miot-spec.com/spec/chunmi.cooker.tw1>

## Properties and actions used

| siid.piid / aiid | Name | Notes |
|---|---|---|
| 2.1 | cooker status | 1 standby, 2 cooking, 3 keep warm, 4 reserved. HA shows `idle` / `busy` / `keep warm` / `delay` |
| 2 / aiid 1 | start-cook (param piid 6) | **accepts 1–6 only**, see below |
| 2 / aiid 2 | cancel | `button.…_cancel_cooking` |
| 4.15 | cooking-data (string) | format unknown |
| 4.16 | bell | **never write** |
| 4.17 / 4.18 / 4.19 | status / phase / menu | menu is a 20-byte hex header, see below |
| 4.20 / 4.21 | t-cook (min) / t-left (s) | |
| 4.30 | temp (°C) | 1–2 °C resolution; with local polling ~30 s |
| 4 / aiid 1, 3 | set-start, set-menu (cooking-data) | return code 0 but **silently ignored** for every string we tried |
| 4 / aiid 4 | set-factory-reset | **do not call** |

There is **no target-temperature property** anywhere in the spec.

## `start-cook` parameter

| param | Result |
|---|---|
| 1 | Fine Cook (rice) |
| 2 | Quick Cook |
| 3 | Congee |
| 4 | Keep Warm (heats to its own plateau ≈ 73–75 °C and holds) |
| 5 | The Mi Home app's **"Custom" slot**: starts whatever recipe the app currently has there (duration = the app's) |
| 6 | Reheat (25 min, plateau ≈ 79–81 °C) |
| 7–15 | rejected (−1) |

## The `menu` header

20 bytes, mostly zeros. The **last byte identifies the recipe** (first two bytes vary with the source:
`0404` standby, `0303…04` keep warm, `0505…` app recipes, `0404…<byte>` when started via param 5, which
immediately after start can transiently show another value):

| byte | Recipe | Factory time |
|---|---|---|
| 06 | Yogurt | 360 min (configurable in app) |
| 07 | Baby porridge | 180 |
| 08 | Instant noodles | 20 |
| 09 | Cake | 60 |
| 0a | Soup | 120 |
| 0b | Reheat | 25 |
| 0c | Oden | 90 |
| 0d | Hot rice | 30 |
| 0e | Sweet rice | 70 |
| 0f | Speed rice | 30 |

## Measured temperature behaviour (water in the pot)

| Program | Behaviour |
|---|---|
| Yogurt (app) | plateau **40–42 °C**, phases 1 → 8 |
| Keep warm | plateau **73–75 °C**, phase 0, `t_left` counts up |
| Reheat | plateau **79–81 °C**, phases 3 → 8 |
| Rice | boils (~105 °C), phases 3 → 9, then decays |
| Cake | 28 → 101 °C in ~15 min (phase 3), then phase 8 at 103–105 °C (still boiling) |
| Instant noodles | 77 → 105 °C in ~4.5 min (phase 3), boiling (`t_left` counts up for this recipe) |

See `../data/` for the raw cake and noodle samples.

## What we tried and could not crack

- **App recipe encoding.** The Mi Home app talks to the cooker via the Xiaomi cloud
  (the cooker opens a TLS connection to a cloud host, bursts of 12–15 KB at start/stop). On the LAN the
  only visible traffic is the miIO discovery/poll on UDP 54321.
- `adb logcat` on the phone: nothing useful. `mitmproxy` with a user-installed CA: the app (and others) reject it.
  We stopped there; a rooted device with a system CA or patched APK is the remaining route.
- Writing arbitrary `cooking-data` through `set-start` / `set-menu`: accepted, ignored. The old
  python-miio `set_start` profile format (hex strings for the normal/press cookers) does not apply to this model.
- The Xiaomi cloud API returns 403 for this device; we did not try to get around it.
- Hardware offload on a MikroTik router hides traffic between devices on the same bridge port, so LAN sniffing
  needs the phone and the cooker on different ports.

## Ideas for contributors

- Capture a real app start with a rooted phone / system CA and decode `cooking-data`.
- Test other firmware / models (`chunmi.cooker.*`) for additional `start-cook` parameters.
- A cleaner sous-vide approach (PWM on keep warm?) and a verified upper temperature limit.
