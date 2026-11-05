# Jackob — Denim Jackets & Sequin Bag

A one-page 3D site: a quiet gallery room with a clothes rack holding three denim jackets and a sculptural table with a sequin patchwork bag on it. Click the rack or the table to step closer.

- **Rack:** click a jacket to bring it forward: it slides along the bar to the centre, the others slide to the ends, the camera moves in and the jacket turns to show its back. Click it again to turn it back, click another jacket to swap.
- **Table:** click the bag to pick it up: it lifts off the table, spins once and settles in the middle of the screen with its sequinned side facing you. Drag to turn it any way you like, click it to flip it round, and step back to put it down.

**Live site:** https://debruynbrycedbb.github.io/Jackob-Blender-Site/ (once GitHub Pages is turned on for this repo)

## How it works
- `assets/room.jpg` is the room photo with the photographed rack removed, plus extra floor at the bottom for tall phone screens.
- The camera is calibrated to that photo (bar at 1.6 m, camera at eye height about 7.7 m away), so the first view lines up with the original image. Zooming crops the calibrated view, so the photo and the 3D objects always move together.
- The rack and swivel hanger are built in `js/main.js` from measurements of the photo, so they stay sharp at any zoom.
- Three jackets, left to right: `assets/jacket_blue.glb` (charcoal, blue Sagrada Família), `assets/jacket_amber.glb` (charcoal, amber Sagrada Família), `assets/jacket_sun.glb` (light wash, sequinned sunburst). Each is built the same way in Blender: one continuous mesh in its hanging shape, a draped body (about 12 cm deep at the chest, 8 cm at the hem) with the sleeves hanging straight down its sides. Seen side-on, each sleeve is as wide as the chest is deep at the same height, and it blends into the shoulder over a soft sleeve cap. Their `Sway_Side`, `Sway_Depth` and `Sleeves_Swing` shape keys are driven live by a small hanging simulation.
- Each jacket hangs from its own swivel hook. Hooks slide along the bar (they keep their order, as real hooks can't pass each other), and the slide's acceleration makes the jacket swing along the bar. Turning only starts once neighbours are clear, so jackets never touch.

- `assets/table.glb` is the spiral table, rebuilt from the room photo (round lacquered top on a double-helix ribbon base) and placed where it stands in the photo. `assets/sequin_bag.glb` is the bag: a rounded pouch with each of its six sides textured from the product photos, with metallic, low-roughness sequins and matte black denim.
- The bag view doesn't move the camera (that would break the line-up with the photo). Instead the bag flies toward the camera along the line of sight through the middle of the screen, and a dark veil fades in behind it.

## Files
```
index.html         page, meta tags, import map for three.js (jsDelivr, pinned to 0.170.0)
css/style.css      overlay type and controls
js/main.js         scene, calibration, physics, interaction
assets/            room photo, jacket model, social image, favicon
```

## Updating a jacket
Export from Blender as glTF 2.0 (GLB, include shape keys, vertex colours on) and replace the matching file in `assets/`, keeping its name. The model's origin should stay at the top of the collar. The names and captions are in the `JACKETS` list at the top of the jackets section in `js/main.js`.

## Running it locally
Any static server works, for example `python3 -m http.server` in this folder, then open http://localhost:8000. Opening `index.html` directly from disk won't load the model.

Add `?debug` to the address to expose `window.__jackob` for testing.
