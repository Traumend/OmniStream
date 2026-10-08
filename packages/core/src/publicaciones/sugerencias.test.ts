import { expect, it } from 'vitest';
import { sugerirDestinos } from './sugerencias';

it.each([
  [{ kind: 'video', aspect: 0.5625, durationSec: 30 }, [['facebook', 'reel'], ['instagram', 'reel'], ['youtube', 'short'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 0.5625, durationSec: 120 }, [['instagram', 'reel'], ['youtube', 'short'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 0.5625, durationSec: 600 }, [['instagram', 'reel'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 1.7778, durationSec: 600 }, [['youtube', 'video_largo']]],
  [{ kind: 'image', aspect: 0.8 }, [['facebook', 'imagen'], ['instagram', 'imagen']]],
] as const)('%j', (asset, esperado) => {
  expect(sugerirDestinos(asset).map((x) => [x.platform, x.format])).toEqual(esperado);
});
