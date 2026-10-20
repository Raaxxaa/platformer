#!/usr/bin/env sh
# Start the RUSHBLADE company controller. Leave this terminal open.
cd "$(dirname "$0")/.." || exit 1
python3 company/company.py doctor || { echo "Fix the problems above, then run this again."; exit 1; }
exec python3 company/company.py run
