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

## Heating curve (partly decoded)

Bytes 20-173 are the heating curve: from byte 26 on, a table of 7-byte **phase records**
`91 b1 b2 78 b4 b5 b6` (record *i* starts at byte `26 + 7*i`), plus a second table of 14-byte blocks in some
recipes. The cooker's `phase` property (siid 4, piid 18) is the record index. Record 0 of the yogurt curve
(`... 00 1e 00`) is a 30 s wait, and the cooker really sits in phase 0 for about 30 s (changing its `1e` does not change that: the wait is fixed in firmware).

Measured on a real cooker (yogurt curve, phase 1, 1 L of water starting at room temperature):

| Field | Meaning | Evidence |
|---|---|---|
| **`b2`** | **target temperature of the phase, in degrees C** | `29` (41 C): heating stopped at about 44 C and the reading fell back. Changed to `37` (55 C): kept heating past 44 C up to the 54 C safety stop |
| **`b4`** | **heating power level** | `03`: about +0.3 C/min. `10`: +2.1 C/min. `20`: +5 to 7 C/min. `40`: about +5.6 C/min (close to `20`, so it may saturate near `20`). `08`: barely beats heat loss at 67 C |
| `b1` | not power, not an exit temperature. A small value (`01`) makes the cooker skip that phase at once (phase 0 and phase 1 both tested: phase 1 skipped, flow went 0 -> 1 -> 4 -> 8); `40`, `62`, `82`, `ff` ran normally, and `62` did not end phase 1 when the pot passed 62 C. Its exact meaning is open | partly |
| `b5`, `b6`, `78` | no observable effect in phases 0-2: values `01`, `40`, `ff` (and `b5` = 5, 20, 60) left the flow and temperature unchanged, and phase 0 always lasts about 31 s. Phases 3 and later cannot be reached while phase 1 holds, so they were not tested | no effect seen |
| second table (14-byte blocks) | not tested | open |

The default values `7d` (125), `6e` (110), `82` (130), `78` (120) that fill most records look like "no limit"
temperatures. These findings come from yogurt phase 1 and a few noodle runs; other phases are assumed to use the
same fields, not verified.

Caveat for anyone repeating this: `temp` (siid 4, piid 30) is a thermistor under the pot. While heating hard it
reads about 3 C or more above the water, and right after adding cold water it is wrong. Wait until the reading
is stable first, and compare trends, not single readings. Read it live with `xiaomi_miot.get_properties` (about
0.2 s) instead of waiting for the HA sensor.

`tools/cookcode.py` can change the target temperature and power of a phase (`--phase 1 --target 45 --power 16`),
clamped to 30-95 C and power <= 0x40. **This is experimental**: it only edits two fields of a curve we do not
fully understand. Watch the first run, with water in the pot.

## Custom constant-temperature recipes

The yogurt flow keeps a constant temperature, so it is the base for custom holds: phase 1 (record at byte 33,
`b2` at 35, `b4` at 37) and phase 8 (record at byte 82, `b2` at 84, `b4` at 86) are set to the same target and
power, the header time is the hold time, and the schedule and auto-keep-warm bits are cleared.
`python tools/cookcode.py hold --hold 65 --minutes 90` builds one (30-90 C, 1-1440 min, power 8-64).

Long run (yogurt flow, target 75 C): **phase 1 lasts about 30 min, then the cooker moves on to phase 8**. If phase 8
keeps its default 40 C target, the pot cools down (77 -> 63 C over 60 min), which is why both records are set (holding the target in phase 8 was not observed in a long run).
Chaining several holds is done by the card / `script.cooker_program`: cancel, wait for idle, send the next packet
(a packet sent while the cooker is busy is ignored). Verified on a real cooker with a 2 x 2 min program (50 C then 60 C).

Cold start (1 L of room-temperature water, target 50 C, power 32, 18 min): the sensor read 42-44 C for the first minute (cold water against a warm pot base), reached 50 C after about 3 min, then stayed at 50-54 C for the rest of the run, with a maximum of 54 C and no runaway overshoot. Expect the sensor to sit 2-4 C above the real water temperature.

## Legal / ethics

Interoperability research on a device the author owns. The packets in `data/recipes.json` are the recipe data
Xiaomi ships for this cooker, included only so the cooker can be driven locally. No Xiaomi code is included.
Not affiliated with Xiaomi.
