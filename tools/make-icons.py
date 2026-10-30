"""Write the app icons (a blue tile with a white play triangle) as PNG files."""
import struct
import sys
import zlib


def png(path, size):
    bg = (58, 123, 253, 255)
    fg = (255, 255, 255, 255)
    radius = size * 0.18
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            # Rounded corners.
            cx = min(max(x + 0.5, radius), size - radius)
            cy = min(max(y + 0.5, radius), size - radius)
            inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2
            px = bg if inside else (0, 0, 0, 0)
            # Play triangle, centered.
            u, v = (x + 0.5) / size, (y + 0.5) / size
            if inside and 0.38 <= u <= 0.70 and abs(v - 0.5) <= (0.70 - u) * 0.62:
                px = fg
            row += bytes(px)
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)


out = sys.argv[1]
png(out + "/icon.png", 80)
png(out + "/largeIcon.png", 130)
