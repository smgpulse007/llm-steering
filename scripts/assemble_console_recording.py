"""Assemble actual browser captures; this does not synthesize UI or run inference."""
from pathlib import Path
import hashlib
import json

from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'docs/assets/console-demo'
names = ['support.png', 'tutor.png', 'awaiting-run.png']
frames = [Image.open(source / name).convert('RGB') for name in names]
if len({frame.size for frame in frames}) != 1:
    raise SystemExit('Capture dimensions must match.')
target = root / 'docs/assets/console-provenance-demo.gif'
frames[0].save(target, save_all=True, append_images=frames[1:], duration=3000, loop=0, optimize=True)
(source / 'recording.json').write_text(json.dumps({
    'capturedAt': '2026-11-14', 'mode': 'Actual static Pages build; no model inference',
    'page': '/llm-steering/#workbench', 'viewport': [1440, 1000],
    'imageSize': list(frames[0].size), 'frameDurationMs': 3000,
    'steps': ['Support preset and empty diagnostics', 'Tutor preset updates the draft', 'Outputs await a completed local run'],
    'editing': 'Unaltered browser frames assembled into a GIF; palette conversion only.',
    'frames': [{'file': name, 'sha256': hashlib.sha256((source/name).read_bytes()).hexdigest()} for name in names],
}, indent=2)+'\n', encoding='utf-8')
print(f'Assembled {len(frames)} actual frames: {target.name} ({target.stat().st_size} bytes)')
