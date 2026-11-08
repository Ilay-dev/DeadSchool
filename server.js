// server.ts
import express from "express";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var rooms = /* @__PURE__ */ new Map();
var clientRoomMap = /* @__PURE__ */ new Map();
function syncUpdatedMapGlbAsset() {
  try {
    const srcGlb = path.join(__dirname, "assets", "timber_campus_building.glb");
    const destMapGlb = path.join(__dirname, "public", "assets", "map.glb");
    const destCampusGlb = path.join(
      __dirname,
      "public",
      "assets",
      "timber_campus_building.glb"
    );
    if (fs.existsSync(srcGlb)) {
      const srcSize = fs.statSync(srcGlb).size;
      const destSize = fs.existsSync(destMapGlb) ? fs.statSync(destMapGlb).size : 0;
      if (srcSize !== destSize) {
        fs.mkdirSync(path.dirname(destMapGlb), { recursive: true });
        fs.copyFileSync(srcGlb, destMapGlb);
        fs.copyFileSync(srcGlb, destCampusGlb);
      }
    }
  } catch {
  }
}
function getLocalLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netList = nets[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}
function broadcastToRoom(wss, roomCode, payload, excludeWs) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      const info = clientRoomMap.get(client);
      if (info && info.roomCode === roomCode) {
        client.send(message);
      }
    }
  });
}
function removeClientFromCurrentRoom(wss, ws) {
  const info = clientRoomMap.get(ws);
  if (!info) return;
  clientRoomMap.delete(ws);
  const room = rooms.get(info.roomCode);
  if (!room) return;
  delete room.players[info.playerId];
  if (room.alphaFlagCarrier === info.playerId) room.alphaFlagCarrier = null;
  if (room.bravoFlagCarrier === info.playerId) room.bravoFlagCarrier = null;
  if (Object.keys(room.players).length === 0) {
    rooms.delete(info.roomCode);
  } else {
    if (room.hostId === info.playerId) {
      const nextHost = Object.keys(room.players)[0];
      room.hostId = nextHost;
      room.players[nextHost].isHost = true;
    }
    broadcastToRoom(wss, info.roomCode, {
      type: "room:state",
      room,
      lanIp: getLocalLanIp()
    });
  }
}
async function startServer() {
  syncUpdatedMapGlbAsset();
  const app = express();
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  app.use(express.json());
  app.get("/api/lan-info", (_req, res) => {
    const activeRooms = Array.from(rooms.values()).map((r) => ({
      roomCode: r.roomCode,
      mapId: r.mapId,
      modeId: r.modeId,
      playerCount: Object.keys(r.players).length,
      isPublic: r.isPublic,
      status: r.status
    }));
    const totalConnectedPlayers = activeRooms.reduce((acc, r) => acc + r.playerCount, 0);
    res.json({
      lanIp: getLocalLanIp(),
      port: 3e3,
      totalConnectedPlayers,
      activeRooms
    });
  });
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch {
        }
      }
    });
  }, 2e4);
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const { type } = msg;
        if (type === "room:join" || type === "room:host") {
          const roomCode = String(msg.roomCode || "WORLD").replace(/[^A-Z0-9_-]/gi, "").toUpperCase().slice(0, 10) || "WORLD";
          const playerId = msg.playerId || `p_${Math.random().toString(36).slice(2, 8)}`;
          const playerName = String(msg.playerName || "Player").slice(0, 24);
          const existingInfo = clientRoomMap.get(ws);
          if (existingInfo && existingInfo.roomCode !== roomCode) {
            removeClientFromCurrentRoom(wss, ws);
          }
          let room = rooms.get(roomCode);
          if (!room) {
            room = {
              roomCode,
              hostId: playerId,
              mapId: msg.mapId || "timber_campus",
              modeId: msg.modeId === "BOTS" ? "TDM" : msg.modeId || "TDM",
              isPublic: msg.isPublic ?? true,
              status: "playing",
              alphaScore: 0,
              bravoScore: 0,
              alphaFlagCarrier: null,
              bravoFlagCarrier: null,
              alphaFlagDroppedPos: null,
              bravoFlagDroppedPos: null,
              players: {}
            };
            rooms.set(roomCode, room);
          }
          const existingPlayers = Object.values(room.players).filter(
            (p) => p.id !== playerId
          );
          const alphaCount = existingPlayers.filter((p) => p.team === "alpha").length;
          const bravoCount = existingPlayers.filter((p) => p.team === "bravo").length;
          const assignedTeam = msg.team || (alphaCount <= bravoCount ? "alpha" : "bravo");
          const defaultPos = assignedTeam === "alpha" ? [2.1, 0.15, 32.5] : [-86, 0.15, -6];
          room.players[playerId] = {
            id: playerId,
            name: playerName,
            team: assignedTeam,
            weaponClass: msg.weaponClass || "assault",
            ready: true,
            hp: room.players[playerId]?.hp ?? 100,
            maxHp: 100,
            kills: room.players[playerId]?.kills ?? 0,
            deaths: room.players[playerId]?.deaths ?? 0,
            position: room.players[playerId]?.position || defaultPos,
            velocity: room.players[playerId]?.velocity || [0, 0, 0],
            rotation: room.players[playerId]?.rotation || [
              0,
              assignedTeam === "alpha" ? Math.PI : 0
            ],
            crouching: false,
            ads: false,
            ridingScooter: false,
            hasFlag: false,
            isHost: room.hostId === playerId,
            lastUpdated: Date.now()
          };
          clientRoomMap.set(ws, { roomCode, playerId });
          ws.send(
            JSON.stringify({
              type: "room:state",
              roomCode,
              room,
              lanIp: getLocalLanIp()
            })
          );
          broadcastToRoom(
            wss,
            roomCode,
            { type: "room:state", roomCode, room, lanIp: getLocalLanIp() },
            ws
          );
        } else if (type === "player:transform") {
          const info = clientRoomMap.get(ws);
          if (!info) return;
          const room = rooms.get(info.roomCode);
          if (!room) return;
          const p = room.players[info.playerId];
          if (!p) return;
          if (Array.isArray(msg.position) && msg.position.length === 3) {
            p.position = msg.position;
          }
          if (Array.isArray(msg.velocity) && msg.velocity.length === 3) {
            p.velocity = msg.velocity;
          }
          if (Array.isArray(msg.rotation) && msg.rotation.length === 2) {
            p.rotation = msg.rotation;
          }
          if (msg.playerName) {
            p.name = String(msg.playerName).slice(0, 24);
          }
          if (msg.team === "alpha" || msg.team === "bravo") {
            p.team = msg.team;
          }
          p.crouching = Boolean(msg.crouching);
          p.ads = Boolean(msg.ads);
          p.ridingScooter = Boolean(msg.ridingScooter);
          p.weaponClass = msg.weaponClass || p.weaponClass;
          p.lastUpdated = Date.now();
          broadcastToRoom(
            wss,
            info.roomCode,
            {
              type: "player:moved",
              roomCode: info.roomCode,
              playerId: info.playerId,
              playerName: p.name,
              team: p.team,
              position: p.position,
              velocity: p.velocity,
              rotation: p.rotation,
              crouching: p.crouching,
              ads: p.ads,
              ridingScooter: p.ridingScooter,
              weaponClass: p.weaponClass,
              timestamp: p.lastUpdated
            },
            ws
          );
        } else if (type === "lobby:update") {
          const info = clientRoomMap.get(ws);
          if (!info) return;
          const room = rooms.get(info.roomCode);
          if (!room) return;
          const p = room.players[info.playerId];
          if (msg.mapId) room.mapId = msg.mapId;
          if (msg.modeId) room.modeId = msg.modeId;
          if (typeof msg.isPublic === "boolean") room.isPublic = msg.isPublic;
          if (msg.status) room.status = msg.status;
          if (p) {
            if (msg.playerName) p.name = String(msg.playerName).slice(0, 24);
            if (msg.team) p.team = msg.team;
            if (typeof msg.ready === "boolean") p.ready = msg.ready;
            if (msg.weaponClass) p.weaponClass = msg.weaponClass;
          }
          broadcastToRoom(wss, info.roomCode, {
            type: "room:state",
            roomCode: info.roomCode,
            room,
            lanIp: getLocalLanIp()
          });
        } else if (type === "combat:hit") {
          const info = clientRoomMap.get(ws);
          if (!info) return;
          const room = rooms.get(info.roomCode);
          if (!room) return;
          const attacker = room.players[info.playerId];
          const target = room.players[msg.targetId];
          if (!target) return;
          const dmg = Math.max(0, Math.min(200, Number(msg.damage) ?? 25));
          const stunDurationMs = Math.max(0, Number(msg.stunDurationMs) || 0);
          target.hp = Math.max(0, target.hp - dmg);
          let killed = false;
          if (dmg > 0 && target.hp <= 0) {
            killed = true;
            target.deaths += 1;
            target.hp = target.maxHp;
            target.position = target.team === "alpha" ? [2.1, 0.15, 32.5] : [-86, 0.15, -6];
            if (attacker && attacker.id !== target.id) {
              attacker.kills += 1;
              if (attacker.team === "alpha") room.alphaScore += 1;
              else room.bravoScore += 1;
            }
          }
          broadcastToRoom(wss, info.roomCode, {
            type: "combat:event",
            roomCode: info.roomCode,
            attackerId: info.playerId,
            attackerName: attacker?.name || msg.attackerName || "Player",
            attackerTeam: attacker?.team || msg.attackerTeam || "alpha",
            targetId: target.id,
            damage: dmg,
            targetHp: target.hp,
            killed,
            isHeadshot: Boolean(msg.isHeadshot),
            stunDurationMs,
            alphaScore: room.alphaScore,
            bravoScore: room.bravoScore,
            weaponClass: msg.weaponClass || attacker?.weaponClass || "Assault Rifle",
            weaponId: msg.weaponId || attacker?.weaponClass || "assault"
          });
        } else if (type === "chat:message") {
          const info = clientRoomMap.get(ws);
          if (!info) return;
          const room = rooms.get(info.roomCode);
          if (!room) return;
          const sender = room.players[info.playerId];
          broadcastToRoom(wss, info.roomCode, {
            type: "chat:message",
            roomCode: info.roomCode,
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            senderName: sender?.name || msg.senderName || "Player",
            team: sender?.team || "alpha",
            text: String(msg.text || "").slice(0, 140),
            timestamp: Date.now()
          });
        }
      } catch {
      }
    });
    ws.on("close", () => {
      removeClientFromCurrentRoom(wss, ws);
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const PORT = 3e3;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `DEADSHOT.io Global & LAN Server running on http://0.0.0.0:${PORT} (LAN IP: ${getLocalLanIp()})`
    );
  });
}
startServer();
