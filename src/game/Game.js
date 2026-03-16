import { WORLD, PICKUP } from '../data/constants.js';
import { InputManager, P1_KEY_MAP, P2_KEY_MAP } from './InputManager.js';
import { RemoteInputManager } from '../network/RemoteInputManager.js';
import { Camera } from './Camera.js';
import { Player } from '../entities/Player.js';
import { EnemySpawner } from '../entities/EnemySpawner.js';
import { XPGem } from '../entities/XPGem.js';
import { Pickup } from '../entities/Pickup.js';
import { XPSystem } from '../systems/XPSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { DamageNumberSystem } from '../systems/DamageNumberSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { OrbWeapon } from '../weapons/OrbWeapon.js';
import { DirectionalShot } from '../weapons/DirectionalShot.js';
import { FlameZone } from '../weapons/FlameZone.js';
import { LightningWeapon } from '../weapons/LightningWeapon.js';
import { BoomerangWeapon } from '../weapons/BoomerangWeapon.js';
import { NovaExplosion } from '../weapons/NovaExplosion.js';
import { distance } from '../utils/math.js';

const WEAPON_MAP = {
  orb: OrbWeapon, shot: DirectionalShot, flame: FlameZone,
  lightning: LightningWeapon, boomerang: BoomerangWeapon, nova: NovaExplosion,
};

export class Game {
  constructor(canvas, callbacks, config = {}) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.callbacks = callbacks;

    // Support both solo (charData/startWeapon), local coop (players array), and network
    const playerConfigs = config.players
      ? config.players
      : [{ charData: config.charData || null, startWeapon: config.startWeapon || 'orb' }];

    this.isCoop        = playerConfigs.length > 1;
    this.networkManager = config.networkManager || null;
    this.isNetworkHost  = config.isNetworkHost  || false;
    this.localPlayerIndex = config.localPlayerIndex ?? 0;
    this._netStateTimer   = 0;
    this._netStatePeriod  = 50; // ms between state broadcasts (20fps)
    this._pauseDrawDone   = false;

    // Shared systems
    this.camera  = new Camera(canvas.width, canvas.height);
    this.audio   = new AudioSystem();
    this.combo   = new ComboSystem();
    this.objectives = new ObjectiveSystem();

    // Per-player systems
    this.players       = [];
    this.playerInputs  = [];
    this.playerXP      = [];
    this.playerUpgrade = [];

    const spawnOffsets = [[-150, -100], [150, -100], [-150, 100], [150, 100]];
    playerConfigs.forEach((pc, idx) => {
      const off = spawnOffsets[idx] || [0, 0];
      const p = new Player(
        WORLD.WIDTH  / 2 + off[0],
        WORLD.HEIGHT / 2 + off[1],
        pc.charData,
        idx,
      );
      p._projectileBuffer = [];
      this.players.push(p);

      // Network: local player uses keyboard; remote players use RemoteInputManager
      if (this.networkManager) {
        const isLocal = idx === this.localPlayerIndex;
        const input = isLocal
          ? new InputManager(P1_KEY_MAP)
          : new RemoteInputManager();
        this.playerInputs.push(input);
        if (!isLocal) this.networkManager[`_remoteInput${idx}`] = input;
      } else {
        // Local co-op: P1=WASD, P2=IJKL
        const keyMaps = [P1_KEY_MAP, P2_KEY_MAP, null, null];
        this.playerInputs.push(
          idx < 2 ? new InputManager(keyMaps[idx]) : new RemoteInputManager()
        );
      }

      this.playerXP.push(new XPSystem());
      this.playerUpgrade.push(new UpgradeSystem());
      this._initWeapons(p, pc);
    });

    // Backwards-compat alias
    this.player = this.players[0];
    this.input  = this.playerInputs[0];

    this.enemies     = [];
    this.projectiles = [];
    this.gems        = [];
    this.pickups     = [];
    this.activeBoss  = null;
    this._netEnemyId = 0; // counter for network enemy IDs

    this.particles     = new ParticleSystem();
    this.damageNumbers = new DamageNumberSystem();
    this.spawner       = new EnemySpawner();

    this.elapsed     = 0;
    this.killCount   = 0;
    this.totalDamage = 0;
    this.bossKills   = 0;
    this.paused      = false;
    this.manualPause = false;
    this.running     = true;

    // Level-up queue: { playerIndex, isChest }
    this._levelUpQueue         = [];
    this._activeLevelUpPlayer  = -1;
    this._activeChestPlayer    = -1;

    this.bossWarningTimer = 0;
    this.bossWarningType  = '';
    this.flashAlpha       = 0;
    this.chestSpawnTimer  = PICKUP.CHEST_SPAWN_INTERVAL * 1000;

    // Kill-streak objective (starts at 1min)
    this._killStreakObjSpawned = false;

    this._decorations   = this._generateDecorations();
    this._lastTime      = null;
    this._raf           = null;
    this._loop          = this._loop.bind(this);
    this._raf           = requestAnimationFrame(this._loop);

    this._handleResize  = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    this._handleResize();
  }

  // ── Init helpers ───────────────────────────────────────────────────

  _initWeapons(player, pc) {
    const wid = pc.startWeapon || 'orb';
    this._addWeaponForPlayer(player, wid);
    // Apply purchased weapon tier (pre-level the starting weapon)
    const tier = pc.startWeaponTier || 0;
    if (tier > 0) {
      const weapon = player.weapons.find(w => w.id === wid);
      if (weapon) {
        for (let i = 0; i < tier; i++) weapon.levelUp();
      }
    }
    // Engineer starts with 2 weapons
    if (pc.charData?.extraStartWeapon) {
      this._addWeaponForPlayer(player, pc.charData.extraStartWeapon);
    }
  }

  _addWeaponForPlayer(player, id) {
    if (player.hasWeapon(id)) return;
    if (player.weapons.length >= player.maxWeapons) return;
    const WeaponClass = WEAPON_MAP[id];
    if (!WeaponClass) return;
    player.weapons.push(new WeaponClass());
  }

  _generateDecorations() {
    const decs = [];
    for (let i = 0; i < 80; i++) {
      decs.push({
        x: Math.random() * WORLD.WIDTH,
        y: Math.random() * WORLD.HEIGHT,
        w: 20 + Math.random() * 100,
        h: 20 + Math.random() * 80,
        alpha: 0.04 + Math.random() * 0.07,
      });
    }
    return decs;
  }

  _handleResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width  = w;
    this.canvas.height = h;
    this.camera.resize(w, h);
  }

  // ── Public API ─────────────────────────────────────────────────────

  addWeapon(id) { this._addWeaponForPlayer(this.player, id); }

  upgradeWeapon(id) {
    const weapon = this.player.weapons.find(w => w.id === id);
    if (weapon) weapon.levelUp();
  }

  pause()  { this.paused = true; this._pauseDrawDone = false; }
  resume() { this.paused = false; this._lastTime = null; this._pauseDrawDone = false; }

  toggleManualPause() {
    this.manualPause = !this.manualPause;
    this.paused = this.manualPause;
    if (!this.paused) this._lastTime = null;
    return this.manualPause;
  }

  destroy() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.playerInputs.forEach(im => im.destroy());
    window.removeEventListener('resize', this._handleResize);
  }

  applyUpgrade(choice, playerIndex = 0) {
    const player        = this.players[playerIndex];
    const upgradeSystem = this.playerUpgrade[playerIndex];

    choice.apply(player, this);

    if (this._activeChestPlayer === playerIndex) {
      this._activeChestPlayer = -1;
    } else {
      upgradeSystem.pendingLevels = Math.max(0, upgradeSystem.pendingLevels - 1);
    }

    if (upgradeSystem.hasPending()) {
      const choices = upgradeSystem.getChoices(player, 3);
      if (this.callbacks.onLevelUp) this.callbacks.onLevelUp(choices, false, playerIndex);
      return;
    }

    this._activeLevelUpPlayer = -1;

    // Process next queued level-up
    const next = this._levelUpQueue.shift();
    if (next) {
      this._activeLevelUpPlayer = next.playerIndex;
      const choices = this.playerUpgrade[next.playerIndex].getChoices(this.players[next.playerIndex], 3, next.minRarity);
      if (this.callbacks.onLevelUp) this.callbacks.onLevelUp(choices, next.isChest, next.playerIndex);
    } else {
      this.paused = this.manualPause;
      this._pauseDrawDone = false;
      if (this.callbacks.onResumeGame) this.callbacks.onResumeGame();
    }
  }

  toggleMute() { this.audio.toggleMute(); }

  // Called by host each frame with input from a specific remote player
  applyRemoteInput(playerIndex, inputObj) {
    const input = this.playerInputs[playerIndex];
    if (input instanceof RemoteInputManager) {
      input.applyInput(inputObj);
    }
  }

  // Serialize game state for network broadcast (compact)
  serializeNetState() {
    const camX = this.camera.x, camY = this.camera.y;
    return {
      t:  Math.round(this.elapsed * 10) / 10,
      k:  this.killCount,
      bk: this.bossKills,
      fa: Math.round(this.flashAlpha * 100) / 100,
      bw: Math.round(this.bossWarningTimer),
      bt: this.bossWarningType,
      cc: this.combo.count,
      ab: this.activeBoss ? {
        hp: this.activeBoss.hp, mhp: this.activeBoss.maxHp, n: this.activeBoss.name,
      } : null,
      pl: this.players.map((p, i) => ({
        x:   Math.round(p.x), y: Math.round(p.y),
        hp:  Math.round(p.hp), mhp: p.maxHp,
        alv: p.alive ? 1 : 0,
        da:  p.dashActive ? 1 : 0,
        dct: Math.round(p.dashCooldownTimer),
        fx:  Math.round(p.facing.dx * 100) / 100,
        fy:  Math.round(p.facing.dy * 100) / 100,
        sw:  p.shockwaveActive ? 1 : 0, sr: Math.round(p.shockwaveRadius),
        lv:  this.playerXP[i].level,
        xp:  this.playerXP[i].xp, xt: this.playerXP[i].xpToNext,
        wp:  p.weapons.map(w => ({ id: w.id, lv: w.level })),
        ps:  {
          ta: p.passiveState.tauntActive ? 1 : 0,
          oa: p.passiveState.overclockActive ? 1 : 0,
          rs: p.passiveState.rageStacks,
        },
      })),
      en: this.enemies.filter(e => e.alive).slice(0, 120).map(e => ({
        id: e._netId, x: Math.round(e.x), y: Math.round(e.y),
        hp: e.hp, mhp: e.maxHp, sz: e.size,
        c:  e.color, b: e.isBoss ? 1 : 0, mb: e.isMajorBoss ? 1 : 0,
      })),
      gm: this.gems.filter(g => g.alive).slice(0, 200).map(g => [Math.round(g.x), Math.round(g.y), g.value]),
      pk: this.pickups.filter(p => p.alive).map(p => [Math.round(p.x), Math.round(p.y), p.type]),
      pj: this.projectiles.filter(p => p.alive).slice(0, 80).map(p => [Math.round(p.x), Math.round(p.y), Math.round(p.size), p.owner === 'enemy' ? 1 : 0]),
    };
  }

  // Guest: apply received state snapshot for rendering
  applyNetworkState(state) {
    if (!state) return;
    this.elapsed         = state.t ?? this.elapsed;
    this.killCount       = state.k ?? this.killCount;
    this.bossKills       = state.bk ?? this.bossKills;
    this.flashAlpha      = state.fa ?? 0;
    this.bossWarningTimer = state.bw ?? 0;
    this.bossWarningType  = state.bt ?? '';
    if (this.combo) this.combo.count = state.cc ?? 0;

    // Players
    (state.pl || []).forEach((pd, idx) => {
      let p = this.players[idx];
      if (!p) return;
      p.x = pd.x; p.y = pd.y;
      p.hp = pd.hp; p.maxHp = pd.mhp;
      p.alive = !!pd.alv;
      p.dashActive = !!pd.da;
      p.dashCooldownTimer = pd.dct;
      p.facing = { dx: pd.fx, dy: pd.fy };
      p.shockwaveActive = !!pd.sw; p.shockwaveRadius = pd.sr;
      if (this.playerXP[idx]) {
        this.playerXP[idx].level = pd.lv;
        this.playerXP[idx].xp = pd.xp;
        this.playerXP[idx].xpToNext = pd.xt;
      }
      // Sync weapons list
      const newWpIds = (pd.wp || []).map(w => w.id);
      // Remove weapons no longer present
      p.weapons = p.weapons.filter(w => newWpIds.includes(w.id));
      // Add new weapons
      newWpIds.forEach((id, i) => {
        if (!p.hasWeapon(id)) this._addWeaponForPlayer(p, id);
        const w = p.weapons.find(w => w.id === id);
        if (w) w.level = pd.wp[i].lv;
      });
      p.passiveState = {
        ...p.passiveState,
        tauntActive:     !!(pd.ps?.ta),
        overclockActive: !!(pd.ps?.oa),
        rageStacks:       pd.ps?.rs ?? 0,
      };
    });

    // Enemies — reconcile with minimal object creation
    const incomingIds = new Set((state.en || []).map(e => e.id));
    this.enemies = this.enemies.filter(e => incomingIds.has(e._netId));
    const existingById = {};
    this.enemies.forEach(e => { existingById[e._netId] = e; });
    (state.en || []).forEach(ed => {
      if (existingById[ed.id]) {
        const e = existingById[ed.id];
        e.x = ed.x; e.y = ed.y; e.hp = ed.hp; e.maxHp = ed.mhp;
      } else {
        // Create a minimal render-only enemy
        const e = { _netId: ed.id, x: ed.x, y: ed.y, hp: ed.hp, maxHp: ed.mhp,
          size: ed.sz, color: ed.c, isBoss: !!ed.b, isMajorBoss: !!ed.mb, alive: true,
          draw(ctx) { this._drawSimple(ctx); },
          _drawSimple(ctx) {
            ctx.save();
            ctx.fillStyle = this.color || '#888';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(this.x, this.y, (this.size || 20) / 2, 0, Math.PI * 2);
            ctx.fill();
            if (this.isBoss) {
              ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2; ctx.stroke();
            }
            ctx.restore();
          },
        };
        this.enemies.push(e);
        existingById[ed.id] = e;
      }
    });

    // Gems — simple array replacement
    this.gems = (state.gm || []).map(([x, y, v]) => ({
      alive: true, x, y, value: v,
      update() {},
      draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#44ff88';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    }));

    // Pickups
    this.pickups = (state.pk || []).map(([x, y, type]) => {
      const COLORS = { heart: '#ff4466', magnet: '#4488ff', chest: '#ffaa00' };
      return {
        alive: true, x, y, type,
        update() {},
        draw(ctx) {
          ctx.save();
          ctx.fillStyle = COLORS[type] || '#fff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      };
    });

    // Projectiles (render-only)
    this.projectiles = (state.pj || []).map(([x, y, sz, isEnemy]) => ({
      alive: true, x, y, size: sz,
      draw(ctx) {
        ctx.save();
        ctx.fillStyle = isEnemy ? '#ff8844' : '#44aaff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, sz / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    }));

    // Active boss info
    if (state.ab) {
      if (!this.activeBoss) this.activeBoss = { hp: state.ab.hp, maxHp: state.ab.mhp, name: state.ab.n };
      else { this.activeBoss.hp = state.ab.hp; this.activeBoss.maxHp = state.ab.mhp; }
    } else {
      this.activeBoss = null;
    }

    this._sendStatsUpdate();
  }

  // ── Game loop ──────────────────────────────────────────────────────

  _loop(timestamp) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);
    if (this._lastTime === null) { this._lastTime = timestamp; return; }
    const dt = Math.min(timestamp - this._lastTime, 50);
    this._lastTime = timestamp;

    // ESC → pause (P1 only)
    if (this.playerInputs[0].consumeJustPressedPause()) {
      if (this._activeLevelUpPlayer === -1 && this._activeChestPlayer === -1) {
        const isPaused = this.toggleManualPause();
        if (this.callbacks.onPauseToggle) this.callbacks.onPauseToggle(isPaused);
        this._pauseDrawDone = false; // redraw once on pause toggle
      }
    }

    if (!this.paused) {
      this._update(dt);
      this._draw();
    } else if (!this._pauseDrawDone) {
      // Draw exactly once when paused (level-up, manual pause) to avoid 60fps re-render lag
      this._draw();
      this._pauseDrawDone = true;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────

  _update(dt) {
    this.elapsed += dt / 1000;

    if (this.flashAlpha > 0) this.flashAlpha -= dt * 0.005;
    if (this.bossWarningTimer > 0) this.bossWarningTimer -= dt;

    // Kill-streak objective starts at 1 minute
    if (!this._killStreakObjSpawned && this.elapsed >= 60) {
      this._killStreakObjSpawned = true;
      this.objectives.startKillStreak(20, this.elapsed);
    }

    // Update objectives
    const objResult = this.objectives.update(this.elapsed);
    if (objResult?.failed?.fatal) {
      this._onGameOver();
      return;
    }

    // Update each player
    this.players.forEach((player, idx) => {
      if (!player.alive) return;
      player._projectileBuffer = [];
      player.update(dt, this.playerInputs[idx]);
      player._projectileBuffer.forEach(p => this.projectiles.push(p));
      player._projectileBuffer = [];
    });

    // Weapon fire per alive player
    this.players.forEach(player => {
      if (!player.alive) return;
      player.weapons.forEach(w => {
        if (w.tick)      w.tick(player, this.enemies, this.damageNumbers, this.audio);
        if (w.fire)      w.fire(player, this.enemies, this.damageNumbers, this.audio);
        if (w.checkHits) w.checkHits(player, this.enemies, this.damageNumbers, this.audio);
      });
    });

    // Afterimage damage (Zynn)
    this.players.forEach(player => {
      if (!player.alive || player.charData?.passive?.id !== 'afterimage') return;
      player.passiveState.afterimages.forEach(shadow => {
        this.enemies.forEach(enemy => {
          if (!enemy.alive) return;
          const d = distance(shadow.x, shadow.y, enemy.x, enemy.y);
          if (d < enemy.size / 2 + player.size / 2 && !shadow._hitEnemies?.has(enemy)) {
            if (!shadow._hitEnemies) shadow._hitEnemies = new Set();
            shadow._hitEnemies.add(enemy);
            const dmg = 12; // improved from 5
            const died = enemy.takeDamage(dmg);
            this.totalDamage += dmg;
            player.onDamageDealt(dmg);
            this.damageNumbers.add(enemy.x, enemy.y - 20, dmg, false);
            if (died) this._onEnemyKilled(enemy, player);
          }
        });
      });
    });

    // Taunt: override enemy target toward taunt player
    this._tauntingPlayer = null;
    this.players.forEach(player => {
      if (player.alive && player.passiveState?.tauntActive) {
        this._tauntingPlayer = player;
      }
    });

    // Level-up shockwave knockback (all players)
    this.players.forEach(player => {
      if (!player.alive || !player.shockwaveActive) return;
      const shockR = player.shockwaveRadius;
      this.enemies.forEach(e => {
        if (!e.alive) return;
        const d = distance(e.x, e.y, player.x, player.y);
        if (d < shockR && d < 120) {
          const nx = (e.x - player.x) / (d || 1);
          const ny = (e.y - player.y) / (d || 1);
          e.x += nx * 6;
          e.y += ny * 6;
        }
      });
    });

    // Enemy spawning — follow average position of alive players
    const avgPos = this._getAveragePlayerPos();
    const prevCount = this.enemies.length;
    const spawned = this.spawner.update(dt, this.elapsed, avgPos.x, avgPos.y, this.enemies, this.players.length);
    // Assign net IDs to newly spawned regular enemies
    for (let i = prevCount; i < this.enemies.length; i++) {
      if (!this.enemies[i]._netId) this.enemies[i]._netId = ++this._netEnemyId;
    }
    if (spawned.miniBoss) {
      spawned.miniBoss._netId = ++this._netEnemyId;
      this.enemies.push(spawned.miniBoss);
      this.activeBoss = spawned.miniBoss;
      this.objectives.startBossObjective(spawned.miniBoss.name, this.elapsed);
      if (this.callbacks.onBossSpawn) this.callbacks.onBossSpawn(spawned.miniBoss.name, spawned.miniBoss.maxHp);
    }
    if (spawned.majorBoss) {
      spawned.majorBoss._netId = ++this._netEnemyId;
      this.enemies.push(spawned.majorBoss);
      this.activeBoss = spawned.majorBoss;
      this.objectives.startBossObjective(spawned.majorBoss.name, this.elapsed);
      if (this.callbacks.onBossSpawn) this.callbacks.onBossSpawn(spawned.majorBoss.name, spawned.majorBoss.maxHp);
    }
    if ((spawned.miniBossWarning || spawned.majorBossWarning) && this.bossWarningTimer <= 0) {
      this.bossWarningTimer = 3000;
      this.bossWarningType  = spawned.majorBossWarning ? 'BOSS LÉGENDAIRE' : 'MINI-BOSS';
    }

    // Enemy update + contact damage on ALL alive players
    const newEnemyProjectiles = [];
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      // Targeting: taunted toward taunt player if active & in range
      let target = this._getTargetForEnemy(enemy);
      if (enemy.update) enemy.update(dt, target, newEnemyProjectiles);

      if (enemy.checkExplode) {
        const explosion = enemy.checkExplode(target);
        if (explosion) {
          this.particles.spawnExplosion(explosion.x, explosion.y, explosion.radius);
          this.audio.playExplosion();
          this.players.forEach(player => {
            if (!player.alive) return;
            const d = distance(player.x, player.y, explosion.x, explosion.y);
            if (d < explosion.radius) {
              const taken = player.takeDamage(explosion.damage);
              if (taken > 0) {
                this.camera.shake(6, 200);
                this.audio.playPlayerHit();
                this.objectives.onPlayerHit();
              }
            }
          });
        }
      }

      if (enemy.alive) {
        this.players.forEach(player => {
          if (!player.alive) return;
          const d = distance(enemy.x, enemy.y, player.x, player.y);
          if (d < (enemy.size || 20) / 2 + player.size / 2) {
            const taken = player.takeDamage(enemy.damage);
            if (taken > 0) {
              this.camera.shake(5, 150);
              this.audio.playPlayerHit();
              this.damageNumbers.add(player.x, player.y - 30, taken, false);
              this.objectives.onPlayerHit();
            }
          }
        });
      }
    });
    newEnemyProjectiles.forEach(p => this.projectiles.push(p));

    // Projectile collisions
    this.projectiles.forEach(proj => {
      if (!proj.alive) return;
      // Pass primary target for enemy projectiles
      const primaryPlayer = this._getNearestAlivePlayer(proj.x, proj.y);
      proj.update(dt, primaryPlayer);
      if (!proj.alive) return;

      if (proj.owner === 'player') {
        // Find which player owns this projectile
        const shooter = this.players.find(p => p.weapons.some(w => w === proj._weapon)) || this.players[0];
        this.enemies.forEach(enemy => {
          if (!enemy.alive || !proj.alive) return;
          if (proj.hitEnemies?.has(enemy)) return;
          const d = distance(proj.x, proj.y, enemy.x, enemy.y);
          if (d < (enemy.size || 20) / 2 + proj.size) {
            const isCrit = Math.random() < shooter.critChance;
            let dmg = proj.damage;
            if (isCrit) dmg = Math.floor(dmg * shooter.critMult);
            this.totalDamage += dmg;
            enemy.takeDamage(dmg);
            shooter.onDamageDealt(dmg);
            this.damageNumbers.add(enemy.x, enemy.y - 20, dmg, isCrit);
            this.audio.playHit();
            if (isCrit && shooter.charData?.passive?.id === 'rage' && enemy.hp <= 0) {
              // Crit kill explosion (Pyrex)
              this.particles.spawnExplosion(enemy.x, enemy.y, 60);
            }
            if (proj.piercing) proj.hitEnemies.add(enemy);
            else proj.alive = false;
          }
        });
      } else if (proj.owner === 'enemy') {
        // Hit nearest player
        this.players.forEach(player => {
          if (!player.alive || !proj.alive) return;
          const d = distance(proj.x, proj.y, player.x, player.y);
          if (d < player.size / 2 + proj.size) {
            const taken = player.takeDamage(proj.damage);
            if (taken > 0) {
              this.camera.shake(4, 100);
              this.audio.playPlayerHit();
              this.objectives.onPlayerHit();
            }
            proj.alive = false;
          }
        });
      }
    });

    // Dead enemy processing
    this.enemies.forEach(e => { if (!e.alive) this._onEnemyKilled(e, null); });
    this.enemies = this.enemies.filter(e => e.alive);

    // Boss tracking
    if (this.activeBoss && !this.enemies.includes(this.activeBoss)) {
      this.bossKills++;
      const objReward = this.objectives.onBossKill();
      if (this.callbacks.onBossKill) this.callbacks.onBossKill();
      this.pickups.push(new Pickup(this.activeBoss.x, this.activeBoss.y, 'chest'));
      if (objReward?.reward === 'extra_upgrade') {
        // Grant bonus chest upgrade to P1
        this._queueChest(0, objReward.rarity || 'epic');
      }
      this.activeBoss = null;
    }

    this.projectiles = this.projectiles.filter(p => p.alive);

    // XP gem collection — nearest alive player collects
    this.gems.forEach(gem => {
      if (!gem.alive) return;
      gem.update(dt);
      let collected = false;
      this.players.forEach(player => {
        if (!player.alive || collected) return;
        if (gem.attracted) {
          const dx = player.x - gem.x;
          const dy = player.y - gem.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d > 5) { gem.x += (dx / d) * 8; gem.y += (dy / d) * 8; }
        }
        const d = distance(gem.x, gem.y, player.x, player.y);
        if (d < (gem.attracted ? 20 : player.xpRadius)) {
          const xpMult     = (player.xpMult || 1) * this.combo.getXpMult();
          const idx        = this.players.indexOf(player);
          const lvlGained  = this.playerXP[idx].addXP(gem.value, xpMult);
          gem.alive        = false;
          collected        = true;
          this.damageNumbers.addText(gem.x, gem.y - 15, `+${gem.value}XP`, '#44ff88');
          this.audio.playCollect();
          if (lvlGained > 0) this._onLevelUp(idx, lvlGained);
        }
      });
    });
    this.gems = this.gems.filter(g => g.alive);

    // Pickups — nearest alive player collects
    this.pickups.forEach(pickup => {
      if (!pickup.alive) return;
      pickup.update(dt);
      const nearest = this._getNearestAlivePlayer(pickup.x, pickup.y);
      if (!nearest) return;
      const d = distance(pickup.x, pickup.y, nearest.x, nearest.y);
      if (d < pickup.collectRadius) {
        pickup.alive = false;
        const pIdx = this.players.indexOf(nearest);
        this._onPickupCollected(pickup, nearest, pIdx);
      }
    });
    this.pickups = this.pickups.filter(p => p.alive);

    // Random chest spawn
    this.chestSpawnTimer -= dt;
    if (this.chestSpawnTimer <= 0) {
      this.chestSpawnTimer = PICKUP.CHEST_SPAWN_INTERVAL * 1000;
      const angle = Math.random() * Math.PI * 2;
      const cx = avgPos.x + Math.cos(angle) * 250;
      const cy = avgPos.y + Math.sin(angle) * 250;
      this.pickups.push(new Pickup(
        Math.max(50, Math.min(WORLD.WIDTH  - 50, cx)),
        Math.max(50, Math.min(WORLD.HEIGHT - 50, cy)),
        'chest',
      ));
    }

    this.combo.update(dt);
    this.particles.update(dt);
    this.damageNumbers.update(dt);

    // Camera follows midpoint of alive players
    const camPos = this._getAveragePlayerPos();
    this.camera.follow(camPos.x, camPos.y);
    this.camera.update(dt);

    // Game over when ALL players dead
    if (this.players.every(p => !p.alive)) {
      this._onGameOver();
      return;
    }

    this._sendStatsUpdate();

    // Network: host broadcasts state to guests
    if (this.networkManager?.isHost) {
      this._netStateTimer -= dt;
      if (this._netStateTimer <= 0) {
        this._netStateTimer = this._netStatePeriod;
        this.networkManager.broadcastState(this.serializeNetState());
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _getAveragePlayerPos() {
    const alive = this.players.filter(p => p.alive);
    if (alive.length === 0) return { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
    return {
      x: alive.reduce((s, p) => s + p.x, 0) / alive.length,
      y: alive.reduce((s, p) => s + p.y, 0) / alive.length,
    };
  }

  _getNearestAlivePlayer(x, y) {
    let nearest = null, minDist = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = distance(p.x, p.y, x, y);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest || this.players[0];
  }

  _getTargetForEnemy(enemy) {
    // If a taunt is active, enemies within taunt radius target the taunting player
    if (this._tauntingPlayer) {
      const d = distance(enemy.x, enemy.y, this._tauntingPlayer.x, this._tauntingPlayer.y);
      if (d < this._tauntingPlayer.passiveState.tauntRadius) {
        return this._tauntingPlayer;
      }
    }
    return this._getNearestAlivePlayer(enemy.x, enemy.y);
  }

  _queueChest(playerIndex, minRarity = 'rare') {
    if (this._activeLevelUpPlayer === -1 && this._activeChestPlayer === -1) {
      this._activeChestPlayer = playerIndex;
      this.paused = true;
      const choices = this.playerUpgrade[playerIndex].getChoices(this.players[playerIndex], 3, minRarity);
      if (this.callbacks.onLevelUp) this.callbacks.onLevelUp(choices, true, playerIndex);
    } else {
      this._levelUpQueue.push({ playerIndex, isChest: true, minRarity });
    }
  }

  _onPickupCollected(pickup, player, playerIndex) {
    if (pickup.type === 'heart') {
      player.vampireHeal(PICKUP.HEART_HEAL);
      this.damageNumbers.addText(player.x, player.y - 40, `+${PICKUP.HEART_HEAL} HP`, '#ff4466');
      this.audio.playCollect();
    } else if (pickup.type === 'magnet') {
      this.gems.forEach(g => { g.attracted = true; });
      this.damageNumbers.addText(player.x, player.y - 40, 'AIMANT!', '#88aaff');
      this.audio.playLevelUp();
    } else if (pickup.type === 'chest') {
      this._queueChest(playerIndex, 'rare');
    }
  }

  _onEnemyKilled(enemy, killer = null) {
    if (enemy._deathProcessed) return;
    enemy._deathProcessed = true;
    this.killCount++;
    this.combo.onKill();
    this.particles.spawnDeath(enemy.x, enemy.y, enemy.color || '#888');

    // Determine killer player (use nearest if unknown)
    const killerPlayer = killer || this._getNearestAlivePlayer(enemy.x, enemy.y);
    killerPlayer.onKill(false);

    // Lucky: 3% heart drop
    if (killerPlayer.luckyHeartRoll()) {
      this.pickups.push(new Pickup(enemy.x, enemy.y, 'heart'));
    }

    // Objective tracking
    const objReward = this.objectives.onKill();
    if (objReward?.reward === 'extra_upgrade') {
      const pIdx = this.players.indexOf(killerPlayer);
      this._queueChest(pIdx >= 0 ? pIdx : 0, objReward.rarity || 'epic');
    }

    if (enemy.xpDrops) {
      const gemMult = (killerPlayer.charData?.passive?.id === 'luck' && Math.random() < 0.15) ? 3 : 1;
      enemy.xpDrops.forEach(drop => {
        for (let i = 0; i < drop.count; i++) {
          const ox = (Math.random() - 0.5) * 20;
          const oy = (Math.random() - 0.5) * 20;
          this.gems.push(new XPGem(enemy.x + ox, enemy.y + oy, drop.value * gemMult));
        }
      });
    }

    const roll = Math.random();
    if (roll < PICKUP.HEART_CHANCE) {
      this.pickups.push(new Pickup(enemy.x, enemy.y, 'heart'));
    } else if (roll < PICKUP.HEART_CHANCE + PICKUP.MAGNET_CHANCE) {
      this.pickups.push(new Pickup(enemy.x, enemy.y, 'magnet'));
    }
  }

  _onLevelUp(playerIndex, count) {
    const player = this.players[playerIndex];
    player.triggerLevelUpEffect();
    this.particles.spawnLevelUp(player.x, player.y);
    this.audio.playLevelUp();
    this.flashAlpha = 0.35;
    this.playerUpgrade[playerIndex].queueLevelUp(count);

    if (this._activeLevelUpPlayer === -1 && this._activeChestPlayer === -1) {
      this._activeLevelUpPlayer = playerIndex;
      this.paused = true;
      this._pauseDrawDone = false;
      const choices = this.playerUpgrade[playerIndex].getChoices(player, 3);
      // Network: if guest player, send to their client instead of local UI
      if (this.networkManager?.isHost && playerIndex !== this.localPlayerIndex) {
        this.networkManager.sendLevelUpRequest(playerIndex, choices, false);
      } else if (this.callbacks.onLevelUp) {
        this.callbacks.onLevelUp(choices, false, playerIndex);
      }
    } else {
      this._levelUpQueue.push({ playerIndex, isChest: false });
    }
  }

  _onGameOver() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    if (this.callbacks.onGameOver) {
      // Collect stats across all players
      const firstPlayer = this.players[0];
      const allWeapons = [...new Set(this.players.flatMap(p => p.weapons.map(w => w.data.name)))];
      this.callbacks.onGameOver({
        elapsed:     this.elapsed,
        kills:       this.killCount,
        level:       this.playerXP[0].level,
        totalDamage: this.totalDamage,
        weapons:     allWeapons,
        bossKills:   this.bossKills,
        maxCombo:    this.combo.maxCount,
        charData:    firstPlayer.charData,
        startWeapon: firstPlayer.weapons[0]?.data?.name || '?',
        isCoop:      this.isCoop,
        players:     this.players.map((p, i) => ({
          charData: p.charData,
          level:    this.playerXP[i].level,
          weapons:  p.weapons.map(w => w.data.name),
        })),
      });
    }
  }

  _sendStatsUpdate() {
    if (!this.callbacks.onStatsUpdate) return;

    const playersData = this.players.map((p, idx) => {
      const xpSys = this.playerXP[idx];
      const ps    = p.passiveState;
      return {
        hp:             Math.ceil(p.hp),
        maxHp:          p.maxHp,
        xp:             xpSys.xp,
        xpToNext:       xpSys.xpToNext,
        level:          xpSys.level,
        weapons:        p.weapons.map(w => ({ id: w.id, level: w.level, icon: w.data.icon })),
        dashCooldownPct:p.dashCooldownTimer / p.dashCooldown,
        dashActive:     p.dashActive,
        charData:       p.charData,
        alive:          p.alive,
        passiveInfo: {
          rageStacks:      ps.rageStacks || 0,
          overclockActive: ps.overclockActive || false,
          overclockTimer:  ps.overclockTimer   || 0,
          tauntActive:     ps.tauntActive       || false,
        },
      };
    });

    const base = playersData[0];

    this.callbacks.onStatsUpdate({
      // Backwards-compat solo fields
      hp:             base.hp,
      maxHp:          base.maxHp,
      xp:             base.xp,
      xpToNext:       base.xpToNext,
      level:          base.level,
      weapons:        base.weapons,
      dashCooldownPct:base.dashCooldownPct,
      dashActive:     base.dashActive,
      charData:       base.charData,
      passiveInfo:    base.passiveInfo,

      // Shared stats
      elapsed:      this.elapsed,
      kills:        this.killCount,
      combo:        this.combo.count,
      waveNumber:   Math.floor(this.elapsed / 60) + 1,
      nextMiniBossIn: Math.max(0, 60000 - this.spawner.miniBossTimer) / 1000,
      bossHp:       this.activeBoss ? this.activeBoss.hp    : null,
      bossMaxHp:    this.activeBoss ? this.activeBoss.maxHp : null,
      bossName:     this.activeBoss ? this.activeBoss.name  : null,
      muted:        this.audio.muted,

      // Co-op multi-player data
      isCoop:  this.isCoop,
      players: playersData,
    });
  }

  // ── Drawing ────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    this.camera.apply(ctx);

    this._drawGrid(ctx);
    this._decorations.forEach(d => {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#334';
      ctx.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
      ctx.restore();
    });
    ctx.strokeStyle = '#334466';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    this.particles.draw(ctx);
    this.gems.forEach(g => g.draw(ctx));
    this.pickups.forEach(p => p.draw(ctx));

    // Draw weapons for each alive player
    this.players.forEach(player => {
      if (!player.alive) return;
      player.weapons.forEach(wep => { if (wep.draw) wep.draw(ctx, player); });
    });
    this.projectiles.forEach(p => { if (p.alive) p.draw(ctx); });
    this.enemies.forEach(e => { if (e.alive) e.draw(ctx); });
    this.players.forEach(player => { if (player.alive) player.draw(ctx); });
    this.damageNumbers.draw(ctx);

    ctx.restore();

    // Screen-space overlays
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.flashAlpha);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    this.combo.draw(ctx, w, h);
    this.objectives.draw(ctx, w, h);
    this._drawOffScreenIndicators(ctx, w, h);
    this._drawBossWarning(ctx, w, h);
    this._drawMiniMap(ctx, w, h);
  }

  _drawGrid(ctx) {
    const step = 50;
    ctx.strokeStyle = '#22223a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = Math.floor(this.camera.x / step) * step;
    const startY = Math.floor(this.camera.y / step) * step;
    for (let x = startX; x < this.camera.x + this.camera.width + step; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT);
    }
    for (let y = startY; y < this.camera.y + this.camera.height + step; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y);
    }
    ctx.stroke();
  }

  _drawOffScreenIndicators(ctx, screenW, screenH) {
    const margin = 22;
    const camX = this.camera.x + this.camera.shakeX;
    const camY = this.camera.y + this.camera.shakeY;

    const dirs = Array.from({ length: 8 }, () => ({ count: 0, hasBoss: false, isMajor: false }));
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const sx = e.x - camX, sy = e.y - camY;
      if (sx >= -20 && sx <= screenW + 20 && sy >= -20 && sy <= screenH + 20) return;
      const angle  = Math.atan2(sy - screenH / 2, sx - screenW / 2);
      const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
      dirs[sector].count++;
      if (e.isBoss)      dirs[sector].hasBoss = true;
      if (e.isMajorBoss) dirs[sector].isMajor = true;
    });

    dirs.forEach((dir, i) => {
      if (dir.count === 0) return;
      const angle = (i / 8) * Math.PI * 2 - Math.PI;
      const cx = screenW / 2 + Math.cos(angle) * (screenW * 0.45);
      const cy = screenH / 2 + Math.sin(angle) * (screenH * 0.42);
      const ax = Math.max(margin, Math.min(screenW - margin, cx));
      const ay = Math.max(margin, Math.min(screenH - margin, cy));
      const arrowSize = dir.hasBoss ? 14 : 9;
      const color     = dir.isMajor ? '#ffaa00' : dir.hasBoss ? '#ff8800' : '#ff4444';
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle   = color;
      ctx.globalAlpha = dir.hasBoss ? 0.95 : 0.65;
      ctx.shadowBlur  = dir.hasBoss ? 10 : 0;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(arrowSize, 0);
      ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.5);
      ctx.lineTo(-arrowSize * 0.6,  arrowSize * 0.5);
      ctx.closePath();
      ctx.fill();
      if (dir.hasBoss) {
        ctx.rotate(-angle);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText('BOSS', 0, arrowSize + 12);
      }
      ctx.restore();
    });
  }

  _drawBossWarning(ctx, screenW, screenH) {
    if (this.bossWarningTimer <= 0) return;
    const flash = Math.floor(this.bossWarningTimer / 380) % 2 === 0;
    if (!flash) return;
    ctx.save();
    ctx.textAlign  = 'center';
    ctx.font       = 'bold 26px monospace';
    ctx.fillStyle  = '#ff2222';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#ff0000';
    ctx.fillText(`⚠ ${this.bossWarningType} INCOMING ⚠`, screenW / 2, 110);
    ctx.restore();
  }

  _drawMiniMap(ctx, screenW, screenH) {
    const mapSize = 150, pad = 16, weaponBarH = 80;
    const mapX = screenW - mapSize - pad;
    const mapY = screenH - mapSize - pad - weaponBarH;
    const scaleX = mapSize / WORLD.WIDTH;
    const scaleY = mapSize / WORLD.HEIGHT;

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle   = '#080818';
    ctx.strokeStyle = '#334466';
    ctx.lineWidth   = 1;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    this.pickups.forEach(p => {
      if (!p.alive || p.type !== 'chest') return;
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(mapX + p.x * scaleX - 2, mapY + p.y * scaleY - 2, 4, 4);
    });

    this.enemies.forEach(e => {
      if (!e.alive || !e.isBoss) return;
      ctx.fillStyle = e.isMajorBoss ? '#ffaa00' : '#ff4444';
      ctx.beginPath();
      ctx.arc(mapX + e.x * scaleX, mapY + e.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // All players on minimap
    this.players.forEach(player => {
      if (!player.alive) return;
      ctx.globalAlpha = 1;
      ctx.fillStyle = player.charData?.color || '#4488ff';
      ctx.beginPath();
      ctx.arc(mapX + player.x * scaleX, mapY + player.y * scaleY, player.playerIndex === 0 ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.stroke();
    });

    ctx.restore();
  }
}
