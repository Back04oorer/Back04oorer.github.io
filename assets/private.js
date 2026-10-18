import { mountMelonGame } from './melon-game.mjs';

const content = document.querySelector('#private-content');
let disposeGame = mountMelonGame(content);

window.addEventListener('pagehide', () => disposeGame());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) disposeGame = mountMelonGame(content);
});
