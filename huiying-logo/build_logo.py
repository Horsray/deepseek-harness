"""绘影 AIGC 品牌标识合成脚本。

把 AI 生成的图形母版与真实中文字体排版合成，输出深色竖版/横版、
透明图标、应用图标四种规范件。字形由系统字体渲染，保证绝对正确。
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = Path(__file__).resolve().parent

DARK_BG = (5, 11, 30)
INK = (8, 22, 48)
CYAN = (0, 210, 255)
BLUE = (46, 107, 255)
ICE = (168, 220, 255)

CJK = "/System/Library/Fonts/Hiragino Sans GB.ttc"
CJK_W6 = 2
HELV = "/System/Library/Fonts/HelveticaNeue.ttc"
HELV_BOLD = 1


def font_cjk(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(CJK, size, index=CJK_W6)


def font_lat(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(HELV, size, index=HELV_BOLD)


def crop_mark(path: Path, side_ratio: float = 1.42, out_px: int | None = None) -> Image.Image:
    """按主体亮度定位图形，裁成正方形（含辉光余量）。"""
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(np.float32) / 255.0
    lum = arr @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    ys, xs = np.where(lum > 0.28)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0) * side_ratio
    side = min(side, min(im.size))
    left, top = cx - side / 2, cy - side / 2
    box = (int(left), int(top), int(left + side), int(top + side))
    crop = im.crop(box)
    return crop.resize((out_px, out_px), Image.LANCZOS) if out_px else crop


def flatten_flat(icon: Image.Image) -> Image.Image:
    """把发光母版重建为扁平双色版：模糊亮度定色（无暗描边）、锐利阈值定形。"""
    rgb = np.asarray(icon.convert("RGB")).astype(np.float32) / 255.0
    bg = np.array((5, 11, 30), dtype=np.float32) / 255.0
    lin = np.clip((rgb - bg) / (1.0 - bg), 0.0, 1.0)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    lum_img = Image.fromarray((lum * 255).astype(np.uint8), "L")
    soft = np.asarray(lum_img.filter(ImageFilter.GaussianBlur(7))).astype(np.float32) / 255.0
    t = np.clip((soft - 0.22) / 0.30, 0.0, 1.0)[..., None]
    deep = np.array((0x14, 0x3C, 0x8C), dtype=np.float32) / 255.0
    ice = np.array((0x86, 0xDF, 0xFF), dtype=np.float32) / 255.0
    color = deep * (1.0 - t) + ice * t

    alpha = np.clip((lum - 0.235) / 0.055, 0.0, 1.0)
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))

    out = Image.fromarray((color * 255).astype(np.uint8), "RGB").convert("RGBA")
    out.putalpha(alpha_img)
    return out


def crop_mark_light(path: Path, side_ratio: float = 1.30, out_px: int | None = None) -> Image.Image:
    """裁切白底扁平版图形，保留纯白背景以便与浅色画布无缝拼接。"""
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im)
    non_white = ~((arr > 246).all(axis=2))
    ys, xs = np.where(non_white)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = min(max(x1 - x0, y1 - y0) * side_ratio, min(im.size))
    left, top = cx - side / 2, cy - side / 2
    crop = im.crop((int(left), int(top), int(left + side), int(top + side)))
    return crop.resize((out_px, out_px), Image.LANCZOS) if out_px else crop


def tracked_mask(text: str, font: ImageFont.FreeTypeFont, tracking: float) -> Image.Image:
    """带字距的墨迹蒙版（自动裁掉四周空白）。"""
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    widths = [probe.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    asc, desc = font.getmetrics()
    pad = max(40, int(font.size * 0.25))
    w, h = int(total) + pad * 2, asc + desc + pad * 2
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    x = float(pad)
    for ch, cw in zip(text, widths):
        draw.text((x, float(pad)), ch, font=font, fill=255)
        x += cw + tracking
    bbox = mask.getbbox()
    return mask.crop(bbox)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    ramp = np.linspace(0.0, 1.0, max(h, 2))[:, None]
    top_a = np.array(top, dtype=np.float32)[None, :]
    bot_a = np.array(bottom, dtype=np.float32)[None, :]
    col = top_a * (1 - ramp) + bot_a * ramp
    arr = np.repeat(col[:, None, :], w, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def paste_gradient(canvas: Image.Image, mask: Image.Image, xy: tuple[int, int],
                   top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    grad = vertical_gradient(mask.size, top, bottom).convert("RGBA")
    grad.putalpha(mask)
    canvas.alpha_composite(grad, xy)


def flatten_mark(icon: Image.Image, lo: float = 0.046, hi: float = 0.30, boost: float = 1.12) -> Image.Image:
    """按亮度把图形从深色底上抠出为 RGBA，使辉光与任意深色画布自然融合。"""
    rgb = np.asarray(icon.convert("RGB")).astype(np.float32) / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    alpha = np.clip((lum - lo) / (hi - lo), 0.0, 1.0) ** 0.92
    out = np.dstack([np.clip(rgb * boost, 0, 1) * 255, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def glow_layer(size: tuple[int, int], center: tuple[float, float], radius: float,
               color: tuple[int, int, int], strength: int = 90) -> Image.Image:
    w, h = size
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=strength)
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.42))
    tint = Image.new("RGBA", (w, h), color + (0,))
    tint.putalpha(layer)
    return tint


def compose(icon: Image.Image, orientation: str, size: tuple[int, int]) -> Image.Image:
    """竖版 / 横版品牌组合。"""
    W, H = size
    canvas = Image.new("RGBA", (W, H), DARK_BG + (255,))

    mark = flatten_mark(icon)

    if orientation == "vertical":
        icon_px = int(W * 0.445)
        title_mask = tracked_mask("绘影", font_cjk(int(W * 0.150)), -int(W * 0.005))
        sub_mask = tracked_mask("AIGC", font_lat(int(W * 0.0435)), int(W * 0.026))
        gap_its = int(H * 0.050)
        gap_sub = int(H * 0.020)
        block_h = icon_px + gap_its + title_mask.height + gap_sub + sub_mask.height
        top = int((H - block_h) * 0.455)

        icon_xy = ((W - icon_px) // 2, top)
        canvas.alpha_composite(glow_layer(size, (W / 2, top + icon_px / 2), icon_px * 0.50, CYAN, 66))
        canvas.alpha_composite(mark.resize((icon_px, icon_px), Image.LANCZOS), icon_xy)

        ty = top + icon_px + gap_its
        tx = (W - title_mask.width) // 2
        paste_gradient(canvas, title_mask, (tx, ty), (255, 255, 255), (150, 208, 250))

        sy = ty + title_mask.height + gap_sub
        sx = (W - sub_mask.width) // 2
        paste_gradient(canvas, sub_mask, (sx, sy), (232, 250, 255), (0, 172, 236))
        return canvas

    # horizontal
    icon_px = int(H * 0.62)
    icon_xy = (int(W * 0.075), (H - icon_px) // 2)
    canvas.alpha_composite(glow_layer(size, (icon_xy[0] + icon_px / 2, H / 2), icon_px * 0.48, CYAN, 62))
    canvas.alpha_composite(mark.resize((icon_px, icon_px), Image.LANCZOS), icon_xy)

    text_x = icon_xy[0] + icon_px + int(W * 0.043)
    title_mask = tracked_mask("绘影", font_cjk(int(H * 0.235)), -int(H * 0.006))
    sub_mask = tracked_mask("AIGC", font_lat(int(H * 0.079)), int(H * 0.045))

    block_h = title_mask.height + int(H * 0.035) + sub_mask.height
    ty = (H - block_h) // 2 - int(H * 0.012)
    paste_gradient(canvas, title_mask, (text_x, ty), (255, 255, 255), (150, 208, 250))
    paste_gradient(canvas, sub_mask, (text_x + int(H * 0.008), ty + title_mask.height + int(H * 0.035)),
                   (232, 250, 255), (0, 172, 236))
    return canvas


def compose_light(icon: Image.Image, size: tuple[int, int] = (2048, 2048)) -> Image.Image:
    """白底浅色版：同一版式，改用深藏蓝字与蓝色图形。"""
    W, H = size
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    icon_px = int(W * 0.445)
    title_mask = tracked_mask("绘影", font_cjk(int(W * 0.150)), -int(W * 0.005))
    sub_mask = tracked_mask("AIGC", font_lat(int(W * 0.0435)), int(W * 0.026))
    gap_its, gap_sub = int(H * 0.050), int(H * 0.020)
    block_h = icon_px + gap_its + title_mask.height + gap_sub + sub_mask.height
    top = int((H - block_h) * 0.455)

    canvas.alpha_composite(icon.resize((icon_px, icon_px), Image.LANCZOS), ((W - icon_px) // 2, top))

    ty = top + icon_px + gap_its
    paste_gradient(canvas, title_mask, ((W - title_mask.width) // 2, ty), (9, 32, 78), (40, 98, 200))
    sy = ty + title_mask.height + gap_sub
    paste_gradient(canvas, sub_mask, ((W - sub_mask.width) // 2, sy), (10, 92, 170), (0, 168, 220))
    return canvas


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def app_icon(icon: Image.Image, px: int = 1024) -> Image.Image:
    base = Image.new("RGBA", (px, px), INK + (255,))
    base.alpha_composite(glow_layer((px, px), (px / 2, px / 2), px * 0.42, CYAN, 62))
    g = flatten_mark(icon).resize((int(px * 0.78), int(px * 0.78)), Image.LANCZOS)
    base.alpha_composite(g, ((px - g.width) // 2, (px - g.height) // 2))
    base.putalpha(rounded_mask(px, int(px * 0.222)))
    return base


def transparent_mark(icon: Image.Image, px: int = 1024) -> Image.Image:
    rgb = np.asarray(icon.convert("RGB")).astype(np.float32) / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    alpha = np.clip((lum - 0.040) / 0.30, 0.0, 1.0) ** 0.85
    out = np.dstack([(rgb * 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
    return Image.fromarray(out, "RGBA").resize((px, px), Image.LANCZOS)


def main() -> None:
    mark = crop_mark(BASE / "icon-dark.png", side_ratio=1.30, out_px=1400)
    mark.save(BASE / "mark.png")

    compose(mark, "vertical", (2048, 2048)).convert("RGB").save(BASE / "logo-vertical-dark.png")
    compose(mark, "horizontal", (2560, 1024)).convert("RGB").save(BASE / "logo-horizontal-dark.png")
    transparent_mark(mark, 1024).save(BASE / "mark-glow-transparent-1024.png")
    flat = flatten_flat(mark)
    flat.resize((1024, 1024), Image.LANCZOS).save(BASE / "mark-flat-1024.png")
    app_icon(mark, 1024).save(BASE / "app-icon-1024.png")

    compose_light(flat, (2048, 2048)).convert("RGB").save(BASE / "logo-vertical-light.png")
    print("done")


if __name__ == "__main__":
    main()
