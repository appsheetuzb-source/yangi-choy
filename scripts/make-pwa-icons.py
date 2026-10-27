# PWA ikonkalarini yasash (apps/web/public/icons/).
# Logo — public/icon-192.png dagi chizma: to'q ko'k fon, sariq halqa, krem doira va uchta nuqta.
# 192 px dan kattalashtirish xira chiqadi, shuning uchun shakllar 192 px o'lchovlarida qayta
# chiziladi (4x katta chizib, keyin kichraytiriladi — chetlari silliq).
#
#   python scripts/make-pwa-icons.py
from pathlib import Path
from PIL import Image, ImageDraw

FON = (26, 39, 68, 255)       # #1a2744
HALQA = (245, 200, 66, 255)   # #f5c842
KREM = (255, 247, 230, 255)   # #fff7e6

# 192 px dagi o'lchovlar (asl icon-192.png dan o'lchangan)
HALQA_MARKAZ, HALQA_R, ICHKI_R = (96, 104), 58, 48
NUQTALAR = [((78, 40), 6.5), ((96, 32.5), 6.5), ((114, 40), 6.5)]
MAZMUN_MARKAZ = (96, 94.5)    # chizma (nuqtalar + halqa) markazi


def chiz(olcham: int, masshtab: float) -> Image.Image:
    """masshtab — 192 px chizma qanchaga kattalashadi; chizma kanvas markaziga qo'yiladi."""
    k = 4                       # supersampling
    S = olcham * k
    im = Image.new("RGBA", (S, S), FON)
    d = ImageDraw.Draw(im)
    ox = S / 2 - MAZMUN_MARKAZ[0] * masshtab * k
    oy = S / 2 - MAZMUN_MARKAZ[1] * masshtab * k

    def doira(cx, cy, r, rang):
        x, y, rr = ox + cx * masshtab * k, oy + cy * masshtab * k, r * masshtab * k
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=rang)

    doira(*HALQA_MARKAZ, HALQA_R, HALQA)
    doira(*HALQA_MARKAZ, ICHKI_R, KREM)
    for (cx, cy), r in NUQTALAR:
        doira(cx, cy, r, KREM)
    return im.resize((olcham, olcham), Image.LANCZOS)


out = Path(__file__).resolve().parent.parent / "apps" / "web" / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)
chiz(192, 192 / 192).save(out / "icon-192.png")
chiz(512, 512 / 192).save(out / "icon-512.png")
# Maskable: Android ikonkani doira/kvadratga kesadi — chizma markaziy xavfsiz zonada
# (radius ≈ 40%) bo'lishi uchun kichikroq masshtab, fon butun kanvasni qoplaydi.
chiz(512, 512 / 192 * 0.8).save(out / "icon-maskable-512.png")
# iPhone/iPad "Ekranga qo'shish" ikonkasi
chiz(180, 180 / 192).save(out / "apple-touch-icon.png")
print("OK:", ", ".join(sorted(p.name for p in out.iterdir())))
