#!/bin/sh
# Convenience installer: builds the plugin and installs it via the Makefile.
# For prebuilt installs (no build tools), use the .deb/.rpm from Releases.
set -eu

USER_INSTALL=0
for a in "$@"; do
    case "$a" in
        --user) USER_INSTALL=1 ;;
        -h|--help) echo "usage: ./install.sh [--user]"; exit 0 ;;
        *) echo "unknown option: $a" >&2; exit 1 ;;
    esac
done

echo "Building..."
make

if [ "$USER_INSTALL" = 1 ]; then
    make devel-install
    echo "Installed for current user (~/.local/share/cockpit/aiscatcher)."
else
    sudo make install
fi
echo "Done. Open Cockpit and click AIS (reload an open tab to pick it up)."
echo "Note: this is the Cockpit UI; it needs a running AIS-catcher instance."
