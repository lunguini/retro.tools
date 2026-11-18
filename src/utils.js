import { navigate } from 'svelte-routing';

// navigate() relative to the deploy base path (e.g. GitHub Pages /repo/).
export function go(path) {
  navigate(import.meta.env.BASE_URL + path.replace(/^\//, ''));
}

export const filterDataKeys = (props) =>
  Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith('data-'))
  );

/** Dispatch event on click outside of node */
export function clickOutside(node) {
  const handleClick = (event) => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('clickOutside', node));
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    },
  };
}
