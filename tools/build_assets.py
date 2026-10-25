"""Entry point for `npm run assets`: builds every generated asset, then runs the checks."""
import os
import subprocess
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)

from art import palette  # noqa: E402
from art import touch  # noqa: E402
from art import look, cosmetics  # noqa: E402
from art import atlas, boards, build_player, build_world, contrast, fonts, items, npcs, projectiles, style_board, ui, vfx, village, weapons  # noqa: E402
from art.enemies import plains as enemies_plains  # noqa: E402
from art.enemies import mountains as enemies_mountains  # noqa: E402
from art.enemies import swamps as enemies_swamps  # noqa: E402
from art import style_board_stage2, style_board_stage34, world34  # noqa: E402
from art.bosses import great_boar, stone_colossus, spider_queen, black_knight, enemy_king, dragon  # noqa: E402
from art.enemies import kingdom as enemies_kingdom, castle as enemies_castle  # noqa: E402
from audio import render_music  # noqa: E402
from audio import listen_sheet, listen_sheet_stage2, listen_sheet_stage34, sfx_defs, sfx_stage2, sfx_stage34  # noqa: E402


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
    anims += look.annotate(build_player.build(assets, preview))
    look.build(assets, preview)
    cosmetics.build(assets, preview)
    anims += weapons.build(assets, preview)
    anims += enemies_plains.build(assets, preview)
    anims += great_boar.build(assets, preview)
    anims += enemies_mountains.build(assets, preview)
    anims += stone_colossus.build(assets, preview)
    anims += enemies_swamps.build(assets, preview)
    anims += spider_queen.build(assets, preview)
    anims += enemies_kingdom.build(assets, preview)
    anims += black_knight.build(assets, preview)
    anims += enemies_castle.build(assets, preview)
    anims += enemy_king.build(assets, preview)
    anims += dragon.build(assets, preview)
    build_world.build(assets, preview)
    world34.build(assets, preview)
    ui.build(assets, preview)
    touch.write_app_icons(os.path.join(assets, 'app'))
    fonts.build(os.path.join(assets, 'fonts'))
    fonts.sample(os.path.join(preview, 'font_sample.png'))
    anims += items.build(assets, preview)
    anims += projectiles.build(assets, preview)
    anims += vfx.build(assets, preview)
    anims += village.build(assets, preview)
    anims += npcs.build(assets, preview)
    style_board.build(preview)
    style_board.build_villages(preview)
    style_board_stage2.build(preview)
    style_board_stage34.build(preview)
    boards.build(preview)
    contrast.write_report(preview)
    sfx_defs.build(os.path.join(assets, 'audio', 'sfx'))
    sfx_stage2.build(os.path.join(assets, 'audio', 'sfx'))
    sfx_stage34.build(os.path.join(assets, 'audio', 'sfx'))
    listen_sheet.build(os.path.join(root, 'docs', 'art'))
    listen_sheet_stage2.build(os.path.join(root, 'docs', 'art'))
    listen_sheet_stage34.build(os.path.join(root, 'docs', 'art'))
    render_music.build(root)
    atlas.write_anims(os.path.join(assets, 'anims.json'), anims)
    return assets


def main():
    build()
    r = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', os.path.join(TOOLS, 'tests')], cwd=ROOT)
    sys.exit(r.returncode)


if __name__ == '__main__':
    main()
