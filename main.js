// Wait for all scripts to load
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    // Check if BrotatoGameScene is available
    if (typeof BrotatoGameScene === 'undefined') {
        console.error('BrotatoGameScene is not defined! Make sure BrotatoGameScene.js is loaded.');
        document.body.innerHTML = '<div style="color: white; padding: 20px;">Error: BrotatoGameScene not loaded. Check console for details.</div>';
        return;
    }
    
    // Check if Phaser is available
    if (typeof Phaser === 'undefined') {
        console.error('Phaser is not defined! Make sure Phaser.js is loaded.');
        document.body.innerHTML = '<div style="color: white; padding: 20px;">Error: Phaser not loaded. Check console for details.</div>';
        return;
    }
    
    console.log('Phaser version:', Phaser.VERSION);
    console.log('Creating game with BrotatoGameScene...');
    
    // Game configuration
    const config = {
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: 'game-container',
        backgroundColor: '#0a0a0a',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scene: [BrotatoGameScene]
    };
    
    // Initialize the game
    try {
        const game = new Phaser.Game(config);
        console.log('Game created successfully!');
    } catch (error) {
        console.error('Error creating game:', error);
        document.body.innerHTML = '<div style="color: white; padding: 20px;">Error creating game: ' + error.message + '</div>';
    }
});