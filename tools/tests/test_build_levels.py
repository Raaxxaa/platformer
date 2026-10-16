import json
import os
import tempfile
import unittest
import _path  # noqa: F401
import build_levels as B


def make(chunks, legend=None, objects=None, w=10, h=6, main=None):
    d = tempfile.mkdtemp()
    man = {'levelId': 'mini', 'kind': 'stage', 'stage': 1, 'biome': 'plains', 'width': w, 'height': h,
           'chunks': [], 'legend': legend or {}, 'objects': objects or [], 'mainPath': main or []}
    for i, (x, y, text) in enumerate(chunks):
        name = f'c{i}.txt'
        with open(os.path.join(d, name), 'w') as f:
            f.write(text)
        man['chunks'].append({'file': name, 'x': x, 'y': y})
    with open(os.path.join(d, 'level.json'), 'w') as f:
        json.dump(man, f)
    return d


def objs(tiled, typ):
    return [o for layer in tiled['layers'] if layer['type'] == 'objectgroup' for o in layer['objects'] if o['type'] == typ]


def cell(tiled, x, y):
    return tiled['layers'][0]['data'][y * tiled['width'] + x]


class BuildLevelsTest(unittest.TestCase):
    def test_collapsing_run(self):  # 06 test 25
        t, _ = B.build(make([(0, 0, '..%%%..')]))
        cp = objs(t, 'collapsing_platform')
        self.assertEqual(len(cp), 1)
        self.assertEqual((cp[0]['x'], cp[0]['width'], cp[0]['height']), (32, 48, 16))

    def test_cracked_block(self):
        t, _ = B.build(make([(1, 1, '++\n++\n++')]))
        cw = objs(t, 'cracked_wall')
        self.assertEqual(len(cw), 1)
        self.assertEqual((cw[0]['x'], cw[0]['y'], cw[0]['width'], cw[0]['height']), (16, 16, 32, 48))

    def test_uncovered_is_solid_and_space_keeps(self):
        t, _ = B.build(make([(0, 0, '....'), (0, 0, ' =  ')]))
        self.assertEqual([cell(t, x, 0) for x in range(5)], [0, 2, 0, 0, 1])
        self.assertEqual(cell(t, 0, 3), 1)

    def test_id_order_and_anchors(self):
        legend = {'w': {'type': 'enemy', 'enemy': 'wolf', 'group': 'p1'}}
        t, _ = B.build(make([(0, 0, '...w\nP...\n..L.')], legend=legend,
                            objects=[{'type': 'exit', 'x': 5, 'y': 0, 'w': 2, 'h': 2}], main=[[0, 1], [3, 1]]))
        all_objs = sorted((o for layer in t['layers'] if layer['type'] == 'objectgroup' for o in layer['objects']), key=lambda o: o['id'])
        self.assertEqual([o['type'] for o in all_objs], ['enemy', 'player_start', 'lucky_block', 'exit', 'main_path'])
        self.assertEqual((all_objs[0]['x'], all_objs[0]['y']), (3 * 16 + 8, 16))        # feet
        self.assertEqual((all_objs[2]['x'], all_objs[2]['y']), (2 * 16 + 8, 2 * 16 + 8))  # center
        self.assertEqual(all_objs[4]['polyline'][1], {'x': 48, 'y': 0})
        self.assertEqual(objs(t, 'enemy')[0]['properties'], [{'name': 'enemy', 'type': 'string', 'value': 'wolf'},
                                                             {'name': 'group', 'type': 'string', 'value': 'p1'}])

    def test_byte_identical(self):  # 06 test 26
        d = make([(0, 0, '..%%..\nP.^^..')])
        self.assertEqual(B.to_text(B.build(d)[0]), B.to_text(B.build(d)[0]))

    def test_unknown_char(self):
        with self.assertRaises(B.BuildError):
            B.build(make([(0, 0, '..Z..')]))


if __name__ == '__main__':
    unittest.main()
