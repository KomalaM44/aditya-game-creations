# Aditya Game Creations

Static game collection for GitHub Pages.

## Structure

```text
docs/
  index.html
  styles.css
  games/
    base-survival/
    build-your-space-shuttle/
games/
  base-survival/
  build-your-space-shuttle/
node_modules/
```

Edit the source games in `games/`. Dependencies are managed once at the repository root with npm workspaces. Run `npm install` from the root after cloning, then run `npm run build` to publish the playable static files into `docs/`.

Use `npm run preview:site` to test the GitHub Pages site locally. Open the printed local URL in the browser instead of opening `docs/index.html` directly from Finder.

For GitHub Pages, set the publish source to the `docs` folder on the main branch.
