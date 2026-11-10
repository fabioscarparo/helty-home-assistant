# Modbus registers of the Flow40

This map comes from reading a Flow40 with firmware 117 (PID 0x1102)
through [HeltyShell](https://github.com/fabioscarparo/HeltyShell). The official Helty Modbus
documentation is not included in this repository: if you need it, ask
Helty support.

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

| Register | Content | Values |
|---|---|---|
| HR 1000 | Machine state | 0 off, 1-4 speed, 5 Hyper, 6 Night, 7 Free cooling |
| HR 0-15 | Password and data in non-volatile memory | **Never write** |

The ESPHome configuration writes **only HR 1000, with values from 0 to 7**,
and only when you give a command from Home Assistant. It writes nothing
when the ESP starts.

## Input registers (read only)

| Register | Content | Notes |
|---|---|---|
| IR 1000 | Indoor temperature | Signed, tenths of °C |
| IR 1001 | Outdoor temperature | Signed, tenths of °C, below zero in winter |
| IR 1005 | CO2 (ppm) | No sensor in the Flow40 |
| IR 1006 | Alarms | Bitmask, details below |
| IR 1010 | Unknown | Perhaps an hour counter; same value as IR 1020 |
| IR 1011 | Perhaps a temperature | Tenths of °C? |
| IR 1012 | Firmware version | 117 on the unit tested |
| IR 1013 | PID (model) | 0x1102 = Flow40 |
| IR 1014 | Unknown | |
| IR 1015 | VOC (ppm) | No sensor in the Flow40 |

IR 1010 and IR 1014 are already in the firmware as the diagnostic entities
**Register 1010** and **Register 1014**, disabled by default: enable them
and watch how they change to work out what they count.

## Alarm bits (IR 1006)

| Bit | Meaning | In Home Assistant |
|---|---|---|
| 0x0001 | Indoor sensor fault | Indoor sensor fault (diagnostic) |
| 0x0002 | Outdoor sensor fault | Outdoor sensor fault (diagnostic) |
| 0x0004 | Indoor fan fault | Indoor fan fault |
| 0x0008 | Outdoor fan fault | Outdoor fan fault |
| 0x0010 | EEPROM error | EEPROM error (diagnostic) |
| 0x0020 | Frost alarm | Frost alarm |
| 0x0040 | High humidity | Not exposed: needs the humidity sensor |
| 0x0080 | Low humidity | Not exposed: needs the humidity sensor |
| 0x0100 | Temperature difference | Not exposed |
| 0x0200 | CO2 alarm | Not exposed: needs the CO2 sensor |
| 0x0400 | Filter alarm | Filter alarm |
| 0x1000 | No humidity sensor | Normal on the Flow40 |
| 0x4000 | No CO2 sensor | Normal on the Flow40 |

On a Flow40 with no faults the register reads **0x5000 (20480)**: the
**Alarm code** entity shows the raw value.
