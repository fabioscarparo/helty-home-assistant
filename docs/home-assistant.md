# Home Assistant: dashboard and automations

The examples use the IDs Home Assistant usually gives to the entities of a
device named **Helty Flow40**, with English names. Check yours in
**Settings → Devices & services → ESPHome → Helty Flow40**: with another
`friendly_name` or another language they differ, for example
`fan.helty_flow40_ventilazione` with the Italian names.

| Entity | ID |
|---|---|
| Ventilation | `fan.helty_flow40_ventilation` |
| Hyper, Night, Free cooling | `switch.helty_flow40_hyper`, `switch.helty_flow40_night`, `switch.helty_flow40_free_cooling` |
| Temperatures | `sensor.helty_flow40_indoor_temperature`, `sensor.helty_flow40_outdoor_temperature` |
| Filter alarm | `binary_sensor.helty_flow40_filter_alarm` |
| Modbus communication | `binary_sensor.helty_flow40_modbus_communication` |

## Dashboard

The [Helty Flow40 card](../README.md#dashboard-card) reproduces the wall
panel of the unit, finds the entities by itself and needs no IDs. With the
core cards of Home Assistant only, a tile card with speed and presets does
the job: while editing a dashboard, select **Add card → Manual** and paste:

```yaml
type: tile
entity: fan.helty_flow40_ventilation
name: Ventilation
features_position: bottom
features:
  - type: fan-speed
  - type: fan-preset-modes
    style: dropdown
```

Without a `preset_modes` list the card shows every preset of the fan, with
the names of your [language](../README.md#language-support): with the
Italian names, for example, **Night** is **Notte**. Listing the presets
by hand works too, but only with the names the fan actually has.

And a card with temperatures and alarms:

```yaml
type: entities
title: Helty Flow40
entities:
  - entity: sensor.helty_flow40_indoor_temperature
    name: Indoor
  - entity: sensor.helty_flow40_outdoor_temperature
    name: Outdoor
  - entity: binary_sensor.helty_flow40_filter_alarm
    name: Filter
  - entity: binary_sensor.helty_flow40_modbus_communication
    name: Connection
```

## Automations

For each one: **Settings → Automations & scenes → Create automation →
Create new automation**, then **⋮ → Edit in YAML**, paste and save.

### Night mode in the evening, normal speed in the morning

Turning the **Night** switch off brings the unit back to the last speed
used, so turning it on and off is all it takes.

```yaml
alias: Ventilation - Night from 23 to 7
triggers:
  - trigger: time
    at: "23:00:00"
    id: evening
  - trigger: time
    at: "07:00:00"
    id: morning
conditions:
  - condition: state
    entity_id: fan.helty_flow40_ventilation
    state: "on"
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: evening
        sequence:
          - action: switch.turn_on
            target:
              entity_id: switch.helty_flow40_night
      - conditions:
          - condition: trigger
            id: morning
        sequence:
          - action: switch.turn_off
            target:
              entity_id: switch.helty_flow40_night
mode: single
```

### Filter reminder

```yaml
alias: Ventilation - Filter reminder
triggers:
  - trigger: state
    entity_id: binary_sensor.helty_flow40_filter_alarm
    to: "on"
actions:
  - action: persistent_notification.create
    data:
      title: Helty Flow40
      message: >-
        The filter needs cleaning or replacing. Then reset the alarm on the
        wall panel: hold ventilation and hyper together for 5 seconds,
        until all the LEDs blink twice.
mode: single
```

To get it on your phone, replace the action with
`notify.mobile_app_<your_phone>`.

The alarm is reset only on the unit: Home Assistant can't clear it,
because the configuration writes nothing but the operating mode. Once
reset, the **Filter alarm** entity turns off at the next read.

### Alert when the unit stops answering

```yaml
alias: Ventilation - Connection lost
triggers:
  - trigger: state
    entity_id: binary_sensor.helty_flow40_modbus_communication
    to: "off"
    for: "00:05:00"
actions:
  - action: persistent_notification.create
    data:
      title: Helty Flow40
      message: The unit hasn't answered for 5 minutes. Check power and wiring.
mode: single
```

### Free cooling on summer evenings

Turns free cooling on when it's warm indoors and at least 2 °C cooler
outside, and off when the difference is gone. Adjust the thresholds to
your home.

```yaml
alias: Ventilation - Summer free cooling
triggers:
  - trigger: template
    value_template: >
      {{ states('sensor.helty_flow40_indoor_temperature') | float(0) > 24
         and states('sensor.helty_flow40_outdoor_temperature') | float(99)
             < states('sensor.helty_flow40_indoor_temperature') | float(0) - 2 }}
    for: "00:10:00"
    id: start
  - trigger: template
    value_template: >
      {{ states('sensor.helty_flow40_outdoor_temperature') | float(-99)
         >= states('sensor.helty_flow40_indoor_temperature') | float(99) }}
    for: "00:10:00"
    id: stop
conditions:
  - condition: state
    entity_id: fan.helty_flow40_ventilation
    state: "on"
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: start
        sequence:
          - action: switch.turn_on
            target:
              entity_id: switch.helty_flow40_free_cooling
      - conditions:
          - condition: trigger
            id: stop
        sequence:
          - action: switch.turn_off
            target:
              entity_id: switch.helty_flow40_free_cooling
mode: single
```
