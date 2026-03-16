import React, { useRef, useState, useEffect, useCallback } from 'react';
import './App.css';
import { Game } from './game/Game.js';
import { MetaProgression } from './systems/MetaProgression.js';
import { NetworkManager } from './network/NetworkManager.js';
import HUD from './ui/HUD.jsx';
import BossHealthBar from './ui/BossHealthBar.jsx';
import TitleScreen from './ui/TitleScreen.jsx';
import GameOverScreen from './ui/GameOverScreen.jsx';
import LevelUpMenu from './ui/LevelUpMenu.jsx';
import CharacterSelectScreen from './ui/CharacterSelectScreen.jsx';
import WeaponSelectScreen from './ui/WeaponSelectScreen.jsx';
import PauseMenu from './ui/PauseMenu.jsx';
import UpgradeShopScreen from './ui/UpgradeShopScreen.jsx';
import WeaponShopScreen from './ui/WeaponShopScreen.jsx';
import LobbyScreen from './ui/LobbyScreen.jsx';

/*
  screens:
    title | shop | weaponShop
    | characterSelect | weaponSelect                 (solo)
    | coopChar1 | coopWeapon1 | coopChar2 | coopWeapon2  (local coop)
    | lobbyCreate | lobbyJoin                         (network lobby)
    | netCharSelect | netWeaponSelect                 (network host char pick)
    | netGuestCharSelect | netGuestWeaponSelect       (network guest char pick)
    | netWaiting                                      (waiting for all players to be ready)
    | playing | levelup | paused | gameover
*/

const meta = new MetaProgression();

export default function App() {
  const canvasRef = useRef(null);
  const gameRef   = useRef(null);
  const netRef    = useRef(null); // NetworkManager

  const [screen,           setScreen]           = useState('title');
  const [hudStats,         setHudStats]         = useState(null);
  const [levelUpChoices,   setLevelUpChoices]   = useState(null);
  const [levelUpIsChest,   setLevelUpIsChest]   = useState(false);
  const [levelUpPlayerIdx, setLevelUpPlayerIdx] = useState(0);
  const [gameOverStats,    setGameOverStats]     = useState(null);
  const [selectedChar,     setSelectedChar]     = useState(null);
  const [netWaitingMsg,    setNetWaitingMsg]    = useState('');

  // Local coop state
  const [coopChar1,   setCoopChar1]   = useState(null);
  const [coopChar2,   setCoopChar2]   = useState(null);
  const [coopWeapon1, setCoopWeapon1] = useState(null);
  const [gameMode,    setGameMode]    = useState('solo');

  // Network state
  const [netPlayerList,  setNetPlayerList]  = useState([]);
  const [netMyIndex,     setNetMyIndex]     = useState(0);
  const [netLobbyMode,   setNetLobbyMode]   = useState('create');
  const [netHostChar,    setNetHostChar]    = useState(null);
  const [netGuestChar,   setNetGuestChar]   = useState(null);
  // Store host config until all guests ready
  const netHostConfigRef = useRef(null);

  const [essenceEarned,  setEssenceEarned] = useState(null);
  const [, forceEssenceUpdate] = useState(0);
  const [currentBest, setCurrentBest] = useState(() => {
    const s = localStorage.getItem('bonkSurvivorBest');
    return s ? parseFloat(s) : 0;
  });

  const applyMeta = useCallback((charData) => meta.applyToCharData(charData), []);

  // ── Destroy old game ───────────────────────────────────────────────
  const destroyGame = useCallback(() => {
    if (gameRef.current) { gameRef.current.destroy(); gameRef.current = null; }
  }, []);

  const destroyNet = useCallback(() => {
    if (netRef.current) { netRef.current.destroy(); netRef.current = null; }
  }, []);

  // ── Launch game (host or solo) ─────────────────────────────────────
  const launchGame = useCallback((playerConfigs, networkManager = null, localPlayerIndex = 0) => {
    destroyGame();
    setHudStats(null);
    setLevelUpChoices(null);
    setGameOverStats(null);
    setEssenceEarned(null);
    setScreen('playing');

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const game = new Game(canvas, {
        onStatsUpdate: (stats) => setHudStats(stats),

        onLevelUp: (choices, isChest, playerIndex = 0) => {
          setLevelUpChoices(choices);
          setLevelUpIsChest(!!isChest);
          setLevelUpPlayerIdx(playerIndex);
          setScreen('levelup');
        },

        onResumeGame: () => {
          setScreen('playing');
          setLevelUpChoices(null);
        },

        onPauseToggle: (isPaused) => {
          setScreen(isPaused ? 'paused' : 'playing');
        },

        onBossSpawn: () => {},
        onBossKill:  () => {},

        onGameOver: (stats) => {
          const earned = meta.earnFromRun({
            kills: stats.kills, bossKills: stats.bossKills,
            elapsed: stats.elapsed, level: stats.level,
            playerCount: playerConfigs.length,
          });
          setEssenceEarned(earned);
          forceEssenceUpdate(n => n + 1);
          setGameOverStats(stats);
          setScreen('gameover');
          if (stats.elapsed > currentBest) {
            setCurrentBest(stats.elapsed);
            localStorage.setItem('bonkSurvivorBest', stats.elapsed.toString());
          }
          // Network: host broadcasts game over
          networkManager?.broadcastGameOver(stats);
        },
      }, {
        players: playerConfigs,
        networkManager,
        isNetworkHost: networkManager?.isHost ?? false,
        localPlayerIndex,
      });

      gameRef.current = game;

      // Wire up incoming network events
      if (networkManager) {
        networkManager.onInputReceived = (playerIndex, inputObj) => {
          game.applyRemoteInput(playerIndex, inputObj);
        };
        networkManager.onLevelUpChoice = (choice, playerIndex) => {
          game.applyUpgrade(choice, playerIndex);
        };
      }
    }, 0);
  }, [currentBest, destroyGame]);

  // ── Guest game (render-only + client-side prediction) ─────────────
  const launchGuestGame = useCallback((playerConfigs, networkManager, localPlayerIndex) => {
    destroyGame();
    setHudStats(null);
    setLevelUpChoices(null);
    setGameOverStats(null);
    setScreen('playing');

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const game = new Game(canvas, {
        onStatsUpdate: (stats) => setHudStats(stats),
        onLevelUp: (choices, isChest, playerIndex) => {
          setLevelUpChoices(choices);
          setLevelUpIsChest(!!isChest);
          setLevelUpPlayerIdx(playerIndex);
          setScreen('levelup');
        },
        onResumeGame: () => { setScreen('playing'); setLevelUpChoices(null); },
        onPauseToggle: () => {},
        onBossSpawn: () => {},
        onBossKill:  () => {},
        onGameOver: (stats) => { setGameOverStats(stats); setScreen('gameover'); },
      }, {
        players: playerConfigs,
        networkManager,
        isNetworkHost: false,
        localPlayerIndex,
      });

      gameRef.current = game;

      // Guest: receive state updates
      networkManager.onStateUpdate = (state) => {
        game.applyNetworkState(state);
        game._pauseDrawDone = false;
      };

      // Guest: receive level-up request
      networkManager.onLevelUpRequest = (choices, isChest, playerIndex) => {
        setLevelUpChoices(choices);
        setLevelUpIsChest(!!isChest);
        setLevelUpPlayerIdx(playerIndex);
        setScreen('levelup');
        game.pause();
      };

      networkManager.onGameOver = (stats) => {
        setGameOverStats(stats);
        setScreen('gameover');
      };

      // Guest: select_phase = host wants a replay
      networkManager.onSelectPhase = () => {
        destroyGame();
        setNetGuestChar(null);
        setScreen('netGuestCharSelect');
      };

      // Guest: send local input to host every frame
      let rafId;
      const sendInputLoop = () => {
        if (!game.running) return;
        const input = game.playerInputs[localPlayerIndex];
        if (input) {
          const { dx, dy } = input.getMovement();
          const dash = input.consumeJustPressedDash();
          networkManager.sendInput({ dx, dy, dash });
        }
        rafId = requestAnimationFrame(sendInputLoop);
      };
      rafId = requestAnimationFrame(sendInputLoop);

      const origDestroy = game.destroy.bind(game);
      game.destroy = () => { cancelAnimationFrame(rafId); origDestroy(); };
    }, 0);
  }, [destroyGame]);

  // ── Solo flow ──────────────────────────────────────────────────────
  const handleTitlePlay  = useCallback(() => { setGameMode('solo'); setScreen('characterSelect'); }, []);
  const handleCharSelect = useCallback((char) => { setSelectedChar(char); setScreen('weaponSelect'); }, []);
  const handleWeaponSelect = useCallback((weaponId) => {
    launchGame([{ charData: applyMeta(selectedChar), startWeapon: weaponId, startWeaponTier: meta.getWeaponTier(weaponId) }]);
  }, [selectedChar, launchGame, applyMeta]);
  const handleWeaponBack = useCallback(() => setScreen('characterSelect'), []);

  // ── Local co-op flow ───────────────────────────────────────────────
  const handleTitleCoop    = useCallback(() => { setGameMode('coop'); setCoopChar1(null); setCoopChar2(null); setCoopWeapon1(null); setScreen('coopChar1'); }, []);
  const handleCoopChar1    = useCallback((char) => { setCoopChar1(char); setScreen('coopWeapon1'); }, []);
  const handleCoopWeapon1  = useCallback((wid)  => { setCoopWeapon1(wid); setScreen('coopChar2'); }, []);
  const handleCoopChar2    = useCallback((char) => { setCoopChar2(char); setScreen('coopWeapon2'); }, []);
  const handleCoopWeapon2  = useCallback((wid)  => {
    launchGame([
      { charData: applyMeta(coopChar1), startWeapon: coopWeapon1, startWeaponTier: meta.getWeaponTier(coopWeapon1) },
      { charData: applyMeta(coopChar2), startWeapon: wid, startWeaponTier: meta.getWeaponTier(wid) },
    ]);
  }, [coopChar1, coopChar2, coopWeapon1, launchGame, applyMeta]);

  // ── Network lobby flow ─────────────────────────────────────────────
  const handleTitleNetwork = useCallback((mode) => {
    setGameMode('network');
    destroyNet();
    netRef.current = new NetworkManager();
    setNetLobbyMode(mode);
    setNetPlayerList([]);
    setScreen(mode === 'create' ? 'lobbyCreate' : 'lobbyJoin');
  }, [destroyNet]);

  // Lobby "start" → host sends select_phase, everyone goes to char select
  const handleLobbyStart = useCallback((playerList) => {
    setNetPlayerList(playerList);
    setNetMyIndex(0);
    const nm = netRef.current;
    if (nm) {
      nm.startSelectionPhase(); // tell guests to go to char select
    }
    setNetHostChar(null);
    setScreen('netCharSelect');
  }, []);

  // ── Network host character + weapon selection ──────────────────────
  const handleNetCharSelect = useCallback((char) => {
    setNetHostChar(char);
    setScreen('netWeaponSelect');
  }, []);

  const handleNetWeaponSelect = useCallback((weaponId) => {
    const nm = netRef.current;
    const hostConfig = {
      charData: applyMeta(netHostChar),
      startWeapon: weaponId,
      startWeaponTier: meta.getWeaponTier(weaponId),
    };
    netHostConfigRef.current = hostConfig;

    // If no guests, start immediately
    const guestCount = netPlayerList.length - 1;
    if (guestCount <= 0) {
      const configs = [hostConfig];
      nm.startGame(configs);
      launchGame(configs, nm, 0);
      return;
    }

    // Wait for all guests to be ready
    setNetWaitingMsg('En attente des autres joueurs…');
    setScreen('netWaiting');

    nm.onAllPlayersReady = (guestSelections) => {
      const configs = netPlayerList.map((p, i) => {
        if (i === 0) return hostConfig;
        const sel = guestSelections[i];
        if (sel) {
          return {
            charData: sel.charData,
            startWeapon: sel.startWeapon,
            startWeaponTier: meta.getWeaponTier(sel.startWeapon),
          };
        }
        return { charData: null, startWeapon: 'orb' };
      });
      nm.startGame(configs);
      launchGame(configs, nm, 0);
    };
  }, [netHostChar, netPlayerList, applyMeta, launchGame]);

  // ── Network guest character + weapon selection ─────────────────────

  // When guest is in lobby and receives select_phase, go to char select
  useEffect(() => {
    if (gameMode === 'network' && netRef.current && !netRef.current.isHost) {
      const nm = netRef.current;
      nm.onSelectPhase = () => {
        setNetPlayerList(nm.playerList);
        setNetGuestChar(null);
        setScreen('netGuestCharSelect');
      };
    }
  }, [gameMode]);

  const handleNetGuestWeaponSelect = useCallback((weaponId) => {
    const char = applyMeta(netGuestChar);
    const nm = netRef.current;

    // Tell host we are ready
    nm?.sendPlayerReady(char, weaponId);

    // Wait for host to start the game
    setNetWaitingMsg('Sélection confirmée ! En attente du démarrage…');
    setScreen('netWaiting');

    if (nm) {
      nm.onGameStart = (playerConfigs, myIndex) => {
        setNetMyIndex(myIndex);
        launchGuestGame(playerConfigs, nm, myIndex);
      };
    }
  }, [netGuestChar, applyMeta, launchGuestGame]);

  // ── Shops ──────────────────────────────────────────────────────────
  const handleTitleShop       = useCallback(() => setScreen('shop'), []);
  const handleShopClose       = useCallback(() => setScreen('title'), []);
  const handleTitleWeaponShop = useCallback(() => setScreen('weaponShop'), []);
  const handleWeaponShopClose = useCallback(() => setScreen('title'), []);

  // ── In-game actions ────────────────────────────────────────────────
  const handleUpgradeChoice = useCallback((choice) => {
    if (!gameRef.current) return;
    if (gameMode === 'network' && !netRef.current?.isHost) {
      // Guest: send choice to host
      netRef.current?.sendLevelUpChoice(choice, levelUpPlayerIdx);
      setScreen('playing');
      setLevelUpChoices(null);
      gameRef.current.resume();
    } else {
      gameRef.current.applyUpgrade(choice, levelUpPlayerIdx);
    }
  }, [levelUpPlayerIdx, gameMode]);

  const handleToggleMute  = useCallback(() => { if (gameRef.current) gameRef.current.toggleMute(); }, []);
  const handlePauseResume = useCallback(() => {
    if (gameRef.current) { gameRef.current.toggleManualPause(); setScreen('playing'); }
  }, []);
  const handlePauseQuit   = useCallback(() => { destroyGame(); destroyNet(); setScreen('title'); }, [destroyGame, destroyNet]);

  // ── Game over ──────────────────────────────────────────────────────
  const handleReplay = useCallback(() => { setScreen('characterSelect'); setGameMode('solo'); }, []);

  const handleReplaySameChar = useCallback(() => {
    if (gameMode === 'network') {
      const nm = netRef.current;
      if (nm?.isHost) {
        // Host: destroy game, tell guests to re-select, go to char select
        destroyGame();
        nm.broadcastReplay();
        setNetHostChar(null);
        setScreen('netCharSelect');
      } else {
        // Guest: destroy game, wait for host's select_phase
        destroyGame();
        setNetWaitingMsg('En attente que l\'hôte relance la partie…');
        setScreen('netWaiting');
        if (nm) {
          nm.onSelectPhase = () => {
            setNetGuestChar(null);
            setScreen('netGuestCharSelect');
          };
        }
      }
    } else if (gameMode === 'coop') {
      setScreen('coopChar1');
    } else if (selectedChar) {
      setScreen('weaponSelect');
    } else {
      setScreen('characterSelect');
    }
  }, [gameMode, selectedChar, destroyGame]);

  const handleMenu = useCallback(() => { destroyGame(); destroyNet(); setScreen('title'); }, [destroyGame, destroyNet]);

  useEffect(() => () => { destroyGame(); destroyNet(); }, []);

  const isGameCanvas = ['playing', 'levelup', 'paused'].includes(screen);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0a0a1a' }}>

      <canvas
        ref={canvasRef}
        style={{ display: isGameCanvas ? 'block' : 'none', position: 'absolute', top: 0, left: 0 }}
      />

      {isGameCanvas && hudStats && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
          <HUD stats={hudStats} onToggleMute={handleToggleMute} />
          <BossHealthBar stats={hudStats} />
        </div>
      )}

      {screen === 'levelup' && levelUpChoices && (
        <LevelUpMenu
          choices={levelUpChoices}
          onChoose={handleUpgradeChoice}
          level={hudStats?.players?.[levelUpPlayerIdx]?.level || hudStats?.level || 1}
          isChest={levelUpIsChest}
          playerLabel={gameMode !== 'solo' ? `Joueur ${levelUpPlayerIdx + 1}` : null}
        />
      )}

      {screen === 'paused' && (
        <PauseMenu stats={hudStats} onResume={handlePauseResume} onQuit={handlePauseQuit} />
      )}

      {screen === 'title' && (
        <TitleScreen
          onPlay={handleTitlePlay}
          onCoop={() => handleTitleCoop()}
          onNetworkCreate={() => handleTitleNetwork('create')}
          onNetworkJoin={() => handleTitleNetwork('join')}
          onShop={handleTitleShop}
          onWeaponShop={handleTitleWeaponShop}
          bestScore={currentBest}
          essence={meta.essence}
          gold={meta.gold}
        />
      )}

      {screen === 'shop'       && <UpgradeShopScreen meta={meta} onClose={handleShopClose} />}
      {screen === 'weaponShop' && <WeaponShopScreen  meta={meta} onClose={handleWeaponShopClose} />}

      {/* Solo */}
      {screen === 'characterSelect' && <CharacterSelectScreen onSelect={handleCharSelect} />}
      {screen === 'weaponSelect' && selectedChar && (
        <WeaponSelectScreen character={selectedChar} onSelect={handleWeaponSelect} onBack={handleWeaponBack} />
      )}

      {/* Local co-op */}
      {screen === 'coopChar1' && <CharacterSelectScreen onSelect={handleCoopChar1} title="CO-OP — Joueur 1" playerColor="#4488ff" />}
      {screen === 'coopWeapon1' && coopChar1 && <WeaponSelectScreen character={coopChar1} onSelect={handleCoopWeapon1} onBack={() => setScreen('coopChar1')} title="CO-OP — J1 : arme" playerColor="#4488ff" />}
      {screen === 'coopChar2' && <CharacterSelectScreen onSelect={handleCoopChar2} title="CO-OP — Joueur 2" playerColor="#ffaa44" />}
      {screen === 'coopWeapon2' && coopChar2 && <WeaponSelectScreen character={coopChar2} onSelect={handleCoopWeapon2} onBack={() => setScreen('coopChar2')} title="CO-OP — J2 : arme" playerColor="#ffaa44" />}

      {/* Network lobbies */}
      {(screen === 'lobbyCreate' || screen === 'lobbyJoin') && netRef.current && (
        <LobbyScreen
          mode={netLobbyMode}
          networkManager={netRef.current}
          onStart={handleLobbyStart}
          onBack={() => { destroyNet(); setScreen('title'); }}
        />
      )}

      {/* Network host char/weapon select */}
      {screen === 'netCharSelect' && (
        <CharacterSelectScreen onSelect={handleNetCharSelect} title="RÉSEAU — Votre personnage (Hôte)" playerColor="#4488ff" />
      )}
      {screen === 'netWeaponSelect' && netHostChar && (
        <WeaponSelectScreen character={netHostChar} onSelect={handleNetWeaponSelect} onBack={() => setScreen('netCharSelect')} title="RÉSEAU — Votre arme" playerColor="#4488ff" />
      )}

      {/* Network guest char/weapon select */}
      {screen === 'netGuestCharSelect' && (
        <CharacterSelectScreen
          onSelect={(char) => { setNetGuestChar(char); setScreen('netGuestWeaponSelect'); }}
          title="RÉSEAU — Votre personnage"
          playerColor={['#4488ff','#ffaa44','#44ff88','#ff44aa'][netMyIndex] || '#fff'}
        />
      )}
      {screen === 'netGuestWeaponSelect' && netGuestChar && (
        <WeaponSelectScreen
          character={netGuestChar}
          onSelect={handleNetGuestWeaponSelect}
          onBack={() => setScreen('netGuestCharSelect')}
          title="RÉSEAU — Votre arme"
          playerColor={['#4488ff','#ffaa44','#44ff88','#ff44aa'][netMyIndex] || '#fff'}
        />
      )}

      {/* Waiting screen (network: after selection, before game start) */}
      {screen === 'netWaiting' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0a0a1a',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: 40, marginBottom: 24, animation: 'spin 1.5s linear infinite' }}>⟳</div>
          <p style={{ fontSize: 18, color: '#aaaaff' }}>{netWaitingMsg || 'Chargement…'}</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {screen === 'gameover' && (
        <GameOverScreen
          stats={gameOverStats}
          onReplay={handleReplay}
          onReplaySameChar={handleReplaySameChar}
          onMenu={handleMenu}
          essenceEarned={essenceEarned}
          isCoop={gameMode !== 'solo'}
        />
      )}
    </div>
  );
}
