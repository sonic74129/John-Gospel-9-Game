import type { Point } from "@sonic74129/content-schema";

import type { SliceFinalState } from "./sequence-adapter.ts";

export interface CanonicalCameraZone {
  readonly id: string;
  readonly desktopZoom: number;
  readonly mobileZoom: number;
  readonly deadZone: Readonly<{ width: number; height: number }>;
}

export interface CanonicalCameraPort {
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  resetFX(): void;
  setBounds(x: number, y: number, width: number, height: number): void;
  setZoom(zoom: number): void;
  setDeadzone(width: number, height: number): void;
  startFollow(
    target: Point,
    roundPixels: boolean,
    lerpX: number,
    lerpY: number,
    offsetX: number,
    offsetY: number,
  ): void;
  stopFollow(): void;
  centerOn(x: number, y: number): void;
}

export interface AppliedCanonicalCameraState {
  readonly canonical: SliceFinalState["camera"];
  readonly actual: Readonly<{
    mode: string;
    zoneId: string;
    focusPosition: Point;
    position: Point;
    zoom: number;
    deadZone: Readonly<{ width: number; height: number }>;
    followTargetActorId: string | null;
    followOffset: Point;
  }>;
}

export function applyCanonicalCameraFinalState(options: Readonly<{
  camera: CanonicalCameraPort;
  canonical: SliceFinalState["camera"];
  zone: CanonicalCameraZone;
  anchorPosition: Point;
  playerActorId: string;
  playerTarget: Point;
  worldWidth: number;
  worldHeight: number;
  mobile: boolean;
}>): AppliedCanonicalCameraState {
  const {
    camera,
    canonical,
    zone,
    anchorPosition,
    playerActorId,
    playerTarget,
    worldWidth,
    worldHeight,
    mobile,
  } = options;
  const zoom = mobile ? zone.mobileZoom : zone.desktopZoom;

  camera.resetFX();
  camera.setBounds(0, 0, worldWidth, worldHeight);
  camera.setZoom(zoom);
  camera.setDeadzone(zone.deadZone.width, zone.deadZone.height);

  let actualMode = "fixed";
  let followTargetActorId: string | null = null;
  let followOffset: Point = { x: 0, y: 0 };
  let focusPosition = structuredClone(anchorPosition);

  if (canonical.mode === "follow-observer") {
    followOffset = {
      x: playerTarget.x - anchorPosition.x,
      y: playerTarget.y - anchorPosition.y,
    };
    camera.startFollow(
      playerTarget,
      true,
      0.08,
      0.08,
      followOffset.x,
      followOffset.y,
    );
    actualMode = "follow-observer";
    followTargetActorId = playerActorId;
    focusPosition = {
      x: playerTarget.x - followOffset.x,
      y: playerTarget.y - followOffset.y,
    };
  } else {
    camera.stopFollow();
    camera.centerOn(anchorPosition.x, anchorPosition.y);
  }

  return {
    canonical: structuredClone(canonical),
    actual: {
      mode: actualMode,
      zoneId: zone.id,
      focusPosition,
      position: {
        x: camera.scrollX + camera.width / 2,
        y: camera.scrollY + camera.height / 2,
      },
      zoom,
      deadZone: structuredClone(zone.deadZone),
      followTargetActorId,
      followOffset,
    },
  };
}
