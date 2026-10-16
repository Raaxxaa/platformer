"""Entry point for `npm run assets`: builds every generated asset, then runs the checks."""
import os
import subprocess
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)

from art import palette  # noqa: E402
from art import atlas, build_player  # noqa: E402


def build(root=ROOT):
    """Write every output under `root` (public/assets/... and tools/out/...)."""
    assets = os.path.join(root, 'public', 'assets')
    out = os.path.join(root, 'tools', 'out')
    preview = os.path.join(out, 'preview')
    for d in (assets, preview):
        os.makedirs(d, exist_ok=True)
    # SPEC-GAP: 08 §3.1 says src/data/palette.generated.ts; the art chat may not touch src/ (docs/art/SPEC-GAPS-art.md #1).
    palette.write_ts(os.path.join(out, 'palette.generated.ts'))
    palette.write_json(os.path.join(assets, 'palette.json'))
    anims = []
    anims += build_player.build(assets, preview)
    atlas.write_anims(os.path.join(assets, 'anims.json'), anims)
    return assets


def main():
    build()
    r = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', os.path.join(TOOLS, 'tests')], cwd=ROOT)
    sys.exit(r.returncode)


if __name__ == '__main__':
    main()
