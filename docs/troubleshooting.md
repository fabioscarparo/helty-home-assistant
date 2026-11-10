# Troubleshooting

## Modbus communication stays disconnected

The ESPHome logs show only timeouts and the entities stay unknown.

1. **A/B polarity.** Swap the wires of terminals 4 and 5 of the unit, or
   A and B on the base. The + and - labels aren't consistent between
   manufacturers, and swapping them doesn't damage anything.
2. **Power.** If the ATOM is online in ESPHome, the base is powered. If it
   isn't, see the next section.
3. **Address.** The factory address is 2. If someone changed it, find it
   with a USB-RS485 adapter and the `scan` command of
   [HeltyShell](https://github.com/fabioscarparo/HeltyShell), then set `modbus_address` in
   `device.yaml`.
4. **One master.** If another Modbus gateway or HeltyShell is on the bus,
   the unit gets overlapping requests. Leave only the ESP connected.
5. **Terminals.** Check that each wire is clamped under the screw by its
   copper, not by its insulation.

## The ATOM doesn't turn on with the unit

- Measure the voltage between the wires of terminals 2 (+) and 1 (-): you
  should read about 24 V.
- Check that + goes to **DC 24V** and - to **G**, not to A or B.
- Try the ATOM over USB, off the base: if it works that way, the problem is
  in the wiring or in the base.

## The first flash over USB doesn't start

- Use a USB-C **data** cable: many cables that come with chargers carry
  power only.
- Use Chrome or Edge: Safari and Firefox can't reach serial ports from the
  browser.
- If the computer doesn't see the port, try another USB socket and check in
  the M5Stack documentation whether your system needs a USB-serial driver.

## ESPHome refuses to build because of `min_version`

The configuration needs ESPHome 2026.9.0 or later for encrypted OTA
updates. Update the ESPHome Device Builder app in Home Assistant.

## ESPHome can't find a secret

The configuration expects `wifi_ssid`, `wifi_password`, `helty_api_key`
and `helty_ap_password` in the Secrets of ESPHome Device Builder. See
[`secrets.yaml.example`](../esphome/secrets.yaml.example).

## Home Assistant asks for the encryption key

It's the value of `helty_api_key` in the ESPHome Secrets. If you change the
key, Home Assistant asks for it again.

## The Wi-Fi drops

Check the **WiFi signal** diagnostic entity: below -75 dBm the connection
gets unreliable. An ATOM closed inside the wall or behind the unit loses
signal: bring a repeater closer or move the module further out.

When the home Wi-Fi is unreachable, after about a minute the ATOM turns on
the `helty-flow40` hotspot (password: `helty_ap_password`), where you can
enter the Wi-Fi credentials again.

## The switches and the fan are unknown after a restart

That's on purpose: when it starts, the ESP writes nothing to the unit and
waits for the first read, about 10 seconds. If they stay unknown longer,
it's a communication problem: see the first section.

## Alarm code reads 20480

That's normal: 20480 is 0x5000, the "no humidity sensor" and "no CO2
sensor" bits, always on in the Flow40. Real alarms have their own
entities. Details in [Modbus registers](modbus-registers.md).
