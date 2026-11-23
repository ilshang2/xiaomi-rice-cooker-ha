# Xiaomi Mijia Mini Rice Cooker × Home Assistant — a sous-vide cooker hack

**English** | [繁體中文](README.zh-TW.md)

Turn a cheap smart rice cooker (**Xiaomi Mijia Rice Cooker mini, `chunmi.cooker.tw1`**, the Taiwan model) into a
customizable low-temperature / sous-vide cooker, with a nice Home Assistant dashboard card.

The cooker exposes **no target-temperature setting** and its app recipes are encoded in an unpublished format.
So instead of fighting the firmware, Home Assistant watches the pot temperature and **switches the built-in
"keep warm" mode on and off** (a thermostat built from automations).

> **Not affiliated with Xiaomi.** This is a hobby reverse-engineering project. Use at your own risk — read the
> [safety notes](#safety-and-limits) first.


<p align="center">
<img src="docs/img/card-cook-idle.png" width="23%"> <img src="docs/img/card-cook-running.png" width="23%">
<img src="docs/img/card-sousvide-recipes.png" width="23%"> <img src="docs/img/card-sousvide-running.png" width="23%">
</p>

*Screenshots are rendered from the real card; the “running” states use sample values.*

![Demo animation](docs/demo.gif)

[![Watch on YouTube](https://img.youtube.com/vi/iS_5qySGZCk/hqdefault.jpg)](https://youtu.be/iS_5qySGZCk)

**▶ [Watch on YouTube](https://youtu.be/iS_5qySGZCk)** (≈44 s) | [download the 1080p mp4](docs/demo.mp4)

## What you get

- A custom Lovelace card `custom:cooker-card`: temperature ring, status chip, two-tap confirmation, recipe
  presets, countdown.
- **All 6 start modes the cooker accepts over the network**: Fine Cook, Quick Cook, Congee, Keep Warm,
  *Custom slot* (whatever recipe the Mi Home app put in that slot, name auto-detected), Reheat.
- **Sous-vide mode (external control)**: any target 30–~75 °C, any time up to 24 h, normal (±1 °C) or quiet
  (±2.5 °C, ~¼ of the beeps) mode, over-temperature / sensor-loss protection.
- **Recipe presets** (yogurt, soft-boiled egg, salmon, steak, chicken breast …) and a **two-step baby-porridge
  recipe**: 55 °C soak, then automatically hand over to the cooker's native congee program.
- A read-only list of the other Mi Home recipes (with their factory durations) that HA cannot start.
- [Protocol notes](docs/protocol-notes.md): everything we learned (and failed to learn) about this cooker.

## What does *not* work (and why)

- The other Mi Home recipes (yogurt, baby porridge, instant noodles, cake, soup, oden, hot rice, sweet rice,
  speed rice) **cannot be started from HA** (except whichever one sits in the Custom slot, and Reheat). The cooker only accepts `start-cook` with parameter 1–6; the app
  sends an encoded recipe through the Xiaomi cloud which we could not decode. See the notes.
- Boil-type recipes (cake, instant noodles, rice) heat flat-out to ~100–105 °C. They cannot be imitated by the
  on/off thermostat, so the card only lists them.
- Every start/stop makes the cooker **beep**. Quiet mode reduces how often, it cannot silence it.

## Requirements

- Home Assistant with the [`xiaomi_miot`](https://github.com/al-one/hass-xiaomi-miot) integration
  (local mode), with your cooker added. Entities are expected as `sensor.chunmi_tw1_c3d7_cooker`,
  `sensor.chunmi_tw1_c3d7_temp`, `button.chunmi_tw1_c3d7_cancel_cooking`, … — replace `c3d7` with your device's
  suffix in the YAML and in the `E` table at the top of `card/cooker-card.js`.
- Helpers from [`ha/helpers.yaml`](ha/helpers.yaml) and automations from
  [`ha/automations.yaml`](ha/automations.yaml).

## Install

1. **Helpers**: merge `ha/helpers.yaml` into `configuration.yaml` (or create the same entities in the UI), restart.
2. **Automations**: append `ha/automations.yaml` to your `automations.yaml`, edit the entity IDs, reload.
3. **Card**: copy `card/cooker-card.js` to `/config/www/cooker-card.js`, then *Settings → Dashboards →
   Resources → Add*: URL `/local/cooker-card.js`, type *JavaScript module*. Add a card:
   ```yaml
   type: custom:cooker-card
   ```
4. The card's UI text is Traditional Chinese; the strings are plain literals in the file and easy to translate.

## How the sous-vide control works

- `sousvide_start`: when `input_boolean.sousvide_run` turns on, set the end time (refuses if the cooker is busy).
- `sousvide_control` (every temperature update and every 30 s): heating → cancel when temp ≥ target − 1.5 °C
  (quiet: −1 °C); idle → start Keep Warm (`start-cook` param 4) when temp ≤ target − 2 °C (quiet: −4 °C);
  hard cancel at target + 8 °C; at the end time, stop, and if *"start native porridge afterwards"* is on,
  wait for idle and start the native congee program (param 3).
- `sousvide_stop`: cancel the cooker when the run is switched off; stop if the temperature sensor is offline for 3 min.
- `cooker_slot5*`: after you press the *Custom* button, 45 s later read the recipe byte from the `menu` property
  and show its name on the button.

Measured with water, target 60 °C: about ±1 °C in normal mode, ±2.5 °C in quiet mode. Temperature sensor
resolution is 1–2 °C with ~30 s polling.

## Safety and limits

- **Always test with water in the pot, and stay nearby.** Heating is started by software.
- Keep Warm mode heats only to its own plateau (**~73–75 °C measured**). Targets above that are
  **untested and probably unreachable**, although the UI slider allows up to 90 °C.
- The recipe presets (times and temperatures) are common home sous-vide values. **They are not verified for
  food safety**; low temperatures (< 55 °C) and long times carry a bacterial risk. Baby food: follow a
  paediatric guideline, not this repository.
- Never call the cooker's `set-factory-reset` action (siid 4, aiid 4) or write its `bell` property.
- Do not rely on this for anything where a failed automation (HA down, Wi-Fi down) would be dangerous: if HA
  stops while the cooker is heating, it keeps heating until its own thermostat cuts off.

## A wish for Xiaomi

Most of this project exists because the cooker does not expose a target temperature and its app recipes are
encoded in a format we cannot read. If Xiaomi ever documents the recipe (`cooking-data`) format, adds a
target-temperature property, or lets the local API start the other app recipes, this hack could shrink to a
thin card and we would be very happy to retire the on/off thermostat. Until then, this is the workaround.
(No pressure, no affiliation. Just a hopeful note from a user who loves the little cooker.)

## Data

`data/recipe-cake.csv`, `data/recipe-noodle.csv`: 10-second samples of temperature/phase for two Mi Home
recipes (water in the pot). Columns: time, state, last menu bytes, total minutes, left seconds, phase, °C.

## License

MIT, see [LICENSE](LICENSE). Contributions (other models, other recipes, protocol findings) welcome.
