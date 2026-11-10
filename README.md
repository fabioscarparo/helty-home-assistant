<p align="center">
  <img src="images/header.svg" alt="Helty Home Assistant" width="600">
</p>

<p align="center">
  <strong>Control a Helty Flow40 ventilation unit from Home Assistant,<br>
  with two snap-together modules and four wires.</strong>
</p>

<p align="center">
  <a href="https://esphome.io/"><img alt="ESPHome 2026.9+" src="https://img.shields.io/badge/ESPHome-2026.9%2B-000?logo=esphome&logoColor=fff"></a>
  <a href="https://www.home-assistant.io/"><img alt="Home Assistant" src="https://img.shields.io/badge/Home_Assistant-18BCF2?logo=homeassistant&logoColor=fff"></a>
  <a href="#dashboard-card"><img alt="HACS Custom" src="https://img.shields.io/badge/HACS-Custom-41BDF5?logo=homeassistantcommunitystore&logoColor=fff"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/License-MIT-333"></a>
</p>

The **Helty Flow40** is a single-room heat recovery ventilation unit (in
Italy, a *VMC*). Units fitted with the Modbus terminal block can be read
and controlled over RS-485: this project puts an **M5Stack ATOM Lite**
running [ESPHome](https://esphome.io) on that bus and brings the unit into
Home Assistant, with no cloud and no vendor app.

It was designed to be easy and cheap to build:

- **No soldering** - two off-the-shelf modules that snap together, four
  wires into screw terminals and one configuration file to paste. No
  custom board and no 3D printing either
- **Cheap** - about €30-40 for everything, shipping included, see the
  [shopping list](#shopping-list)
- **No extra power supply** - the module runs on the 24 V of the unit
  itself and is small enough to sit inside its casing
- **Local** - everything stays on your home network
- **Careful** - the firmware can only change the operating mode, and it
  never writes anything when it starts
- **Familiar** - a [dashboard card](#dashboard-card) that recalls the
  wall panel of the unit, built like the core cards of Home Assistant

<p align="center">
  <img src="images/installation.jpg" alt="A Flow40 with its front cover off: four wires run from the green terminal block to the ATOM Lite on its RS485 base, tucked in the bottom of the casing" width="420">
</p>

---

## What you get

| Entity | Type | What it does |
|---|---|---|
| Ventilation | Fan | On and off, 4 speeds, Hyper, Night and Free cooling presets |
| Hyper, Night, Free cooling | Switches | Turn a preset on. They exclude each other, and turning one off goes back to the last speed used |
| Indoor and outdoor temperature | Sensors | In °C, with one decimal |
| Filter alarm, frost alarm, indoor and outdoor fan fault | Binary sensors | From the alarm register of the unit |
| Modbus communication | Diagnostic | Connected when the unit answered in the last 35 seconds |
| Alarm code, firmware version, WiFi signal, sensor faults, EEPROM error | Diagnostic | For checks and troubleshooting |

The state refreshes every 10 seconds, also when you change speed from the
unit's own controls.

```mermaid
flowchart LR
  VMC["Helty Flow40<br/>Modbus terminal block"] -- "RS-485 (A/B)<br/>and 24 Vdc" --> BASE["Atomic RS485 Base"]
  BASE --- ATOM["ATOM Lite<br/>ESPHome"]
  ATOM -- "Wi-Fi<br/>encrypted API" --> HA["Home Assistant"]
```

## Requirements

- A **Helty Flow40 with the Modbus terminal block**: the green 7-way
  terminal block (1-6 and X) next to the RJ socket, with 24 Vdc on
  terminals 1-2 and Modbus on terminals 4-5
- **Home Assistant** with the **ESPHome Device Builder** app (add-on),
  version **2026.9.0** or later
- **2.4 GHz Wi-Fi** that reaches the unit
- A computer with **Chrome** or **Edge** for the first flash over USB
- A small flat screwdriver. A multimeter helps to check the 24 V before
  connecting

> [!IMPORTANT]
> Without the green terminal block, with Modbus on terminals 4 and 5,
> this project doesn't apply: the ESP has nothing to talk to.

## Shopping list

Both modules come from the **M5Stack Official Store** on AliExpress.
Prices on AliExpress Italy in November 2026, VAT included: they change
with the frequent discounts.

| Part | Code | Where to buy | Price |
|---|---|---|---|
| **M5Stack ATOM Lite** (ESP32) | C008 | [AliExpress](https://www.aliexpress.com/item/1005008476946567.html) | €17-19 |
| **M5Stack Atomic RS485 Base** | A131 | [AliExpress](https://www.aliexpress.com/item/1005005912210853.html) | €10-12 |
| 4-wire cable | - | Any electrical store: alarm cable 2x0.50 + 2x0.22 mm², or a piece of UTP network cable. Use a twisted pair for A and B | €1-5 |
| USB-C **data** cable | - | You probably have one: it's needed only for the first flash | €0-5 |
| Shipping | - | Free standard shipping from the M5Stack Official Store, in about 10-20 days | €0 |
| **Total** | | | **about €30-40** |

Optional: a **USB-RS485 adapter** (€5-15) to talk to the unit from a
computer with [HeltyShell](https://github.com/fabioscarparo/HeltyShell), handy to find the Modbus
address or to run tests without the ESP.

> [!NOTE]
> Buy the **ATOM Lite** (C008). The base fits other Atom boards too, but
> this configuration is written and tested for the ATOM Lite: the AtomS3
> Lite needs a different board and different pins. The old **ATOM RS485
> Kit** (K045) that bundled both parts is discontinued: buy the two
> separately.

## Installation

### 1. Prepare ESPHome

1. In Home Assistant, open **ESPHome Device Builder** and check that the
   version is 2026.9.0 or later.
2. Select **Secrets** (top right) and add the entries of
   [`esphome/secrets.yaml.example`](esphome/secrets.yaml.example).
   `wifi_ssid` and `wifi_password` are usually there already, so add
   `helty_api_key` and `helty_ap_password`. Generate the API key with:

   ```bash
   openssl rand -base64 32
   ```

   Keep it at hand: Home Assistant asks for it in step 5.
3. Select **+ New device**, name it `helty-flow40`, choose **ESP32** and
   skip the installation.
4. On the new device select **Edit**, replace everything with the content
   of [`esphome/device.yaml`](esphome/device.yaml) and save.

`device.yaml` is short: it loads the full configuration,
[`esphome/helty-flow40.yaml`](esphome/helty-flow40.yaml), straight from
this repository. At the top you can change:

| Setting | Default | What it is |
|---|---|---|
| `device_name` | `helty-flow40` | Host name on the network |
| `friendly_name` | `Helty Flow40` | Device name in Home Assistant, and the first part of the entity IDs |
| `modbus_address` | `2` | Modbus address of the unit, 2 from the factory |

For entity names in another language, see
[Language support](#language-support).

> [!TIP]
> Rather have everything in one file? Paste
> [`esphome/helty-flow40.yaml`](esphome/helty-flow40.yaml) whole instead
> of `device.yaml`. It works the same, but you update it by hand.

### 2. First flash over USB

The first firmware goes in over the cable, with the **ATOM Lite on its
own**, off the base.

1. In ESPHome Device Builder select **Install → Manual download** and pick
   the **Factory format**. The first build takes several minutes, then a
   `.bin` file downloads.
2. Plug the ATOM Lite into the computer with the USB-C cable.
3. Open [web.esphome.io](https://web.esphome.io) in Chrome or Edge, select
   **Connect** and pick the serial port of the ATOM, then **Install** and
   choose the `.bin` file.
4. The ATOM restarts and joins the Wi-Fi: in ESPHome Device Builder the
   device turns **Online**.

If you open Home Assistant over HTTPS, **Install → Plug into this
computer** does it all in one go.

The logs now show Modbus timeouts: that's expected, the unit isn't
connected yet. From here on, updates go over Wi-Fi.

### 3. Wiring

> [!WARNING]
> Unplug the unit from the mains before opening it and connecting the
> wires.

<p align="center">
  <img src="images/wiring.svg" alt="Wiring: terminal 1 to G, terminal 2 to DC 24V, terminal 4 to A, terminal 5 to B" width="720">
</p>

| Flow40 terminal | Signal | Atomic RS485 Base |
|---|---|---|
| 1 | 24 Vdc - (ground) | **G** |
| 2 | 24 Vdc + | **DC 24V** |
| 4 | Modbus + | **A** |
| 5 | Modbus - | **B** |
| 3, 6, X | not used | - |

1. Strip the wires by 6-7 mm and tighten them in the screw terminals of
   the unit and in the orange connector of the base. The letters B, A,
   DC 24V and G are printed on the label of the base.
2. If you have a multimeter, power the unit back on before plugging in the
   base and measure the power wires: between terminal 2 and terminal 1 you
   should read about +24 V. Then unplug the unit again. Reversed polarity
   can damage the base.
3. Snap the ATOM Lite onto the base and fix it with the M2 screw that
   comes with the base.

A few notes:

- **Don't plug in the USB while the base is powered by the unit**: both
  supplies would end up on the same 5 V line. Use Wi-Fi for updates.
- **No termination resistor needed**: with one device and a short cable
  the bus works without one.
- **One master on the bus**: before connecting another Modbus gateway or
  HeltyShell, unplug the ESP.

### 4. First power-up

1. Power the unit back on: the base powers the ATOM, which joins the Wi-Fi
   in a few seconds.
2. In ESPHome Device Builder open the **Logs** of the device: the
   timeouts give way to register reads.
3. If after a minute you still see only timeouts, swap the wires of
   terminals 4 and 5 (or A and B on the base) and try again. More checks
   in [Troubleshooting](docs/troubleshooting.md).

### 5. Add to Home Assistant

1. Go to **Settings → Devices & services**: Home Assistant finds
   **Helty Flow40** among the discovered devices. Select **Configure**.
2. When it asks for the encryption key, paste the value of
   `helty_api_key`.
3. Check that **Modbus communication** is **Connected** and that the
   temperatures make sense.
4. Try the controls: turn on **Ventilation**, change the speed, turn on
   **Night**. The unit reacts within a few seconds.

### 6. Dashboard and automations

Add the [Helty Flow40 card](#dashboard-card) for a dashboard that looks
like the wall panel of the unit. [docs/home-assistant.md](docs/home-assistant.md)
has a card made with core cards only and a few automations: night mode,
filter reminder, free cooling on summer evenings and an alert when the
unit stops answering.

## Dashboard card

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="images/card-dark.png">
  <img alt="The Helty Flow40 card at speed 2, in Night mode, and in Free cooling with the filter alarm" src="images/card-light.png">
</picture>

The **Helty Flow40 card** recalls the wall panel of the unit: the same
symbols in the same places, with the four speeds next to ventilation. It's
built like the core cards of Home Assistant, so it follows your theme,
light or dark, and the language of your profile.

| Control | What it does |
|---|---|
| Icon in the header | Turns the unit on and off, like the icon of a tile card |
| Name in the header | Opens the details and the history of the fan |
| Indoor, Outdoor | The two temperatures: tap for their history |
| Ventilation | Like the key on the panel: off, speed 1, 2, 3, 4, then off again |
| 1 2 3 4 | The speed, filled up to the current one like the LEDs of the panel: tap a number to jump straight to that speed |
| Night | Minimum speed. Tap again to go back to the previous speed |
| Hyper | Maximum airflow, all four speeds filled. Tap again to go back to the previous speed |
| Free cooling | Turns free cooling on. Tap again to turn it off |
| Filter | Turns amber when the filter needs cleaning, with the steps to reset the alarm |

The card also tells you when the unit doesn't answer over Modbus, and
when it reports a frost alarm or a fault.

> [!IMPORTANT]
> The card needs version **1.0.0** of the ESPHome configuration: it finds
> the unit by the model that version sets, and recognizes the entities by
> their icons. If your device was set up before, install the configuration
> again with **Install → Wirelessly**.

### Install with HACS

The card is not in the default HACS store: add this repository as a
custom repository.

1. Open **HACS**, then **⋮ → Custom repositories**.
2. Add `https://github.com/fabioscarparo/helty-home-assistant` with type
   **Dashboard**.
3. Search for **Helty Flow40 Card**, open it and select **Download**. HACS
   adds the dashboard resource for you and lets you know when a new
   version is out.
4. Reload the browser.

### Manual installation

1. Copy [`helty-flow40-card.js`](helty-flow40-card.js) into the `www/`
   folder of your Home Assistant configuration.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**, enter
   `/local/helty-flow40-card.js` and choose **JavaScript module**. The
   **Resources** menu shows up with **Advanced mode** turned on in your
   user profile.
3. Reload the browser.

### Adding the card

1. Open a dashboard and select **Edit dashboard** (pencil).
2. Select **Add card** and search for **Helty Flow40**.
3. Pick your unit in the visual editor and save.

```yaml
type: custom:helty-flow40-card
device_id: 0123456789abcdef0123456789abcdef
name: Ventilation   # optional: defaults to the device name
color: light-blue   # optional: active controls and speeds, a Home Assistant color name or any CSS color
```

If you changed the icon of one of the unit's entities in Home Assistant,
the card can't recognize that entity: point the card to it yourself.

```yaml
entities:
  night: switch.helty_flow40_night
```

The roles are `fan`, `hyper`, `night`, `free_cooling`, `filter`, `frost`,
`modbus`, `indoor` and `outdoor`.

## Language support

| Language | Entity names | Card |
|---|---|---|
| English | ✅ default | ✅ |
| Italian | ✅ [`locales/it.yaml`](esphome/locales/it.yaml) | ✅ |

The card follows the language of each user's profile, with English for any
other language.

Entity names are part of the configuration, so Home Assistant shows them
as they are, whatever the language of your profile. To switch language,
remove the `#` in front of its line in `device.yaml`:

```yaml
    files:
      - esphome/helty-flow40.yaml
      - esphome/locales/it.yaml
```

The preset names change too: in automations, use the names of your
language, such as `Notte` instead of `Night`.

> [!IMPORTANT]
> Pick the language before adding the device to Home Assistant. Home
> Assistant tells ESPHome entities apart by their name: on a device that
> is already set up, new names create new entities with new IDs, and the
> old ones stay behind as unavailable. Dashboards and automations would
> then need the new ones.

### Help translate

- **Entity names**: copy [`locales/it.yaml`](esphome/locales/it.yaml) to
  a file named after your language, such as `de.yaml`, translate the values
  and leave the keys as they are.
- **The card**: its texts are in `STRINGS`, at the top of
  [`helty-flow40-card.js`](helty-flow40-card.js). Add your language next
  to `en` and `it`.

Then open a pull request, or send the texts with the
[Translation form](https://github.com/fabioscarparo/helty-home-assistant/issues/new?template=translation.yml).

## Updating

`device.yaml` checks this repository for changes once a day
(`refresh: 1d`). To install a new version, select **Install →
Wirelessly** in ESPHome Device Builder. Updates over Wi-Fi are accepted
only when encrypted with the API key.

To stay on a version until you decide to move, set `ref:` in
`device.yaml` to a release tag instead of `main`.

The card updates from HACS, which shows when a new version is out.

## How it works

The ESP reads the unit every 10 seconds over Modbus RTU, at 19200 baud,
8N1:

| Register | Content |
|---|---|
| IR 1000, IR 1001 | Indoor and outdoor temperature, in tenths of °C |
| IR 1006 | Alarm bitmask |
| IR 1012 | Firmware version |
| HR 1000 | Machine state: 0 off, 1-4 speed, 5 Hyper, 6 Night, 7 Free cooling |

- **It writes only HR 1000, with a value from 0 to 7.** Every control
  (fan, speed, presets and switches) goes through one internal select.
- **It writes nothing when the ESP starts**: the entities stay unknown
  until the first read, about 10 seconds later.
- **Turning the unit on without a speed** starts again from the last speed
  used, not from the highest.
- **Turning a preset off** goes back to the last speed used.
- **Alarm code 20480 (0x5000) is normal**: those are the "no humidity
  sensor" and "no CO2 sensor" bits, always on in the Flow40.
- **The filter alarm is reset on the unit**: after cleaning or replacing
  the filter, hold ventilation and hyper together on the wall panel for
  5 seconds, until all the LEDs blink twice.

The full map, with the alarm bits and the registers still unknown, is in
[Modbus registers](docs/modbus-registers.md).

## Troubleshooting

The most common problem is **Modbus communication** staying disconnected:
swap the wires of terminals 4 and 5 first. For that and everything else,
see [Troubleshooting](docs/troubleshooting.md).

## Repository layout

```text
helty-flow40-card.js       the dashboard card
hacs.json                  lets HACS install the card
esphome/
  device.yaml              the file to paste into ESPHome Device Builder
  helty-flow40.yaml        the full configuration, loaded by device.yaml
  locales/it.yaml          Italian entity names
  secrets.yaml.example     entries for the ESPHome Secrets
docs/
  home-assistant.md        dashboard and automations
  modbus-registers.md      register map
  troubleshooting.md       common problems
images/                    header, icon and pictures for this README
.github/ISSUE_TEMPLATE/    forms for bug reports and translations
```

## Contributing

Reports and improvements are welcome. Open an issue with the
[Bug report](https://github.com/fabioscarparo/helty-home-assistant/issues/new?template=bug_report.yml)
form, which asks for the versions that help to find the cause. Ideas
especially welcome:

- **Other firmware versions** - this configuration is checked on a Flow40
  with firmware 117, PID 0x1102
- **Registers 1010 and 1014** - perhaps operating or filter hours. Both
  are already in the firmware as diagnostic entities, disabled by default:
  enable them and watch how they change
- **Other boards** - tests with other Atom boards or RS-485 bases
- **Translations** - see [Help translate](#help-translate)

## Disclaimer

This is a community project, not affiliated with or endorsed by Helty.
Helty and Flow40 are trademarks of their owners. Opening the unit and
connecting anything to it is at your own risk and may affect the warranty.

## License

MIT, see [LICENSE](LICENSE).
