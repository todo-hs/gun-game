class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Game state
        this.player = null;
        this.enemies = null;
        this.bullets = null;
        this.experienceOrbs = null;
        
        // Player stats
        this.playerLevel = 1;
        this.playerExp = 0;
        this.expToNextLevel = 10;
        this.playerSpeed = 200;
        
        // Wave system
        this.currentWave = 1;
        this.enemiesPerWave = 5;
        this.enemySpawnTimer = 0;
        this.enemySpawnDelay = 2000;
        
        // Weapon system
        this.weapons = [];
        this.currentWeapon = 0;
        this.fireRate = 250;
        this.lastFired = 0;
        
        // Controls
        this.cursors = null;
        this.wasd = null;
        this.mousePointer = null;
    }

    preload() {
        // Create simple colored rectangles as sprites
        this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('enemy', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        this.load.image('exp', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }

    create() {
        // Set world bounds
        this.physics.world.setBounds(0, 0, 1200, 800);
        
        // Create groups
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.experienceOrbs = this.physics.add.group();
        
        // Create player
        this.player = this.physics.add.sprite(600, 400, 'player');
        this.player.setTint(0x00ff00);
        this.player.setDisplaySize(32, 32);
        this.player.setCollideWorldBounds(true);
        
        // Setup controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.mousePointer = this.input.activePointer;
        
        // Setup collisions
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.experienceOrbs, this.collectExp, null, this);
        
        // Initialize weapons
        this.initializeWeapons();
        
        // Start spawning enemies
        this.time.addEvent({
            delay: this.enemySpawnDelay,
            callback: this.spawnWave,
            callbackScope: this,
            loop: true
        });
        
        // Initial wave
        this.spawnWave();
    }

    update(time, delta) {
        // Player movement
        const velocity = new Phaser.Math.Vector2(0, 0);
        
        if (this.wasd.A.isDown) velocity.x = -1;
        if (this.wasd.D.isDown) velocity.x = 1;
        if (this.wasd.W.isDown) velocity.y = -1;
        if (this.wasd.S.isDown) velocity.y = 1;
        
        velocity.normalize().scale(this.playerSpeed);
        this.player.setVelocity(velocity.x, velocity.y);
        
        // Player rotation (face mouse)
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mousePointer.worldX, this.mousePointer.worldY
        );
        this.player.setRotation(angle);
        
        // Auto-fire
        if (time > this.lastFired + this.fireRate) {
            this.fire();
            this.lastFired = time;
        }
        
        // Enemy AI
        this.enemies.children.entries.forEach(enemy => {
            const angleToPlayer = Phaser.Math.Angle.Between(
                enemy.x, enemy.y,
                this.player.x, this.player.y
            );
            const velocity = new Phaser.Math.Vector2(
                Math.cos(angleToPlayer) * enemy.getData('speed'),
                Math.sin(angleToPlayer) * enemy.getData('speed')
            );
            enemy.setVelocity(velocity.x, velocity.y);
            enemy.setRotation(angleToPlayer);
        });
        
        // Experience orb magnetism
        this.experienceOrbs.children.entries.forEach(orb => {
            const distance = Phaser.Math.Distance.Between(
                orb.x, orb.y,
                this.player.x, this.player.y
            );
            
            if (distance < 100) {
                const angleToPlayer = Phaser.Math.Angle.Between(
                    orb.x, orb.y,
                    this.player.x, this.player.y
                );
                const speed = 300 * (1 - distance / 100);
                orb.setVelocity(
                    Math.cos(angleToPlayer) * speed,
                    Math.sin(angleToPlayer) * speed
                );
            } else {
                orb.setVelocity(0, 0);
            }
        });
        
        // Update HUD
        this.updateHUD();
        
        // Clean up off-screen bullets
        this.bullets.children.entries.forEach(bullet => {
            if (bullet.x < -50 || bullet.x > 1250 || bullet.y < -50 || bullet.y > 850) {
                bullet.destroy();
            }
        });
    }

    initializeWeapons() {
        // Basic pistol
        this.weapons.push({
            name: 'Pistol',
            damage: 10,
            fireRate: 250,
            bulletSpeed: 500,
            bulletSize: 8,
            spread: 0
        });
        
        this.currentWeapon = 0;
        this.fireRate = this.weapons[this.currentWeapon].fireRate;
    }

    fire() {
        const weapon = this.weapons[this.currentWeapon];
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mousePointer.worldX, this.mousePointer.worldY
        );
        
        const bullet = this.bullets.create(this.player.x, this.player.y, 'bullet');
        bullet.setTint(0xffff00);
        bullet.setDisplaySize(weapon.bulletSize, weapon.bulletSize);
        bullet.setData('damage', weapon.damage);
        
        const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread;
        const velocity = new Phaser.Math.Vector2(
            Math.cos(spreadAngle) * weapon.bulletSpeed,
            Math.sin(spreadAngle) * weapon.bulletSpeed
        );
        bullet.setVelocity(velocity.x, velocity.y);
    }

    spawnWave() {
        const enemyCount = this.enemiesPerWave + Math.floor(this.currentWave * 1.5);
        
        for (let i = 0; i < enemyCount; i++) {
            const side = Phaser.Math.Between(0, 3);
            let x, y;
            
            switch(side) {
                case 0: // Top
                    x = Phaser.Math.Between(0, 1200);
                    y = -50;
                    break;
                case 1: // Right
                    x = 1250;
                    y = Phaser.Math.Between(0, 800);
                    break;
                case 2: // Bottom
                    x = Phaser.Math.Between(0, 1200);
                    y = 850;
                    break;
                case 3: // Left
                    x = -50;
                    y = Phaser.Math.Between(0, 800);
                    break;
            }
            
            const enemy = this.enemies.create(x, y, 'enemy');
            enemy.setTint(0xff0000);
            enemy.setDisplaySize(24, 24);
            enemy.setData('health', 20 + this.currentWave * 5);
            enemy.setData('maxHealth', 20 + this.currentWave * 5);
            enemy.setData('speed', 50 + Math.min(this.currentWave * 5, 150));
            enemy.setData('damage', 5 + this.currentWave);
            enemy.setData('expValue', 1 + Math.floor(this.currentWave / 2));
        }
    }

    bulletHitEnemy(bullet, enemy) {
        const damage = bullet.getData('damage');
        const health = enemy.getData('health') - damage;
        
        bullet.destroy();
        
        if (health <= 0) {
            // Drop experience
            const expValue = enemy.getData('expValue');
            for (let i = 0; i < expValue; i++) {
                const exp = this.experienceOrbs.create(
                    enemy.x + Phaser.Math.Between(-20, 20),
                    enemy.y + Phaser.Math.Between(-20, 20),
                    'exp'
                );
                exp.setTint(0x00ffff);
                exp.setDisplaySize(12, 12);
                exp.setData('value', 1);
            }
            
            enemy.destroy();
            
            // Check if wave is complete
            if (this.enemies.countActive() === 0) {
                this.currentWave++;
                this.enemySpawnDelay = Math.max(1000, this.enemySpawnDelay - 100);
            }
        } else {
            enemy.setData('health', health);
            // Flash effect
            enemy.setTint(0xffffff);
            this.time.delayedCall(100, () => {
                if (enemy.active) enemy.setTint(0xff0000);
            });
        }
    }

    playerHitEnemy(player, enemy) {
        // Simple damage flash for now
        player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            player.setTint(0x00ff00);
        });
    }

    collectExp(player, exp) {
        const value = exp.getData('value');
        this.playerExp += value;
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
        this.physics.pause();
        
        // Show upgrade options
        this.showUpgradePanel();
    }

    showUpgradePanel() {
        const panel = document.getElementById('upgrade-panel');
        const optionsContainer = document.getElementById('upgrade-options');
        
        // Clear previous options
        optionsContainer.innerHTML = '';
        
        // Generate random upgrade options
        const upgrades = [
            { title: '攻撃力アップ', description: 'ダメージ +20%', effect: () => this.upgradeWeaponDamage() },
            { title: '移動速度アップ', description: '移動速度 +15%', effect: () => this.upgradeMovementSpeed() },
            { title: '連射速度アップ', description: '攻撃速度 +20%', effect: () => this.upgradeFireRate() },
            { title: '弾速アップ', description: '弾の速度 +25%', effect: () => this.upgradeBulletSpeed() },
            { title: '体力回復', description: 'HPを全回復', effect: () => this.healPlayer() }
        ];
        
        // Randomly select 3 upgrades
        const selectedUpgrades = [];
        while (selectedUpgrades.length < 3 && upgrades.length > 0) {
            const index = Phaser.Math.Between(0, upgrades.length - 1);
            selectedUpgrades.push(upgrades.splice(index, 1)[0]);
        }
        
        // Create upgrade buttons
        selectedUpgrades.forEach(upgrade => {
            const option = document.createElement('div');
            option.className = 'upgrade-option';
            option.innerHTML = `
                <div class="upgrade-title">${upgrade.title}</div>
                <div class="upgrade-description">${upgrade.description}</div>
            `;
            option.onclick = () => {
                upgrade.effect();
                panel.style.display = 'none';
                this.physics.resume();
            };
            optionsContainer.appendChild(option);
        });
        
        panel.style.display = 'block';
    }

    upgradeWeaponDamage() {
        this.weapons.forEach(weapon => {
            weapon.damage = Math.floor(weapon.damage * 1.2);
        });
    }

    upgradeMovementSpeed() {
        this.playerSpeed *= 1.15;
    }

    upgradeFireRate() {
        this.weapons.forEach(weapon => {
            weapon.fireRate = Math.floor(weapon.fireRate * 0.8);
        });
        this.fireRate = this.weapons[this.currentWeapon].fireRate;
    }

    upgradeBulletSpeed() {
        this.weapons.forEach(weapon => {
            weapon.bulletSpeed *= 1.25;
        });
    }

    healPlayer() {
        // Placeholder for health system
        this.player.setTint(0x00ff00);
    }

    updateHUD() {
        document.getElementById('level').textContent = this.playerLevel;
        document.getElementById('exp').textContent = this.playerExp;
        document.getElementById('exp-needed').textContent = this.expToNextLevel;
        document.getElementById('wave').textContent = this.currentWave;
        document.getElementById('enemies').textContent = this.enemies.countActive();
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: GameScene
};

// Create game
const game = new Phaser.Game(config);