import Phaser from "phaser";

import type { Point } from "@sonic74129/content-schema";

import type { WorldRuntime } from "./world-adapter.ts";

const BASELINE = Object.freeze({
  worldId: "john-9-jerusalem-story-world",
  width: 2560,
  height: 1792,
  regionIds: Object.freeze(["courtyard", "siloam-pool"]),
  viewports: Object.freeze([
    Object.freeze({ width: 1280, height: 720 }),
    Object.freeze({ width: 390, height: 844 }),
  ]),
});

const AREA_COLORS = [0xd2b887, 0x8ca6a3, 0xc5a16e, 0xa85f3e, 0x66704b];
const COLLISION_COLOR = 0x3c352f;
const WATER_COLLISION_COLOR = 0x526c73;
const PORTAL_COLOR = 0xe2d2b2;
const LANDMARK_COLOR = 0xffe2a6;

function assertBaseline(world: WorldRuntime): void {
  const actualRegionIds = world.areas.map(({ definition }) => definition.id);
  if (
    world.definition.id !== BASELINE.worldId ||
    world.definition.width !== BASELINE.width ||
    world.definition.height !== BASELINE.height ||
    actualRegionIds.join(",") !== BASELINE.regionIds.join(",")
  ) {
    throw new Error("Development graybox baseline no longer matches the story world.");
  }
}

function drawPolygon(
  graphics: Phaser.GameObjects.Graphics,
  polygon: readonly Point[],
): void {
  const first = polygon[0];
  if (first === undefined) {
    throw new Error("Graybox polygons must contain at least one point.");
  }
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (const point of polygon.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

function polygonCenter(polygon: readonly Point[]): Point {
  return {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  };
}

export function installDevelopmentGrayboxOverlay(
  scene: Phaser.Scene,
  world: WorldRuntime,
): void {
  assertBaseline(world);
  const visible =
    new URLSearchParams(window.location.search).get("graybox") === "1";
  const layer = scene.add.container(0, 0).setDepth(100).setVisible(visible);
  const graphics = scene.add.graphics();
  layer.add(graphics);

  world.regionContracts.forEach((region, index) => {
    const { x, y, id } = world.areas[index]!.definition;
    graphics.fillStyle(AREA_COLORS[index % AREA_COLORS.length]!, 0.72);
    graphics.lineStyle(4, 0x3c352f, 0.55);
    drawPolygon(graphics, region.walkablePolygon);
    layer.add(
      scene.add.text(x + 24, y + 20, `${id} · walkable`, {
        color: "#3c352f",
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
      }),
    );
  });

  for (const collision of world.collisionPolygons) {
    graphics.fillStyle(
      collision.material === "water-boundary"
        ? WATER_COLLISION_COLOR
        : COLLISION_COLOR,
      0.88,
    );
    graphics.lineStyle(3, 0xfffaf1, 0.7);
    drawPolygon(graphics, collision.polygon);
    const center = polygonCenter(collision.polygon);
    layer.add(
      scene.add
        .text(center.x, center.y, collision.id.replace("collision.", ""), {
          color: "#fffaf1",
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          align: "center",
        })
        .setOrigin(0.5),
    );
  }

  graphics.lineStyle(10, PORTAL_COLOR, 0.9);
  for (const portal of world.portals) {
    const [start, end] = portal.segment;
    if (start === undefined || end === undefined) {
      throw new Error(`Portal ${portal.id} must define a segment.`);
    }
    graphics.lineBetween(start.x, start.y, end.x, end.y);
    layer.add(
      scene.add
        .text((start.x + end.x) / 2, (start.y + end.y) / 2 - 18, "transition", {
          color: "#3c352f",
          backgroundColor: "#e2d2b2dd",
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 1),
    );
  }

  graphics.fillStyle(LANDMARK_COLOR, 1);
  graphics.lineStyle(3, COLLISION_COLOR, 0.8);
  for (const anchor of world.anchorById.values()) {
    if (anchor.kind !== "landmark") {
      continue;
    }
    graphics.fillCircle(anchor.position.x, anchor.position.y, 12);
    graphics.strokeCircle(anchor.position.x, anchor.position.y, 12);
    layer.add(
      scene.add
        .text(
          anchor.position.x,
          anchor.position.y - 18,
          anchor.id.split(".").at(-1) ?? anchor.id,
          {
            color: "#3c352f",
            backgroundColor: "#fffaf1dd",
            fontFamily: "system-ui, sans-serif",
            fontSize: "12px",
            padding: { x: 4, y: 2 },
          },
        )
        .setOrigin(0.5, 1),
    );
  }

  scene.input.keyboard
    ?.addKey(Phaser.Input.Keyboard.KeyCodes.G)
    .on("down", () => layer.setVisible(!layer.visible));
}
