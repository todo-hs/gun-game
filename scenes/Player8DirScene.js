class Player8DirScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Player8DirScene' });
        
        // Player properties
        this.player = null;
        this.playerStats = {
            hp: 100,
            maxHp: 100,
            speed: 200,
            level: 1,
            exp: 0,
            expToNext: 10
        };
        
        // Current direction (0-7)
        this.currentDirection = 2; // Start facing down
        
        // Weapons
        this.weapons = [];
        this.maxWeapons = 6;
        this.bullets = null;
        
        // Enemies
        this.enemies = null;
        this.waveNumber = 1;
        
        // Pickups
        this.experienceOrbs = null;
        
        // Controls
        this.wasd = null;
        this.mousePointer = null;
        
        // UI
        this.isPaused = false;
    }

    preload() {
        // Load 8-directional sprite sheet
        // The sprite sheet has 8 rows (directions) and 4 columns (animation frames)
        // Each frame is 16x16 pixels
        this.load.spritesheet('player_8dir', './assets/sprites/player_8dir.png', {
            frameWidth: 16,
            frameHeight: 16
        });
        
        // Load other assets
        this.load.image('bullet', './assets/sprites/bullet.png');
        this.load.image('enemy', './assets/sprites/enemy.png');
        this.load.image('exp', './assets/sprites/exp.png');
        this.load.image('weapon_pistol', './assets/sprites/weapon_pistol.png');
    }

    create() {
        // Create animations for 8 directions
        this.createAnimations();
        
        // Create groups
        this.bullets = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.experienceOrbs = this.physics.add.group();
        
        // Create player
        this.player = this.physics.add.sprite(640, 360, 'player_8dir');
        this.player.setCollideWorldBounds(true);
        this.player.setScale(3); // Scale up the pixel art
        this.player.body.setSize(12, 12);
        
        // Start with down animation
        this.player.play('walk_down');
        
        // Add initial weapon
        this.addWeapon({
            type: 'pistol',
            damage: 10,
            fireRate: 500,
            bulletSpeed: 400,
            spread: 0.1,
            auto: true
        });
        
        // Setup controls
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.mousePointer = this.input.activePointer;
        
        // Setup collisions
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.experienceOrbs, this.collectExp, null, this);
        
        // Start spawning enemies
        this.time.addEvent({
            delay: 3000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
        
        // Spawn first enemy
        this.spawnEnemy();
        
        // Setup UI
        this.setupUI();
    }

    createAnimations() {
        // 8 directions in order: down, down-left, left, up-left, up, up-right, right, down-right
        const directions = [
            'down', 'down_left', 'left', 'up_left', 
            'up', 'up_right', 'right', 'down_right'
        ];
        
        directions.forEach((dir, index) => {
            // Walk animation (4 frames per direction)
            this.anims.create({
                key: `walk_${dir}`,
                frames: this.anims.generateFrameNumbers('player_8dir', {
                    start: index * 4,
                    end: index * 4 + 3
                }),
                frameRate: 8,
                repeat: -1
            });
            
            // Idle animation (first frame of each direction)
            this.anims.create({
                key: `idle_${dir}`,
                frames: [{ key: 'player_8dir', frame: index * 4 }],
                frameRate: 1
            });
        });
    }

    update(time, delta) {
        if (this.isPaused) return;
        
        // Handle player movement
        this.handleMovement();
        
        // Update weapons
        this.updateWeapons(time);
        
        // Update enemies
        this.updateEnemies();
        
        // Update pickups
        this.updatePickups();
        
        // Update UI
        this.updateUI();
    }

    handleMovement() {
        const velocity = new Phaser.Math.Vector2(0, 0);
        let isMoving = false;
        
        // Get input
        if (this.wasd.A.isDown) {
            velocity.x = -1;
            isMoving = true;
        }
        if (this.wasd.D.isDown) {
            velocity.x = 1;
            isMoving = true;
        }
        if (this.wasd.W.isDown) {
            velocity.y = -1;
            isMoving = true;
        }
        if (this.wasd.S.isDown) {
            velocity.y = 1;
            isMoving = true;
        }
        
        // Normalize and apply speed
        if (isMoving) {
            velocity.normalize().scale(this.playerStats.speed);
            
            // Calculate direction (0-7)
            let angle = Math.atan2(velocity.y, velocity.x);
            angle = (angle + Math.PI * 2) % (Math.PI * 2); // Normalize to 0-2π
            
            // Convert to 8 directions
            const directionIndex = Math.round(angle / (Math.PI / 4)) % 8;
            
            // Direction mapping
            const dirMap = [6, 7, 0, 1, 2, 3, 4, 5]; // Remap to match sprite sheet
            this.currentDirection = dirMap[directionIndex];
            
            // Play animation
            const directions = [
                'down', 'down_left', 'left', 'up_left', 
                'up', 'up_right', 'right', 'down_right'
            ];
            this.player.play(`walk_${directions[this.currentDirection]}`, true);
        } else {
            // Idle animation
            const directions = [
                'down', 'down_left', 'left', 'up_left', 
                'up', 'up_right', 'right', 'down_right'
            ];
            this.player.play(`idle_${directions[this.currentDirection]}`, true);
        }
        
        this.player.setVelocity(velocity.x, velocity.y);
    }

    addWeapon(weaponData) {
        if (this.weapons.length >= this.maxWeapons) return;
        
        const weapon = {
            ...weaponData,
            lastFired: 0,
            sprite: this.add.sprite(0, 0, 'weapon_pistol')
        };
        
        weapon.sprite.setOrigin(0.3, 0.5);
        this.weapons.push(weapon);
    }

    updateWeapons(time) {
        this.weapons.forEach((weapon, index) => {
            // Position weapon around player
            const angleOffset = (index / this.weapons.length) * Math.PI * 2;
            const distance = 30;
            
            weapon.sprite.x = this.player.x + Math.cos(angleOffset) * distance;
            weapon.sprite.y = this.player.y + Math.sin(angleOffset) * distance;
            
            // Rotate weapon to face mouse
            const mouseAngle = Phaser.Math.Angle.Between(
                weapon.sprite.x, weapon.sprite.y,
                this.mousePointer.worldX, this.mousePointer.worldY
            );
            weapon.sprite.setRotation(mouseAngle);
            
            // Auto fire
            if (weapon.auto && time > weapon.lastFired + weapon.fireRate) {
                this.fireWeapon(weapon, mouseAngle);
                weapon.lastFired = time;
            }
        });
    }

    fireWeapon(weapon, angle) {
        const bullet = this.bullets.create(weapon.sprite.x, weapon.sprite.y, 'bullet');
        bullet.setData('damage', weapon.damage);
        
        // Add spread
        const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread;
        const velocity = new Phaser.Math.Vector2(
            Math.cos(spreadAngle) * weapon.bulletSpeed,
            Math.sin(spreadAngle) * weapon.bulletSpeed
        );
        bullet.setVelocity(velocity.x, velocity.y);
        bullet.setRotation(spreadAngle);
        
        // Destroy after 2 seconds
        this.time.delayedCall(2000, () => {
            if (bullet && bullet.active) bullet.destroy();
        });
    }

    spawnEnemy() {
        const side = Phaser.Math.Between(0, 3);
        let x, y;
        
        switch(side) {
            case 0: // Top
                x = Phaser.Math.Between(100, 1180);
                y = 50;
                break;
            case 1: // Right
                x = 1230;
                y = Phaser.Math.Between(100, 620);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(100, 1180);
                y = 670;
                break;
            case 3: // Left
                x = 50;
                y = Phaser.Math.Between(100, 620);
                break;
        }
        
        const enemy = this.enemies.create(x, y, 'enemy');
        enemy.setData('hp', 20 + this.waveNumber * 5);
        enemy.setData('damage', 10);
        enemy.setData('speed', 60 + Math.min(this.waveNumber * 5, 100));
        enemy.setData('expValue', this.waveNumber);
    }

    updateEnemies() {
        this.enemies.children.entries.forEach(enemy => {
            if (!enemy.active) return;
            
            const angle = Phaser.Math.Angle.Between(
                enemy.x, enemy.y,
                this.player.x, this.player.y
            );
            
            const speed = enemy.getData('speed');
            enemy.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
        });
    }

    updatePickups() {
        const magnetRange = 100;
        
        this.experienceOrbs.children.entries.forEach(orb => {
            const distance = Phaser.Math.Distance.Between(
                orb.x, orb.y,
                this.player.x, this.player.y
            );
            
            if (distance < magnetRange) {
                const angle = Phaser.Math.Angle.Between(
                    orb.x, orb.y,
                    this.player.x, this.player.y
                );
                const speed = 300 * (1 - distance / magnetRange);
                orb.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
            }
        });
    }

    bulletHitEnemy(bullet, enemy) {
        const damage = bullet.getData('damage');
        const hp = enemy.getData('hp') - damage;
        
        bullet.destroy();
        
        if (hp <= 0) {
            // Drop experience
            const exp = this.experienceOrbs.create(enemy.x, enemy.y, 'exp');
            exp.setData('value', enemy.getData('expValue'));
            
            enemy.destroy();
            
            // Check if no enemies left
            if (this.enemies.countActive() === 0) {
                this.waveNumber++;
            }
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
        this.playerStats.hp -= enemy.getData('damage');
        
        // Knockback
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        player.setVelocity(
            Math.cos(angle) * 300,
            Math.sin(angle) * 300
        );
        
        // Flash
        player.setTint(0xff0000);
        this.time.delayedCall(200, () => player.clearTint());
        
        enemy.destroy();
        
        if (this.playerStats.hp <= 0) {
            this.gameOver();
        }
    }

    collectExp(player, exp) {
        this.playerStats.exp += exp.getData('value');
        exp.destroy();
        
        if (this.playerStats.exp >= this.playerStats.expToNext) {
            this.levelUp();
        }
    }

    levelUp() {
        this.playerStats.level++;
        this.playerStats.exp -= this.playerStats.expToNext;
        this.playerStats.expToNext = Math.floor(this.playerStats.expToNext * 1.5);
        
        // Simple level up effect
        const levelUpText = this.add.text(this.player.x, this.player.y - 50, 'LEVEL UP!', {
            fontSize: '24px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: levelUpText,
            y: this.player.y - 100,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => levelUpText.destroy()
        });
        
        // Auto upgrade
        this.playerStats.speed += 10;
        this.playerStats.maxHp += 10;
        this.playerStats.hp = Math.min(this.playerStats.hp + 20, this.playerStats.maxHp);
    }

    gameOver() {
        this.isPaused = true;
        this.physics.pause();
        
        const gameOverText = this.add.text(640, 360, 'GAME OVER', {
            fontSize: '64px',
            color: '#FF0000',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
    }

    setupUI() {
        const style = {
            fontSize: '18px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        };
        
        // HP Bar
        this.add.rectangle(100, 30, 204, 24, 0x000000);
        this.add.rectangle(100, 30, 200, 20, 0x440000);
        this.hpBar = this.add.rectangle(100, 30, 200, 20, 0xFF0000);
        this.hpBar.setOrigin(0.5);
        
        // Stats
        this.levelText = this.add.text(10, 50, 'LV: 1', style);
        this.waveText = this.add.text(10, 75, 'Wave: 1', style);
        
        // Exp Bar
        this.add.rectangle(640, 690, 404, 14, 0x000000);
        this.add.rectangle(640, 690, 400, 10, 0x004400);
        this.expBar = this.add.rectangle(440, 690, 0, 10, 0x00FF00);
        this.expBar.setOrigin(0, 0.5);
    }

    updateUI() {
        // Update HP bar
        const hpPercent = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
        this.hpBar.width = 200 * hpPercent;
        
        // Update exp bar
        const expPercent = this.playerStats.exp / this.playerStats.expToNext;
        this.expBar.width = 400 * expPercent;
        
        // Update texts
        this.levelText.setText(`LV: ${this.playerStats.level}`);
        this.waveText.setText(`Wave: ${this.waveNumber}`);
    }
}