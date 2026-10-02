import { describe, it, expect, vi, afterEach } from 'vitest';
import { vehicleThumbnail, setThumbnailAppearance, clearThumbnails } from '../src/ui/menu/thumbnails';
import { TIGER_I } from '../src/data/vehicles';

describe('缩略图外观钩子(涂装)', () => {
  afterEach(() => {
    setThumbnailAppearance(null);
    clearThumbnails();
  });

  it('设置后,普通调用会先套外观再渲染', () => {
    const appearance = vi.fn((s: typeof TIGER_I) => ({ ...s, color: 0x123456 }));
    setThumbnailAppearance(appearance);
    vehicleThumbnail(TIGER_I);
    expect(appearance).toHaveBeenCalledTimes(1);
    expect(appearance).toHaveBeenCalledWith(TIGER_I);
  });

  it('raw: true 跳过外观(涂装界面自己已经套好了预览用的涂装)', () => {
    const appearance = vi.fn((s: typeof TIGER_I) => s);
    setThumbnailAppearance(appearance);
    vehicleThumbnail(TIGER_I, { raw: true });
    expect(appearance).not.toHaveBeenCalled();
  });

  it('传 null 恢复成原样', () => {
    const appearance = vi.fn((s: typeof TIGER_I) => s);
    setThumbnailAppearance(appearance);
    setThumbnailAppearance(null);
    vehicleThumbnail(TIGER_I);
    expect(appearance).not.toHaveBeenCalled();
  });
});
