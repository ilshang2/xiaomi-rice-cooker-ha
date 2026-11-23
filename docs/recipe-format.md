# Recipe (`cooking-data`) packet format

**English** | [繁體中文](recipe-format.zh-TW.md)

How the Xiaomi Mijia Rice Cooker mini (`chunmi.cooker.tw1`) encodes a recipe, how to send one from Home Assistant
**over the local network** (no Xiaomi cloud), and what is still unknown.

## How it was found

1. The Mi Home app (Xiaomi's mainland-China build, 11.9.x) was run on a rooted phone with a Frida hook on the
   plugin's native bridge. At the moment you press *Start*, the app calls the MIoT action
   `siid 4 / aiid 1 (set-start)` with one string argument: the packet below, in clear text.
2. The cooker's plugin (`mijia.chunmi.cooker.tw1`, a plain-text React Native bundle) contains the class that
   edits the packet header, which gives every header field a name (`CMCookProfile`).
3. The app has **no encoder for the heating curve**. The complete packet, curve included, comes from the cloud
   recipe data; the app only edits the header and recomputes the CRC.

## Packet layout (176 bytes)

| Bytes | Content |
|---|---|
| 0–19 | header (below) |
| 20–173 | heating curve (see "What is still unknown") |
| 174–175 | CRC-16/XMODEM of bytes 0–173 (poly 0x1021, init 0, no reflection, xorout 0), **big-endian** |

### Header

| Index | Field |
|---|---|
| 0, 1 | device type, sub type (`02 01`) |
| 2 | *index*: modes 1–4 keep their own value (00–03); for menu id > 4 the app uses `05` to start now and `04` to store a favourite |
| 3–6 | menu id, 32-bit big-endian = recipe id (below) |
| 7 | flags: bit7 custom-save, bit6 can be scheduled, bit5 auto-keep-warm can be set. Low 5 bits are ignored by the cooker |
| 8, 9 | cooking time: hours, minutes |
| 10, 11 / 12, 13 | maximum / minimum cooking time (hours, minutes). Adjustable only if max > min |
| 14 | bit7 = scheduled start on, low 7 bits = hours until start |
| 15 | bit7 = auto keep warm on, low 7 bits = minutes until start |
| 17, 18 | rice type id (16-bit) |
| 19 | taste (firmness) |

### Recipe ids (`data/recipes.json`)

| id | recipe | id | recipe |
|---|---|---|---|
| 01 | Fine Cook | 09 | Cake |
| 02 | Quick Cook | 0a | Simmered soup |
| 03 | Congee | 0b | Reheat |
| 04 | Keep Warm | 0c | Oden |
| 05 | Stew | 0d | Hot rice |
| 06 | **Yogurt** | 0e | Sweet rice |
| 07 | Baby porridge | 0f | Speed rice |
| 08 | Instant noodles | | |

## Send a recipe from Home Assistant

```yaml
service: xiaomi_miot.call_action
data:
  entity_id: sensor.chunmi_tw1_c3d7_cooker   # your cooker
  siid: 4
  aiid: 1
  params: ["<176-byte packet as 352 hex characters>"]
```

`tools/cookcode.py` builds packets (it edits the header and recomputes the CRC):

```
python tools/cookcode.py list
python tools/cookcode.py show 優格
python tools/cookcode.py hex 優格 --minutes 360 --keep-warm off
python tools/cookcode.py hex 燉煮 --minutes 90 --order 60      # start in 60 minutes
```

The card's **Recipes** tab does the same in the browser (JavaScript port, verified byte-for-byte against the
Python tool). Cancel with `button.…_cancel_cooking`.

Verified on a real cooker: the original packets start the matching recipe; changing the duration is honoured
(yogurt set to 300 min → `t_cook` 300); a 3-minute scheduled start on *Fine Cook* → `t_pre` 3; the header
byte 7 is not validated.

> **Sending a packet starts heating immediately.** Make sure there is water or food in the pot.

## What is still unknown

Bytes 20–173 are the heating curve: a table of 7-byte records `91 b1 b2 78 b4 b5 b6` (plus a second table of
14-byte blocks in some recipes). We have 15 complete curves and these observations:

- The cooker's `phase` property follows the record index: record 2 of the noodle curve contains `1e`
  (30), and the cooker really waits about 30 s in phase 0 → 3. Phases skip when their record holds `ff` or
  other trivial values.
- `b2` looks like a **temperature in °C**: the yogurt curve contains `29` (41), `28` (40) and `55` (85),
  matching "pasteurise, then keep ~40 °C"; boil-type recipes contain `7d` (125), `6e` (110), `82` (130), `78`
  (120), which look like "no limit" defaults.
- `b1` of record 3 differs per recipe (`5a` noodle/keep-warm, `54` stew, `58` oden, `2b` reheat, `66` cake)
  but the **heating rate does not depend on it** (measured), so it is not a power value. Its exact meaning is
  open.
- Caveat for anyone repeating the experiments: the `temp` property is a thermistor under the pot. It reads far
  above the water temperature while heating and after adding cold water, so use trends, not single readings.

Changing the curve is therefore **not supported**; only the header (time, schedule, keep-warm) is safe to edit.
Pull requests that decode the curve are very welcome.

## Legal / ethics

Interoperability research on a device the author owns. The packets in `data/recipes.json` are the recipe data
Xiaomi ships for this cooker, included only so the cooker can be driven locally. No Xiaomi code is included.
Not affiliated with Xiaomi.
