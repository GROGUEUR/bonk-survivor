/**
 * NetworkManager — PeerJS-based P2P lobby + game sync.
 *
 * HOST:  creates room → shares 6-char code → players join → host starts game
 *        sends compressed game state @ 20fps to all guests
 *        receives input packets from guests each frame
 *
 * GUEST: joins with room code → receives lobby updates
 *        sends input packet each frame to host
 *        receives state snapshots and renders them
 *
 * Max 4 players total.
 */

import Peer from 'peerjs';

export const MAX_PLAYERS = 4;

// ---------- Helpers ----------

function generateRoomCode() {
  // 8-char alphanumeric ID — used as both the PeerJS peer ID and the room code
  return Math.random().toString(36).slice(2, 10);
}

// ---------- NetworkManager ----------

export class NetworkManager {
  constructor() {
    this.peer            = null;
    this.isHost          = false;
    this.roomCode        = null;       // short code shown to guests
    this.hostPeerId      = null;       // full peer ID of host
    this.localPlayerIndex= 0;
    this.playerList      = [];         // [{ id, name, index, charData, startWeapon }]
    this._conns          = {};         // peerId → DataConnection (host only)
    this._hostConn       = null;       // single connection to host (guest only)
    this._stateTimer     = 0;

    // Callbacks (set by App or Game)
    this.onOpen           = null;  // (shortCode) — host is open
    this.onJoined         = null;  // (playerList) — guest joined successfully
    this.onPlayerList     = null;  // (playerList) — lobby updated
    this.onGameStart      = null;  // (playerConfigs, myIndex) — start the game
    this.onStateUpdate    = null;  // (state) — guest: received host game state
    this.onInputReceived  = null;  // (playerIndex, inputObj) — host: got guest input
    this.onLevelUpRequest = null;  // (choices, isChest, playerIndex) — guest: choose upgrade
    this.onLevelUpChoice  = null;  // (choice, playerIndex) — host: guest chose
    this.onGameOver       = null;  // (stats) — guest: game is over
    this.onDisconnect     = null;  // (playerIndex)
    this.onError          = null;  // (err)
  }

  // ── HOST ────────────────────────────────────────────────────────────

  async createRoom(hostName) {
    return new Promise((resolve, reject) => {
      const roomCode = generateRoomCode();
      // Use the room code directly as the PeerJS peer ID so guests can connect with it
      this.peer     = new Peer(roomCode);
      this.isHost   = true;
      this.roomCode = roomCode;

      this.peer.on('open', (id) => {
        this.hostPeerId       = id;
        this.localPlayerIndex = 0;
        this.playerList       = [{ id, name: hostName, index: 0 }];

        this.peer.on('connection', (conn) => this._onGuestConnect(conn));
        this.peer.on('error', (e) => { if (this.onError) this.onError(e); });

        if (this.onOpen) this.onOpen(this.roomCode);
        resolve(this.roomCode);
      });

      // If the custom ID is taken, retry with a new one
      this.peer.on('error', (e) => {
        if (e.type === 'unavailable-id') {
          this.peer.destroy();
          this.createRoom(hostName).then(resolve).catch(reject);
        } else {
          reject(e);
        }
      });
    });
  }

  _onGuestConnect(conn) {
    if (this.playerList.length >= MAX_PLAYERS) {
      conn.close();
      return;
    }

    conn.on('open', () => {
      // Assign index
      const index = this.playerList.length;
      conn._playerIndex = index;
      this._conns[conn.peer] = conn;

      conn.on('data', (rawData) => {
        const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        this._onHostReceive(conn, msg);
      });

      conn.on('close', () => {
        delete this._conns[conn.peer];
        this.playerList = this.playerList.filter(p => p.id !== conn.peer);
        // Re-index
        this.playerList.forEach((p, i) => { p.index = i; });
        this._broadcastPlayerList();
        if (this.onDisconnect) this.onDisconnect(conn._playerIndex);
      });
    });
  }

  _onHostReceive(conn, msg) {
    if (msg.type === 'join') {
      this.playerList.push({ id: conn.peer, name: msg.name, index: conn._playerIndex });
      this._broadcastPlayerList();
      if (this.onPlayerList) this.onPlayerList([...this.playerList]);
    } else if (msg.type === 'input') {
      if (this.onInputReceived) this.onInputReceived(conn._playerIndex, msg.input);
    } else if (msg.type === 'char_select') {
      const p = this.playerList.find(x => x.id === conn.peer);
      if (p) { p.charData = msg.charData; p.startWeapon = msg.startWeapon; }
      this._broadcastPlayerList();
      if (this.onPlayerList) this.onPlayerList([...this.playerList]);
    } else if (msg.type === 'levelup_choice') {
      if (this.onLevelUpChoice) this.onLevelUpChoice(msg.choice, conn._playerIndex);
    }
  }

  // Host: tell all guests to start
  startGame(playerConfigs) {
    const packet = JSON.stringify({ type: 'start', players: playerConfigs });
    Object.values(this._conns).forEach((conn, i) => {
      conn.send(JSON.stringify({
        type: 'start',
        players: playerConfigs,
        myIndex: i + 1,
      }));
    });
    // Host starts locally
    if (this.onGameStart) this.onGameStart(playerConfigs, 0);
  }

  // Host: broadcast game state snapshot @ 20fps
  broadcastState(state) {
    const packet = JSON.stringify({ type: 'state', s: state });
    Object.values(this._conns).forEach(conn => conn.send(packet));
  }

  // Host: send level-up choices to a specific guest
  sendLevelUpRequest(playerIndex, choices, isChest) {
    const conn = Object.values(this._conns).find(c => c._playerIndex === playerIndex);
    if (conn) conn.send(JSON.stringify({ type: 'levelup', choices, isChest }));
  }

  // Host: resume game after level-up on guest
  sendResumeAfterLevelUp(playerIndex) {
    const conn = Object.values(this._conns).find(c => c._playerIndex === playerIndex);
    if (conn) conn.send(JSON.stringify({ type: 'resume' }));
  }

  // Host: broadcast game over
  broadcastGameOver(stats) {
    const packet = JSON.stringify({ type: 'gameover', stats });
    Object.values(this._conns).forEach(conn => conn.send(packet));
  }

  _broadcastPlayerList() {
    const conns = Object.values(this._conns);
    conns.forEach((conn, i) => {
      conn.send(JSON.stringify({
        type: 'players',
        players: this.playerList,
        myIndex: i + 1,
      }));
    });
  }

  // ── GUEST ───────────────────────────────────────────────────────────

  async joinRoom(roomCode, guestName) {
    return new Promise((resolve, reject) => {
      this.peer   = new Peer();
      this.isHost = false;

      this.peer.on('open', (myId) => {
        this.localPlayerIndex = -1; // assigned by host

        // Normalize: room codes are stored lowercase
        const normalizedCode = roomCode.trim().toLowerCase();
        const conn = this.peer.connect(normalizedCode, { reliable: true });
        this._hostConn = conn;

        conn.on('open', () => {
          conn.send(JSON.stringify({ type: 'join', name: guestName, id: myId }));
          conn.on('data', (rawData) => {
            const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            this._onGuestReceive(msg);
          });
          conn.on('close', () => { if (this.onDisconnect) this.onDisconnect(0); });
          resolve();
        });

        conn.on('error', reject);
      });

      this.peer.on('error', reject);
    });
  }

  _onGuestReceive(msg) {
    if (msg.type === 'players') {
      this.playerList      = msg.players;
      this.localPlayerIndex = msg.myIndex;
      if (this.onPlayerList) this.onPlayerList([...this.playerList]);
      if (this.onJoined && this.localPlayerIndex !== -1) this.onJoined([...this.playerList]);
    } else if (msg.type === 'start') {
      this.localPlayerIndex = msg.myIndex;
      if (this.onGameStart) this.onGameStart(msg.players, msg.myIndex);
    } else if (msg.type === 'state') {
      if (this.onStateUpdate) this.onStateUpdate(msg.s);
    } else if (msg.type === 'levelup') {
      if (this.onLevelUpRequest) this.onLevelUpRequest(msg.choices, msg.isChest, this.localPlayerIndex);
    } else if (msg.type === 'resume') {
      // Guest can dismiss level-up (handled by App)
    } else if (msg.type === 'gameover') {
      if (this.onGameOver) this.onGameOver(msg.stats);
    }
  }

  // Guest: send input to host each frame
  sendInput(input) {
    if (this._hostConn?.open) {
      this._hostConn.send(JSON.stringify({ type: 'input', input }));
    }
  }

  // Guest: send character selection to host
  sendCharacterSelect(charData, startWeapon) {
    if (this._hostConn?.open) {
      this._hostConn.send(JSON.stringify({ type: 'char_select', charData, startWeapon }));
    }
  }

  // Guest: send upgrade choice to host
  sendLevelUpChoice(choice, playerIndex) {
    if (this._hostConn?.open) {
      this._hostConn.send(JSON.stringify({ type: 'levelup_choice', choice, playerIndex }));
    }
  }

  // ── Shared ──────────────────────────────────────────────────────────

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this._conns   = {};
    this._hostConn = null;
  }
}
