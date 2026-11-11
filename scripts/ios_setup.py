"""M16: makes the Capacitor iOS project (ios/) a full-screen, landscape-only game app.
Safe to run again (npm run app:ios runs it after `cap sync`). Needs Python 3 with Pillow only for the icon and splash."""
import plistlib, re
from pathlib import Path

APP = Path('ios/App/App')
BG = (0x0d, 0x0b, 0x14)

def info_plist():
    p = APP / 'Info.plist'
    d = plistlib.loads(p.read_bytes())
    land = ['UIInterfaceOrientationLandscapeRight', 'UIInterfaceOrientationLandscapeLeft']
    d['UISupportedInterfaceOrientations'] = land
    d['UISupportedInterfaceOrientations~ipad'] = land
    d['UIStatusBarHidden'] = True
    d['UIViewControllerBasedStatusBarAppearance'] = True       # the game view controller hides it
    d['UIRequiresFullScreen'] = True
    d['UIRequiredDeviceCapabilities'] = ['arm64']
    d['ITSAppUsesNonExemptEncryption'] = False
    p.write_bytes(plistlib.dumps(d))

GAME_VC = '''
/// RUSHBLADE (M16): full screen, no status bar, and edge swipes go to the game first (the home indicator is hidden by SystemBars in capacitor.config.ts).
class GameViewController: CAPBridgeViewController {
    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override func viewDidLoad() {
        super.viewDidLoad()
        let bg = UIColor(red: 13 / 255, green: 11 / 255, blue: 20 / 255, alpha: 1)
        view.backgroundColor = bg
        webView?.isOpaque = false
        webView?.backgroundColor = bg
        webView?.scrollView.backgroundColor = bg
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
'''

def view_controller():
    d = APP / 'AppDelegate.swift'
    s = d.read_text()
    if 'class GameViewController' not in s: d.write_text(s.rstrip() + '\n' + GAME_VC)
    # Capacitor 8 builds the first screen in SceneDelegate, not from Main.storyboard, so swap it there too.
    sd = APP / 'SceneDelegate.swift'
    if sd.exists(): sd.write_text(sd.read_text().replace('rootViewController = CAPBridgeViewController()', 'rootViewController = GameViewController()'))
    m = APP / 'Base.lproj/Main.storyboard'
    m.write_text(m.read_text().replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="GameViewController" customModule="App"'))
    ls = APP / 'Base.lproj/LaunchScreen.storyboard'
    ls.write_text(re.sub(r'<color key="backgroundColor" systemColor="systemBackgroundColor"/>',
        '<color key="backgroundColor" red="0.051" green="0.043" blue="0.078" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>', ls.read_text()))

def images():
    try:
        from PIL import Image
    except ImportError:
        print('(no Pillow: keeping the committed icon and launch images)'); return
    icon = Image.open('public/assets/app/icon-512.png').convert('RGB').resize((1024, 1024), Image.NEAREST)
    icon.save(APP / 'Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
    splash = Image.new('RGB', (2732, 2732), BG)
    logo = Image.open('public/assets/app/icon-512.png').convert('RGB')
    splash.paste(logo, ((2732 - 512) // 2, (2732 - 512) // 2))
    for n in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
        splash.save(APP / 'Assets.xcassets/Splash.imageset' / n, optimize=True)

if __name__ == '__main__':
    info_plist(); view_controller(); images()
    print('ios/ set up: landscape, full screen, RUSHBLADE icon and dark launch screen')
