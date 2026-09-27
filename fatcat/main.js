function startFatCat() {
    View3D.init();
    window.fatcatGame = new Phaser.Game({
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: 'game-container',
        transparent: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [BootScene, TitleScene, GameScene, HudScene]
    });
}

// Web フォントの読み込みを待ってから開始（最大 1.5 秒）
window.addEventListener('load', () => {
    const fontsReady = document.fonts && document.fonts.load
        ? document.fonts.load('bold 20px "M PLUS Rounded 1c"').catch(() => {})
        : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(startFatCat);
});
