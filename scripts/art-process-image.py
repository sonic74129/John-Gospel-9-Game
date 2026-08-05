import argparse
from pathlib import Path

from PIL import Image


def parse_crop(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in value.split(","))
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("crop must be left,top,right,bottom")
    return parts


def parse_size(value: str) -> tuple[int, int]:
    parts = tuple(int(part) for part in value.split("x"))
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT")
    return parts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--crop", required=True, type=parse_crop)
    parser.add_argument("--size", required=True, type=parse_size)
    parser.add_argument("--quality", required=True, type=int)
    args = parser.parse_args()

    if args.output.exists():
        raise FileExistsError(f"Refusing to overwrite {args.output}")

    with Image.open(args.input) as source:
        processed = source.crop(args.crop).resize(args.size, Image.Resampling.LANCZOS)
        processed.save(
            args.output,
            format="WEBP",
            quality=args.quality,
            method=6,
            exact=True,
        )


if __name__ == "__main__":
    main()
