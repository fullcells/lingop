import Phaser from "phaser";

export function nestedPhaserTextObjects(
  object: Phaser.GameObjects.GameObject,
): Phaser.GameObjects.Text[] {
  if (object instanceof Phaser.GameObjects.Text) return [object];
  if (object instanceof Phaser.GameObjects.Container) {
    return object.list.flatMap((child) => nestedPhaserTextObjects(child));
  }
  return [];
}

/** Applies a device-aware texture resolution to all current scene text. */
export function sharpenPhaserSceneText(
  scene: Phaser.Scene,
  resolution = Math.max(
    2,
    Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2),
  ),
): void {
  scene.children.list.forEach((object) => {
    nestedPhaserTextObjects(object).forEach((text) => text.setResolution(resolution));
  });
}
