import argparse
from pathlib import Path

from PIL import Image, ImageColor


def parse_size(value: str) -> tuple[int, int]:
    parts = tuple(int(part) for part in value.split("x"))
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT")
    return parts


def parse_paste(value: str) -> tuple[Path, tuple[int, int]]:
    path, separator, coordinates = value.rpartition("@")
    if not separator:
        raise argparse.ArgumentTypeError("paste must be PATH@X,Y")
    position = tuple(int(part) for part in coordinates.split(","))
    if len(position) != 2:
        raise argparse.ArgumentTypeError("paste must be PATH@X,Y")
    return Path(path), position


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", required=True, type=parse_size)
    parser.add_argument("--color", required=True)
    parser.add_argument("--paste", required=True, action="append", type=parse_paste)
    args = parser.parse_args()

    if args.output.exists():
        raise FileExistsError(f"Refusing to overwrite {args.output}")

    canvas = Image.new("RGBA", args.size, ImageColor.getrgb(args.color) + (255,))
    for path, position in args.paste:
        with Image.open(path) as source:
            canvas.paste(source.convert("RGBA"), position)
    canvas.save(
        args.output,
        format="WEBP",
        lossless=True,
        method=6,
        exact=True,
    )


if __name__ == "__main__":
    main()
