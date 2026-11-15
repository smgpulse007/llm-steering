"""Assemble unaltered browser captures into the README tour; never render fake UI."""
from pathlib import Path
import hashlib
import json

from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'docs/assets/lab-tour'
steps = [
    ('01-overview.jpg', '#overview', 'Story and original customer-support comparison', 4500),
    ('02-experiment.jpg', '#experiments/customer_support_empathy', 'Full source record and original settings', 5000),
    ('03-learn.jpg', '#learn', 'Synthetic 2D illustration, coefficient 1', 3500),
    ('04-vector.jpg', '#learn', 'Keyboard changes coefficient to 2; edited vector updates', 3000),
    ('05-workbench.jpg', '#workbench', 'Local experiment draft; no generated outputs', 5000),
]
frames = [Image.open(source / name).convert('RGB') for name, *_ in steps]
if len({frame.size for frame in frames}) != 1:
    raise SystemExit('Capture dimensions must match.')
target = root / 'docs/assets/steering-lab-tour.gif'
frames[0].save(target, save_all=True, append_images=frames[1:], duration=[row[3] for row in steps], loop=0, optimize=True)
(source / 'recording.json').write_text(json.dumps({
    'capturedAt': '2026-11-15',
    'mode': 'Actual static Pages build. No API fixture or new model inference in these frames.',
    'imageSize': list(frames[0].size),
    'editing': 'Unaltered browser screenshots, GIF palette conversion only. No generated image is used as evidence.',
    'frames': [{'file': name, 'route': route, 'description': description, 'durationMs': duration,
                'sha256': hashlib.sha256((source / name).read_bytes()).hexdigest()}
               for name, route, description, duration in steps],
}, indent=2) + '\n', encoding='utf-8')
print(f'Assembled {len(frames)} actual browser frames into {target.name}: {target.stat().st_size} bytes.')
