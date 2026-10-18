/** The build reads the existing asset tree; missing ART7 files never become 404 requests. */
export function assetPlan(files: readonly string[]): { atlases: string[]; tiles: string[]; backgrounds: string[]; audio: string[] } {
  const have = new Set(files);
  const atlases = files.flatMap(path => {
    const match = path.match(/^assets\/atlases\/(.+)\.json$/);
    return match && have.has(`assets/atlases/${match[1]}.png`) ? [match[1]] : [];
  });
  const tiles = files.flatMap(path => {
    const match = path.match(/^assets\/tiles\/tiles_(.+)\.png$/);
    return match ? [match[1]] : [];
  });
  const backgrounds = files.flatMap(path => {
    const match = path.match(/^assets\/bg\/bg_(.+)_0\.png$/);
    return match && have.has(`assets/bg/bg_${match[1]}_1.png`) && have.has(`assets/bg/bg_${match[1]}_2.png`) ? [match[1]] : [];
  });
  const audio = files.filter(path => path.startsWith('assets/audio/sfx/')).map(path => path.slice('assets/audio/sfx/'.length));
  return { atlases: atlases.sort(), tiles: tiles.sort(), backgrounds: backgrounds.sort(), audio: audio.sort() };
}
