#!/bin/sh
# Remove the Cockpit AIS-catcher plugin installed via the Makefile.
set -eu

if [ "${1:-}" = "--user" ]; then
    make devel-uninstall
    echo "Removed user install."
    exit 0
fi

sudo make uninstall
echo "Done."
