window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  const fullscreenButton = document.getElementById("fullscreen-btn");
  const restartButton = document.getElementById("restart-btn");

  if (!canvas) {
    return;
  }

  const game = new CloudCatcherGame(canvas, {
    fullscreenButton,
    restartButton,
  });

  window.cloudCatchersGame = game;
});
