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
        // Create simple colored rectangles as sprites
        this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('enemy', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('exp', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }

    create() {
        // Setup physics groups
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.experienceOrbs = this.physics.add.group();
        
        // Create player at center
        this.player = this.physics.add.sprite(640, 360, 'player');
        this.player.setTint(0x00ff00);
        this.player.setDisplaySize(32, 32);
        this.player.setCollideWorldBounds(true);
        
        // Setup input
        this.setupInput();
        
        // Setup collisions
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.experienceOrbs, this.collectExp, null, this);
        
        // Start enemy spawning
        this.enemySpawnTimer = this.time.addEvent({
            delay: 5000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
        
        // Spawn first enemy immediately
        this.spawnEnemy();
        
        // Setup UI
        this.setupUI();
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
        const bullet = this.bullets.create(this.player.x, this.player.y, 'bullet');
        bullet.setTint(0xffff00);
        bullet.setDisplaySize(8, 8);
        
        const velocity = new Phaser.Math.Vector2(
            Math.cos(angle) * this.bulletSpeed,
            Math.sin(angle) * this.bulletSpeed
        );
        bullet.setVelocity(velocity.x, velocity.y);
        
        // Clean up bullets that go off-screen
        bullet.setData('lifespan', 3000);
        this.time.delayedCall(3000, () => bullet.destroy());
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
        
        const enemy = this.enemies.create(x, y, 'enemy');
        enemy.setTint(0xff0000);
        enemy.setDisplaySize(24, 24);
        enemy.setData('hp', 10);
        enemy.setData('speed', 80);
        enemy.setData('damage', 10);
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
            const exp = this.experienceOrbs.create(enemy.x, enemy.y, 'exp');
            exp.setTint(0x0088ff);
            exp.setDisplaySize(16, 16);
            exp.setData('value', 1);
            
            enemy.destroy();
        } else {
            enemy.setData('hp', hp);
            // Flash effect
            enemy.setTint(0xffffff);
            this.time.delayedCall(100, () => enemy.setTint(0xff0000));
        }
    }
    
    playerHitEnemy(player, enemy) {
        this.playerHP -= enemy.getData('damage');
        
        // Flash effect
        player.setTint(0xff0000);
        this.time.delayedCall(200, () => player.setTint(0x00ff00));
        
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
        // Create simple upgrade panel
        const panel = this.add.rectangle(640, 360, 600, 400, 0x000000, 0.9);
        const title = this.add.text(640, 200, 'レベルアップ！', {
            fontSize: '32px',
            color: '#ffffff'
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
        
        // Create buttons
        selected.forEach((upgrade, i) => {
            const y = 300 + i * 80;
            const button = this.add.rectangle(640, y, 400, 60, 0x333333);
            const text = this.add.text(640, y, upgrade.text, {
                fontSize: '20px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            button.setInteractive();
            button.on('pointerover', () => button.setFillStyle(0x555555));
            button.on('pointerout', () => button.setFillStyle(0x333333));
            button.on('pointerdown', () => {
                upgrade.effect();
                panel.destroy();
                title.destroy();
                button.destroy();
                text.destroy();
                this.isPaused = false;
                this.physics.resume();
            });
        });
    }
    
    setupUI() {
        const style = { fontSize: '18px', color: '#ffffff' };
        this.levelText = this.add.text(10, 10, 'Level: 1', style);
        this.expText = this.add.text(10, 35, 'EXP: 0 / 10', style);
        this.hpText = this.add.text(10, 60, 'HP: 100', style);
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