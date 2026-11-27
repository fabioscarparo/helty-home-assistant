# Modbus registers of Helty Flow units

This map comes from reading a Flow40 and a Flow120 (Green PCB, firmware 117,
PID `0x1102`) through [HeltyShell](https://github.com/fabioscarparo/HeltyShell)
and from Helty's Modbus register documentation (HDRP / HDAP). The official
Helty documentation is not included in this repository: if you need it, ask
Helty support.

Helty ships Flow units with two PCB revisions: **Green PCB** (*Elettronica
Verde*) and **Blue PCB** (*Elettronica Blu*). Input registers and machine state
control (`HR 1000`) are shared; configuration holding registers differ between
the two PCBs.

## Communication

| Parameter | Value |
|---|---|
| Protocol | Modbus RTU over RS-485 |
| Speed | 19200 baud |
| Format | 8 data bits, no parity, 1 stop bit (8N1) |
| Factory address | 2 |
| Functions used | 03 read holding registers, 04 read input registers, 06 write single holding register |
| Terminals | 4 = Modbus +, 5 = Modbus - |

## Holding registers (read and write)

| Register | Content | Values / Unit | Green PCB | Blue PCB | In Home Assistant |
|---|---|---|---|---|---|
| HR 0-15 | Password and non-volatile data | **Never write** | - | - | Never read or written |
| HR 1000 | Machine state | `0` off, `1`-`4` speed, `5` Hyper, `6` Night, `7` Free cooling | yes | yes | Ventilation fan & preset switches (read/write) |
| HR 1051 | Manual free cooling timer | `0-9999 min` (default `20`) | yes* | yes | Manual free cooling timer (read-only diagnostic) |
| HR 1060 | `ConfigStatus` bitmask | `0x01` Auto FC, `0x02` Exclude sensors, `0x04` Panel LED off* | yes | no | Auto free cooling & Panel LED switches (read/write, default) |
| HR 1063 | Power LED intensity | `0-100 %` (Elite models only) | yes | no | Not exposed |
| HR 1064 | Light timer | `0-999 s`, `0` = infinite (Elite models only) | yes | no | Not exposed |
| HR 1070 | Heater ON temperature | Signed `×0.1 °C` (`-200..100`) | yes | yes | Heater ON temperature (read-only diagnostic) |
| HR 1072 | Heater OFF temperature | Signed `×0.1 °C` (`-400..400`) | yes | yes | Heater OFF temperature (read-only diagnostic) |
| HR 1085 | Exclude sensors | `0` active, `1` excluded | no | yes | Sensors excluded (`pcb-blue.yaml`, diagnostic) |
| HR 1096 | Panel LED | `0` on, `1` off | no | yes | Panel LED switch (`pcb-blue.yaml`, read/write) |
| HR 1100 | Reset partial filter counter | Write `0x4550` | no | yes | Reset filter button (`pcb-blue.yaml`, write-only) |
| HR 1101 | Free cooling mode | `0` manual, `1` auto | no | yes | Auto free cooling switch (`pcb-blue.yaml`, read/write) |
| HR 1117 | Modbus slave ID | `1-254` (default `2`) | no | yes | Modbus address (`pcb-blue.yaml`, read-only diagnostic) |

*\*Helty's documentation marks `HR 1051` as Blue PCB only, but it also responds (`20` min) on tested Green PCB units. On Flow40 units with the FlowEASY wall panel, firmware `117` stores `HR 1060` bit `0x04` (Panel LED off) without turning off the panel LEDs, so **Panel LED** is disabled by default on Flow40 and enabled automatically by `flow120.yaml`.*

The default ESPHome configuration (`helty-flow40.yaml`, Green PCB) writes only:

- **`HR 1000`** (`0`-`7`) when changing operating mode.
- **`HR 1060`** via read-modify-write (preserving all other bits) when toggling **Panel LED** or **Auto free cooling**.

With the optional **`pcb-blue.yaml`** package, `HR 1060` is removed and writes go to `HR 1000`, `HR 1096` (Panel LED), `HR 1101` (Auto free cooling), and `HR 1100` (`0x4550` when pressing **Reset filter**). Nothing is ever written at boot or before the register has been read at least once.

## Input registers (read only)

| Register | Content | Unit / Notes | In Home Assistant |
|---|---|---|---|
| IR 1000 | Indoor temperature | Signed, `×0.1 °C` | Indoor temperature |
| IR 1001 | Outdoor temperature | Signed, `×0.1 °C` (below zero in winter) | Outdoor temperature |
| IR 1004 | Relative humidity | `×0.1 %` (fallback `400` = `40.0 %` if unfitted) | Indoor humidity (`air-quality.yaml`) |
| IR 1005 | CO2eq / CO2 | `ppm` (if sensor fitted) | CO2 (`air-quality.yaml`) |
| IR 1006 | Alarms and status flags | 16-bit bitmask, details below | Alarm code + decoded binary sensors |
| IR 1010 | Partial filter air counter | `×0.1 m³` | Filter air |
| IR 1011 | Temperature? | `×0.1 °C` (observed equal to IR 1000) | Not exposed |
| IR 1012 | Firmware version | `117` on tested units | Firmware version (diagnostic) |
| IR 1013 | PID (model) | `0x1102` on tested Flow40 and Flow120 | Not exposed |
| IR 1014 | Unknown | | Register 1014 (diagnostic, disabled by default) |
| IR 1015 | VOC / IAQ | `ppb` or VOC index (if sensor fitted) | VOC (`air-quality.yaml`) |
| IR 1020 | Total air volume counter | `×0.1 m³` | Total air |

`air-quality.yaml` checks the missing-sensor bits of `IR 1006` (`0x1000` and `0x4000`) so unfitted sensors report `unknown` instead of fallback values like `40.0 %` or `0 ppm`.

## Alarm and status bits (IR 1006)

All 16 bits of `IR 1006` are defined:

| Bit | Meaning | Kind | In Home Assistant |
|---|---|---|---|
| `0x0001` | Indoor sensor fault | Alarm | Indoor sensor fault (diagnostic) |
| `0x0002` | Outdoor sensor fault | Alarm | Outdoor sensor fault (diagnostic) |
| `0x0004` | Indoor fan fault | Alarm | Indoor fan fault |
| `0x0008` | Outdoor fan fault | Alarm | Outdoor fan fault |
| `0x0010` | EEPROM error | Alarm | EEPROM error (diagnostic) |
| `0x0020` | Frost alarm (ICE / indoor temp.) | Alarm | Frost alarm |
| `0x0040` | High humidity | Alarm | High humidity alarm (`air-quality.yaml`) |
| `0x0080` | High/low humidity | Alarm | Humidity alarm (`air-quality.yaml`, diagnostic) |
| `0x0100` | Temperature difference / low temp. | Alarm | Temperature difference alarm |
| `0x0200` | CO2/VOC alarm | Alarm | CO2/VOC alarm (`air-quality.yaml`) |
| `0x0400` | Filter alarm | Alarm | Filter alarm |
| `0x0800` | Free-heating active | Status | Free heating active |
| `0x1000` | Humidity sensor not fitted | Info | Normal on base Flow40 (gates `IR 1004` in `air-quality.yaml`) |
| `0x2000` | Free-cooling active | Status | Free cooling active |
| `0x4000` | CO2/VOC sensor not fitted | Info | Normal on base Flow40 (gates `IR 1005`/`1015` in `air-quality.yaml`) |
| `0x8000` | Automatic free-cooling enabled | Status | Reflected by Auto free cooling switch (`HR 1060` bit `0x01` / `HR 1101`); verified active on Green PCB fw `117` as well as documented for Blue PCB |

On a base Flow40 with no faults, free cooling/heating idle, and automatic free
cooling off, `IR 1006` reads **`0x5000` (`20480`)** — or **`0xD000` (`53248`)**
when automatic free cooling is enabled. The **Alarm code** entity shows the raw
value.
