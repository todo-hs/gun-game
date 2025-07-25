class BrotatoGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BrotatoGameScene' });
        
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
        
        // Weapons
        this.weapons = [];
        this.maxWeapons = 6;
        this.bullets = null;
        
        // Enemies
        this.enemies = null;
        this.waveNumber = 1;
        this.enemiesKilled = 0;
        this.waveEnemies = 20;
        
        // Pickups
        this.experienceOrbs = null;
        this.materials = null;
        
        // Controls
        this.wasd = null;
        this.mousePointer = null;
        
        // UI
        this.isPaused = false;
    }

    preload() {
        // Create placeholder sprites for now
        this.createPlaceholders();
    }

    createPlaceholders() {
        // Player sprite (potato shape)
        const graphics = this.add.graphics();
        
        // Player
        graphics.fillStyle(0x8B4513);
        graphics.fillCircle(16, 16, 12);
        graphics.fillStyle(0x000000);
        graphics.fillCircle(12, 12, 2);
        graphics.fillCircle(20, 12, 2);
        graphics.generateTexture('player_temp', 32, 32);
        graphics.clear();
        
        // Pistol
        graphics.fillStyle(0x444444);
        graphics.fillRect(10, 14, 20, 4);
        graphics.fillRect(8, 14, 8, 8);
        graphics.generateTexture('weapon_pistol', 32, 32);
        graphics.clear();
        
        // Enemy
        graphics.fillStyle(0xFF0000);
        graphics.fillCircle(12, 12, 10);
        graphics.generateTexture('enemy_basic', 24, 24);
        graphics.clear();
        
        // Bullet
        graphics.fillStyle(0xFFFF00);
        graphics.fillCircle(4, 4, 3);
        graphics.generateTexture('bullet_basic', 8, 8);
        graphics.clear();
        
        // Experience
        graphics.fillStyle(0x00FF00);
        graphics.fillCircle(6, 6, 5);
        graphics.generateTexture('exp_orb', 12, 12);
        graphics.clear();
        
        // Material
        graphics.fillStyle(0x0088FF);
        graphics.fillRect(2, 2, 8, 8);
        graphics.generateTexture('material', 12, 12);
        
        graphics.destroy();
    }

    create() {
        // Create groups
        this.bullets = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.experienceOrbs = this.physics.add.group();
        this.materials = this.physics.add.group();
        
        // Create player
        this.player = this.physics.add.sprite(640, 360, 'player_temp');
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(20, 20);
        
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
        this.physics.add.overlap(this.player, this.materials, this.collectMaterial, null, this);
        
        // Start wave
        this.startWave();
        
        // Setup UI
        this.setupUI();
    }

    update(time, delta) {
        if (this.isPaused) return;
        
        // Player movement
        this.handleMovement();
        
        // Update weapons
        this.updateWeapons(time);
        
        // Update enemies
        this.updateEnemies();
        
        // Magnet effect for pickups
        this.updatePickupMagnet();
        
        // Update UI
        this.updateUI();
    }

    handleMovement() {
        const velocity = new Phaser.Math.Vector2(0, 0);
        
        if (this.wasd.A.isDown) velocity.x = -1;
        if (this.wasd.D.isDown) velocity.x = 1;
        if (this.wasd.W.isDown) velocity.y = -1;
        if (this.wasd.S.isDown) velocity.y = 1;
        
        velocity.normalize().scale(this.playerStats.speed);
        this.player.setVelocity(velocity.x, velocity.y);
        
        // Face mouse direction
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mousePointer.worldX, this.mousePointer.worldY
        );
        this.player.setRotation(angle);
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
            const distance = 20;
            
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
        const bullet = this.bullets.create(weapon.sprite.x, weapon.sprite.y, 'bullet_basic');
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
        this.time.delayedCall(2000, () => bullet.destroy());
    }

    startWave() {
        // Spawn enemies in circular pattern
        const enemyCount = this.waveEnemies + (this.waveNumber - 1) * 5;
        
        for (let i = 0; i < enemyCount; i++) {
            this.time.delayedCall(i * 200, () => {
                const angle = Math.random() * Math.PI * 2;
                const distance = 400 + Math.random() * 100;
                const x = 640 + Math.cos(angle) * distance;
                const y = 360 + Math.sin(angle) * distance;
                
                this.spawnEnemy(x, y);
            });
        }
    }

    spawnEnemy(x, y) {
        const enemy = this.enemies.create(x, y, 'enemy_basic');
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

    bulletHitEnemy(bullet, enemy) {
        const damage = bullet.getData('damage');
        const hp = enemy.getData('hp') - damage;
        
        bullet.destroy();
        
        if (hp <= 0) {
            // Drop loot
            this.dropLoot(enemy.x, enemy.y, enemy.getData('expValue'));
            
            enemy.destroy();
            this.enemiesKilled++;
            
            // Check wave completion
            if (this.enemies.countActive() === 0) {
                this.waveComplete();
            }
        } else {
            enemy.setData('hp', hp);
            // Damage flash
            enemy.setTint(0xFFFFFF);
            this.time.delayedCall(100, () => enemy.clearTint());
        }
    }

    dropLoot(x, y, expValue) {
        // Drop experience
        for (let i = 0; i < expValue; i++) {
            const exp = this.experienceOrbs.create(
                x + Phaser.Math.Between(-20, 20),
                y + Phaser.Math.Between(-20, 20),
                'exp_orb'
            );
            exp.setData('value', 1);
        }
        
        // Chance to drop material
        if (Math.random() < 0.3) {
            const material = this.materials.create(x, y, 'material');
            material.setData('value', 1);
        }
    }

    updatePickupMagnet() {
        const magnetRange = 80;
        
        // Magnet for experience
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
        
        // Same for materials
        this.materials.children.entries.forEach(material => {
            const distance = Phaser.Math.Distance.Between(
                material.x, material.y,
                this.player.x, this.player.y
            );
            
            if (distance < magnetRange) {
                const angle = Phaser.Math.Angle.Between(
                    material.x, material.y,
                    this.player.x, this.player.y
                );
                const speed = 300 * (1 - distance / magnetRange);
                material.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
            }
        });
    }

    playerHitEnemy(player, enemy) {
        this.playerStats.hp -= enemy.getData('damage');
        
        // Knockback
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        player.setVelocity(
            Math.cos(angle) * 300,
            Math.sin(angle) * 300
        );
        
        // Damage flash
        player.setTint(0xFF0000);
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

    collectMaterial(player, material) {
        // For now just destroy it
        material.destroy();
    }

    levelUp() {
        this.playerStats.level++;
        this.playerStats.exp -= this.playerStats.expToNext;
        this.playerStats.expToNext = Math.floor(this.playerStats.expToNext * 1.5);
        
        // Show upgrade panel
        this.showUpgradePanel();
    }

    waveComplete() {
        this.waveNumber++;
        
        // Show wave complete message
        const text = this.add.text(640, 300, `Wave ${this.waveNumber - 1} Complete!`, {
            fontSize: '48px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: text,
            y: 250,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
        
        // Start next wave after delay
        this.time.delayedCall(3000, () => this.startWave());
    }

    showUpgradePanel() {
        this.isPaused = true;
        this.physics.pause();
        
        // Create panel
        const panel = this.add.rectangle(640, 360, 700, 500, 0x000000, 0.9);
        panel.setStrokeStyle(4, 0xFFD700);
        
        const title = this.add.text(640, 150, 'LEVEL UP!', {
            fontSize: '48px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Upgrade options
        const upgrades = [
            { name: 'More Damage', desc: '+20% Weapon Damage', effect: () => this.upgradeWeaponDamage() },
            { name: 'Faster Shooting', desc: '-15% Fire Rate', effect: () => this.upgradeFireRate() },
            { name: 'Speed Boost', desc: '+15% Movement Speed', effect: () => this.upgradeSpeed() },
            { name: 'Max HP Up', desc: '+25 Max HP', effect: () => this.upgradeMaxHP() },
            { name: 'New Weapon', desc: 'Add Random Weapon', effect: () => this.addRandomWeapon() }
        ];
        
        // Select 3 random upgrades
        const selected = [];
        while (selected.length < 3 && upgrades.length > 0) {
            const index = Phaser.Math.Between(0, upgrades.length - 1);
            selected.push(upgrades.splice(index, 1)[0]);
        }
        
        const elements = [panel, title];
        
        selected.forEach((upgrade, i) => {
            const y = 250 + i * 100;
            
            const bg = this.add.rectangle(640, y, 600, 80, 0x1a1a1a);
            bg.setStrokeStyle(2, 0xFFD700);
            
            const nameText = this.add.text(640, y - 15, upgrade.name, {
                fontSize: '24px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            const descText = this.add.text(640, y + 15, upgrade.desc, {
                fontSize: '18px',
                color: '#CCCCCC'
            }).setOrigin(0.5);
            
            elements.push(bg, nameText, descText);
            
            bg.setInteractive();
            bg.on('pointerover', () => bg.setFillStyle(0xFFD700, 0.3));
            bg.on('pointerout', () => bg.setFillStyle(0x1a1a1a));
            bg.on('pointerdown', () => {
                upgrade.effect();
                elements.forEach(el => el.destroy());
                this.isPaused = false;
                this.physics.resume();
            });
        });
    }

    upgradeWeaponDamage() {
        this.weapons.forEach(weapon => {
            weapon.damage *= 1.2;
        });
    }

    upgradeFireRate() {
        this.weapons.forEach(weapon => {
            weapon.fireRate *= 0.85;
        });
    }

    upgradeSpeed() {
        this.playerStats.speed *= 1.15;
    }

    upgradeMaxHP() {
        this.playerStats.maxHp += 25;
        this.playerStats.hp += 25;
    }

    addRandomWeapon() {
        const weaponTypes = [
            { type: 'shotgun', damage: 5, fireRate: 800, bulletSpeed: 350, spread: 0.5, auto: true },
            { type: 'smg', damage: 7, fireRate: 200, bulletSpeed: 500, spread: 0.3, auto: true },
            { type: 'rifle', damage: 20, fireRate: 1000, bulletSpeed: 600, spread: 0.05, auto: true }
        ];
        
        const weapon = weaponTypes[Phaser.Math.Between(0, weaponTypes.length - 1)];
        this.addWeapon(weapon);
    }

    gameOver() {
        this.isPaused = true;
        this.physics.pause();
        
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
        
        const gameOverText = this.add.text(640, 300, 'GAME OVER', {
            fontSize: '64px',
            color: '#FF0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const statsText = this.add.text(640, 400, 
            `Wave Reached: ${this.waveNumber}\nEnemies Killed: ${this.enemiesKilled}`, {
            fontSize: '24px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5);
    }

    setupUI() {
        const style = {
            fontSize: '20px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        };
        
        // HP Bar background
        this.add.rectangle(640, 30, 204, 24, 0x000000);
        this.add.rectangle(640, 30, 200, 20, 0x440000);
        this.hpBar = this.add.rectangle(640, 30, 200, 20, 0xFF0000);
        this.hpBar.setOrigin(0.5);
        
        // Stats text
        this.levelText = this.add.text(10, 10, 'LV: 1', style);
        this.waveText = this.add.text(10, 40, 'Wave: 1', style);
        this.enemiesText = this.add.text(1270, 10, 'Enemies: 0', style).setOrigin(1, 0);
        
        // Experience bar
        this.add.rectangle(640, 690, 404, 14, 0x000000);
        this.add.rectangle(640, 690, 400, 10, 0x004400);
        this.expBar = this.add.rectangle(440, 690, 0, 10, 0x00FF00);
        this.expBar.setOrigin(0, 0.5);
    }

    updateUI() {
        // Update HP bar
        const hpPercent = this.playerStats.hp / this.playerStats.maxHp;
        this.hpBar.width = 200 * hpPercent;
        
        // Update exp bar
        const expPercent = this.playerStats.exp / this.playerStats.expToNext;
        this.expBar.width = 400 * expPercent;
        
        // Update texts
        this.levelText.setText(`LV: ${this.playerStats.level}`);
        this.waveText.setText(`Wave: ${this.waveNumber}`);
        this.enemiesText.setText(`Enemies: ${this.enemies.countActive()}`);
    }
}