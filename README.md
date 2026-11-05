# Jackob — Denim Jackets

A one-page 3D site: a quiet gallery room with a clothes rack holding three denim jackets. Click the rack to step closer. Click a jacket to bring it forward: it slides along the bar to the centre, the others slide to the ends, the camera moves in and the jacket turns to show its back. Click it again to turn it back, click another jacket to swap, or step back.

**Live site:** https://debruynbrycedbb.github.io/Jackob-Blender-Site/ (once GitHub Pages is turned on for this repo)

## How it works
- `assets/room.jpg` is the room photo with the photographed rack removed, plus extra floor at the bottom for tall phone screens.
- The camera is calibrated to that photo (bar at 1.6 m, camera at eye height about 7.7 m away), so the first view lines up with the original image. Zooming crops the calibrated view, so the photo and the 3D objects always move together.
- The rack and swivel hanger are built in `js/main.js` from measurements of the photo, so they stay sharp at any zoom.
- Three jackets, left to right: `assets/jacket_blue.glb` (charcoal, blue Sagrada Família), `assets/jacket_amber.glb` (charcoal, amber Sagrada Família), `assets/jacket_sun.glb` (light wash, sequinned sunburst). Each is built the same way in Blender: one continuous mesh in its hanging shape, a thin draped body (about 9 cm deep at the shoulders, 5 cm at the hem) with the sleeves folded down from the armhole seams. Their `Sway_Side`, `Sway_Depth` and `Sleeves_Swing` shape keys are driven live by a small hanging simulation.
- Each jacket hangs from its own swivel hook. Hooks slide along the bar (they keep their order, as real hooks can't pass each other), and the slide's acceleration makes the jacket swing along the bar. Turning only starts once neighbours are clear, so jackets never touch.

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
