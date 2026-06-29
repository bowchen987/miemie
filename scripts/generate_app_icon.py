from PIL import Image, ImageDraw

SIZE = 1024
SCALE = 4
CANVAS = SIZE * SCALE

BG = (244, 251, 246)
MINT = (211, 240, 226)
MINT_STRONG = (96, 190, 158)
SKY = (204, 232, 245)
CORAL = (255, 181, 166)
LEMON = (255, 241, 180)
INK = (39, 78, 69)
FLEECE = (255, 255, 252)
FACE = (255, 229, 214)
SHADOW = (178, 216, 202)


def s(value):
    return int(value * SCALE)


def box(left, top, right, bottom):
    return (s(left), s(top), s(right), s(bottom))


image = Image.new("RGB", (CANVAS, CANVAS), BG)
draw = ImageDraw.Draw(image)

draw.rounded_rectangle(box(88, 88, 936, 936), radius=s(230), fill=MINT)
draw.ellipse(box(126, 130, 380, 384), fill=SKY)
draw.ellipse(box(660, 646, 910, 896), fill=LEMON)
draw.rounded_rectangle(box(160, 192, 864, 850), radius=s(190), fill=(250, 255, 251))

draw.ellipse(box(250, 706, 774, 812), fill=SHADOW)

for center_x, center_y, radius in [
    (290, 430, 104),
    (360, 318, 116),
    (504, 270, 130),
    (646, 318, 118),
    (728, 430, 106),
    (316, 558, 126),
    (512, 560, 168),
    (704, 558, 126),
]:
    draw.ellipse(
        box(center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=FLEECE,
        outline=MINT,
        width=s(8),
    )

draw.ellipse(box(260, 460, 392, 632), fill=CORAL, outline=FLEECE, width=s(16))
draw.ellipse(box(632, 460, 764, 632), fill=CORAL, outline=FLEECE, width=s(16))
draw.ellipse(box(336, 352, 688, 734), fill=FACE)

for center_x, center_y, radius in [
    (390, 336, 76),
    (484, 304, 86),
    (578, 334, 76),
]:
    draw.ellipse(
        box(center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=FLEECE,
        outline=MINT,
        width=s(7),
    )

draw.ellipse(box(422, 500, 466, 544), fill=INK)
draw.ellipse(box(558, 500, 602, 544), fill=INK)
draw.ellipse(box(434, 510, 448, 524), fill=FLEECE)
draw.ellipse(box(570, 510, 584, 524), fill=FLEECE)

draw.ellipse(box(404, 574, 458, 616), fill=CORAL)
draw.ellipse(box(566, 574, 620, 616), fill=CORAL)
draw.rounded_rectangle(box(490, 552, 534, 580), radius=s(14), fill=INK)
draw.arc(box(470, 560, 552, 636), start=22, end=158, fill=INK, width=s(9))

draw.rounded_rectangle(box(380, 724, 460, 790), radius=s(30), fill=INK)
draw.rounded_rectangle(box(564, 724, 644, 790), radius=s(30), fill=INK)
draw.rounded_rectangle(box(394, 708, 630, 760), radius=s(26), fill=FLEECE)

image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
image.save("MieMie/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
