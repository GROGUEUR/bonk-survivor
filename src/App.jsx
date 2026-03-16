import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
    | netCharSelect | netWeaponSelect                 (network char pick)
    | netWaiting                                      (guest waiting)
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

  // Local coop state
  const [coopChar1,   setCoopChar1]   = useState(null);
  const [coopWeapon1, setCoopWeapon1] = useState(null);
  const [coopChar2,   setCoopChar2]   = useState(null);
  const [gameMode,    setGameMode]    = useState('solo');

  // Network state
  const [netPlayerList,  setNetPlayerList]  = useState([]);
  const [netMyIndex,     setNetMyIndex]     = useState(0);
  const [netLobbyMode,   setNetLobbyMode]   = useState('create'); // 'create'|'join'
  const [netSelections,  setNetSelections]  = useState({}); // playerIndex → {charData, startWeapon}
  const [netGuestScreen, setNetGuestScreen] = useState(''); // what guest sees

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

  // ── Guest game (render-only) ───────────────────────────────────────
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
        game._pauseDrawDone = false; // ensure it redraws
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

      // Guest: send local input to host every frame via requestAnimationFrame
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

  // Host: lobby says "start" with player list
  const handleLobbyStart = useCallback((playerList) => {
    setNetPlayerList(playerList);
    // Each player now selects their character
    // Host selects first (their own)
    setNetMyIndex(0);
    setScreen('netCharSelect');
  }, []);

  // Host character+weapon selection
  const [netHostChar, setNetHostChar] = useState(null);
  const handleNetCharSelect = useCallback((char) => {
    setNetHostChar(char);
    setScreen('netWeaponSelect');
  }, []);

  const handleNetWeaponSelect = useCallback((weaponId) => {
    const char = applyMeta(netHostChar);
    const mySelection = { charData: char, startWeapon: weaponId };
    const nm = netRef.current;

    // Tell guests to select their characters
    // Build player configs: host is P0, guests fill P1..PN
    // We'll wait for all guests' selections
    const allSelections = { 0: mySelection };
    setNetSelections(allSelections);

    // Host broadcasts "start selection phase" to guests
    if (nm) {
      nm.onPlayerList = (list) => setNetPlayerList(list);
    }

    // For simplicity: host starts game with just their config, guests are assigned
    // default config until they send selections. We'll use a simple flow:
    // Host collects selections, then starts game when all ready.
    // Since async selection is complex, use a simpler flow:
    // All players in lobby pre-selected via separate char select UI.
    // We'll just start with what we have and add guests as they connect.

    // Build configs array for all players
    const configs = netPlayerList.map((p, i) => {
      if (i === 0) return { ...mySelection, startWeaponTier: meta.getWeaponTier(weaponId) };
      return { charData: null, startWeapon: 'orb' }; // guests will be assigned after
    });

    nm.startGame(configs);
    setNetMyIndex(0);
    launchGame(configs, nm, 0);
  }, [netHostChar, netPlayerList, applyMeta, launchGame]);

  // Guest: after lobby, select character
  const handleNetGuestCharSelect = useCallback((char) => {
    setNetHostChar(char);
    setScreen('netGuestWeaponSelect');
  }, []);

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
    if (gameMode === 'coop')         setScreen('coopChar1');
    else if (gameMode === 'network') setScreen(netRef.current?.isHost ? 'netCharSelect' : 'netGuestCharSelect');
    else if (selectedChar)           setScreen('weaponSelect');
    else                             setScreen('characterSelect');
  }, [gameMode, selectedChar]);
  const handleMenu = useCallback(() => { destroyGame(); destroyNet(); setScreen('title'); }, [destroyGame, destroyNet]);

  useEffect(() => {
    // Guest: wire up onGameStart when in network non-host mode
    if (gameMode === 'network' && netRef.current && !netRef.current.isHost) {
      const nm = netRef.current;
      nm.onGameStart = (playerConfigs, myIndex) => {
        setNetMyIndex(myIndex);
        // Guest: go to char select to send their selection
        setScreen('netGuestCharSelect');
        // Store configs for later use
        setNetPlayerList(nm.playerList);
      };
    }
  }, [gameMode]);

  // Network guest weapon select → launch guest game
  const [netGuestChar, setNetGuestChar] = useState(null);
  const handleNetGuestWeaponSelect = useCallback((weaponId) => {
    const char = applyMeta(netGuestChar);
    const nm = netRef.current;
    nm?.sendCharacterSelect(char, weaponId);

    // Build a local player config for rendering — guest's player at their index
    const configs = netPlayerList.map((_, i) => ({ charData: null, startWeapon: 'orb' }));
    configs[netMyIndex] = { charData: char, startWeapon: weaponId, startWeaponTier: meta.getWeaponTier(weaponId) };

    launchGuestGame(configs, nm, netMyIndex);
  }, [netGuestChar, netPlayerList, netMyIndex, applyMeta, launchGuestGame]);

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
