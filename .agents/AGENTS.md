# Styling Guidelines

- **Strict CSS Separation**: Do not use inline styles (`style={{ ... }}`) within React components unless strictly necessary for dynamic values (e.g., calculated absolute positioning or dynamic colors that change frequently).
- For all static and state-based styling, always declare CSS classes in a dedicated `.css` file and import it into the component.
- Apply state-based UI changes by toggling CSS classes (e.g., `className={isActive ? 'active' : ''}`) rather than manipulating inline style objects.
