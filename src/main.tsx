import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';
// Self-hosted Press Start 2P (OFL). Used by the Outcome Text Overlay
// on the Encounter Canvas. Bundled via @fontsource so the game has no
// runtime dependency on Google Fonts.
import '@fontsource/press-start-2p/400.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element missing from index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
