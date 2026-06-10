# Cockpit AIS-catcher

A [Cockpit](https://cockpit-project.org/) plugin for
[AIS-catcher](https://github.com/jvde-github/AIS-catcher) — adds an **AIS** page
to the Cockpit web console with service control, live statistics, a nearby-vessel
table, and a link to the AIS-catcher web map.

## Features

- **Service control** — start / restart / stop `ais-catcher.service` from Cockpit.
- **Live statistics** (polled from AIS-catcher's `/stat.json`): message count and
  rate, tracked vessels, max range, A/B channel split, feed clients, and the
  input device (e.g. a dAISy on serial).
- **Vessel table** (from `/ships.json`): nearest vessels with MMSI, name, type,
  country, distance, speed, signal level and last-seen.
- **Open map ↗** button to the full AIS-catcher web viewer.

Stats are fetched server-side through the Cockpit bridge, so there's no
cross-origin or mixed-content problem with AIS-catcher's HTTP server.

This plugin ships **prebuilt** — no Node/build toolchain is needed to install.

## Requirements

- `cockpit`
- A running [AIS-catcher](https://github.com/jvde-github/AIS-catcher) instance
  with its web server enabled (`-N 8100`) on the same host.

The plugin is the **UI only**; it does not bundle AIS-catcher. Install
AIS-catcher separately (see below).

## Install

### Packages (no build tools)

Download the `.deb` or `.rpm` from the
[Releases](https://github.com/snstac/cockpit-aiscatcher/releases) page:

```sh
# Debian/Ubuntu
sudo apt install ./cockpit-aiscatcher_*_all.deb
# Fedora/RHEL
sudo dnf install ./cockpit-aiscatcher-*.noarch.rpm
```

### From source

```sh
git clone https://github.com/snstac/cockpit-aiscatcher.git
cd cockpit-aiscatcher
make
sudo make install      # -> /usr/share/cockpit/aiscatcher
```

Then open `https://<host>:9090` and click **AIS** (reload an open Cockpit tab to
pick up the new package).

### Development

```sh
make devel-install     # symlink dist/ into ~/.local/share/cockpit/aiscatcher
make watch             # rebuild on change; just reload the page
```

## Setting up AIS-catcher (with a dAISy or other receiver)

Install AIS-catcher per its
[docs](https://jvde-github.github.io/AIS-catcher-docs/) (the official installer
fetches a prebuilt `.deb`):

```sh
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/jvde-github/AIS-catcher/main/scripts/aiscatcher-install) -p"
```

Then run it as a service with the web viewer on port **8100**. An example unit is
shipped at `/usr/share/doc/cockpit-aiscatcher/examples/ais-catcher.service` (and
in [`examples/`](examples/)) — edit the device path and station, then:

```sh
sudo cp examples/ais-catcher.service /etc/systemd/system/
sudoedit /etc/systemd/system/ais-catcher.service   # set device, station, lat/lon
sudo systemctl enable --now ais-catcher.service
```

For a **dAISy** AIS receiver (NMEA over USB serial), the input is
`-e 38400 /dev/serial/by-id/usb-...dAISy...-if00`. For an SDR, use `-d:0` etc.
See the AIS-catcher docs for all input options.

## Uninstall

```sh
sudo ./uninstall.sh        # or: ./uninstall.sh --user
```

## License

Apache-2.0. See [LICENSE](LICENSE).
