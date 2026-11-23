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
| 4.15 | cooking-data (string) | write-only; 176-byte recipe packet, see [recipe-format.md](recipe-format.md) |
| 4.16 | bell | **never write** |
| 4.17 / 4.18 / 4.19 | status / phase / menu | menu is a 20-byte hex header, see below |
| 4.20 / 4.21 | t-cook (min) / t-left (s) | |
| 4.30 | temp (°C) | 1–2 °C resolution; with local polling ~30 s |
| 4 / aiid 1, 3 | set-start, set-menu (cooking-data) | **works** with a valid 176-byte packet (header + curve + CRC16/XMODEM); anything shorter/invalid returns 0 but is silently ignored |
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

- **App recipe encoding: solved** (see [recipe-format.md](recipe-format.md)). It was found with a Frida hook on a
  rooted phone running Mi Home; the cooker's own plugin names every header field. Early attempts were ignored
  only because they had no heating curve.
- The **heating curve** bytes are still only partly understood.
- `mitmproxy` with a user-installed CA is rejected by the app; `adb logcat` shows nothing useful.
- The Xiaomi cloud API returns 403 for this device; we did not try to get around it.
- Hardware offload on a MikroTik router hides traffic between devices on the same bridge port, so LAN sniffing
  needs the phone and the cooker on different ports.

## Ideas for contributors

- Decode the heating-curve records (see "What is still unknown" in [recipe-format.md](recipe-format.md)).
- Test other firmware / models (`chunmi.cooker.*`) for additional `start-cook` parameters.
- A cleaner sous-vide approach (PWM on keep warm?) and a verified upper temperature limit.
