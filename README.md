# Atelier Mécanique

Application web (HTML/CSS/JS pur, PWA installable) : génère en 3D des vis, écrous, rondelles, tiges filetées, engrenages droits et hélicoïdaux, crémaillères, vis sans fin et roues à vis aux cotes métriques ISO, puis exporte un STL binaire (mm) prêt pour l'impression 3D.

**Déploiement GitHub Pages** : poussez le contenu de ce dossier à la racine d'un dépôt, puis *Settings → Pages → Deploy from a branch* (branche `main`, dossier `/root`). GitHub Pages sert en HTTPS, ce qui active l'installation PWA et le mode hors ligne.

`js/viewer.bundle.js` est la visionneuse three.js déjà empaquetée ; les moteurs géométriques (`core`, `threads`, `parts-*`) et le catalogue (`catalog.js`) sont lisibles et modifiables. Remplacez `icons/` par vos propres icônes si besoin.
