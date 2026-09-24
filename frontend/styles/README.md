# CSS structure

- `design-system.css` — existing shared visual system and dashboard styles
- `base.css` — reusable layout, form, button, and card primitives
- `pos.css` — point-of-sale menu and current-order layout
- `dashboard.css` — dashboard-specific chart styling
- `responsive.css` — shared viewport overrides

`app/globals.css` imports these files in the order they should cascade. Add new styles to the closest feature file instead of adding one-line rules to the global entry file.
