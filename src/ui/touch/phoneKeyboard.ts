// Seed entry on a phone (M12 Task 4): tapping a seed box focuses a hidden HTML input so the phone's own keyboard opens;
// what is typed goes into the same panel model the keyboard uses.
export interface PhoneKeyboardSink { text(ch: string): void; backspace(): void; enter(): void }

let input: HTMLInputElement | null = null;
let sink: PhoneKeyboardSink | null = null;

function ensure(): HTMLInputElement {
  if (input) return input;
  const el = document.createElement('input');
  el.type = 'text'; el.id = 'phone-keyboard'; el.autocapitalize = 'characters'; el.autocomplete = 'off'; el.spellcheck = false;
  el.setAttribute('autocorrect', 'off'); el.setAttribute('enterkeyhint', 'done');
  // 16 px or more keeps iOS from zooming the page when the field takes focus.
  el.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;z-index:60;';
  el.addEventListener('input', () => {
    for (const ch of el.value) if (/[A-Za-z0-9]/.test(ch)) sink?.text(ch);
    el.value = '';
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') sink?.backspace();
    if (e.key === 'Enter') { sink?.enter(); el.blur(); }
    e.stopPropagation();                       // the game's own key handlers must not also see these keys
  });
  el.addEventListener('keyup', (e) => e.stopPropagation());
  document.body.append(el);
  input = el;
  return el;
}

/** Opens the phone keyboard for a panel; call from the tap's handler so the browser allows the focus. */
export function openPhoneKeyboard(s: PhoneKeyboardSink): void { sink = s; const el = ensure(); el.value = ''; el.focus(); }
export function closePhoneKeyboard(): void { sink = null; input?.blur(); }
