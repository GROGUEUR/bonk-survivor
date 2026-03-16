import React, { useState, useEffect, useRef } from 'react';
import './LobbyScreen.css';

const PLAYER_COLORS = ['#4488ff', '#ffaa44', '#44ff88', '#ff44aa'];

export default function LobbyScreen({
  mode,           // 'create' | 'join'
  networkManager,
  onStart,        // host only: called with playerList when all selected
  onBack,
  onError,
}) {
  const [status,     setStatus]     = useState(mode === 'create' ? 'opening' : 'form');
  const [roomCode,   setRoomCode]   = useState('');
  const [inputCode,  setInputCode]  = useState('');
  const [playerName, setPlayerName] = useState(`Joueur${Math.floor(Math.random()*900+100)}`);
  const [playerList, setPlayerList] = useState([]);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);

  const isHost = mode === 'create';

  useEffect(() => {
    networkManager.onPlayerList = (list) => setPlayerList(list);
    networkManager.onJoined     = (list) => { setPlayerList(list); setStatus('lobby'); };
    networkManager.onError      = (err)  => {
      setError('Connexion échouée : ' + (err?.message || err));
      setStatus('error');
      if (onError) onError(err);
    };

    if (isHost && status === 'opening') {
      networkManager.createRoom(playerName)
        .then(code => { setRoomCode(code); setStatus('lobby'); setPlayerList(networkManager.playerList); })
        .catch(err => { setError('Impossible d\'ouvrir le salon : ' + err); setStatus('error'); });
    }

    return () => {
      networkManager.onPlayerList = null;
      networkManager.onJoined     = null;
    };
  }, []);

  function handleJoin() {
    if (!inputCode.trim()) return;
    setStatus('connecting');
    networkManager.joinRoom(inputCode.trim(), playerName)
      .then(() => setStatus('lobby'))
      .catch(err => { setError('Code invalide ou hôte introuvable. (' + err + ')'); setStatus('form'); });
  }

  function handleStart() {
    if (playerList.length < 1) return;
    onStart(playerList);
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (status === 'opening' || status === 'connecting') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-grid" />
        <div className="lobby-content">
          <div className="lobby-spinner">⟳</div>
          <p className="lobby-status-text">
            {status === 'opening' ? 'Création du salon…' : 'Connexion en cours…'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-grid" />
        <div className="lobby-content">
          <h2 className="lobby-title" style={{ color: '#ff4444' }}>ERREUR</h2>
          <p className="lobby-error-msg">{error}</p>
          <button className="lobby-back-btn" onClick={onBack}>← RETOUR</button>
        </div>
      </div>
    );
  }

  if (status === 'form') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-grid" />
        <div className="lobby-content">
          <h2 className="lobby-title">REJOINDRE UNE PARTIE</h2>
          <div className="lobby-form">
            <label className="lobby-label">Votre pseudo</label>
            <input
              className="lobby-input"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={16}
              placeholder="Pseudo"
            />
            <label className="lobby-label">Code du salon (ID PeerJS de l'hôte)</label>
            <input
              className="lobby-input lobby-code-input"
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              placeholder="Collez l'ID ici…"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            {error && <p className="lobby-error-msg">{error}</p>}
            <div className="lobby-form-btns">
              <button className="lobby-back-btn" onClick={onBack}>← RETOUR</button>
              <button className="lobby-join-btn" onClick={handleJoin} disabled={!inputCode.trim()}>
                REJOINDRE →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // status === 'lobby'
  return (
    <div className="lobby-screen">
      <div className="lobby-bg-grid" />
      <div className="lobby-content">
        <h2 className="lobby-title">{isHost ? 'SALON CRÉÉ' : 'EN ATTENTE…'}</h2>

        {isHost && (
          <div className="lobby-code-box">
            <span className="lobby-code-label">ID à partager avec vos amis :</span>
            <span className="lobby-code-value">{roomCode.toUpperCase()}</span>
            <button className="lobby-copy-btn" onClick={handleCopyCode}>
              {copied ? '✓ Copié !' : 'Copier'}
            </button>
          </div>
        )}

        {!isHost && (
          <p className="lobby-waiting-text">
            Connecté ! En attente que l'hôte lance la partie…
          </p>
        )}

        <div className="lobby-players-box">
          <div className="lobby-players-title">JOUEURS ({playerList.length}/{4})</div>
          {playerList.map((p, i) => (
            <div key={p.id || i} className="lobby-player-row">
              <span className="lobby-player-dot" style={{ background: PLAYER_COLORS[i] }} />
              <span className="lobby-player-name" style={{ color: PLAYER_COLORS[i] }}>
                {p.name}
              </span>
              {i === 0 && <span className="lobby-host-badge">HÔTE</span>}
            </div>
          ))}
          {playerList.length === 0 && (
            <p className="lobby-no-players">Personne connecté pour l'instant…</p>
          )}
        </div>

        <p className="lobby-hint">
          Chaque joueur choisira son personnage et son arme après le lancement.
        </p>

        <div className="lobby-form-btns">
          <button className="lobby-back-btn" onClick={onBack}>← QUITTER</button>
          {isHost && (
            <button
              className="lobby-start-btn"
              onClick={handleStart}
              disabled={playerList.length < 1}
            >
              ▶ LANCER ({playerList.length} joueur{playerList.length > 1 ? 's' : ''})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
