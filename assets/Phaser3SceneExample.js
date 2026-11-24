// Phaser 3 Scene for "Together Loy Krathong" (3200x2400 World Map, 32x32 Tiles)
export class LoyKrathongScene extends Phaser.Scene {
  constructor() {
    super('LoyKrathongScene');
  }

  preload() {
    this.load.image('loy_krathong_tiles', '00_master_tileset_512x768.png');
    this.load.tilemapTiledJSON('loy_krathong_map', 'together_loy_krathong_map.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'loy_krathong_map' });
    const tileset = map.addTilesetImage('loy_krathong_master', 'loy_krathong_tiles');

    // Layered rendering: background -> paths -> mid props -> [PLAYERS] -> foreground canopy
    const bgGroundLayer = map.createLayer('bg_ground_water', tileset, 0, 0).setDepth(0);
    const bgPathsLayer  = map.createLayer('bg_paths_bridges', tileset, 0, 0).setDepth(1);
    const midPropsLayer = map.createLayer('mid_buildings_props', tileset, 0, 0).setDepth(2);
    const fgCanopyLayer = map.createLayer('fg_canopy_lanterns', tileset, 0, 0).setDepth(10);

    // Collision layer (Phaser 3 Arcade Physics)
    const collisionLayer = map.createLayer('collision', tileset, 0, 0);
    collisionLayer.setVisible(false);
    collisionLayer.setCollisionByProperty({ collides: true });

    // World bounds (3200 x 2400)
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setRoundPixels(true); // Crisp 16-bit pixel art rendering

    // Parse Object Placement Layer
    const objectsLayer = map.getObjectLayer('objects');
    objectsLayer.objects.forEach((obj) => {
      if (obj.name === 'player_spawn_1') {
        this.spawnP1 = { x: obj.x, y: obj.y };
      } else if (obj.name === 'romantic_photo_spot') {
        const photoZone = this.add.zone(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
        this.physics.world.enable(photoZone);
        // Trigger romantic photo pose when both players overlap photoZone
      }
    });
  }
}
