class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Game entities
        this.player = null;
        this.enemies = null;
        this.bullets = null;
        this.experienceOrbs = null;
        
        // Controls
        this.cursors = null;
        this.wasd = null;
        this.mousePointer = null;
        
        // Game state
        this.playerLevel = 1;
        this.playerExp = 0;
        this.expToNextLevel = 10;
        this.playerSpeed = 200;
        this.playerHP = 100;
        
        // Weapon stats
        this.fireRate = 300; // ms between shots
        this.lastFired = 0;
        this.bulletSpeed = 500;
        this.bulletDamage = 10;
        
        // Enemy spawn
        this.enemySpawnTimer = null;
        
        // UI
        this.levelText = null;
        this.expText = null;
        this.hpText = null;
        this.isPaused = false;
    }

    preload() {
        // Create colored placeholder sprites if images fail to load
        this.createPlaceholderSprites();
        
        // Try to load sprites from files
        this.load.image('player', './assets/sprites/player.png');
        this.load.image('enemy', './assets/sprites/enemy.png');
        this.load.image('bullet', './assets/sprites/bullet.png');
        this.load.image('exp', './assets/sprites/exp.png');
    }
    
    createPlaceholderSprites() {
        // Create visible colored rectangles as fallback sprites
        
        // Player sprite (orange square)
        const playerGraphics = this.add.graphics();
        playerGraphics.fillStyle(0xff6600);
        playerGraphics.fillRect(0, 0, 32, 32);
        playerGraphics.generateTexture('player_placeholder', 32, 32);
        playerGraphics.destroy();
        
        // Enemy sprite (red square)
        const enemyGraphics = this.add.graphics();
        enemyGraphics.fillStyle(0xff0000);
        enemyGraphics.fillRect(0, 0, 24, 24);
        enemyGraphics.generateTexture('enemy_placeholder', 24, 24);
        enemyGraphics.destroy();
        
        // Bullet sprite (yellow circle)
        const bulletGraphics = this.add.graphics();
        bulletGraphics.fillStyle(0xffff00);
        bulletGraphics.fillCircle(4, 4, 4);
        bulletGraphics.generateTexture('bullet_placeholder', 8, 8);
        bulletGraphics.destroy();
        
        // Experience orb sprite (green circle)
        const expGraphics = this.add.graphics();
        expGraphics.fillStyle(0x00ff00);
        expGraphics.fillCircle(8, 8, 8);
        expGraphics.generateTexture('exp_placeholder', 16, 16);
        expGraphics.destroy();
    }

    create() {
        // Setup physics groups
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.experienceOrbs = this.physics.add.group();
        
        // Create player at center - use placeholder if original fails
        const playerTexture = this.textures.exists('player') ? 'player' : 'player_placeholder';
        this.player = this.physics.add.sprite(640, 360, playerTexture);
        this.player.setCollideWorldBounds(true);
        this.player.setOrigin(0.5, 0.5);
        
        console.log('Player created at:', this.player.x, this.player.y);
        console.log('Player texture:', playerTexture);
        
        // Setup input
        this.setupInput();
        
        // Setup collisions
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.experienceOrbs, this.collectExp, null, this);
        
        // Start enemy spawning
        this.enemySpawnTimer = this.time.addEvent({
            delay: 3000, // Spawn enemies every 3 seconds
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
        
        // Spawn first enemy immediately
        this.spawnEnemy();
        
        // Setup UI
        this.setupUI();
        
        console.log('Game scene created successfully');
    }

    update(time, delta) {
        if (this.isPaused) return;
        
        // Player movement
        this.handlePlayerMovement();
        
        // Player rotation (face mouse)
        this.handlePlayerRotation();
        
        // Auto-fire
        if (time > this.lastFired + this.fireRate) {
            this.fire();
            this.lastFired = time;
        }
        
        // Enemy AI
        this.updateEnemies();
        
        // Update UI
        this.updateUI();
    }

    setupInput() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Mouse controls
        this.mousePointer = this.input.activePointer;
    }
    
    handlePlayerMovement() {
        const velocity = new Phaser.Math.Vector2(0, 0);
        
        if (this.wasd.A.isDown) velocity.x = -1;
        if (this.wasd.D.isDown) velocity.x = 1;
        if (this.wasd.W.isDown) velocity.y = -1;
        if (this.wasd.S.isDown) velocity.y = 1;
        
        velocity.normalize().scale(this.playerSpeed);
        this.player.setVelocity(velocity.x, velocity.y);
    }
    
    handlePlayerRotation() {
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mousePointer.worldX, this.mousePointer.worldY
        );
        this.player.setRotation(angle);
    }
    
    fire() {
        const angle = this.player.rotation;
        const bulletTexture = this.textures.exists('bullet') ? 'bullet' : 'bullet_placeholder';
        const bullet = this.bullets.create(this.player.x, this.player.y, bulletTexture);
        bullet.setOrigin(0.5, 0.5);
        
        const velocity = new Phaser.Math.Vector2(
            Math.cos(angle) * this.bulletSpeed,
            Math.sin(angle) * this.bulletSpeed
        );
        bullet.setVelocity(velocity.x, velocity.y);
        
        // Clean up bullets that go off-screen
        bullet.setData('lifespan', 3000);
        this.time.delayedCall(3000, () => {
            if (bullet && bullet.active) bullet.destroy();
        });
    }
    
    spawnEnemy() {
        const side = Phaser.Math.Between(0, 3);
        let x, y;
        
        switch(side) {
            case 0: // Top
                x = Phaser.Math.Between(0, 1280);
                y = -50;
                break;
            case 1: // Right
                x = 1330;
                y = Phaser.Math.Between(0, 720);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(0, 1280);
                y = 770;
                break;
            case 3: // Left
                x = -50;
                y = Phaser.Math.Between(0, 720);
                break;
        }
        
        const enemyTexture = this.textures.exists('enemy') ? 'enemy' : 'enemy_placeholder';
        const enemy = this.enemies.create(x, y, enemyTexture);
        enemy.setOrigin(0.5, 0.5);
        enemy.setData('hp', 10);
        enemy.setData('speed', 80);
        enemy.setData('damage', 10);
        
        console.log('Enemy spawned at:', x, y, 'with texture:', enemyTexture);
    }
    
    updateEnemies() {
        this.enemies.children.entries.forEach(enemy => {
            if (!enemy.active) return;
            
            const angle = Phaser.Math.Angle.Between(
                enemy.x, enemy.y,
                this.player.x, this.player.y
            );
            
            const velocity = new Phaser.Math.Vector2(
                Math.cos(angle) * enemy.getData('speed'),
                Math.sin(angle) * enemy.getData('speed')
            );
            enemy.setVelocity(velocity.x, velocity.y);
            enemy.setRotation(angle);
        });
    }
    
    bulletHitEnemy(bullet, enemy) {
        bullet.destroy();
        
        const hp = enemy.getData('hp') - this.bulletDamage;
        if (hp <= 0) {
            // Drop experience
            const expTexture = this.textures.exists('exp') ? 'exp' : 'exp_placeholder';
            const exp = this.experienceOrbs.create(enemy.x, enemy.y, expTexture);
            exp.setOrigin(0.5, 0.5);
            exp.setData('value', 1);
            
            enemy.destroy();
        } else {
            enemy.setData('hp', hp);
            // Flash effect
            enemy.setTint(0xffffff);
            this.time.delayedCall(100, () => {
                if (enemy && enemy.active) enemy.clearTint();
            });
        }
    }
    
    playerHitEnemy(player, enemy) {
        this.playerHP -= enemy.getData('damage');
        
        // Flash effect
        player.setTint(0xff0000);
        this.time.delayedCall(200, () => player.clearTint());
        
        // Knockback
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        const knockback = new Phaser.Math.Vector2(
            Math.cos(angle) * 200,
            Math.sin(angle) * 200
        );
        player.setVelocity(knockback.x, knockback.y);
        
        enemy.destroy();
    }
    
    collectExp(player, exp) {
        this.playerExp += exp.getData('value');
        exp.destroy();
        
        // Check level up
        if (this.playerExp >= this.expToNextLevel) {
            this.levelUp();
        }
    }
    
    levelUp() {
        this.playerLevel++;
        this.playerExp -= this.expToNextLevel;
        this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
        
        // Pause game
        this.isPaused = true;
        this.physics.pause();
        
        // Show upgrade options
        this.showUpgradePanel();
    }
    
    showUpgradePanel() {
        // Create simple upgrade panel with orange theme
        const panel = this.add.rectangle(640, 360, 600, 400, 0x000000, 0.9);
        panel.setStrokeStyle(4, 0xff6600);
        const title = this.add.text(640, 200, 'レベルアップ！', {
            fontSize: '32px',
            color: '#ff6600'
        }).setOrigin(0.5);
        
        const upgrades = [
            { text: '弾の速度 +20%', effect: () => this.bulletSpeed *= 1.2 },
            { text: '攻撃間隔 -10%', effect: () => this.fireRate *= 0.9 },
            { text: '移動速度 +15%', effect: () => this.playerSpeed *= 1.15 },
            { text: '弾のダメージ +25%', effect: () => this.bulletDamage *= 1.25 },
            { text: 'HP回復 +50', effect: () => this.playerHP = Math.min(100, this.playerHP + 50) }
        ];
        
        // Select 3 random upgrades
        const selected = [];
        for (let i = 0; i < 3; i++) {
            const index = Phaser.Math.Between(0, upgrades.length - 1);
            selected.push(upgrades.splice(index, 1)[0]);
        }
        
        // Create buttons with orange theme
        const panelElements = [panel, title];
        selected.forEach((upgrade, i) => {
            const y = 300 + i * 80;
            const button = this.add.rectangle(640, y, 400, 60, 0x333333);
            button.setStrokeStyle(2, 0xff6600);
            const text = this.add.text(640, y, upgrade.text, {
                fontSize: '20px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            panelElements.push(button, text);
            
            button.setInteractive();
            button.on('pointerover', () => {
                button.setFillStyle(0xff6600);
                button.setAlpha(0.8);
            });
            button.on('pointerout', () => {
                button.setFillStyle(0x333333);
                button.setAlpha(1);
            });
            button.on('pointerdown', () => {
                upgrade.effect();
                panelElements.forEach(element => element.destroy());
                this.isPaused = false;
                this.physics.resume();
            });
        });
    }
    
    setupUI() {
        const style = { fontSize: '18px', color: '#ff6600', fontWeight: 'bold', stroke: '#000000', strokeThickness: 2 };
        this.levelText = this.add.text(10, 10, 'Level: 1', style);
        this.expText = this.add.text(10, 35, 'EXP: 0 / 10', style);
        this.hpText = this.add.text(10, 60, 'HP: 100', style);
        
        // Add controls instruction
        const controlsText = this.add.text(10, 100, 'WASD: 移動  マウス: 照準  自動射撃', {
            fontSize: '14px',
            color: '#cccccc'
        });
    }
    
    updateUI() {
        this.levelText.setText(`Level: ${this.playerLevel}`);
        this.expText.setText(`EXP: ${this.playerExp} / ${this.expToNextLevel}`);
        this.hpText.setText(`HP: ${Math.max(0, this.playerHP)}`);
    }
}

// Entity classes (placeholder structures)
class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');
        // Player implementation will go here
    }
}

class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type) {
        super(scene, x, y, 'enemy');
        // Enemy implementation will go here
    }
}

class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        // Bullet implementation will go here
    }
}

class ExperienceOrb extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, value) {
        super(scene, x, y, 'exp');
        // Experience orb implementation will go here
    }
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameScene;
}