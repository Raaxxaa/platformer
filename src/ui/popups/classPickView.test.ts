import { expect, it, vi } from 'vitest';
import { ClassPickView } from './classPick.ts';
import { ClassPickModel } from './classPickModel.ts';
it('allows mouse selection and left-click confirmation in the class menu', () => {
  const targets: any[] = [], make = () => {
    const object: any = { width: 10, handlers: {}, destroy: vi.fn(), add: vi.fn(), removeAll: vi.fn() };
    for (const method of ['setScrollFactor', 'setDepth', 'setTint', 'setOrigin', 'setFrame', 'setInteractive', 'setPosition', 'clear', 'fillStyle', 'fillRect', 'lineStyle', 'strokeRect']) object[method] = () => object;
    object.on = (name: string, fn: unknown) => { object.handlers[name] = fn; return object; }; return object;
  };
  const scene = { textures: { exists: () => false }, add: { graphics: make, image: make, bitmapText: make, container: make, rectangle: () => { const object = make(); targets.push(object); return object; } } };
  const confirm = vi.fn(), model = new ClassPickModel(['tank'], null), view = new ClassPickView(scene as never, confirm);
  view.draw(model, null); targets[1].handlers.pointerover(); expect(model.wi).toBe(1);
  targets.at(-1).handlers.pointerdown({ button: 2 }); expect(confirm).not.toHaveBeenCalled();
  targets.at(-1).handlers.pointerdown({ button: 0 }); expect(confirm).toHaveBeenCalledOnce();
});
