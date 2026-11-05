# Jackob — Charcoal Denim Jacket

A one-page 3D site: a quiet gallery room with a clothes rack. Click the rack to step closer, click the jacket to turn it on its hanger and see the hand-painted back.

**Live site:** https://debruynbrycedbb.github.io/Jackob-Blender-Site/ (once GitHub Pages is turned on for this repo)

## How it works
- `assets/room.jpg` is the room photo with the photographed rack removed, plus extra floor at the bottom for tall phone screens.
- The camera is calibrated to that photo (bar at 1.6 m, camera at eye height about 7.7 m away), so the first view lines up with the original image. Zooming crops the calibrated view, so the photo and the 3D objects always move together.
- The rack and swivel hanger are built in `js/main.js` from measurements of the photo, so they stay sharp at any zoom.
- `assets/denim_jacket.glb` is the Blender model in its hanging shape (meshopt-compressed): a thin draped body, about 9 cm deep at the shoulders and 5 cm at the hem, with the sleeves hanging straight down beside it. Its `Sway_Side`, `Sway_Depth` and `Sleeves_Swing` shape keys are driven live by a small hanging simulation: the jacket swings about the bar, turns on the swivel with a slight overshoot, the hem lags behind the movement and the sleeves swing on their own.

## Files
```
index.html         page, meta tags, import map for three.js (jsDelivr, pinned to 0.170.0)
css/style.css      overlay type and controls
js/main.js         scene, calibration, physics, interaction
assets/            room photo, jacket model, social image, favicon
```

## Updating the jacket
Export from Blender as glTF 2.0 (GLB, include shape keys) and replace `assets/denim_jacket.glb`, keeping the file name. The model's origin should stay at the top of the collar.

## Running it locally
Any static server works, for example `python3 -m http.server` in this folder, then open http://localhost:8000. Opening `index.html` directly from disk won't load the model.

Add `?debug` to the address to expose `window.__jackob` for testing.
