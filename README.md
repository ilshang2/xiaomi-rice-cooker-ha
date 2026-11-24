# Xiaomi Mijia Mini Rice Cooker × Home Assistant — a sous-vide cooker hack

**English** | [繁體中文](README.zh-TW.md)

Turn a cheap smart rice cooker (**Xiaomi Mijia Rice Cooker mini, `chunmi.cooker.tw1`**, the Taiwan model) into a
sous-vide / constant-temperature cooker with its own Home Assistant dashboard card — **fully local, no Xiaomi cloud**.

The cooker has no target-temperature setting, but its recipes are plain 176-byte packets
(header + heating curve + CRC) that it accepts over the local network. This project decoded them, so you can:

1. **Start all 15 built-in recipes from Home Assistant**, including the app-only ones such as yogurt, with your own
   duration, scheduled start and auto-keep-warm ([packet format](docs/recipe-format.md)).
2. **Design your own constant-temperature recipes**: pick a temperature and a time per step, and chain several steps.
   The cooker holds the temperature with its own thermostat — no relay-style on/off control from Home Assistant,
   no beeping.

> **Not affiliated with Xiaomi.** A hobby reverse-engineering project, use at your own risk. Read the
> [safety notes](#safety-and-limits) first.

<p align="center">
<img src="docs/img/card-cook-idle.png" width="23%"> <img src="docs/img/card-recipes.png" width="23%">
<img src="docs/img/card-custom.png" width="23%"> <img src="docs/img/card-cook-running.png" width="23%">
</p>

*Screenshots are rendered from the real card; the running states use sample values.*

![Demo animation](docs/demo.gif)

[![Watch on YouTube](https://img.youtube.com/vi/ur2tDmEzq1M/hqdefault.jpg)](https://youtu.be/ur2tDmEzq1M)

**▶ [Watch on YouTube](https://youtu.be/ur2tDmEzq1M)** (≈42 s) | [download the 1080p mp4](docs/demo.mp4)

## The card

A custom Lovelace card `custom:cooker-card` with three tabs, a temperature ring, a status chip, two-tap confirmation
for every start, and a countdown.

- **Cook** — the 6 native start modes (Fine Cook, Quick Cook, Congee, Keep Warm, *Custom slot*, Reheat) and an
  auto-keep-warm switch. The *Custom slot* button shows the name of the recipe stored in the Mi Home app.
- **Recipes** — the 11 recipes beyond the basic modes: Stew, **Yogurt**, Baby porridge, Instant noodles, Cake,
  Simmered soup, Reheat, Oden, Hot rice, Sweet rice, Speed rice. Adjustable cooking time (within each recipe's own
  limits), **scheduled start**, auto keep warm, and a **fermentation temperature** (30–50 °C) for yogurt. The packet is
  built in the browser and sent locally.
- **Sous-vide** — design your own recipe: a target temperature, a time and a power level per step, several steps in a
  row. Presets: onsen egg, chicken breast, steak, salmon, pork loin, chicken thigh, yogurt. Save your own favourites (★).
  - One step is a single packet; the cooker keeps the temperature and stops by itself.
  - Several steps run through a Home Assistant script that switches to the next step when a step ends.
  - While running, the card shows an estimated water temperature (sensor reading minus `offset`), the target on the
    temperature ring and a 90-minute temperature trace.

Two optional automations add a **watchdog** (cancels and notifies if the cooker is still running 5 minutes after the
planned end) and a **completion notice**.

Also included: [`tools/cookcode.py`](tools/cookcode.py) and [`data/recipes.json`](data/recipes.json) to build and send
packets from scripts, and the [packet format](docs/recipe-format.md) and [protocol notes](docs/protocol-notes.md) —
everything we learned (and did not learn) about this cooker.

## Requirements

- Home Assistant with the [`xiaomi_miot`](https://github.com/al-one/hass-xiaomi-miot) integration (local mode) and your
  cooker added. Entities are expected as `sensor.chunmi_tw1_c3d7_cooker`, `sensor.chunmi_tw1_c3d7_temp`,
  `button.chunmi_tw1_c3d7_cancel_cooking`, … where `c3d7` is your device's suffix.
- The helpers in [`ha/helpers.yaml`](ha/helpers.yaml) and the script
  [`ha/cooker_program.script.json`](ha/cooker_program.script.json) (needed for multi-step programs). The automations in
  [`ha/automations.yaml`](ha/automations.yaml) are optional.

## Install

1. **Helpers**: merge `ha/helpers.yaml` into `configuration.yaml` (or create the same entities in the UI), restart.
2. **Script**: create a script with the id `cooker_program` from `ha/cooker_program.script.json`. Replace `c3d7` with
   your suffix.
3. **Automations (optional)**: append `ha/automations.yaml` to your automations, replace `c3d7` and
   `notify.persistent_notification` (use your phone, e.g. `notify.mobile_app_xxx`), reload.
4. **Card**, either way:
   - **HACS** (recommended): *HACS → ⋮ → Custom repositories*, add `https://github.com/ilshang2/xiaomi-rice-cooker-ha`
     with category *Dashboard*, then install *Xiaomi Rice Cooker Card*.
   - **Manual**: copy `dist/cooker-card.js` to `/config/www/cooker-card.js`, then *Settings → Dashboards → Resources →
     Add*: URL `/local/cooker-card.js`, type *JavaScript module*.
5. Add the card:
   ```yaml
   type: custom:cooker-card
   device: c3d7      # your device suffix (default c3d7)
   offset: 2         # °C subtracted from the sensor reading for the estimated water temperature (default 2)
   ```

Saved recipes (★) are stored in the browser (localStorage) of the device you use. The card's text is Traditional
Chinese; the strings are plain literals in the file and easy to translate.

## How it works

- **Single step**: the card sends one packet (`xiaomi_miot.call_action`, siid 4, aiid 1). The cooker runs the yogurt
  program with your target temperature and time. Target temperature and power are set in the heating curve; the yogurt
  flow switches phase after about 30 minutes, so both phases are set to the same temperature (measured: a 55 °C hold
  for 42 minutes stays at 54–58 °C on the pot sensor, and the cooker stops at the end).
- **Multi-step**: `script.cooker_program` runs the steps in order — cancel, wait until idle, send the packet, wait the
  step's minutes — and shows progress through `input_number.cooker_prog_step` / `cooker_prog_total` /
  `cooker_prog_target` and `input_datetime.cooker_prog_end`. Cancelling by hand (on the cooker or in the app) aborts the
  whole program and notifies you.
- **Custom slot name**: the `cooker_slot5*` automations read the recipe byte from the `menu` property 45 s after you
  press *Custom* and show the name on the button.

Details and measurements: [recipe format](docs/recipe-format.md#custom-constant-temperature-recipes),
[protocol notes](docs/protocol-notes.md).

## What does *not* work (and why)

- **Fully free heating curves.** Only two fields of a curve phase are decoded (target temperature and power). The
  firmware decides the phase flow of each recipe id, so the Sous-vide tab builds constant-temperature holds (and chains
  of them), not arbitrary ramps. The other curve fields showed no effect in our tests.
- Boil-type recipes (cake, instant noodles, rice) heat flat-out to ~100–105 °C by design.
- The cooker offers no target-temperature property and no way to read the real water temperature.

## Safety and limits

- **Always test with water in the pot, and stay nearby.** Heating is started by software; sending a recipe starts
  heating immediately.
- The temperature sensor sits under the pot and is wrong right after adding cold water. Use a food thermometer when
  accuracy matters.
- **The cooker usually stops by itself when the time is up, but not always** — twice in testing it continued in a
  480-minute hold instead (we could not reproduce it). Multi-step programs cancel at the end of every step, and the
  optional watchdog automation cancels a run that is still going 5 minutes after its planned end. Do not leave a
  program running unattended if Home Assistant or the network is unreliable.
- The recipe presets (times and temperatures) are common home sous-vide values. **They are not verified for food
  safety**; low temperatures (< 55 °C) combined with long times carry a bacterial risk. Baby food: follow a
  paediatric guideline, not this repository.
- Never call the cooker's `set-factory-reset` action (siid 4, aiid 4) or write its `bell` property.

## Data

- `data/recipes.json`: the 15 recipe packets.
- `data/hold-55c.csv`: a measured 55 °C hold (42 min, 1 L of water): seconds, status, phase, sensor °C.
- `data/recipe-cake.csv`, `data/recipe-noodle.csv`: 10-second samples of temperature/phase for two Mi Home recipes
  (water in the pot). Columns: time, state, last menu bytes, total minutes, left seconds, phase, °C.

## License

MIT, see [LICENSE](LICENSE). Contributions (other models, other recipes, protocol findings) welcome.
