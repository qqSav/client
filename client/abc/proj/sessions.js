const fetch = require("node-fetch-commonjs");
const ByteBuffer = require("bytebuffer");
const WebSocket = require("ws");
const { SocksProxyAgent } = require("socks-proxy-agent");
let wssId = "a";

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1475712559087616090/YEBzK4iDy44Q0dcAbfREH55x8abjr3kSCTsbglpCLKDl7Uj9xG2Id0RXUlMwchPMGy1B";

function sendDiscordDisconnectNotification(sessionName, serverId, reason) {
    const payload = {
        content: "<@700104320217120838>",
        embeds: [{
            title: "Session Disconnected",
            color: 0xff4444,
            fields: [
                { name: "Session", value: sessionName || "Unknown", inline: true },
                { name: "Server", value: serverId || "Unknown", inline: true },
                { name: "Reason", value: reason || "Connection closed", inline: false }
            ],
            timestamp: new Date().toISOString()
        }]
    };
    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(err => console.log("[Discord Webhook] Failed to send notification:", err.message));
}

function getPlayersInViewField(bot) {
    if (!bot || !bot.myPlayer || !bot.entities) return null;
    const players = [];
    bot.entities.forEach(entity => {
        if (entity.targetTick &&
            entity.targetTick.model === "GamePlayer" &&
            entity.targetTick.uid !== bot.myPlayer.uid &&
            entity.targetTick.partyId !== bot.myPlayer.partyId &&
            !entity.targetTick.dead) {
            const name = entity.targetTick.name || "Unknown";
            const weapon = entity.targetTick.weaponName || "?";
            const tier = entity.targetTick.tier || 1;
            players.push(`${name} (${weapon} T${tier})`);
        }
    });
    if (players.length === 0) return null;
    const text = players.join(", ");
    return text.length > 1024 ? text.substring(0, 1021) + "..." : text;
}

function sendDiscordAlarmNotification(title, color, extraFields, bot) {
    const fields = [
        { name: "Session", value: bot.sessionName || "Unknown", inline: true },
        { name: "Server", value: bot.serverId || "Unknown", inline: true }
    ];
    if (extraFields && extraFields.length > 0) {
        extraFields.forEach(f => fields.push(f));
    }
    const playersInView = getPlayersInViewField(bot);
    if (playersInView) {
        fields.push({ name: "Players In View (Not In Party)", value: playersInView, inline: false });
    }
    const payload = {
        content: "<@700104320217120838>",
        embeds: [{
            title: title,
            color: color,
            fields: fields,
            timestamp: new Date().toISOString()
        }]
    };
    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(err => console.log("[Discord Webhook] Failed to send alarm:", err.message));
}

const wss = new WebSocket.Server({ port: 8080 });

let s = {};
let playerX = -1;
let playerY = -1;
let yaw = 0;
let counts = 0;
let autoSpearTier = 0;
let selectedTier = 0;
let requiredGold = 0;
let spearCosts = {1: 1400, 2: 4200, 3: 9800, 4: 21000, 5: 43500, 6: 88500, 7: 178500};
const connections = new Map();
const sessions = {};
const sessionsNames = {};
const sessions_1 = {};
const records = {};
const verifyRecords = {};
const leaderboardData = {};
const serversSessions = {};
const keys = {};
const proxies = {
    "Proxy1": "157.52.253.226:6186",
    "Proxy2": "154.30.242.221:9615",
    "Proxy3": "134.73.187.73:6121",
    "Proxy4": "136.0.220.106:6744",
    "Proxy5": "104.233.12.217:6768",
    "Proxy6": "161.123.151.125:6109",
    "Proxy7": "192.177.86.101:6656",
    "Proxy8": "161.123.115.132:5153",
    "Proxy9": "161.123.101.147:6773",
    "Proxy10": "166.88.235.30:6339",
    "Proxy11": "192.177.87.228:6493",
    "Proxy12": "45.43.167.22:6204",
    "Proxy13": "104.223.149.162:5790",
    "Proxy14": "104.148.0.11:5366",
    "Proxy15": "192.177.103.183:6124",
    "Proxy16": "161.123.5.9:5058",
    "Proxy17": "43.245.119.227:6001",
    "Proxy18": "45.43.167.103:6285",
    "Proxy19": "134.73.109.220:5985",
    "Proxy20": "161.123.101.177:6803",
    "Proxy21": "184.174.27.97:6320",
    "Proxy22": "207.244.218.36:5644",
    "Proxy23": "154.30.244.76:9517",
    "Proxy24": "134.73.100.252:6539",
    "Proxy25": "23.228.108.114:6504",
    "Proxy26": "43.245.119.170:5944",
    "Proxy27": "134.73.18.200:6783",
    "Proxy28": "45.61.122.12:6304",
    "Proxy29": "166.88.245.104:6104",
    "Proxy30": "166.88.3.44:6396",
    "Proxy31": "216.74.118.243:6398",
    "Proxy32": "38.153.133.137:9541",
    "Proxy33": "161.123.115.135:5156",
    "Proxy34": "184.174.27.127:6350",
    "Proxy35": "23.247.112.156:6812",
    "Proxy36": "134.73.94.57:6027",
    "Proxy37": "38.153.140.130:9008",
    "Proxy38": "136.0.88.232:6525",
    "Proxy39": "38.170.175.66:5735",
    "Proxy40": "38.153.139.116:9792",
    "Proxy41": "104.233.13.44:6039",
    "Proxy42": "161.123.101.94:6720",
    "Proxy43": "134.73.107.88:6380",
    "Proxy44": "134.73.100.247:6534",
    "Proxy45": "104.238.37.120:6677",
    "Proxy46": "136.0.109.50:5644",
    "Proxy47": "142.111.245.110:6328",
    "Proxy48": "166.88.3.183:6535",
    "Proxy49": "104.238.37.26:6583",
    "Proxy50": "104.223.227.218:6741",
    "Proxy51": "45.43.167.152:6334",
    "Proxy52": "134.73.100.116:6403",
    "Proxy53": "147.185.250.239:7025",
    "Proxy54": "161.123.93.71:5801",
    "Proxy55": "104.233.12.12:6563",
    "Proxy56": "107.179.26.221:6291",
    "Proxy57": "104.223.149.53:5681",
    "Proxy58": "192.177.86.110:6665",
    "Proxy59": "45.61.124.240:6569",
    "Proxy60": "166.88.195.121:6126",
    "Proxy61": "216.173.76.214:6841",
    "Proxy62": "45.61.123.91:5770",
    "Proxy63": "166.88.58.125:6642",
    "Proxy64": "184.174.58.221:5783",
    "Proxy65": "107.179.26.236:6306",
    "Proxy66": "166.88.235.235:6544",
    "Proxy67": "134.73.18.135:6718",
    "Proxy68": "173.245.88.246:5897",
    "Proxy69": "184.174.46.252:5881",
    "Proxy70": "161.123.5.118:5167",
    "Proxy71": "38.170.172.7:5008",
    "Proxy72": "45.61.118.130:5827",
    "Proxy73": "104.232.209.219:6177",
    "Proxy74": "207.244.218.236:5844"
};

function encode(e) {
    return new Uint8Array(codec.encode(9, { name: "message", msg: e }));
}

function decode(e) {
    try {
        return codec.decode(new Uint8Array(e)).response.msg;
    } catch (error) {
        return null;
    }
}

const sendBreakInStatus = () => {
    try {
        const breakInServers = [];
        serverMap.forEach((server, id) => {
            if (server.autoBreakIn) breakInServers.push(id);
        });
        connections.forEach(e => {
            if (e.type === "user") {
                e.send(encode(`breakinstatus,  ;${JSON.stringify(breakInServers)}`));
            }
        });
    } catch (e) {
        console.log(e);
    }
};

const sendSessions = () => {
    try {
        connections.forEach(e => {
            if (e.type === "user") {
                e.send(encode(`sessions,  ;${JSON.stringify(Object.fromEntries(Object.entries(sessionsNames).filter(i => i[1].proxy === e.proxy)))}`));
            }
        });
        sendBreakInStatus();
    } catch (e) {
        console.log(e);
    }
}

const cipher = salt => {
    const textToChars = text => text.split('').map(c => c.charCodeAt(0));
    const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = code => textToChars(salt).reduce((a, b) => a ^ b, code);
    return text => text.split('').map(textToChars).map(applySaltToChar).map(byteHex).join('');
}

let salt = "pro";
let adminsalt = "pro";

wss.on('connection', ws => {
    ws.id = counts++;
    ws.type = null;
    ws.sessionConnectedToId = null;
    ws.isVerified = null;
    let hasAccess = false;
    let isAdmin = false;
    const key = (Math.random() * 99999).toString(16);
    const encodedKey = cipher(salt)(key);
    const encodedKey2 = cipher(adminsalt)(key);
    ws.sendMessage = m => {
        try {
            if (ws.readyState === 1) {
                ws.send(encode(m));
            }
        } catch (e) {
            console.log(e);
        }
    }
    ws.sendMessage(`proxies,  ;${Object.keys(proxies)}`);
    ws.sendMessage(`prfpsks,  ;${Object.keys(keys)}`);
    ws.on('message', m => {
        try {
            let x = new Uint8Array(m);
            if (hasAccess && x[0] == 1 && ws.isVerified && sessions_1[ws.sessionConnectedToId]) {
                x = x.slice(1);
                const opcode = x[0];
                if (opcode == 9) {
                    const data = sessions_1[ws.sessionConnectedToId].codec.decode(x);
                    if (data.name == "BuyItem" && data.response.tier == 1) {
                        if (data.response.itemName == "PetCARL" || data.response.itemName == "PetMiner") return;
                        if (data.response.itemName == "Pickaxe" && sessions_1[ws.sessionConnectedToId].inventory.Pickaxe) return;
                        if (data.response.itemName == "Spear" && sessions_1[ws.sessionConnectedToId].inventory.Spear) return;
                        if (data.response.itemName == "Bow" && sessions_1[ws.sessionConnectedToId].inventory.Bow) return;
                        if (data.response.itemName == "Bomb" && sessions_1[ws.sessionConnectedToId].inventory.Bomb) return;
                    }
                    if (data.name == "SetPartyName" && !(new TextEncoder().encode(data.response.partyName).length <= 49)) return;
                    if (data.name == "SendChatMessage" && !(new TextEncoder().encode(data.response.message).length <= 249)) return;
                }
                sessions_1[ws.sessionConnectedToId].ws.send(x);
                return;
            }
            if (hasAccess && x[0] == 2 && ws.isVerified) {
                sessions_1[ws.sessionConnectedToId] && sessions_1[ws.sessionConnectedToId].ws && sessions_1[ws.sessionConnectedToId].ws.readyState == 1 && sessions_1[ws.sessionConnectedToId].ws.send(x.slice(1));
                return;
            }
            let msg = decode(m);
            if (msg) {
            if (!hasAccess) {
                if (msg.startsWith("plsverify")) {
                    ws.sendMessage(`encodeyounoob,  ;${key}`);
                }
                if (msg.startsWith("decodednoob")) {
                    let args = msg.split(",  ;");
                    if (args[1] == encodedKey || args[1] == encodedKey2) {
                        hasAccess = true;
                        ws.sendMessage("accesssuccess");
                        if (args[1] == encodedKey2) isAdmin = true;
                    }
                }
            }
            if (isAdmin) {
                if (msg.startsWith("changehasaccess")) {
                    let args = msg.split(",  ;");
                    salt = args[1];
                    adminsalt = args[1];
                    console.log(`Password changed: ${salt}`);
                }
            }
            if (msg == "getleaderboarddata") {
                ws.sendMessage(`leaderboarddata,  ;${JSON.stringify(leaderboardData)}`);
            }
            if (!hasAccess) return;
            if (msg.startsWith("user")) {
                let args = msg.split(",  ;");
                ws.proxy = args[1];
                ws.sendMessage(`id,  ;${ws.id}`);
                ws.sendMessage(`sessions,  ;${JSON.stringify(Object.fromEntries(Object.entries(sessionsNames).filter(i => i[1].proxy == ws.proxy)))}`);
                ws.type = "user";
            }
            if (msg == "getsessions") {
                ws.sendMessage(`sessions,  ;${JSON.stringify(sessionsNames)}`);
            }
            if (msg == "getrecords") {
                ws.sendMessage(`records,  ;${JSON.stringify(records)}`);
            }
            if (msg == "getverifiedrecords") {
                ws.sendMessage(`verifiedrecords,  ;${JSON.stringify(verifyRecords)}`);
            }
            if (msg.startsWith("eabi")) {
                msg.split(",  ;")[1] && (serverMap.get(msg.split(",  ;")[1]).autoBreakIn = true);
                sendBreakInStatus();
            }
            if (msg.startsWith("dabi")) {
                msg.split(",  ;")[1] && (serverMap.get(msg.split(",  ;")[1]).autoBreakIn = false);
                sendBreakInStatus();
            }
            if (msg.startsWith("esrf")) {
                if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                    serverMap.get(msg.split(",  ;")[1]).proxies[msg.split(",  ;")[2]] = true;
                }
            }
            if (msg.startsWith("dsrf")) {
                if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                    delete serverMap.get(msg.split(",  ;")[1]).proxies[msg.split(",  ;")[2]];
                }
            }
            if (msg.startsWith("eafp")) {
                msg.split(",  ;")[1] && (serverMap.get(msg.split(",  ;")[1]).autoFillParty = true);
            }
            if (msg.startsWith("dafp")) {
                msg.split(",  ;")[1] && (serverMap.get(msg.split(",  ;")[1]).autoFillParty = false);
            }
            if (msg.startsWith("addafpsk")) {
                if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                    if (msg.split(",  ;")[1].length == 20) {
                        serverMap.get(msg.split(",  ;")[2]).keys[msg.split(",  ;")[1]] = true;
                        keys[`${msg.split(",  ;")[2]}/${msg.split(",  ;")[1]}`] = true;
                    }
                }
            }
            if (msg.startsWith("removeafpsk")) {
                if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                    if (msg.split(",  ;")[1].length == 20) {
                        delete serverMap.get(msg.split(",  ;")[2]).keys[msg.split(",  ;")[1]];
                        delete keys[`${msg.split(",  ;")[2]}/${msg.split(",  ;")[1]}`];
                    }
                }
            }
            if (ws.type == "user") {
                if (msg.startsWith("verify")) {
                    let sid = parseInt(msg.split(",  ;")[1]);
                    if (sessions[sid]) {
                        if(sessions[ws.sessionConnectedToId] && sessions[ws.sessionConnectedToId][ws.id]) delete sessions[ws.sessionConnectedToId][ws.id];
                        ws.sessionConnectedToId = sid;
                        ws.isVerified = false;
                        sessions[sid][ws.id] = ws.id;
                        sendSessions();
                        sessions[sid] && Object.values(sessions[sid]).forEach(e => {
                            let ws = connections.get(e);
                            ws && !ws.isVerified && (ws.send(encode(`verifydata,  ;${JSON.stringify(sessions_1[sid].getSyncNeeds())}`)), ws.isVerified = true);
                        });
                    }
                }
                if (msg.startsWith("packet") && ws.isVerified && sessions_1[ws.sessionConnectedToId]) {
                    let args = msg.split(",  ;");
                    const opcode = parseInt(args[1]);
                    const data = JSON.parse(args.slice(2).join(",  ;"));
                    if (opcode == 9) {
                        if (data.name == "BuyItem" && data.tier == 1) {
                            if (data.itemName == "PetCARL" || data.itemName == "PetMiner") return;
                            if (data.itemName == "Pickaxe" && sessions_1[ws.sessionConnectedToId].inventory.Pickaxe) return;
                            if (data.itemName == "Spear" && sessions_1[ws.sessionConnectedToId].inventory.Spear) return;
                            if (data.itemName == "Bow" && sessions_1[ws.sessionConnectedToId].inventory.Bow) return;
                            if (data.itemName == "Bomb" && sessions_1[ws.sessionConnectedToId].inventory.Bomb) return;
                        }
                        if (data.name == "SetPartyName" && !(new TextEncoder().encode(data.partyName).length <= 49)) return;
                        if (data.name == "SendChatMessage" && !(new TextEncoder().encode(data.message).length <= 249)) return;
                    }
                    sessions_1[ws.sessionConnectedToId].sendPacket(opcode, data);
                }
                if (msg.startsWith("buffer") && ws.isVerified) {
                    let args = msg.split(",  ;");
                    sessions_1[ws.sessionConnectedToId] && sessions_1[ws.sessionConnectedToId].ws && sessions_1[ws.sessionConnectedToId].ws.readyState == 1 && sessions_1[ws.sessionConnectedToId].ws.send(new Uint8Array(JSON.parse(args[1])));
                }
                if (msg.startsWith("createsession")) {
                    let args = msg.split(",  ;");
                    let sessionName;
                    args[1] ? (sessionName = args[1].slice(0, 20)) : null;
                    let name = args[2] || "";
                    let sid = args[3];
                    let psk = args[4];
                    let proxy = args[5];
                    new Bot(sessionName, name, sid, psk, proxy);
                }
                if (msg.startsWith("decodeOpcode5")) {
                    let args = msg.split(",  ;");
                    let opcode5data = JSON.parse(args[1]);
                    let hostname = args[2];
                    decodeOpcode5(opcode5data, hostname).then(e => {
                        e[5].extra = Array.from(new Uint8Array(e[5].extra));
                        e[6] = Array.from(new Uint8Array(e[6]));
                        ws && ws.send(encode("decodedOpcode5,  ;" + JSON.stringify(e)));
                    });
                }
                if (msg.startsWith("getsettings")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        ws.sendMessage(`ah,  ;${sessions_1[ws.sessionConnectedToId].scripts.autoheal}`);
                        ws.sendMessage(`hs,  ;${sessions_1[ws.sessionConnectedToId].scripts.healset}`);
                        ws.sendMessage(`phs,  ;${sessions_1[ws.sessionConnectedToId].scripts.pethealset}`);
                        ws.sendMessage(`ar,  ;${sessions_1[ws.sessionConnectedToId].scripts.autorespawn}`);
                        ws.sendMessage(`ab,  ;${sessions_1[ws.sessionConnectedToId].scripts.autobuild}`);
                        ws.sendMessage(`au,  ;${sessions_1[ws.sessionConnectedToId].scripts.autoupgrade}`);
                        ws.sendMessage(`aa,  ;${sessions_1[ws.sessionConnectedToId].scripts.autoaim}`);
                        ws.sendMessage(`atb,  ;${sessions_1[ws.sessionConnectedToId].scripts.autobow}`);
                        ws.sendMessage(`apr,  ;${sessions_1[ws.sessionConnectedToId].scripts.autopetrevive}`);
                        ws.sendMessage(`aph,  ;${sessions_1[ws.sessionConnectedToId].scripts.autopetheal}`);
                        ws.sendMessage(`pt,  ;${sessions_1[ws.sessionConnectedToId].scripts.playertrick}`);
                        ws.sendMessage(`rpt,  ;${sessions_1[ws.sessionConnectedToId].scripts.reverseplayertrick}`);
                        ws.sendMessage(`aaz,  ;${sessions_1[ws.sessionConnectedToId].scripts.autoaimonzombies}`);
                        ws.sendMessage(`ahrc,  ;${sessions_1[ws.sessionConnectedToId].scripts.ahrc}`);
                        ws.sendMessage(`pl,  ;${sessions_1[ws.sessionConnectedToId].scripts.positionlock}`);
                        ws.sendMessage(`ape,  ;${sessions_1[ws.sessionConnectedToId].scripts.autopetevolve}`);
                        ws.sendMessage(`arc,  ;${sessions_1[ws.sessionConnectedToId].scripts.autoreconnect}`);
                        ws.sendMessage(`uth,  ;${sessions_1[ws.sessionConnectedToId].scripts.upgradetowerhealth}`);
                        ws.sendMessage(`ua,  ;${sessions_1[ws.sessionConnectedToId].scripts.upgradeall}`);
                        ws.sendMessage(`at,  ;${sessions_1[ws.sessionConnectedToId].scripts.autotimeout}`);
                        ws.sendMessage(`sbt,  ;${sessions_1[ws.sessionConnectedToId].scripts.scoreblocktrick}`);
                        ws.sendMessage(`hth,  ;${sessions_1[ws.sessionConnectedToId].scripts.healtowerhealth}`);
                        ws.sendMessage(`sa,  ;${sessions_1[ws.sessionConnectedToId].scripts.sellall}`);
                        ws.sendMessage(`mpt,  ;${sessions_1[ws.sessionConnectedToId].scripts.multipartytrick}`);
                        ws.sendMessage(`pff,  ;${sessions_1[ws.sessionConnectedToId].scripts.playerFollower}`);
                        ws.sendMessage(`satb,  ;${sessions_1[ws.sessionConnectedToId].scripts.antiarrow}`);
                        ws.sendMessage(`sar,  ;${sessions_1[ws.sessionConnectedToId].scripts.sessionautorespawn}`);
                        ws.sendMessage(`abb,  ;${sessions_1[ws.sessionConnectedToId].scripts.autobuybow}`);
                        ws.sendMessage(`abp,  ;${sessions_1[ws.sessionConnectedToId].scripts.autobuypickaxe}`);
                        ws.sendMessage(`mb,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox}`);
                        ws.sendMessage(`mm,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).mouseMove}`);
                        ws.sendMessage(`sc,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).scatterAlts}`);
                        ws.sendMessage(`aaj,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autoaltjoin}`);
                        ws.sendMessage(`as,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autospear}`);
                        ws.sendMessage(`xk,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).xkey}`);
                        ws.sendMessage(`pf,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).playerFinder}`);
                        ws.sendMessage(`arf,  ;${Object.keys(serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).proxies).length > 0 ? true : false}`);
                        ws.sendMessage(`prf,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autoFillParty}`);
                        ws.sendMessage(`upgrank,  ;${sessions_1[ws.sessionConnectedToId].upgradeRank || 0}`);
                        ws.sendMessage(`almtd,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmTowerDestroyed}`);
                        ws.sendMessage(`almaa,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmAntiarrowShooting}`);
                        ws.sendMessage(`almhth,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmHealTowerHealth}`);
                        ws.sendMessage(`almgsd,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmGoldStashDamaged}`);
                        ws.sendMessage(`almthl,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmTowerHealthLow}`);
                        ws.sendMessage(`almphl,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerHealthLow}`);
                        ws.sendMessage(`almpd,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerDeath}`);
                        ws.sendMessage(`almsp,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmSpearPlayers}`);
                        ws.sendMessage(`almhp,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmHighPing}`);
                        ws.sendMessage(`almsf,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmServerFilled}`);
                        ws.sendMessage(`almdc,  ;${sessions_1[ws.sessionConnectedToId].scripts.alarmDisconnect}`);
                    }
                }
                if (msg.startsWith("earn")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autorespawn = true);
                }
                if (msg.startsWith("darn")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autorespawn = false);
                }
                if (msg.startsWith("eahhl")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoheal = true);
                }
                if (msg.startsWith("dahhl")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoheal = false);
                }
                if (msg.startsWith("eabbase,")) {
                    if (!sessions_1[ws.sessionConnectedToId] || !sessions_1[ws.sessionConnectedToId].gs) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    const baseJson = msg.split(",  ;")[1];
                    if (!baseJson) return;
                    try {
                        const baseData = JSON.parse(baseJson);
                        _this.scripts.autobuild = true;
                        _this.inactiveRebuilder.forEach((e, t) => _this.inactiveRebuilder.delete(t));
                        _this.rebuilder.forEach((e, t) => _this.rebuilder.delete(t));
                        const rebuilder2 = new Map(Object.entries(baseData));
                        rebuilder2.forEach(e => {
                            _this.rebuilder.set(JSON.parse(e[0]) + JSON.parse(e[1]) * 1000, e);
                        });
                    } catch (e) {}
                }
                if (msg == "eab") {
                    if (!sessions_1[ws.sessionConnectedToId] || !sessions_1[ws.sessionConnectedToId].gs) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    _this.scripts.autobuild = true;
                    _this.inactiveRebuilder.forEach((e, t) => _this.inactiveRebuilder.delete(t));
                    _this.rebuilder.forEach((e, t) => _this.rebuilder.delete(t));
                    Object.values(_this.buildings).forEach(e => {
                        _this.rebuilder.set((e.x - _this.gs.x) / 24 + (e.y - _this.gs.y) / 24 * 1000, [(e.x - _this.gs.x) / 24, (e.y - _this.gs.y) / 24, e.type, (_this.entities.get(e.uid) ? _this.entities.get(e.uid).targetTick.yaw : 0)]);
                    });
                }
                if (msg == "dab") {
                    if (!sessions_1[ws.sessionConnectedToId]) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    _this.scripts.autobuild = false;
                    _this.inactiveRebuilder.forEach((e, t) => _this.inactiveRebuilder.delete(t));
                    _this.rebuilder.forEach((e, t) => _this.rebuilder.delete(t));
                }
                if (msg.startsWith("eau")) {
                    if (!sessions_1[ws.sessionConnectedToId] || !sessions_1[ws.sessionConnectedToId].gs) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    _this.scripts.autoupgrade = true;
                    _this.inactiveReupgrader.forEach((e, t) => _this.inactiveReupgrader.delete(t));
                    _this.reupgrader.forEach((e, t) => _this.reupgrader.delete(t));
                    Object.values(_this.buildings).forEach(e => {
                        _this.reupgrader.set((e.x - _this.gs.x) / 24 + (e.y - _this.gs.y) / 24 * 1000, [(e.x - _this.gs.x) / 24, (e.y - _this.gs.y) / 24, e.tier]);
                    });
                }
                if (msg.startsWith("dau")) {
                    if (!sessions_1[ws.sessionConnectedToId]) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    _this.scripts.autoupgrade = false;
                    _this.inactiveReupgrader.forEach((e, t) => _this.inactiveReupgrader.delete(t));
                    _this.reupgrader.forEach((e, t) => _this.reupgrader.delete(t));
                }
                if (msg.startsWith("eupgrank")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        const rank = parseInt(msg.split(",  ;")[1]);
                        const offsets = { 1: 8, 2: 18, 3: 33, 4: 53 };
                        if (offsets[rank] !== undefined) {
                            sessions_1[ws.sessionConnectedToId].upgradeTickOffset = offsets[rank];
                            sessions_1[ws.sessionConnectedToId].upgradeRank = rank;
                        }
                    }
                }
                if (msg == "dupgrank") {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        sessions_1[ws.sessionConnectedToId].upgradeTickOffset = 0;
                        sessions_1[ws.sessionConnectedToId].upgradeRank = 0;
                    }
                }
                if (msg.startsWith("eaap")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                            sessions_1[ws.sessionConnectedToId].minAimingYaw = msg.split(",  ;")[1];
                            sessions_1[ws.sessionConnectedToId].maxAimingYaw = msg.split(",  ;")[2];
                            sessions_1[ws.sessionConnectedToId].scripts.autoaim = true;
                        }
                    }
                }
                if (msg == "daap") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaim = false);
                }
                if (msg.startsWith("eatb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobow = true);
                }
                if (msg.startsWith("datb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobow = false);
                }
                if (msg.startsWith("eapr")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetrevive = true);
                }
                if (msg.startsWith("dapr")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetrevive = false);
                }
                if (msg.startsWith("eaph")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetheal = true);
                }
                if (msg.startsWith("daph")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetheal = false);
                }
		        if (msg.startsWith("esatb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.antiarrow = true);
                }
                if (msg.startsWith("dsatb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.antiarrow = false);
                }
                if (msg.startsWith("esar")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.sessionautorespawn = true);
                }
                if (msg.startsWith("dsar")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.sessionautorespawn = false);
                }
                if (msg.startsWith("eabb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobuybow = true);
                }
                if (msg.startsWith("dabb")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobuybow = false);
                }
                if (msg.startsWith("eabp")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobuypickaxe = true);
                }
                if (msg.startsWith("dabp")) {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autobuypickaxe = false);
                }
                if (msg == "ept") {
                    if (!sessions_1[ws.sessionConnectedToId]) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    const args = msg.split(",  ;");
                    _this.scripts.playertrick = true;
                    _this.playerTrickPsk = (!args[1] || args[1].length != 20) ? _this.partyShareKey : args[1];
                }
                if (msg == "dpt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.playertrick = false);
                }
                if (msg == "erpt") {
                    if (!sessions_1[ws.sessionConnectedToId]) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    const args = msg.split(",  ;");
                    _this.scripts.reverseplayertrick = true;
                    _this.playerTrickPsk = (!args[1] || args[1].length != 20) ? _this.partyShareKey : args[1];
                }
                if (msg == "drpt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.reverseplayertrick = false);
                }
                if (msg == "eaaz") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaimonzombies = true);
                }
                if (msg == "daaz") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoaimonzombies = false);
                }
                if (msg == "eahrc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.ahrc = true);
                }
                if (msg == "dahrc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.ahrc = false);
                }
                if (msg == "epl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.positionlock = true);
                }
                if (msg == "dpl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.positionlock = false);
                }
                if (msg == "eape") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetevolve = true);
                }
                if (msg == "dape") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autopetevolve = false);
                }
                if (msg == "earc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoreconnect = true);
                }
                if (msg == "darc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autoreconnect = false);
                }
                if (msg.startsWith("euth")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                            sessions_1[ws.sessionConnectedToId].uthHealth = msg.split(",  ;")[1];
                            sessions_1[ws.sessionConnectedToId].shouldRevert = msg.split(",  ;")[2];
                            sessions_1[ws.sessionConnectedToId].scripts.upgradetowerhealth = true;
                        }
                    }
                }
                if (msg == "duth") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.upgradetowerhealth = false);
                }
                if (msg == "eua") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.upgradeall = true);
                }
                if (msg == "dua") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.upgradeall = false);
                }
                if (msg == "eamt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autotimeout = true);
                }
                if (msg == "damt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.autotimeout = false);
                }
                if (msg.startsWith("sbtpos")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        const melee = Object.values(sessions_1[ws.sessionConnectedToId].buildings).find(e => e.type == "MeleeTower" && e.tier == 1);
                        melee && (sessions_1[ws.sessionConnectedToId].sbt = {x: melee.x, y: melee.y});
                    }
                }
                if (msg.startsWith("esbt")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1] && msg.split(",  ;")[2]) {
                            sessions_1[ws.sessionConnectedToId].sbtStartTick = msg.split(",  ;")[1];
                            sessions_1[ws.sessionConnectedToId].sbtEndTick = msg.split(",  ;")[2];
                            sessions_1[ws.sessionConnectedToId].scripts.scoreblocktrick = true;
                        }
                    }
                }
                if (msg == "dsbt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.scoreblocktrick = false);
                }
                if (msg == "savemelees") {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        const _this = sessions_1[ws.sessionConnectedToId];
                        _this.savedMelees = Object.values(_this.buildings)
                            .filter(e => e.type === "MeleeTower")
                            .map(e => ({x: e.x, y: e.y, uid: e.uid}));
                    }
                }
                if (msg == "emeleetrick") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.meleetrick = true);
                }
                if (msg == "dmeleetrick") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.meleetrick = false);
                }
                if (msg.startsWith("empt")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1] && msg.split(",  ;")[2] && msg.split(",  ;")[3] && msg.split(",  ;")[4]) {
                            sessions_1[ws.sessionConnectedToId].psk1 = msg.split(",  ;")[1];
                            sessions_1[ws.sessionConnectedToId].psk2 = msg.split(",  ;")[2];
                            sessions_1[ws.sessionConnectedToId].psk3 = msg.split(",  ;")[3];
                            sessions_1[ws.sessionConnectedToId].psk4 = msg.split(",  ;")[4];
                            sessions_1[ws.sessionConnectedToId].scripts.multipartytrick = true;
                        }
                    }
                }
                if (msg == "dmpt") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.multipartytrick = false);
                    for (let i = 0; i < 8; i++) {
                        sessions_1[ws.sessionConnectedToId].harvesterTicks[i].deposit = [0.4, 0.6, 0.7, 1, 1.2, 1.2, 2.4, 3][i];
                    }
                }
                if (msg.startsWith("ehth")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1]) {
                            sessions_1[ws.sessionConnectedToId].hthHealth = msg.split(",  ;")[1];
                            sessions_1[ws.sessionConnectedToId].scripts.healtowerhealth = true;
                        }
                    }
                }
                if (msg == "dhth") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.healtowerhealth = false);
                }
                if (msg == "esa") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.sellall = true);
                }
                if (msg == "dsa") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.sellall = false);
                }
                if (msg == "epff") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.playerFollower = true);
                }
                if (msg == "dpff") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.playerFollower = false);
                }
                if (msg == "ealmtd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmTowerDestroyed = true);
                }
                if (msg == "dalmtd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmTowerDestroyed = false);
                }
                if (msg == "ealmaa") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmAntiarrowShooting = true);
                }
                if (msg == "dalmaa") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmAntiarrowShooting = false);
                }
                if (msg == "ealmhth") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmHealTowerHealth = true);
                }
                if (msg == "dalmhth") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmHealTowerHealth = false);
                }
                if (msg == "ealmgsd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmGoldStashDamaged = true);
                }
                if (msg == "dalmgsd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmGoldStashDamaged = false);
                }
                if (msg == "ealmthl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmTowerHealthLow = true);
                }
                if (msg == "dalmthl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmTowerHealthLow = false);
                }
                if (msg == "ealmphl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerHealthLow = true);
                }
                if (msg == "dalmphl") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerHealthLow = false);
                }
                if (msg == "ealmpd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerDeath = true);
                }
                if (msg == "dalmpd") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmPlayerDeath = false);
                }
                if (msg == "ealmsp") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmSpearPlayers = true);
                }
                if (msg == "dalmsp") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmSpearPlayers = false);
                }
                if (msg == "ealmhp") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmHighPing = true);
                }
                if (msg == "dalmhp") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmHighPing = false);
                }
                if (msg == "ealmsf") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmServerFilled = true);
                }
                if (msg == "dalmsf") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmServerFilled = false);
                }
                if (msg == "ealmdc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmDisconnect = true);
                }
                if (msg == "dalmdc") {
                    sessions_1[ws.sessionConnectedToId] && (sessions_1[ws.sessionConnectedToId].scripts.alarmDisconnect = false);
                }
                if (msg.startsWith("hs")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1]) {
                            sessions_1[ws.sessionConnectedToId].scripts.healset = msg.split(",  ;")[1];
                        }
                    }
                }
                if (msg.startsWith("phs")) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1]) {
                            sessions_1[ws.sessionConnectedToId].scripts.pethealset = msg.split(",  ;")[1];
                        }
                    }
                }
                if (msg == "emb") {
                    sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox = true);
                    Object.values(sessions_1).forEach(bot => {
                        if (serverMap.get(bot.serverId).multibox) {
                            bot.scripts.autobuild = false;
                            bot.scripts.autoupgrade = false;
                            bot.scripts.autobow = false;
                            bot.scripts.autoaim = false;
                            bot.scripts.autopetrevive = false;
                            bot.scripts.autopetheal = false;
                            bot.scripts.playertrick = false;
                            bot.scripts.reverseplayertrick = false;
                            bot.scripts.autoaimonzombies = false;
                            bot.scripts.ahrc = false;
                            bot.scripts.positionlock = false;
                            bot.scripts.autopetevolve = false;
                            bot.scripts.upgradetowerhealth = false;
                            bot.scripts.upgradeall = false;
                            bot.scripts.autotimeout = false;
                            bot.scripts.scoreblocktrick = false;
                            bot.scripts.healtowerhealth = false;
                            bot.scripts.sellall = false;
                            bot.scripts.multipartytrick = false;
                            bot.scripts.playerFollower = false;
                        }
                    });
                }
                if (msg == "dmb") {
                    sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox = false);
                }
                if (msg.startsWith("lock")) {
                    if (!sessions_1[ws.sessionConnectedToId]) return;
                    const _this = sessions_1[ws.sessionConnectedToId];
                    const args = msg.split(",  ;");
                    if (args[1]) {
                        let pos = args[1].split(" ");
                        let x = parseInt(pos[0]);
                        let y = parseInt(pos[1]);
                        _this.lockPos = {x: x || _this.myPlayer.position.x, y: y || _this.myPlayer.position.y};
                    } else {
                        _this.lockPos = {x: _this.myPlayer.position.x, y: _this.myPlayer.position.y};
                    }
                }
                if (msg.startsWith("stats")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1] && msg.split(",  ;")[2] && msg.split(",  ;")[3] && msg.split(",  ;")[4] && msg.split(",  ;")[5] && msg.split(",  ;")[6] && msg.split(",  ;")[7]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox && !bot.isLocked) {
                                    bot.mousePs.x = JSON.parse(msg.split(",  ;")[1]);
                                    bot.mousePs.y = JSON.parse(msg.split(",  ;")[2]);
                                    bot.width = JSON.parse(msg.split(",  ;")[3]);
                                    bot.height = JSON.parse(msg.split(",  ;")[4]);
                                }
                            });
                            sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).psk = msg.split(",  ;")[5]);
                            sessions_1[ws.sessionConnectedToId] && (serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).uid = JSON.parse(msg.split(",  ;")[6]));
                            Object.values(sessions_1).forEach(bot => {
                                bot.ws.readyState == 1 && bot.hasVerified && bot.serverId == msg.split(",  ;")[7] && ws.sendMessage(`altstats,  ;${JSON.stringify(bot.myPlayer)},  ;${JSON.stringify(bot.actualId)},  ;${JSON.stringify(bot.mouseDownHit)},  ;${JSON.stringify(bot.isOnControl)},  ;${JSON.stringify(bot.ws.readyState)},  ;${JSON.stringify(bot.serverId)},  ;${JSON.stringify(serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).target)},  ;${JSON.stringify(bot.gs)}`);
                            });
                        }
                    }
                }
                if (msg.startsWith("leaveall")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.uid !== serverMap.get(bot.serverId).uid && bot.sendPacket(9, {name: "LeaveParty"});
                            }
                        });
                    }
                }
                if (msg.startsWith("joinall")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        let botArray = [];
                        Object.values(sessions_1).forEach(bot => {
                            serverMap.get(bot.serverId).multibox && botArray.push(bot);
                        });
                        if (botArray[1] || botArray[2] || botArray[3]) {
                            if (botArray[1].ws.readyState == 1 && botArray[1].isOnControl) {
                                botArray[1].uid !== serverMap.get(botArray[1].serverId).uid && botArray[1].sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).psk});
                            }
                            if (botArray[2].ws.readyState == 1 && botArray[2].isOnControl) {
                                botArray[2].uid !== serverMap.get(botArray[2].serverId).uid && botArray[2].sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).psk});
                            }
                            if (botArray[3].ws.readyState == 1 && botArray[3].isOnControl) {
                                botArray[3].uid !== serverMap.get(botArray[3].serverId).uid && botArray[3].sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).psk});
                            }
                        }
                    }
                }
                if (msg.startsWith("space")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(3, {mouseUp: 1});
                                (bot.scripts.autobow = !bot.scripts.autobow);
                            }
                        });
                    }
                }
                if (msg.startsWith("sellpets")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.myPet && bot.sendPacket(9, {name: "DeleteBuilding", uid: bot.myPet.uid});
                            }
                        });
                    }
                }
                if (msg.startsWith("equippets")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.myPet ? bot.sendPacket(9, {name: "EquipItem", itemName: "PetCARL", tier: bot.myPet.tier}) : bot.sendPacket(9, {name: "EquipItem", itemName: "PetCARL", tier: 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("revivepets")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.scripts.autopetrevive = !bot.scripts.autopetrevive;
                            }
                        });
                    }
                }
                if (msg.startsWith("mousedown")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(3, {mouseDown: bot.aimingYaw1});
                            }
                        });
                    }
                }
                if (msg.startsWith("mouseup")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(3, {mouseUp: 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("scatteralts")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {                
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).scatterAlts = !serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).scatterAlts;
                    }
                }
                if (msg.startsWith("buypickaxe")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "BuyItem", itemName: "Pickaxe", tier: bot.inventory.Pickaxe.tier + 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("buyspear")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "BuyItem", itemName: "Spear", tier: bot.inventory.Spear ? bot.inventory.Spear.tier + 1 : 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("buybow")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "BuyItem", itemName: "Bow", tier: bot.inventory.Bow ? bot.inventory.Bow.tier + 1 : 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("buybomb")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "BuyItem", itemName: "Bomb", tier: bot.inventory.Bomb ? bot.inventory.Bomb.tier + 1 : 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("buyshield")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "BuyItem", itemName: "ZombieShield", tier: bot.inventory.ZombieShield ? bot.inventory.ZombieShield.tier + 1 : 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("equippickaxe")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "EquipItem", itemName: "Pickaxe", tier: bot.inventory.Pickaxe.tier});
                            }
                        });
                    }
                }
                if (msg.startsWith("equipspear")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.inventory.Spear && bot.sendPacket(9, {name: "EquipItem", itemName: "Spear", tier: bot.inventory.Spear.tier});
                            }
                        });
                    }
                }
                if (msg.startsWith("equipbow")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.inventory.Bow && bot.sendPacket(9, {name: "EquipItem", itemName: "Bow", tier: bot.inventory.Bow.tier});
                            }
                        });
                    }
                }
                if (msg.startsWith("equipbomb")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.inventory.Bomb && bot.sendPacket(9, {name: "EquipItem", itemName: "Bomb", tier: bot.inventory.Bomb.tier});
                            }
                        });
                    }
                }
                if (msg.startsWith("equiphealthpotion")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "EquipItem", itemName: "HealthPotion", tier: 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("equippethealthpotion")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "EquipItem", itemName: "PetHealthPotion", tier: 1});
                            }
                        });
                    }
                }
                if (msg.startsWith("recallpet")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "RecallPet"});
                            }
                        });
                    }
                }
                if (msg.startsWith("1b1")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            let nearestAltMouse = JSON.parse(msg.split(",  ;")[1]);
                            if (nearestAltMouse.readyState == 1) {
                                let oldSocket = Object.values(sessions_1).find(session => session.uid == nearestAltMouse.uid);
                                if (oldSocket && !oldSocket.mouseDownHit) {
                                    oldSocket.mouseDownHit = 1;
                                    oldSocket.sendPacket(9, {name: "EquipItem", itemName: "HealthPotion", tier: 1});
                                    setTimeout(() => {
                                        oldSocket.sendPacket(3, {mouseDown: oldSocket.aimingYaw1});
                                    }, 100);
                                    setTimeout(() => {
                                        oldSocket.sendPacket(3, {mouseUp: 1});
                                        setTimeout(() => {
                                            oldSocket.mouseDownHit = 0;
                                        }, 100);
                                    }, 7000);
                                }
                            }
                        }
                    }
                }
                if (msg.startsWith("mousemoveon")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).mouseMove = true;
                    }
                }
                if (msg.startsWith("mousemoveoff")) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).mouseMove = false;
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.hasVerified && bot.sendPacket(3, {up: 0, left: 0, down: 0, right: 0});
                            }
                        });
                    }
                }
                if (msg.startsWith(`sesjoin`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            if (msg.split(",  ;")[2] == 0) {
                                Object.values(sessions_1).forEach(bot => {
                                    if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                        bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && bot.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).psk});
                                    }
                                });
                            } else {
                                Object.values(sessions_1).forEach(bot => {
                                    if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                        bot.hasVerified && bot.actualId == msg.split(",  ;")[2] && bot.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: sessions_1[msg.split(",  ;")[1].slice(1, msg.length)].psk});
                                    }
                                });
                            }
                        }
                    }
                }
                if (msg.startsWith(`joinses`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                serverMap.get(bot.serverId).multibox && bot.ws.readyState == 1 && bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && ws.sendMessage(`joinid,  ;${bot.psk}`);
                            });
                        }
                    }
                }
                if (msg.startsWith(`js`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            serverMap.get(bot.serverId).multibox && bot.ws.readyState == 1 && bot.hasVerified && bot.isOnControl && !bot.gs && ws.sendMessage(`joinid,  ;${bot.psk}`);
                        });
                    }
                }
                if (msg.startsWith(`leaveses`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                    bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && bot.sendPacket(9, {name: "LeaveParty"});
                                }
                            });
                        }
                    }
                }
                if (msg.startsWith(`sesahrcon`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                    bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.scripts.ahrc = true);
                                }
                            });
                        }
                    }
                }
                if (msg.startsWith(`sesahrcoff`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                    bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.scripts.ahrc = false);
                                }
                            });
                        }
                    }
                }
                if (msg.startsWith(`allsesahrcoff`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.hasVerified && (bot.scripts.ahrc = false);
                            }
                        });
                    }
                }
                if (msg.startsWith(`healspam`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.sendPacket(9, {name: "CastSpell", spell: "HealTowersSpell", x: Math.round(bot.mousePs.x), y: Math.round(bot.mousePs.y), tier: 1});
                            }
                        });
                    }
                }
                if (msg.startsWith(`eaaj`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autoaltjoin = true;
                    }
                }
                if (msg.startsWith(`daaj`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autoaltjoin = false;
                    }
                }
                if (msg.startsWith(`eas`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autospear = true;
                            if (!isNaN(JSON.parse(msg.split(",  ;")[1]))) {
                                autoSpearTier = JSON.parse(msg.split(",  ;")[1]);
                                selectedTier = JSON.parse(msg.split(",  ;")[1]);
                                requiredGold = spearCosts[JSON.parse(msg.split(",  ;")[1])];
                            }
                        }
                    }
                }
                if (msg.startsWith(`das`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).autospear = false;
                    }
                }
                if (msg.startsWith(`exk`) && !msg.startsWith(`exks`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).xkey = true;
                    }
                }
                if (msg.startsWith(`dxk`) && !msg.startsWith(`dxks`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).xkey = false;
                    }
                }
                if (msg.startsWith(`exks`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).xkeySpear = true;
                    }
                }
                if (msg.startsWith(`dxks`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).xkeySpear = false;
                    }
                }
                if (msg.startsWith(`ecs`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).chatspam = true;
                    }
                }
                if (msg.startsWith(`dcs`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).chatspam = false;
                    }
                }
                if (msg.startsWith(`epf`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).target = {uid: JSON.parse(msg.split(",  ;")[1]), x: 0, y: 0};
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).playerFinder = true;
                    }
                }
                if (msg.startsWith(`dpf`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).playerFinder = false;
                        serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).target = {};
                    }
                }
                if (msg.startsWith(`target`)) {
                    ws.sendMessage(`target,  ;${serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).target}`);
                }
                if (msg.startsWith(`cycleweapon`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                !bot.thisWeapon && (bot.thisWeapon = 'Pickaxe');
                                let nextWeapon = 'Pickaxe';
                                let weaponOrder = ['Pickaxe', 'Spear', 'Bow', 'Bomb'];
                                let foundCurrent = false;
                                for (let i in weaponOrder) {
                                    if (foundCurrent) {
                                        if (bot.inventory[weaponOrder[i]]) {
                                            nextWeapon = weaponOrder[i];
                                            break;
                                        }
                                    } else if (weaponOrder[i] == bot.thisWeapon) {
                                        foundCurrent = true;
                                    }
                                }
                                bot.sendPacket(9, {name: 'EquipItem', itemName: nextWeapon, tier: bot.inventory[nextWeapon].tier});
                                bot.thisWeapon = nextWeapon;
                                bot.inventory[bot.thisWeapon] && bot.sendPacket(9, {name: 'EquipItem', itemName: bot.thisWeapon, tier: bot.inventory[bot.thisWeapon].tier});
                            }
                        });
                    }
                }
                if (msg.startsWith(`controlsession`)) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.isOnControl = true);
                            });
                        }
                    }
                }
                if (msg.startsWith(`uncontrolsession`)) {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.isOnControl = false);
                            });
                        }
                    }
                }
                if (msg == "controlall") {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        Object.values(sessions_1).forEach(bot => {
                            bot.hasVerified && (bot.isOnControl = true);
                        });
                    }
                }
                if (msg == "uncontrolall") {
                    if (sessions_1[ws.sessionConnectedToId]) {
                        Object.values(sessions_1).forEach(bot => {
                            bot.hasVerified && (bot.isOnControl = false);
                        });
                    }
                }
                if (msg.startsWith(`locksession`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                    bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.isLocked = true);
                                }
                            });
                        }
                    }
                }
                if (msg.startsWith(`unlocksession`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        if (msg.split(",  ;")[1]) {
                            Object.values(sessions_1).forEach(bot => {
                                if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                    bot.hasVerified && bot.actualId == msg.split(",  ;")[1] && (bot.isLocked = false);
                                }
                            });
                        }
                    }
                }
                if (msg.startsWith(`respawnon`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.hasVerified && (bot.autoRespawn = true);
                            }
                        });
                    }
                }
                if (msg.startsWith(`respawnoff`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox) {
                                bot.hasVerified && (bot.autoRespawn = false);
                            }
                        });
                    }
                }
                if (msg.startsWith(`presskeyw`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox && !serverMap.get(bot.serverId).mouseMove) {
                                bot.hasVerified && bot.sendPacket(3, {up: 1, down: 0});
                            }
                        });
                    }
                }
                if (msg.startsWith(`presskeya`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox && !serverMap.get(bot.serverId).mouseMove) {
                                bot.hasVerified && bot.sendPacket(3, {left: 1, right: 0});
                            }
                        });
                    }
                }
                if (msg.startsWith(`presskeys`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox && !serverMap.get(bot.serverId).mouseMove) {
                                bot.hasVerified && bot.sendPacket(3, {down: 1, up: 0});
                            }
                        });
                    }
                }
                if (msg.startsWith(`presskeyd`)) {
                    if (sessions_1[ws.sessionConnectedToId] && serverMap.get(sessions_1[ws.sessionConnectedToId].serverId).multibox) {
                        Object.values(sessions_1).forEach(bot => {
                            if (bot.ws.readyState == 1 && bot.isOnControl && serverMap.get(bot.serverId).multibox && !serverMap.get(bot.serverId).mouseMove) {
                                bot.hasVerified && bot.sendPacket(3, {right: 1, left: 0});
                            }
                        });
                    }
                }
                if (msg.startsWith("closeallsessions")) {
                    Object.keys(sessions_1).forEach(id => {
                        if (sessions_1[id]) {
                            sessions_1[id].scripts.autoreconnect = false;
                            sessions_1[id].disconnect();
                        }
                    });
                }
                else if (msg.startsWith("closesession")) {
                    let args = msg.split(",  ;");
                    if (sessions_1[args[1]]) {
                        sessions_1[args[1]].scripts.autoreconnect = false;
                        sessions_1[args[1]].disconnect();
                    }
                }
                if (msg.startsWith("changesessionname")) {
                    let args = msg.split(",  ;");
                    sessionsNames[args[1]] && (sessionsNames[args[1]].sessionName = (args[2] && args[2].slice(0, 20)) || "Session");
                    sendSessions();
                }
                if (msg.startsWith("changesessionid")) {
                    let args = msg.split(",  ;");
                    sessionsNames[args[1]] && (sessionsNames[args[1]].sessionUserId = parseInt(args[2]));
                    sendSessions();
                }
            }
            }
        } catch(e) {
            console.log(e);
        }
    })
    ws.on("error", () => console.log("error"));
    ws.on("close", () => {
        try {
            connections.delete(ws.id);
            if (sessions[ws.sessionConnectedToId] && sessions[ws.sessionConnectedToId][ws.id]) {
                delete sessions[ws.sessionConnectedToId][ws.id];
            }
            sendSessions();
        } catch(e) {
            console.log(e);
        }
    });
    connections.set(ws.id, ws);
});
wss.on("error", () => console.log("error"));

class Scripts {
    constructor() {
        this.autoheal = true;
        this.healset = 20;
        this.pethealset = 70;
        this.autorespawn = true;
        this.sessionautorespawn = false;
        this.autobuybow = false;
        this.autobuypickaxe = false;
        this.autobuild = false;
        this.autoupgrade = false;
        this.autoaim = false;
        this.autobow = false;
        this.autopetrevive = false;
        this.autopetheal = false;
        this.playertrick = false;
        this.reverseplayertrick = false;
        this.autoaimonzombies = false;
        this.ahrc = false;
        this.positionlock = false;
        this.autopetevolve = false;
        this.autoreconnect = true;
        this.upgradetowerhealth = false;
        this.upgradeall = false;
        this.autotimeout = false;
        this.scoreblocktrick = false;
        this.meleetrick = false;
        this.healtowerhealth = false;
        this.sellall = false;
	    this.antiarrow = false;
        this.multipartytrick = false;
        this.playerFollower = false;
        this.alarmTowerDestroyed = false;
        this.alarmAntiarrowShooting = false;
        this.alarmHealTowerHealth = false;
        this.alarmGoldStashDamaged = false;
        this.alarmTowerHealthLow = false;
        this.alarmPlayerHealthLow = false;
        this.alarmPlayerDeath = false;
        this.alarmSpearPlayers = false;
        this.alarmHighPing = true;
        this.alarmServerFilled = false;
        this.alarmDisconnect = true;
    }
}
class Bot {
    constructor(sessionName = null, name = " ", sid = "", psk = "", proxy, reconnectAttempts = 0, parentUserId = null) {
        if (!sid || !serverMap.get(sid)) return;
        if (serversSessions[sid]) {
            let count = 0;
            serversSessions[sid].forEach(ws => {
                ws.readyState == 1 && count++;
                if (ws.readyState == 2 || ws.readyState == 3) {
                    ws.close();
                    serversSessions[sid].delete(ws);
                }
            })
            if (count >= 32) return;
        }
        this.sessionName = sessionName;
        this.name = name;
        this.serverId = sid;
        this.host = serverMap.get(sid).host;
        this.hostname = serverMap.get(sid).hostname;
        this.psk = psk;
        this.proxy = proxy;
        this.mousePs = {x: 0, y: 0};
        this.width = 0;
        this.height = 0;
        this.ws = this.proxy ? new WebSocket(`wss://${this.host}:443/`, {headers: {"Origin": "","User-Agent": ""}, agent: new SocksProxyAgent(`socks://kOjwOJ93mOuIkwSirr0mLartemis:y2HKqUbJlKaJUfuckartemis@${proxies[proxy]}`)}) : new WebSocket(`wss://${this.host}:443/`, {headers: {"Origin": "","User-Agent": ""}});
        this.ws.binaryType = "arraybuffer";
        this.codec = new BinCodec();
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = () => {
            clearInterval(this.healthCheckInterval);
            serversSessions[this.serverId] && serversSessions[this.serverId].delete(this.ws);
            const serverEntry = serverMap.get(this.serverId);
            if (serverEntry) serverEntry.count--;
            const sessionUserId = this.userId || this.parentUserId;
            const willReconnect = this.scripts.autoreconnect && (this.hasVerified || this.reconnectAttempts > 0);
            if (willReconnect && sessionUserId) {
                this.scripts.alarmDisconnect && sendDiscordDisconnectNotification(this.sessionName, this.serverId, "Session disconnected (reconnecting)");
                delete sessions_1[sessionUserId];
                if (sessionsNames[sessionUserId]) sessionsNames[sessionUserId].reconnecting = true;
                sendSessions();
                wss.clients.forEach(client => {
                    client.sendMessage(`sessionreconnecting,  ;${this.actualId || (wssId + sessionUserId)}`);
                });
                const nextAttempt = this.reconnectAttempts + 1;
                const baseDelay = this.hasVerified ? 0 : Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                const jitter = Math.floor(Math.random() * 5000);
                const delay = baseDelay + jitter;
                console.log(`[Reconnect] Session ${this.sessionName} attempt ${nextAttempt}, delay ${delay}ms`);
                setTimeout(() => {
                    new Bot(this.sessionName, this.name, this.serverId, this.psk, this.proxy, nextAttempt, sessionUserId);
                }, delay);
            } else {
                this.hasVerified && this.scripts.alarmDisconnect && sendDiscordDisconnectNotification(this.sessionName, this.serverId, "Session closed permanently");
                sessionUserId && sessions[sessionUserId] && (delete sessions[sessionUserId], delete sessions_1[sessionUserId], delete sessionsNames[sessionUserId], sendSessions());
                wss.clients.forEach(client => {
                    client.sendMessage(`sessionclosed,  ;${this.actualId || (wssId + sessionUserId)}`);
                });
                if (!this.hasVerified && !this.breakInRetryScheduled && serverMap.get(this.serverId) && serverMap.get(this.serverId).autoBreakIn) {
                    console.log(`[Break-In] WS closed before enter world, retrying in 5s for ${this.serverId}`);
                    setTimeout(() => {
                        new Bot(this.sessionName, this.name, this.serverId, this.psk, this.proxy);
                    }, 5000);
                }
            }
        }
        this.ws.onerror = (err) => { console.log(`[Error] WebSocket error on session ${this.sessionName}:`, err && err.message); };
        if (!serversSessions[this.serverId]) serversSessions[this.serverId] = new Set();
        serversSessions[this.serverId].add(this.ws);
        this.entities = new Map();
        this.buildings = {};
        this.inventory = {};
        this.partyInfo = [];
        this.partyShareKey = psk;
        this.dayCycle = {cycleStartTick: 100, nightEndTick: 0, dayEndTick: 1300, isDay: 1};
        this.leaderboard = [];
        this.messages = [];
        this.parties = {};
        this.castSpellResponse = {};
        this.buildingUids_1 = {};
        this.uid = 0;
        this.tick = 100;
        this.hasVerified = false;
        this.scripts = new Scripts();
        this.petActivated = false;
        this.gs = null;
        this.rebuilder = new Map();
        this.inactiveRebuilder = new Map();
        this.reupgrader = new Map();
        this.inactiveReupgrader = new Map();
        this.upgradeTickOffset = 0;
        this.upgradeRank = 0;
        this.nearestPlayer = null;
        this.nearestZombie = null;
        this.nearestPlayerDistance = Infinity;
        this.nearestZombieDistance = Infinity;
        this.playerTrickPsk = null;
        this.leaveOnce = null;
        this.joinOnce = null;
        this.harvesters = new Map();
        this.harvesterTicks = [
            {tick: 0, resetTick: 31, deposit: 0.4, tier: 1},
            {tick: 0, resetTick: 29, deposit: 0.6, tier: 2},
            {tick: 0, resetTick: 27, deposit: 0.7, tier: 3},
            {tick: 0, resetTick: 24, deposit: 1, tier: 4},
            {tick: 0, resetTick: 22, deposit: 1.2, tier: 5},
            {tick: 0, resetTick: 20, deposit: 1.2, tier: 6},
            {tick: 0, resetTick: 18, deposit: 2.4, tier: 7},
            {tick: 0, resetTick: 16, deposit: 3, tier: 8}
        ];
        this.players = false;
        this.positionRest = null;
        this.lockPos = {x: 12000, y: 12000};
        leaderboardData[this.serverId] = [];
        this.uthTicks = 0;
        this.shouldRevert = false;
        this.upgradeTicks = 0;
        this.revertTicks = 10;
        this.sellTicks = 0;
        this.canSellTicks = 0;
        this.sbt = {x: 0, y: 0};
        this.sbtStartTick = 105;
        this.sbtEndTick = 110;
        this.savedMelees = [];
        this.meleeSellIndex = 0;
        this.meleeBuildIndex = 0;
        this.meleeSellDone = false;
        this.meleeBuildDone = false;
        this.chatSpamTicks = 0;
        this.buildOnce = null;
        this.sellOnce = null;
        this.uthHealth = 30;
        this.hthHealth = 30;
        this.mouseDownHit = 0;
        this.isOnControl = true;
        this.isLocked = false;
        this.aimingYaw1 = 0;
        this.minAimingYaw = 0;
        this.maxAimingYaw = 359;
        this.mptTicks = 0;
        this.psk1 = "";
        this.psk2 = "";
        this.psk3 = "";
        this.psk4 = "";
        this.autoRespawn = true;
        this.reconnectAttempts = reconnectAttempts;
        this.parentUserId = parentUserId;
        this.lastMessageTime = Date.now();
        this.alarmCooldowns = {};
        this.lastGoldStashHealth = null;
        this._wasPlayerDead = false;
        this._antiarrowWasShooting = false;
        this._lastServerFilled = false;
        this.healthCheckInterval = setInterval(() => {
            if (this.ws.readyState !== 1) return;
            if (Date.now() - this.lastMessageTime > 30000) {
                console.log(`[HealthCheck] No message for 30s on session ${this.sessionName}, forcing reconnect`);
                clearInterval(this.healthCheckInterval);
                this.ws.terminate();
            }
        }, 10000);
    }
    canSendAlarm(alarmName, cooldownMs = 30000) {
        const now = Date.now();
        if (this.alarmCooldowns[alarmName] && now - this.alarmCooldowns[alarmName] < cooldownMs) return false;
        this.alarmCooldowns[alarmName] = now;
        return true;
    }
    encode(e) {
        return new Uint8Array(codec.encode(9, {name: "message", msg: e}));
    }
    decode(e) {
        return codec.decode(new Uint8Array(e)).response.msg;
    }
    sendPacket(event, data) {
        this.ws && this.ws.readyState == 1 && this.ws.send(new Uint8Array(this.codec.encode(event, data)));
    }
    sendData(data) {
        sessions[this.userId] && Object.values(sessions[this.userId]).forEach(e => {
            let ws = connections.get(e);
            ws && ws.isVerified && ws.readyState == 1 && ws.send(data);
        });
    }
    angleTo = (xFrom, yFrom, xTo, yTo) => {
        return ((Math.atan2(yTo - yFrom, xTo - xFrom) / (Math.PI/180) + 450) % 360) | 0;
    };   
    screenToYaw = function(x, y) {
        return this.angleTo(this.width / 2, this.height / 2, x, y);
    };
    aimToYaw = (num) => !(num > 90 + 23) && !(num < 90 - 23)
    ? 90 : !(num > 225 + 23) && !(num < 225 - 23)
    ? 225 : !(num > 135 + 23) && !(num < 135 - 23)
    ? 135 : !(num > 360 + 23) && !(num < 360 - 23)
    ? 359 : !(num > 0 + 23) && !(num < 0 - 23)
    ? 359 : !(num > 180 + 23) && !(num < 180 - 23)
    ? 180 : !(num > 270 + 23) && !(num < 270 - 23)
    ? 270 : !(num > 315 + 23) && !(num < 315 - 23)
    ? 314 : !(num > 45 + 23) && !(num < 45 - 23)
    ? 44 : null;  
    moverbymouse = function(data, type = "name", pos, isMouseMoving = true, isPlayerMoving) {
        playerX = this.mousePs.x;
        playerY = this.mousePs.y;
        s.playerX = playerX;
        s.playerY = playerY;
        this.aimingYaw1 = this.angleTo(this.myPlayer.position.x, this.myPlayer.position.y, this.mousePs.x, this.mousePs.y);
        isMouseMoving || isPlayerMoving ? yaw = this.aimToYaw(this.aimingYaw1) : yaw = null;
        if (yaw) {
            if (!serverMap.get(this.serverId).scatterAlts && !this.reversedYaw) {
                this.a77r != null && (this.a77r = null);
                if (yaw == 90) {
                    if (this.a77 != 90) {
                        this.a77 = 90;
                        this.sendPacket(3, {right: 1, left: 0, up: 0, down: 0});
                    }
                }
                if (yaw == 225) {
                    if (this.a77 != 225) {
                        this.a77 = 225;
                        this.sendPacket(3, {down: 1, left: 1, up: 0, right: 0});
                    }
                }
                if (yaw == 44) {
                    if (this.a77 != 44) {
                        this.a77 = 44;
                        this.sendPacket(3, {down: 0, left: 0, up: 1, right: 1});
                    }
                }
                if (yaw == 314) {
                    if (this.a77 != 314) {
                        this.a77 = 314;
                        this.sendPacket(3, {down: 0, left: 1, up: 1, right: 0});
                    }
                }
                if (yaw == 135) {
                    if (this.a77 != 135) {
                        this.a77 = 135;
                        this.sendPacket(3, {down: 1, left: 0, up: 0, right: 1});
                    }
                }
                if (yaw == 359) {
                    if (this.a77 != 359) {
                        this.a77 = 359;
                        this.sendPacket(3, {up: 1, down: 0, right: 0, left: 0});
                    }
                }
                if (yaw == 180) {
                    if (this.a77 != 180) {
                        this.a77 = 180;
                        this.sendPacket(3, {down: 1, up: 0, right: 0, left: 0});
                    }
                }
                if (yaw == 270) {
                    if (this.a77 != 270) {
                        this.a77 = 270;
                        this.sendPacket(3, {left: 1, right: 0, up: 0, down: 0});
                    }
                }
            } else {
                this.a77 != null && (this.a77 = null);
                if (yaw == 90) {
                    if (this.a77r != 90) {
                        this.a77r = 90;
                        this.sendPacket(3, {left: 1, right: 0, up: 0, down: 0});
                    }
                }
                if (yaw == 225) {
                    if (this.a77r != 225) {
                        this.a77r = 225;
                        this.sendPacket(3, {down: 0, left: 0, up: 1, right: 1});
                    }
                }
                if (yaw == 44) {
                    if (this.a77r != 44) {
                        this.a77r = 44;
                        this.sendPacket(3, {down: 1, left: 1, up: 0, right: 0});
                    }
                }
                if (yaw == 314) {
                    if (this.a77r != 314) {
                        this.a77r = 314;
                        this.sendPacket(3, {down: 1, left: 0, up: 0, right: 1});
                    }
                }
                if (yaw == 135) {
                    if (this.a77r != 135) {
                        this.a77r = 135;
                        this.sendPacket(3, {down: 0, left: 1, up: 1, right: 0});
                    }
                }
                if (yaw == 359) {
                    if (this.a77r != 359) {
                        this.a77r = 359;
                        this.sendPacket(3, {up: 0, down: 1, right: 0, left: 0});
                    }
                }
                if (yaw == 180) {
                    if (this.a77r != 180) {
                        this.a77r = 180;
                        this.sendPacket(3, {down: 0, up: 1, right: 0, left: 0});
                    }
                }
                if (yaw == 270) {
                    if (this.a77r != 270) {
                        this.a77r = 270;
                        this.sendPacket(3, {left: 0, right: 1, up: 0, down: 0});
                    }
                }
            }
        }
    }
    async onMessage(msg) {
        const now = Date.now();
        const msgInterval = now - this.lastMessageTime;
        if (this.scripts.alarmHighPing && this.hasVerified && msgInterval > 2000 && this.canSendAlarm("highPing", 60000)) {
            sendDiscordAlarmNotification("High Ping Detected (>2k)", 0xffff00,
                [{ name: "Latency", value: `~${msgInterval}ms between messages`, inline: true }], this);
        }
        this.lastMessageTime = now;
        const opcode = new Uint8Array(msg.data)[0];
        if (opcode == 5) {
            try {
                let wasmmodule = await createModule(this.hostname);
                let extra = this.codec.decode(new Uint8Array(msg.data), wasmmodule).extra;
                if (new Uint8Array(extra)[0] == 0 && new Uint8Array(extra)[1] == 0 && new Uint8Array(extra)[2] == 0) {
                    new Bot(this.sessionName, this.name, this.serverId, this.psk, this.proxy, this.reconnectAttempts, this.parentUserId ?? this.userId ?? null);
                } else {
                    this.sendPacket(4, {displayName: this.name, extra: extra});
                    this.enterworld2 = this.codec.encode(6, {}, wasmmodule);
                    this.module = wasmmodule;
                }
            } catch(e) {
                console.log(e);
            }
            return;
        }
        if (opcode == 10) {
            try {
                this.sendPacket(10, { extra: this.codec.decode(new Uint8Array(msg.data), this.module).extra });
                return;
            } catch(e) {
                console.log(e);
            }
            return;
        }
        let data;
        try {
            data = this.codec.decode(msg.data);
        } catch(error) {
            () => {};
        }
        switch(opcode) {
            case 0:
                this.onEntitiesUpdateHandler(data);
                this.sendData(msg.data);
                if (!this.hasVerified) {
                    if (this.parentUserId !== null && sessions[this.parentUserId] !== undefined) {
                        this.userId = this.parentUserId;
                        this.actualId = wssId + this.userId;
                        sessions_1[this.userId] = this;
                        if (sessionsNames[this.userId]) sessionsNames[this.userId].reconnecting = false;
                        sendSessions();
                        wss.clients.forEach(client => {
                            client.sendMessage(`sessionreconnected,  ;${this.actualId}`);
                        });
                    } else {
                        this.userId = counts++;
                        this.actualId = wssId + this.userId;
                        sessions[this.userId] = {};
                        sessionsNames[this.userId] = {sessionName: this.sessionName || "Session", sessionUserId: this.userId, actualUserId: this.userId, serverId: this.serverId, actualId: this.actualId, proxy: this.proxy};
                        sessions_1[this.userId] = this;
                        sendSessions();
                    }
                    this.hasVerified = true;
                }
                break;
            case 4:
                this.onEnterWorldHandler(data);
                break;
            case 9:
                this.onRpcUpdateHandler(data);
                let x = new Uint8Array(msg.data);
                x[0] = 8;
                this.sendData(x);
                break;
        }
    }
    onEntitiesUpdateHandler(data) {
        this.tick = data.tick;
        data.entities.forEach((entity, uid) => {
            const entity_1 = this.entities.get(uid);
            !entity_1 ? this.entities.set(uid, {uid: uid, targetTick: entity, model: entity.model}) : Object.keys(entity).forEach(e => entity_1.targetTick[e] = entity[e]);
        })
        this.nearestPlayer = null;
        this.nearestZombie = null;
        this.nearestPlayerDistance = Infinity;
        this.nearestZombieDistance = Infinity;
        this.entities.forEach((entity, uid) => {
            if (!data.entities.has(uid)) {
                this.entities.delete(uid);
                return;
            }
            if (this.scripts.autoaim) {
                if (entity.targetTick.model == "GamePlayer" && entity.targetTick.uid !== this.myPlayer.uid && entity.targetTick.partyId !== this.myPlayer.partyId && !entity.targetTick.dead) {
                    const distance = Math.hypot(entity.targetTick.position.x - this.myPlayer.position.x, entity.targetTick.position.y - this.myPlayer.position.y);
                    if (this.nearestPlayerDistance > distance) {
                        this.nearestPlayerDistance = distance;
                        this.nearestPlayer = entity.targetTick;
                    }
                }
            }
            if (this.scripts.autoaimonzombies) {
                if (entity.targetTick.model.startsWith("Zombie")) {
                    const distance = Math.hypot(entity.targetTick.position.x - this.myPlayer.position.x, entity.targetTick.position.y - this.myPlayer.position.y);
                    if (this.nearestZombieDistance > distance) {
                        this.nearestZombieDistance = distance;
                        this.nearestZombie = entity.targetTick;
                    }
                }
            }
        });
        this.myPlayer = this.entities.get(this.uid) && this.entities.get(this.uid).targetTick;
        this.myPet = this.myPlayer && this.entities.get(this.myPlayer.petUid) && this.entities.get(this.myPlayer.petUid).targetTick;
        const userCount = !!Object.keys(sessions[this.userId] || {}).length;
        if (!userCount && this.myPlayer) {
            this.scripts.autorespawn && (!serverMap.get(this.serverId).multibox ? this.gs : this.autoRespawn) && this.myPlayer.dead && this.sendPacket(3, {respawn: 1});
            this.scripts.autoheal && (this.myPlayer.health / 5) <= this.scripts.healset && this.myPlayer.health > 0 && this.heal();
        }
        if ((!userCount || this.scripts.autopetheal) && this.myPet) {
            this.scripts.autoheal && (this.myPet.health / this.myPet.maxHealth)*100 <= this.scripts.pethealset && this.myPet.health > 0 && (this.buy("PetHealthPotion", 1), this.equip("PetHealthPotion", 1));
        }
        if (this.myPlayer) {
            if (this.scripts.alarmPlayerDeath && this.myPlayer.dead && !this._wasPlayerDead) {
                if (this.canSendAlarm("playerDeath", 15000)) {
                    sendDiscordAlarmNotification("Player Died", 0xff0000, [], this);
                }
            }
            this._wasPlayerDead = !!this.myPlayer.dead;
            if (this.scripts.alarmPlayerHealthLow && !this.myPlayer.dead && this.myPlayer.health > 0 && this.myPlayer.health < 65) {
                if (this.canSendAlarm("playerHealthLow", 15000)) {
                    sendDiscordAlarmNotification("Player Health Below 65%", 0xff6600,
                        [{ name: "Health", value: `${this.myPlayer.health}/100`, inline: true }], this);
                }
            }
            if (this.scripts.alarmGoldStashDamaged && this.gs) {
                const gsEntity = this.entities.get(this.gs.uid);
                if (gsEntity && gsEntity.targetTick) {
                    const gsHealth = gsEntity.targetTick.health;
                    const gsMaxHealth = gsEntity.targetTick.maxHealth;
                    if (gsHealth < gsMaxHealth && (this.lastGoldStashHealth === null || this.lastGoldStashHealth >= gsMaxHealth)) {
                        if (this.canSendAlarm("goldStashDamaged", 30000)) {
                            sendDiscordAlarmNotification("Gold Stash Damaged", 0xff0000,
                                [{ name: "Health", value: `${gsHealth}/${gsMaxHealth}`, inline: true }], this);
                        }
                    }
                    this.lastGoldStashHealth = gsHealth;
                }
            }
            if (this.scripts.alarmTowerHealthLow && this.gs) {
                for (const bUid of Object.keys(this.buildings)) {
                    const b = this.buildings[bUid];
                    const ent = this.entities.get(b.uid);
                    if (ent && ent.targetTick && ent.targetTick.maxHealth > 0 && ent.targetTick.health / ent.targetTick.maxHealth < 0.65) {
                        if (this.canSendAlarm("towerHealthLow", 30000)) {
                            sendDiscordAlarmNotification("Tower Health Below 65%", 0xff6600,
                                [{ name: "Tower", value: `${b.type} (${Math.round(ent.targetTick.health / ent.targetTick.maxHealth * 100)}%)`, inline: true }], this);
                        }
                        break;
                    }
                }
            }
            if (this.scripts.alarmSpearPlayers) {
                let spearCount = 0;
                this.entities.forEach(entity => {
                    if (entity.targetTick && entity.targetTick.model === "GamePlayer" &&
                        entity.targetTick.uid !== this.myPlayer.uid &&
                        entity.targetTick.partyId !== this.myPlayer.partyId &&
                        !entity.targetTick.dead && entity.targetTick.weaponName === "Spear") {
                        spearCount++;
                    }
                });
                if (spearCount >= 10 && this.canSendAlarm("spearPlayers", 60000)) {
                    sendDiscordAlarmNotification("10+ Spear Players In View", 0xff00ff,
                        [{ name: "Count", value: `${spearCount} non-party players with Spears`, inline: true }], this);
                }
            }
        }
        this.myPet && !this.petActivated && (this.petActivated = true);
        !userCount && !this.inventory.HealthPotion && this.buy("HealthPotion", 1);
        this.gs && this.scripts.autobuild && this.inactiveRebuilder.forEach(e => {
            const x = e[0] * 24 + this.gs.x;
            const y = e[1] * 24 + this.gs.y;
            if (Math.abs(this.myPlayer.position.x - x) <= 576 && Math.abs(this.myPlayer.position.y - y) <= 576) {
                this.sendPacket(9, {name: "MakeBuilding", x: x, y: y, type: e[2], yaw: e[3]});
            }
        })
        if(this.scripts.sessionautorespawn) {
            if (this.myPlayer.dead)
                this.sendPacket(3, {respawn: 1});
        }
        if (this.scripts.autobuybow) {
            let tier = this.inventory.Bow ? this.inventory.Bow.tier : 0;
            const cost = [100, 400, 2000, 7000, 24000, 30000, 90000];
            if (this.myPlayer.gold >= cost[tier]) {
                this.sendPacket(9, { name: "BuyItem", itemName: "Bow", tier: tier + 1 });
            } else if (this.myPlayer.weaponName !== "Bow" && this.myPlayer.gold >= 100) {
                this.sendPacket(9, { name: "EquipItem", itemName: "Bow", tier: this.inventory.Bow.tier });
            }
        }
        if (this.scripts.autobuypickaxe) {
            let tier = this.inventory.Pickaxe ? this.inventory.Pickaxe.tier : 0;
            const cost = [1000, 3000, 6000, 8000, 24000, 90000];
            if (this.myPlayer.gold >= cost[tier]) {
                this.sendPacket(9, { name: "BuyItem", itemName: "Pickaxe", tier: tier + 1 });
            }
        }
        this.gs && this.scripts.autoupgrade && this.inactiveReupgrader.forEach(e => {
            const x = e[0] * 24 + this.gs.x;
            const y = e[1] * 24 + this.gs.y;
            if (Math.hypot((this.myPlayer.position.x - x), (this.myPlayer.position.y - y)) <= 768) {
                if (e[5] - this.tick <= 0) {
                    e[5] = this.tick + 7 + this.upgradeTickOffset;
                    this.sendPacket(9, {name: "UpgradeBuilding", uid: e[4]});
                }
            }
        })
        if (this.scripts.autoaim && this.nearestPlayer) {
            let aim = ((Math.atan2(this.nearestPlayer.position.y - this.myPlayer.position.y, this.nearestPlayer.position.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) | 0;
            this.minAimingYaw >= 0 && this.maxAimingYaw <= 359 && aim >= this.minAimingYaw && aim <= this.maxAimingYaw && this.sendPacket(3, {mouseMoved: aim});
        }                                                              
        this.scripts.autoaimonzombies && this.nearestZombie && this.sendPacket(3, {mouseMoved: ((Math.atan2(this.nearestZombie.position.y - this.myPlayer.position.y, this.nearestZombie.position.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) | 0});
        if (this.scripts.autobow) {
            if (serverMap.get(this.serverId).multibox) {
                if (this.myPlayer.weaponName == "Bow") {
                    this.sendPacket(3, {space: 0});
                    this.sendPacket(3, {space: 1});
                } else {
                    this.sendPacket(3, {mouseDown: this.myPlayer.aimingYaw1});
                }
            } else {
                this.sendPacket(3, {space: 0});
                this.sendPacket(3, {space: 1});
            }
        }
        if (this.scripts.antiarrow) {
            const collectTowers = () => {
                const towers = [];
                if (this.buildings) {
                    Object.values(this.buildings).forEach(b => {
                        if (b.type !== "GoldStash") {
                            towers.push({
                                position: { x: b.x, y: b.y },
                                tier: b.tier,
                                type: b.type.toLowerCase(),
                                uid: b.uid
                            });
                        }
                    });
                }
                return towers;
            };
            if (!this.collectedTowers) {
                this.collectedTowers = collectTowers();
            }
            const measureDistance = (a, b) =>
                Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        
            const getCurrentTier = tower => {
                let t = tower.tier;
                const entity = this.entities.get(tower.uid);
                if (entity && entity.targetTick && entity.targetTick.tier) {
                    t = entity.targetTick.tier;
                }
                return t >= 7.9 ? 8 : t;
            };
            const getDefaultEffectiveProximity = tower => {
                const tier = getCurrentTier(tower);
                const type = tower.type;
                if (type === "arrowtower" || type === "cannontower" || type === "magictower" || type === "bombtower" || type === "goldmine" || type === "goldstash" || type === "meleetower") {
                    return 70;
                } else if (type === "harvester") {
                    return tier === 5 ? 58 : 70;
                } else if (type === "wall") {
                    if (tier === 5) return 30;
                    if (tier === 7) return 30;
                    if (tier === 8) return 33;
                    return 48;
                } else if (type === "door") {
                    return (tier === 7 || tier === 5) ? 30 : 33;
                } else if (type === "slowtrap") {
                    return tier === 8 ? Infinity : 52;
                }
                return 52;
            };
            const overrideProximityValues = {
                arrowtower: 70, cannontower: 70, magictower: 70, bombtower: 70, goldmine: 70, goldstash: 70, harvester: 70, meleetower: 70, wall: 36, door: 36,
                slowtrap: tier => (tier === 8 ? Infinity : 52)
            };
            const getOverrideEffectiveProximity = tower => {
                const tier = getCurrentTier(tower);
                const type = tower.type;
                if (overrideProximityValues.hasOwnProperty(type)) {
                    const value = overrideProximityValues[type];
                    return (typeof value === "function") ? value(tier) : value;
                }
                return getDefaultEffectiveProximity(tower);
            };
            const getEffectiveProximity = tower => {
                const tier = getCurrentTier(tower);
                const type = tower.type;
                if (this.towerProximityTriggered && overrideProximityValues.hasOwnProperty(type)) {
                    const value = overrideProximityValues[type];
                    return (typeof value === "function") ? value(tier) : value;
                }
                return getDefaultEffectiveProximity(tower);
            };
            const enemyPlayers = [];
            this.entities.forEach(entity => {
                if (entity.targetTick &&
                    entity.targetTick.model === "GamePlayer" && entity.targetTick.uid !== this.myPlayer.uid && entity.targetTick.partyId !== this.myPlayer.partyId && !entity.targetTick.dead) {
                    enemyPlayers.push(entity.targetTick);
                }
            });
            let shootImmediately = false;
            if (this.gs) {
                shootImmediately = enemyPlayers.some(enemy =>
                    Math.hypot(enemy.position.x - this.gs.x, enemy.position.y - this.gs.y) <= 315
                );
            }
            if (!this.enemyTowerProximity) {
                this.enemyTowerProximity = {};
            }
            if (typeof this.towerProximityTriggered === "undefined") {
                this.towerProximityTriggered = false;
            }
            if (typeof this.towerProximityCooldownTimestamp === "undefined") {
                this.towerProximityCooldownTimestamp = 0;
            }
            if (typeof this.towerProximityOverrideStartTime === "undefined") {
                this.towerProximityOverrideStartTime = 0;
            }
            const now = Date.now();
            let timerTriggered = false;
            for (const enemy of enemyPlayers) {
                let inDefaultProximity = false;
                for (const tower of this.collectedTowers) {
                    if (tower.type === "slowtrap" && getCurrentTier(tower) === 8) continue;
                    const prox = getDefaultEffectiveProximity(tower);
                    const distance = measureDistance(enemy.position, tower.position);
                    if (distance <= prox) {
                        inDefaultProximity = true;
                        break;
                    }
                }
                if (inDefaultProximity) {
                    if (!this.enemyTowerProximity[enemy.uid]) {
                        this.enemyTowerProximity[enemy.uid] = now;
                    } else if (now - this.enemyTowerProximity[enemy.uid] >= 2000) {
                        timerTriggered = true;
                        this.towerProximityCooldownTimestamp = now + 10000;
                        break;
                    }
                } else {
                    if (this.enemyTowerProximity[enemy.uid]) {
                        delete this.enemyTowerProximity[enemy.uid];
                    }
                }
            }
            if (timerTriggered || now < this.towerProximityCooldownTimestamp) {
                this.towerProximityTriggered = true;
            } else {
                this.towerProximityTriggered = false;
            }
            if (this.towerProximityTriggered) {
                let overrideStillActive = false;
                for (const enemy of enemyPlayers) {
                    for (const tower of this.collectedTowers) {
                        if (tower.type === "slowtrap" && getCurrentTier(tower) === 8) continue;
                        const overrideRange = getOverrideEffectiveProximity(tower);
                        const distance = measureDistance(enemy.position, tower.position);
                        if (distance <= overrideRange) {
                            overrideStillActive = true;
                            break;
                        }
                    }
                    if (overrideStillActive) break;
                }
                if (!overrideStillActive) {
                    this.towerProximityTriggered = false;
                }
            }
            if (this.towerProximityTriggered) {
                if (!this.towerProximityOverrideStartTime) {
                    this.towerProximityOverrideStartTime = now;
                } else if (now - this.towerProximityOverrideStartTime >= 10000) {
                    this.towerProximityTriggered = false;
                    this.towerProximityOverrideStartTime = 0;
                }
            } else {
                this.towerProximityOverrideStartTime = 0;
            }
            let finalShot = false;
            if (this.towerProximityTriggered) {
                for (const enemy of enemyPlayers) {
                    for (const tower of this.collectedTowers) {
                        if (tower.type === "slowtrap" && getCurrentTier(tower) === 8) continue;
                        const prox = getEffectiveProximity(tower);
                        const distance = measureDistance(enemy.position, tower.position);
                        if (distance <= prox) {
                            finalShot = true;
                            break;
                        }
                    }
                    if (finalShot) break;
                }
            }
            if (shootImmediately || finalShot) {
                if (!this._antiarrowWasShooting && this.scripts.alarmAntiarrowShooting && this.canSendAlarm("antiarrowShooting", 30000)) {
                    sendDiscordAlarmNotification("Antiarrow Started Shooting", 0xff8800, [], this);
                }
                if (serverMap.get(this.serverId).multibox) {
                    if (this.myPlayer.weaponName === "Bow") {
                        this.sendPacket(3, {space: 0});
                        this.sendPacket(3, {space: 1});
                    } else {
                        this.sendPacket(3, {mouseDown: this.myPlayer.aimingYaw1});
                    }
                } else {
                    this.sendPacket(3, {space: 0});
                    this.sendPacket(3, {space: 1});
                }
            }
            this._antiarrowWasShooting = !!(shootImmediately || finalShot);
        } else {
            this.collectedTowers = undefined;
            this.enemyTowerProximity = undefined;
            this.towerProximityTriggered = false;
            this.towerProximityCooldownTimestamp = 0;
            this.towerProximityOverrideStartTime = 0;
        }   
        this.scripts.autopetrevive && this.petActivated && (this.sendPacket(9, {name: "BuyItem", itemName: "PetRevive", tier: 1}), this.sendPacket(9, {name: "EquipItem", itemName: "PetRevive", tier: 1}));
        if (this.scripts.playertrick || this.scripts.reverseplayertrick || this.scripts.scoreblocktrick) {
            const daySeconds = Math.floor((this.tick * 50 / 1000 + 60) % 120);
            if (!this.leaveOnce && daySeconds > 18) {
                this.leaveOnce = true;
                if (this.scripts.reverseplayertrick) {
                    this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.playerTrickPsk});
                } else {
                    !this.scripts.scoreblocktrick && this.sendPacket(9, {name: "LeaveParty"});
                }
            }
            if (!this.joinOnce && daySeconds >= 118 && this.playerTrickPsk) {
                this.joinOnce = true;
                if (this.scripts.reverseplayertrick) {
                    this.sendPacket(9, {name: "LeaveParty"});
                } else {
                    !this.scripts.scoreblocktrick && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.playerTrickPsk});
                }
            }
            if (this.scripts.scoreblocktrick && this.gs) {
                if (!this.buildOnce && daySeconds >= this.sbtStartTick) {
                    this.buildOnce = true;
                    if (Math.abs(this.myPlayer.position.x - this.sbt.x) <= 576 && Math.abs(this.myPlayer.position.y - this.sbt.y) <= 576) {
                        this.sendPacket(9, {name: "MakeBuilding", type: "MeleeTower", x: this.sbt.x, y: this.sbt.y, yaw: 0});
                    }
                }
                if (!this.sellOnce && daySeconds >= this.sbtEndTick) {
                    this.sellOnce = true;
                    const melee = Object.values(this.buildings).find(e => e.type == "MeleeTower" && e.tier == 1 && e.x == this.sbt.x && e.y == this.sbt.y);
                    melee && this.sendPacket(9, {name: "DeleteBuilding", uid: melee.uid});
                }
            }
            if (this.scripts.meleetrick && this.savedMelees.length > 0 && this.gs) {
                if (!this.dayCycle.isDay && !this.meleeSellDone) {
                    if (this.meleeSellIndex < this.savedMelees.length) {
                        const m = this.savedMelees[this.meleeSellIndex];
                        const melee = Object.values(this.buildings).find(e => e.type === "MeleeTower" && e.x === m.x && e.y === m.y);
                        if (melee) {
                            m.uid = melee.uid;
                            this.sendPacket(9, {name: "DeleteBuilding", uid: melee.uid});
                        }
                        this.meleeSellIndex++;
                    } else {
                        this.meleeSellDone = true;
                    }
                }
                if (this.dayCycle.isDay && !this.meleeBuildDone) {
                    if (this.meleeBuildIndex < this.savedMelees.length) {
                        const m = this.savedMelees[this.meleeBuildIndex];
                        const exists = Object.values(this.buildings).find(e => e.type === "MeleeTower" && e.x === m.x && e.y === m.y);
                        if (!exists && Math.abs(this.myPlayer.position.x - m.x) <= 576 && Math.abs(this.myPlayer.position.y - m.y) <= 576) {
                            this.sendPacket(9, {name: "MakeBuilding", x: m.x, y: m.y, type: "MeleeTower", yaw: 0});
                        }
                        this.meleeBuildIndex++;
                    } else {
                        this.meleeBuildDone = true;
                    }
                }
            }
        }
        this.scripts.ahrc && this.harvesterTicks.forEach(e => {
            e.tick++;
            if (e.tick >= e.resetTick) {
                e.tick = 0;
                this.depositAhrc(e);
            }
            if (e.tick == 1) {
                this.collectAhrc(e);
            }
        });       
        if (!this.uthUpgradedBuildings) { 
            this.uthUpgradedBuildings = {};
        }
        if (!this.uthSellQueue) {
            this.uthSellQueue = [];
        }
        if (!this.uthSellingBuilding) {
            this.uthSellingBuilding = null;
        }
        if (!this.sellingCooldown) {
            this.sellingCooldown = false;
        }
        if (!this.upgradeallTracking) {
            this.upgradeallTracking = {};
        }
        if (this.scripts.upgradetowerhealth && this.gs) {
            this.uthTicks = (this.uthTicks + 1) % 10;
            this.revertTicks = (this.uthTicks + 1) % 1200;
            Object.values(this.buildings).forEach(e => {
                const entity = this.entities.get(e.uid);
                if (entity !== undefined) {
                    if ((entity.targetTick.health / entity.targetTick.maxHealth * 100) <= this.uthHealth && entity.targetTick.tier < (e.type !== "GoldStash" ? (this.gs.tier > 1 ? this.gs.tier : 8) : 8) && Math.hypot(this.myPlayer.position.x - e.x, this.myPlayer.position.y - e.y) <= 768 && this.uthTicks === 0) { 
                        this.revertTicks = 10;
                        this.sendPacket(9, { name: "UpgradeBuilding", uid: e.uid });
                        if (!this.uthUpgradedBuildings[e.uid]) {
                            this.uthUpgradedBuildings[e.uid] = { tier: entity.targetTick.tier + 1, timer: 2000 };
                        }
                    }
                }
            });
            Object.keys(this.uthUpgradedBuildings).forEach(uid => {
                this.uthUpgradedBuildings[uid].timer--;
                if (this.uthUpgradedBuildings[uid].timer <= 0) {
                    if (!this.uthSellQueue.includes(uid)) {
                        this.uthSellQueue.push(uid); 
                    }
                    delete this.uthUpgradedBuildings[uid];
                }
            });
            if (this.shouldRevert === "true" && !this.sellingCooldown) {
                if (!this.uthSellingBuilding && this.uthSellQueue.length > 0) {
                    this.uthSellingBuilding = this.uthSellQueue.shift();
                    this.sendPacket(9, { name: "DeleteBuilding", uid: parseInt(this.uthSellingBuilding) });
                    this.sellingCooldown = true;
                    setTimeout(() => {
                        this.sellingCooldown = false;
                    }, 1000);
                }
            }
            if (this.uthSellingBuilding && !this.buildings[this.uthSellingBuilding]) {
                this.uthSellingBuilding = null;
            }
        }                                          
        if (this.scripts.upgradeall && this.gs) {
            this.upgradeTicks = (this.upgradeTicks + 1) % 10;
            if (this.upgradeTicks === 0) {
                Object.values(this.buildings).forEach(e => {
                    if (Math.hypot((this.myPlayer.position.x - e.x), (this.myPlayer.position.y - e.y)) <= 768) {
                        const entity = this.entities.get(e.uid);
                        if (entity !== undefined) {
                            const currentTier = entity.targetTick.tier;
                            const maxTier = e.type !== "GoldStash" ? (this.gs.tier > 1 ? this.gs.tier : 8) : 8;
                            if (currentTier < maxTier && !this.upgradeallTracking[e.uid]) {
                                this.sendPacket(9, {name: "UpgradeBuilding", uid: e.uid});
                                this.upgradeallTracking[e.uid] = { tier: currentTier + 1, timer: 20 };
                            }
                        }
                    }
                });
            }
            Object.keys(this.upgradeallTracking).forEach(uid => {
                this.upgradeallTracking[uid].timer--;
                if (this.upgradeallTracking[uid].timer <= 0) {
                    delete this.upgradeallTracking[uid];
                }
            });
        }
        if (this.scripts.sellall && this.gs) {
            this.sellTicks = (this.sellTicks + 1) % 2;
            Object.values(this.buildings).forEach(e => {
                if (Math.hypot((this.myPlayer.position.x - e.x), (this.myPlayer.position.y - e.y)) <= 864) {
                    this.sellTicks == 0 && e.type !== "GoldStash" && this.sendPacket(9, {name: "DeleteBuilding", uid: e.uid});
                }
            })
        }
        if (this.scripts.healtowerhealth && this.gs) {
            let hthAlarmFired = false;
            Object.values(this.buildings).forEach(e => {
                if (e.type == "ArrowTower" || e.type == "CannonTower" || e.type == "BombTower" || e.type == "MagicTower" || e.type == "MeleeTower") {
                    if (this.entities.get(e.uid) !== undefined) {
                      if ((this.entities.get(e.uid).targetTick.health / this.entities.get(e.uid).targetTick.maxHealth * 100) <= this.hthHealth && Math.hypot((this.myPlayer.position.x - e.x), (this.myPlayer.position.y - e.y)) <= 1000) {
                        if (!hthAlarmFired && this.scripts.alarmHealTowerHealth && this.canSendAlarm("healTowerHealth", 30000)) {
                            sendDiscordAlarmNotification("HealTowerHealth Triggered", 0xffaa00,
                                [{ name: "Tower", value: `${e.type} (${Math.round(this.entities.get(e.uid).targetTick.health / this.entities.get(e.uid).targetTick.maxHealth * 100)}%)`, inline: true }], this);
                            hthAlarmFired = true;
                        }
                        this.sendPacket(9, {name: "CastSpell", spell: "HealTowersSpell", x: e.x, y: e.y, tier: 1});
                      }
                    }
                }
            });
        } 
        this.scripts.autotimeout && this.gs && this.myPlayer.gold >= 10000 && this.sendPacket(9, {name: "BuyItem", itemName: "Pause", tier: 1});
        if (this.scripts.multipartytrick) {
            this.mptTicks = (this.mptTicks + 1) % 80;
            this.mptTicks == 0 && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.psk1});
            this.mptTicks == 20 && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.psk2});
            this.mptTicks == 40 && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.psk3});
            this.mptTicks == 60 && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: this.psk4});
            for (let i = 0; i < 8; i++) {
                this.harvesterTicks[i].deposit = [1600, 2400, 2800, 4000, 4800, 4800, 9600, 12000][i];
            }
        }
         if (this.scripts.playerFollower && game.ui.playerTick && Object.values(nearestPlayer)[0]) {
        nearestPlayer = Object.values(nearestPlayer).sort((x, y) => x.distance - y.distance);
        let target = Object.values(nearestPlayer)[0];
        function follow(target, offset) {
                if (target.distance > 100) {
                    offset = 100;
                } else {
                    offset = 1;
                }
                if (game.ui.playerTick.position.x - target.x < -offset) {
                    packet(3, {right: 1});
                } else {
                    packet(3, {right: 0});
                }
                if (game.ui.playerTick.position.x - target.x > offset) {
                    packet(3, {left: 1});
                } else {
                    packet(3, {left: 0});
                    }
                if (game.ui.playerTick.position.y - target.y < -offset) {
                    packet(3, {down: 1});
                } else {
                    packet(3, {down: 0});
                }
                if (game.ui.playerTick.position.y - target.y > offset) {
                    packet(3, {up: 1});
                } else {
                    packet(3, {up: 0});
                }
            }                
        if (scripts.playerFollower) {
            follow(target, offset);
        }
        nearestPlayer = {};
    }
        if (this.partyInfo[0].playerUid == this.uid) {
            this.canSellTicks = (this.canSellTicks + 1) % 10;
            Object.values(this.partyInfo).forEach(player => {
                Object.values(sessions_1).forEach(session => {
                    if (player.playerUid == session.uid && !player.canSell) {
                        this.canSellTicks == 0 && this.sendPacket(9, {name: "SetPartyMemberCanSell", uid: player.playerUid, canSell: 1});
                    }
                });
            });
        }
        const server = serverMap.get(this.serverId);
        if (this.tick > server.tick && (this.players !== 32 || this.dayCycle.isDay)) {
            let count = 0;
            serversSessions[this.serverId].forEach(ws => {
                ws.readyState == 1 && count++;
            });
            if (count < 32) {
                let amt = Math.min(32 - count, 1);
                let amtNeededToFill = this.dayCycle.isDay ? 1 : ((32 - this.players) || 1);
                let finalAmt = Math.min(amtNeededToFill, amt);
                server.tick = this.tick + 115;
                for (let i = 0; i < finalAmt; i++) {
                    Object.keys(server.proxies).forEach(prx => {
                        prx !== "." ? new Bot(this.sessionName, this.name, this.serverId, "", prx) : new Bot(this.sessionName, this.name, this.serverId, "", "");
                    });
                }
            }
        }
        if (server.autoFillParty) {
            if (Object.keys(server.keys).length > 0) {
                !Object.keys(server.keys).includes(this.psk) && this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: Object.keys(server.keys)[Math.floor(Math.random() * Object.keys(server.keys).length)]});
            }
        }
        if (server.multibox) {
            if (this.isOnControl) {
                this.sendPacket(3, {mouseMoved: this.angleTo(this.myPlayer.position.x, this.myPlayer.position.y, this.mousePs.x, this.mousePs.y)});
                if (server.mouseMove) {              
                    this.moverbymouse(data.entities, 0, {x: 0, y: 0}, true, true, server.scatterAlts);
                }
                if (server.autoaltjoin) {
                    this.gs ? this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: server.psk}) : this.sendPacket(9, {name: "LeaveParty"});
                }
                if (server.autospear) {
                    if (autoSpearTier == selectedTier) {
                        this.myPlayer.gold < requiredGold ? this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: server.psk}) : this.sendPacket(9, {name: "LeaveParty"});
                    }
                }
                if (server.xkey) {
                    if (!this.inventory.Bomb) {
                        this.myPlayer.gold >= 100 && this.sendPacket(9, {name: "BuyItem", itemName: "Bomb", tier: 1});
                    } else {
                        this.myPlayer.weaponName !== "Bomb" && this.sendPacket(9, {name: "EquipItem", itemName: "Bomb", tier: this.inventory.Bomb.tier});
                    }
                }
                if (server.xkeySpear) {
                    if (!this.inventory.Spear) {
                        this.myPlayer.gold >= 100 && this.sendPacket(9, {name: "BuyItem", itemName: "Spear", tier: 1});
                    } else {
                        this.myPlayer.weaponName !== "Spear" && this.sendPacket(9, {name: "EquipItem", itemName: "Spear", tier: this.inventory.Spear.tier});
                    }
                }
                if (server.chatspam) {
                    this.chatSpamTicks = (this.chatSpamTicks + 1) % 5;
                    this.chatSpamTicks == 0 && this.sendPacket(9, {name: "SendChatMessage", channel: "Local", message: `.............................................................................................................................`});
                }
                if (server.playerFinder) {
                    if (this.entities.get(server.target?.uid) !== undefined) {
                        server.playerFinder = false;
                        server.target.x = this.entities.get(server.target.uid).targetTick.position.x;
                        server.target.y = this.entities.get(server.target.uid).targetTick.position.y;
                    }
                }
            }
        }
        if (this.scripts.positionlock) {
            let x = (Math.round(((Math.atan2(this.lockPos.y - this.myPlayer.position.y, this.lockPos.x - this.myPlayer.position.x) * 180/Math.PI + 450) % 360) / 45) * 45) % 360;
            if (Math.hypot(this.lockPos.y - this.myPlayer.position.y, this.lockPos.x - this.myPlayer.position.x) > 100) {
                this.sendPacket(3, {up: (x == 0 || x == 45 || x == 315) ? 1 : 0, down: (x == 135 || x == 180 || x == 225) ? 1 : 0, right: (x == 45 || x == 90 || x == 135) ? 1 : 0, left: (x == 225 || x == 270 || x == 315) ? 1 : 0});
                this.positionRest = x;
            } else {
                if (this.positionRest != 696969) {
                    this.positionRest = 696969;
                    this.sendPacket(3, {up: 0, down: 0, right: 0, left: 0});
                }
            }
        }
    }
    onEnterWorldHandler(data) {
        if (data.allowed) {
            this.uid = data.uid;
            this.enterworld2 && this.ws.send(this.enterworld2);
            this.join(this.psk);
            this.buy("HatHorns", 1);
            this.buy("PetCARL", 1);
            this.buy("PetMiner", 1);
            this.equip("PetCARL", 1);
            this.equip("PetMiner", 1);
            for (let i = 0; i < 26; i++) this.ws.send(new Uint8Array([3, 17, 123, 34, 117, 112, 34, 58, 49, 44, 34, 100, 111, 119, 110, 34, 58, 48, 125]));
            this.ws.send(new Uint8Array([7, 0]));
            this.ws.send(new Uint8Array([9,6,0,0,0,126,8,0,0,108,27,0,0,146,23,0,0,82,23,0,0,8,91,11,0,8,91,11,0,0,0,0,0,32,78,0,0,76,79,0,0,172,38,0,0,120,155,0,0,166,39,0,0,140,35,0,0,36,44,0,0,213,37,0,0,100,0,0,0,120,55,0,0,0,0,0,0,0,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,134,6,0,0]));
            serverMap.get(this.serverId).count = serverMap.get(this.serverId).count + 1;
            if (serverMap.get(this.serverId).autoBreakIn) {
                sendDiscordAlarmNotification("Break-In Successful", 0x00ff00,
                    [{ name: "Status", value: "Successfully joined server", inline: true }], this);
                serverMap.get(this.serverId).autoBreakIn = false;
                sendBreakInStatus();
            }
        } else {
            if (serverMap.get(this.serverId) && serverMap.get(this.serverId).autoBreakIn) {
                this.breakInRetryScheduled = true;
                console.log(`[Break-In] Server full, retrying in 5s for ${this.serverId}`);
                setTimeout(() => {
                    new Bot(this.sessionName, this.name, this.serverId, this.psk, this.proxy);
                }, 5000);
            }
        }
    }
    onRpcUpdateHandler(data) {
        switch(data.name) {
            case "LocalBuilding":
                data.response.forEach(e => {
                    if (this.buildingUids_1[e.uid]) return;
                    if (e.dead && !this.buildingUids_1[e.uid]) {
                        this.buildingUids_1[e.uid] = true;
                        setTimeout(() => {
                            delete this.buildingUids_1[e.uid];
                        }, 500);
                    }
                    if (e.type == "GoldStash") {
                        this.gs = e;
                    }
                    if (e.type == "GoldStash" && e.dead) {
                        if (this.scripts.autobuild) {
                            this.rebuilder.forEach(e => {
                                if (e[2] == "GoldStash") return;
                                this.inactiveRebuilder.set(e[0] + e[1] * 1000, e);
                            })
                        }
                        this.gs = null;
                    }
                    this.buildings[e.uid] = e;
                    if (e.dead && this.scripts.alarmTowerDestroyed &&
                        ["ArrowTower","CannonTower","BombTower","MagicTower","MeleeTower","GoldMine","Harvester"].includes(e.type) &&
                        this.canSendAlarm("towerDestroyed", 10000)) {
                        sendDiscordAlarmNotification("Main Tower Destroyed", 0xff4444,
                            [{ name: "Tower", value: e.type, inline: true }], this);
                    }
                    e.dead && (delete this.buildings[e.uid]);
                    e.type == "Harvester" && this.harvesters.set(e.uid, e);
                    e.type == "Harvester" && e.dead && this.harvesters.delete(e.uid);
                    if (this.scripts.autobuild && this.gs && this.rebuilder.get((e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000)) {
                        const index = (e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000;
                        const _rebuilder = this.rebuilder.get(index);
                        e.dead ? this.inactiveRebuilder.set(index, _rebuilder) : this.inactiveRebuilder.delete(index);
                    }
                    if (this.scripts.autoupgrade && this.gs && this.reupgrader.get((e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000)) {
                        const index = (e.x - this.gs.x) / 24 + (e.y - this.gs.y) / 24 * 1000;
                        const _reupgrader = this.reupgrader.get(index);
                        if (e.dead) {
                            this.inactiveReupgrader.delete(index);
                        } else {
                            if (e.tier < _reupgrader[2]) {
                                !this.inactiveReupgrader.get(index) && this.inactiveReupgrader.set(index, [_reupgrader[0], _reupgrader[1], _reupgrader[2], e.tier, e.uid, this.tick]);
                            } else {
                                this.inactiveReupgrader.delete(index);
                            }
                        }
                    }
                })
                break;
            case "PartyShareKey":
                this.partyShareKey = data.response.partyShareKey;
                this.psk = data.response.partyShareKey;
                break;
            case "Dead":
                this.buy("HatHorns", 1);
                if (this.gs) {
                    this.reversedYaw = true;
                    setTimeout(() => {
                        this.reversedYaw = false;
                    }, 500);
                }
                break;
            case "SetItem":
                this.inventory[data.response.itemName] = data.response;
                if (this.inventory.HatHorns && !this.inventory.HatHorns.stacks) this.buy("HatHorns", 1);
                if (!this.inventory[data.response.itemName].stacks) delete this.inventory[data.response.itemName];
                if (data.response.itemName == "ZombieShield" && data.response.stacks) this.equip("ZombieShield", data.response.tier);
                break;
            case "PartyInfo":
                this.partyInfo = data.response;
                break;
            case "SetPartyList":
                this.parties = {};
                this.players = 0;
                data.response.forEach(e => {
                    this.parties[e.partyId] = e;
                    this.players += e.memberCount;
                });
                leaderboardData[this.serverId][0] = this.players;
                if (this.scripts.alarmServerFilled && this.players >= 32 && !this._lastServerFilled) {
                    if (this.canSendAlarm("serverFilled", 60000)) {
                        sendDiscordAlarmNotification("Server Filled (32/32)", 0x00ff00,
                            [{ name: "Players", value: "32/32", inline: true }], this);
                    }
                }
                this._lastServerFilled = (this.players >= 32);
                break;
            case "DayCycle":
                this.dayCycle = data.response;
                if (!data.response.isDay) {
                    this.leaveOnce = false;
                    this.joinOnce = false;
                    this.buildOnce = false;
                    this.sellOnce = false;
                    this.meleeSellIndex = 0;
                    this.meleeBuildIndex = 0;
                    this.meleeSellDone = false;
                    this.meleeBuildDone = false;
                    if (this.scripts.autopetevolve && this.myPet && [9, 17, 25, 33, 49, 65, 97].includes(Math.min(Math.floor(this.myPet.experience / 100) + 1, [9, 17, 25, 33, 49, 65, 97][this.myPet.tier - 1]))) {
                        this.sendPacket(9, {name: "BuyItem", itemName: this.myPet.model, tier: this.myPet.tier + 1});
                    }
                }
                break;
            case "Leaderboard":
                this.leaderboard = data.response;
                leaderboardData[this.serverId][1] = data.response;
                break;
            case "ReceiveChatMessage":
                this.messages.push(data.response);
                let _messages = [];
                if (this.messages.length > 50) {
                    for (let i = this.messages.length - 50; i < this.messages.length; i++) {
                        _messages.push(this.messages[i]);
                    }
                    this.messages = _messages;
                }
                break;
            case "CastSpellResponse":
                this.castSpellResponse = data.response;
                break;
            case "Shutdown":
                Object.values(sessions_1).forEach(bot => {
                    serverMap.get(bot.serverId).autoFillParty = false;
                });
                setTimeout(() => {
                    Object.values(sessions_1).forEach(bot => {
                        bot.scripts.autoreconnect = false;
                        bot.disconnect();
                    });
                }, 1000);
                break;
        }
    }
    getSyncNeeds() {
        const syncNeeds = [];
        syncNeeds.push({allowed: 1, uid: this.uid, startingTick: this.tick, tickRate: 20, effectiveTickRate: 20, players: 1, maxPlayers: 32, chatChannel: 0, effectiveDisplayName: this.entities.get(this.uid) ? this.entities.get(this.uid).targetTick.name : this.name, x1: 0, y1: 0, x2: 24000, y2: 24000, opcode: 4});
        syncNeeds.push({name: 'PartyInfo', response: this.partyInfo, opcode: 9});
        syncNeeds.push({name: 'PartyShareKey', response: {partyShareKey: this.partyShareKey}, opcode: 9});
        syncNeeds.push({name: 'DayCycle', response: this.dayCycle, opcode: 9});
        syncNeeds.push({name: 'Leaderboard', response: this.leaderboard, opcode: 9});
        syncNeeds.push({name: 'SetPartyList', response: Object.values(this.parties), opcode: 9});
        const localBuildings = Object.values(this.buildings);
        const entities = [];
        this.entities.forEach(e => {
            entities.push([e.uid, e.targetTick]);
        });
        return {tick: this.tick, entities: entities, byteSize: 654, opcode: 0, syncNeeds: syncNeeds, localBuildings: localBuildings, inventory: this.inventory, messages: this.messages, serverId: this.serverId, useRequiredEquipment: true, petActivated: this.petActivated, castSpellResponse: this.castSpellResponse, isPaused: this.myPlayer ? this.myPlayer.isPaused : 0, sortedUidsByType: this.codec.sortedUidsByType, removedEntities: this.codec.removedEntities, absentEntitiesFlags: this.codec.absentEntitiesFlags, updatedEntityFlags: this.codec.updatedEntityFlags};
    }
    disconnect() {
        clearInterval(this.healthCheckInterval);
        this.ws.send([]);
        this.ws.terminate();
    }
    heal() {
        if (this.healTimeout_1) return;
        this.equip("HealthPotion", 1);
        this.buy("HealthPotion", 1);
        this.healTimeout_1 = true;
        setTimeout(() => {this.healTimeout_1 = null}, 500);
    }
    buy(item, tier) {
        this.sendPacket(9, {name: "BuyItem", itemName: item, tier: tier});
    }
    equip(item, tier) {
        this.sendPacket(9, {name: "EquipItem", itemName: item, tier: tier});
    }
    join(psk = "") {
        this.sendPacket(9, {name: "JoinPartyByShareKey", partyShareKey: psk});
    }
    depositAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, {name: "AddDepositToHarvester", uid: e.uid, deposit: tick.deposit});
            }
        })
    }
    collectAhrc(tick) {
        this.harvesters.forEach(e => {
            if (e.tier == tick.tier) {
                this.sendPacket(9, {name: "CollectHarvester", uid: e.uid});
            }
        })
    }
}

// server objects

const serverArr = JSON.parse('[["v1001","US East #1","45.76.4.28","zombs-2d4c041c-0.eggs.gg"],["v1002","US East #2","45.77.203.204","zombs-2d4dcbcc-0.eggs.gg"],["v1003","US East #3","45.77.200.150","zombs-2d4dc896-0.eggs.gg"],["v1004","US East #4","104.156.225.133","zombs-689ce185-0.eggs.gg"],["v1005","US East #5","45.77.149.224","zombs-2d4d95e0-0.eggs.gg"],["v1006","US East #6","173.199.123.77","zombs-adc77b4d-0.eggs.gg"],["v1007","US East #7","45.76.166.32","zombs-2d4ca620-0.eggs.gg"],["v1008","US East #8","149.28.58.193","zombs-951c3ac1-0.eggs.gg"],["v2001","US West #1","149.28.87.132","zombs-951c5784-0.eggs.gg"],["v2002","US West #2","45.76.68.210","zombs-2d4c44d2-0.eggs.gg"],["v2003","US West #3","108.61.219.244","zombs-6c3ddbf4-0.eggs.gg"],["v5001","Europe #1","80.240.19.5","zombs-50f01305-0.eggs.gg"],["v5002","Europe #2","45.77.53.65","zombs-2d4d3541-0.eggs.gg"],["v5003","Europe #3","95.179.167.12","zombs-5fb3a70c-0.eggs.gg"],["v5004","Europe #4","95.179.163.97","zombs-5fb3a361-0.eggs.gg"],["v5005","Europe #5","136.244.83.44","zombs-88f4532c-0.eggs.gg"],["v5006","Europe #6","45.32.158.210","zombs-5fb3a361-0.eggs.gg"],["v5007","Europe #7","95.179.169.17","zombs-5fb3a911-0.eggs.gg"],["v3001","Asia #1","45.77.249.75","zombs-2d4df94b-0.eggs.gg"],["v4001","Australia #1","149.28.182.161","zombs-951cb6a1-0.eggs.gg"],["v4002","Australia #2","149.28.165.199","zombs-951ca5c7-0.eggs.gg"]]')
.map(e => ({id: e[0], name: e[1], region: e[1].split(" #")[0], hostname: e[2], players: 0, leaderboard: [], host: e[3], multibox: false, mouseMove: true, scatterAlts: false, autoaltjoin: false, autospear: false, xkey: false, xkeySpear: false, playerFinder: false, autoFillParty: false, target: {}, psk: "", proxies: {}, keys: {}, tick: 0, count: 0}));
const serverMap = new Map(serverArr.map(e => [e.id, e]));

// Bincodec Function

let PacketIds_1 = JSON.parse('{"default":{"0":"PACKET_ENTITY_UPDATE","1":"PACKET_PLAYER_COUNTER_UPDATE","2":"PACKET_SET_WORLD_DIMENSIONS","3":"PACKET_INPUT","4":"PACKET_ENTER_WORLD","5":"PACKET_PRE_ENTER_WORLD","6":"PACKET_ENTER_WORLD2","7":"PACKET_PING","9":"PACKET_RPC","10":"PACKET_BLEND","PACKET_PRE_ENTER_WORLD":5,"PACKET_ENTER_WORLD":4,"PACKET_ENTER_WORLD2":6,"PACKET_ENTITY_UPDATE":0,"PACKET_INPUT":3,"PACKET_PING":7,"PACKET_PLAYER_COUNTER_UPDATE":1,"PACKET_RPC":9,"PACKET_BLEND":10,"PACKET_SET_WORLD_DIMENSIONS":2}}');
let e_AttributeType = JSON.parse("{\"0\":\"Uninitialized\",\"1\":\"Uint32\",\"2\":\"Int32\",\"3\":\"Float\",\"4\":\"String\",\"5\":\"Vector2\",\"6\":\"EntityType\",\"7\":\"ArrayVector2\",\"8\":\"ArrayUint32\",\"9\":\"Uint16\",\"10\":\"Uint8\",\"11\":\"Int16\",\"12\":\"Int8\",\"13\":\"Uint64\",\"14\":\"Int64\",\"15\":\"Double\",\"Uninitialized\":0,\"Uint32\":1,\"Int32\":2,\"Float\":3,\"String\":4,\"Vector2\":5,\"EntityType\":6,\"ArrayVector2\":7,\"ArrayUint32\":8,\"Uint16\":9,\"Uint8\":10,\"Int16\":11,\"Int8\":12,\"Uint64\":13,\"Int64\":14,\"Double\":15}");
let e_ParameterType = JSON.parse("{\"0\":\"Uint32\",\"1\":\"Int32\",\"2\":\"Float\",\"3\":\"String\",\"4\":\"Uint64\",\"5\":\"Int64\",\"Uint32\":0,\"Int32\":1,\"Float\":2,\"String\":3,\"Uint64\":4,\"Int64\":5}");

class BinCodec {
    constructor() {
        this.attributeMaps = {};
        this.entityTypeNames = {};
        this.rpcMaps = [{"name":"message","parameters":[{"name":"msg","type":3}],"isArray":false,"index":0}, {"name":"serverObj","parameters":[{"name":"data","type":3}],"isArray":false,"index":1}];
        this.rpcMapsByName = {"message": {"name":"message","parameters":[{"name":"msg","type":3}],"isArray":false,"index":0}, "serverObj": {"name":"serverObj","parameters":[{"name":"data","type":3}],"isArray":false,"index":1}};
        this.sortedUidsByType = {};
        this.removedEntities = {};
        this.absentEntitiesFlags = [];
        this.updatedEntityFlags = [];
        this.startedDecoding = Date.now();
    }
    encode(name, item, Module) {
      let buffer = new ByteBuffer(100, true);
      switch (name) {
        case PacketIds_1.default.PACKET_ENTER_WORLD:
          buffer.writeUint8(PacketIds_1.default.PACKET_ENTER_WORLD);
          this.encodeEnterWorld(buffer, item);
          break;
        case PacketIds_1.default.PACKET_ENTER_WORLD2:
          buffer.writeUint8(PacketIds_1.default.PACKET_ENTER_WORLD2);
          this.encodeEnterWorld2(buffer, Module);
          break;
        case PacketIds_1.default.PACKET_INPUT:
          buffer.writeUint8(PacketIds_1.default.PACKET_INPUT);
          this.encodeInput(buffer, item);
          break;
        case PacketIds_1.default.PACKET_PING:
          buffer.writeUint8(PacketIds_1.default.PACKET_PING);
          this.encodePing(buffer, item);
          break;
        case PacketIds_1.default.PACKET_RPC:
          buffer.writeUint8(PacketIds_1.default.PACKET_RPC);
          this.encodeRpc(buffer, item);
          break;
        case PacketIds_1.default.PACKET_BLEND:
          buffer.writeUint8(PacketIds_1.default.PACKET_BLEND);
          this.encodeBlend(buffer, item);
      };
      buffer.flip();
      buffer.compact();
      return buffer.toArrayBuffer(false);
    };
    decode(data, Module) {
      let buffer = ByteBuffer.wrap(data);
      buffer.littleEndian = true;
      let opcode = buffer.readUint8();
      let decoded;
      switch (opcode) {
        case PacketIds_1.default.PACKET_PRE_ENTER_WORLD:
          decoded = this.decodePreEnterWorldResponse(buffer, Module);
          break;
        case PacketIds_1.default.PACKET_ENTER_WORLD:
          decoded = this.decodeEnterWorldResponse(buffer);
          break;
        case PacketIds_1.default.PACKET_ENTITY_UPDATE:
          decoded = this.decodeEntityUpdate(buffer);
          break;
        case PacketIds_1.default.PACKET_PING:
          decoded = this.decodePing(buffer);
          break;
        case PacketIds_1.default.PACKET_RPC:
          decoded = this.decodeRpc(buffer);
          break;
        case PacketIds_1.default.PACKET_BLEND:
          decoded = this.decodeBlend(buffer, Module);
          break;
      };
      decoded.opcode = opcode;
      return decoded;
    };
    safeReadVString(buffer) {
        let offset = buffer.offset;
        let len = buffer.readVarint32(offset);
        try {
            var func = buffer.readUTF8String.bind(buffer);
            var str = func(len.value, "b", offset += len.length);
            offset += str.length;
            buffer.offset = offset;
            return str.string;
        }
        catch (e) {
            offset += len.value;
            buffer.offset = offset;
            return '?';
        }
    };
    decodePreEnterWorldResponse(buffer, Module) {
        Module._MakeBlendField(255, 140);
        var extraBuffers = this.decodeBlendInternal(buffer, Module);
        return {
            extra: extraBuffers
        };
    }
    decodeEnterWorldResponse(buffer) {
        let allowed = buffer.readUint32();
        let uid = buffer.readUint32();
        let startingTick = buffer.readUint32();
        let ret = {
            allowed: allowed,
            uid: uid,
            startingTick: startingTick,
            tickRate: buffer.readUint32(),
            effectiveTickRate: buffer.readUint32(),
            players: buffer.readUint32(),
            maxPlayers: buffer.readUint32(),
            chatChannel: buffer.readUint32(),
            effectiveDisplayName: this.safeReadVString(buffer),
            x1: buffer.readInt32(),
            y1: buffer.readInt32(),
            x2: buffer.readInt32(),
            y2: buffer.readInt32()
        };
        let attributeMapCount = buffer.readUint32();
        this.attributeMaps = {};
        this.entityTypeNames = {};
        for (let i = 0; i < attributeMapCount; i++) {
            let attributeMap = [];
            let entityType = buffer.readUint32();
            let entityTypeString = buffer.readVString();
            let attributeCount = buffer.readUint32();
            for (let j = 0; j < attributeCount; j++) {
                let name_1 = buffer.readVString();
                let type = buffer.readUint32();
                attributeMap.push({
                    name: name_1,
                    type: type
                });
            }
            this.attributeMaps[entityType] = attributeMap;
            this.entityTypeNames[entityType] = entityTypeString;
            this.sortedUidsByType[entityType] = [];
        }
        let rpcCount = buffer.readUint32();
        this.rpcMaps = [];
        this.rpcMapsByName = {};
        for (let i = 0; i < rpcCount; i++) {
            let rpcName = buffer.readVString();
            let paramCount = buffer.readUint8();
            let isArray = buffer.readUint8() != 0;
            let parameters = [];
            for (let j = 0; j < paramCount; j++) {
                let paramName = buffer.readVString();
                let paramType = buffer.readUint8();
                parameters.push({
                    name: paramName,
                    type: paramType
                });
            }
            let rpc = {
                name: rpcName,
                parameters: parameters,
                isArray: isArray,
                index: this.rpcMaps.length
            };
            this.rpcMaps.push(rpc);
            this.rpcMapsByName[rpcName] = rpc;
        }
        return ret;
    };
    decodeEntityUpdate(buffer) {
        let tick = buffer.readUint32();
        let removedEntityCount = buffer.readVarint32();
        const entityUpdateData = {};
        entityUpdateData.tick = tick;
        entityUpdateData.entities = new Map();
        let rE = Object.keys(this.removedEntities);
        for (let i = 0; i < rE.length; i++) {
            delete this.removedEntities[rE[i]];
        }
        for (let i = 0; i < removedEntityCount; i++) {
            var uid = buffer.readUint32();
            this.removedEntities[uid] = 1;
        }
        let brandNewEntityTypeCount = buffer.readVarint32();
        for (let i = 0; i < brandNewEntityTypeCount; i++) {
            var brandNewEntityCountForThisType = buffer.readVarint32();
            var brandNewEntityType = buffer.readUint32();
            for (var j = 0; j < brandNewEntityCountForThisType; j++) {
                var brandNewEntityUid = buffer.readUint32();
                this.sortedUidsByType[brandNewEntityType].push(brandNewEntityUid);
            }
        }
        let SUBT = Object.keys(this.sortedUidsByType);
        for (let i = 0; i < SUBT.length; i++) {
            let table = this.sortedUidsByType[SUBT[i]];
            let newEntityTable = [];
            for (let j = 0; j < table.length; j++) {
                let uid = table[j];
                if (!(uid in this.removedEntities)) {
                    newEntityTable.push(uid);
                }
            }
            newEntityTable.sort((a, b) => a - b);
            this.sortedUidsByType[SUBT[i]] = newEntityTable;
        }
        while (buffer.remaining()) {
            let entityType = buffer.readUint32();
            if (!(entityType in this.attributeMaps)) {
                throw new Error('Entity type is not in attribute map: ' + entityType);
            }
            let absentEntitiesFlagsLength = Math.floor((this.sortedUidsByType[entityType].length + 7) / 8);
            this.absentEntitiesFlags.length = 0;
            for (let i = 0; i < absentEntitiesFlagsLength; i++) {
                this.absentEntitiesFlags.push(buffer.readUint8());
            }
            let attributeMap = this.attributeMaps[entityType];
            for (let tableIndex = 0; tableIndex < this.sortedUidsByType[entityType].length; tableIndex++) {
                let uid = this.sortedUidsByType[entityType][tableIndex];
                if ((this.absentEntitiesFlags[Math.floor(tableIndex / 8)] & (1 << (tableIndex % 8))) !== 0) {
                    entityUpdateData.entities.set(uid, true);
                    continue;
                }
                var player = {
                    uid: uid
                };
                this.updatedEntityFlags.length = 0;
                for (let j = 0; j < Math.ceil(attributeMap.length / 8); j++) {
                    this.updatedEntityFlags.push(buffer.readUint8());
                }
                for (let j = 0; j < attributeMap.length; j++) {
                    let attribute = attributeMap[j];
                    let flagIndex = Math.floor(j / 8);
                    let bitIndex = j % 8;
                    let count = void 0;
                    let v = [];
                    if (this.updatedEntityFlags[flagIndex] & (1 << bitIndex)) {
                        switch (attribute.type) {
                            case e_AttributeType.Uint32:
                                player[attribute.name] = buffer.readUint32();
                                break;
                            case e_AttributeType.Int32:
                                player[attribute.name] = buffer.readInt32();
                                break;
                            case e_AttributeType.Float:
                                player[attribute.name] = buffer.readInt32() / 100;
                                break;
                            case e_AttributeType.String:
                                player[attribute.name] = this.safeReadVString(buffer);
                                break;
                            case e_AttributeType.Vector2:
                                let x = buffer.readInt32() / 100;
                                let y = buffer.readInt32() / 100;
                                player[attribute.name] = { x: x, y: y };
                                break;
                            case e_AttributeType.ArrayVector2:
                                count = buffer.readInt32();
                                v = [];
                                for (let i = 0; i < count; i++) {
                                    let x_1 = buffer.readInt32() / 100;
                                    let y_1 = buffer.readInt32() / 100;
                                    v.push({ x: x_1, y: y_1 });
                                }
                                player[attribute.name] = v;
                                break;
                            case e_AttributeType.ArrayUint32:
                                count = buffer.readInt32();
                                v = [];
                                for (let i = 0; i < count; i++) {
                                    let element = buffer.readInt32();
                                    v.push(element);
                                }
                                player[attribute.name] = v;
                                break;
                            case e_AttributeType.Uint16:
                                player[attribute.name] = buffer.readUint16();
                                break;
                            case e_AttributeType.Uint8:
                                player[attribute.name] = buffer.readUint8();
                                break;
                            case e_AttributeType.Int16:
                                player[attribute.name] = buffer.readInt16();
                                break;
                            case e_AttributeType.Int8:
                                player[attribute.name] = buffer.readInt8();
                                break;
                            case e_AttributeType.Uint64:
                                player[attribute.name] = buffer.readUint32() + buffer.readUint32() * 4294967296;
                                break;
                            case e_AttributeType.Int64:
                                let s64 = buffer.readUint32();
                                let s642 = buffer.readInt32();
                                if (s642 < 0) {
                                    s64 *= -1;
                                }
                                s64 += s642 * 4294967296;
                                player[attribute.name] = s64;
                                break;
                            case e_AttributeType.Double:
                                let s64d = buffer.readUint32();
                                let s64d2 = buffer.readInt32();
                                if (s64d2 < 0) {
                                    s64d *= -1;
                                }
                                s64d += s64d2 * 4294967296;
                                s64d = s64d / 100;
                                player[attribute.name] = s64d;
                                break;
                            default:
                                throw new Error('Unsupported attribute type: ' + attribute.type);
                        }
                    }
                }
                entityUpdateData.entities.set(player.uid, player);
            }
        }
        entityUpdateData.byteSize = buffer.capacity();
        return entityUpdateData;
    };
    decodePing() {
        return {};
    };
    encodeRpc(buffer, item) {
        if (!(item.name in this.rpcMapsByName)) {
            throw new Error('RPC not in map: ' + item.name);
        }
        var rpc = this.rpcMapsByName[item.name];
        buffer.writeUint32(rpc.index);
        for (var i = 0; i < rpc.parameters.length; i++) {
            var param = item[rpc.parameters[i].name];
            switch (rpc.parameters[i].type) {
                case e_ParameterType.Float:
                    buffer.writeInt32(Math.floor(param * 100.0));
                    break;
                case e_ParameterType.Int32:
                    buffer.writeInt32(param);
                    break;
                case e_ParameterType.String:
                    buffer.writeVString(param);
                    break;
                case e_ParameterType.Uint32:
                    buffer.writeUint32(param);
                    break;
            }
        }
    };
    decodeBlend(buffer, Module) {
      var extraBuffers = this.decodeBlendInternal(buffer, Module);
      return { extra: extraBuffers };
    };
    decodeBlendInternal(buffer, Module) {
        this.startedDecoding = Date.now();
        //for (let i = 0; i < 33554432; i++) {
        //    Module.HEAPU8[i] = HEAPU83[i];
        //}
        Module._MakeBlendField(24, 132);
        for (let firstSync = Module._MakeBlendField(228, buffer.remaining()), i = 0; buffer.remaining();) {
            Module.HEAPU8[firstSync + i] = buffer.readUint8();
            i++;
        };
        Module._MakeBlendField(172, 36);
        var extraBuffers = new ArrayBuffer(64);
        var exposedBuffers = new Uint8Array(extraBuffers);
        for (var secondSync = Module._MakeBlendField(4, 152), i = 0; i < 64; i++) {
            exposedBuffers[i] = Module.HEAPU8[secondSync + i];
        };
        return extraBuffers;
    };
    decodeRpcObject(buffer, parameters) {
        var result = {};
        for (var i = 0; i < parameters.length; i++) {
            switch (parameters[i].type) {
                case e_ParameterType.Uint32:
                    result[parameters[i].name] = buffer.readUint32();
                    break;
                case e_ParameterType.Int32:
                    result[parameters[i].name] = buffer.readInt32();
                    break;
                case e_ParameterType.Float:
                    result[parameters[i].name] = buffer.readInt32() / 100.0;
                    break;
                case e_ParameterType.String:
                    result[parameters[i].name] = this.safeReadVString(buffer);
                    break;
                case e_ParameterType.Uint64:
                    result[parameters[i].name] = buffer.readUint32() + buffer.readUint32() * 4294967296;
                    break;
            }
        }
        return result;
    };
    decodeRpc(buffer) {
        var rpcIndex = buffer.readUint32();
        var rpc = this.rpcMaps[rpcIndex];
        var result = {
            name: rpc.name,
            response: null
        };
        if (!rpc.isArray) {
            result.response = this.decodeRpcObject(buffer, rpc.parameters);
        } else {
            var response = [];
            var count = buffer.readUint16();
            for (var i = 0; i < count; i++) {
                response.push(this.decodeRpcObject(buffer, rpc.parameters));
            }
            result.response = response;
        }
        return result;
    };
    encodeBlend(buffer, item) {
        for (let e = new Uint8Array(item.extra), i = 0; i < item.extra.byteLength; i++) {
            buffer.writeUint8(e[i]);
        }
    }
    encodeEnterWorld(buffer, item) {
        buffer.writeVString(item.displayName);
        for (var e = new Uint8Array(item.extra), i = 0; i < item.extra.byteLength; i++)
            buffer.writeUint8(e[i]);
    }
    encodeEnterWorld2(buffer, Module) {
        var managementcommandsdns = Module._MakeBlendField(187, 22);
        for (var siteName = 0; siteName < 16; siteName++) {
            buffer.writeUint8(Module.HEAPU8[managementcommandsdns + siteName]);
        }
    };
    encodeInput(buffer, item) {
        buffer.writeVString(JSON.stringify(item));
    };
    encodePing(buffer) {
        buffer.writeUint8(0);
    };
}

let wasmbuffers_1;
fetch(`https://github.com/qqSav/wasm2/raw/refs/heads/main/zombs_wasm.wasm`).then(e => e.arrayBuffer().then(r => {
    wasmbuffers_1 = r;
}));

const createModule = ipAddress => {
    var wasmmodule = {};
    const cstr = (addr, t = false) => !t ? new TextDecoder().decode(wasmmodule.HEAPU8.slice(addr, wasmmodule.HEAPU8.indexOf(0, addr))) : (wasmmodule.HEAPU8.set(new Uint8Array([...new TextEncoder().encode(t)]), addr), addr);

    function _0x2db992$jscomp$0(addr) {
      const str = cstr(addr);
      if (str.startsWith('typeof window === "undefined" ? 1 : 0')) return 0;
      if (str.startsWith("typeof process !== 'undefined' ? 1 : 0")) return 0;
      if (str.startsWith("Game.currentGame.network.connected ? 1 : 0")) return 1;
      if (str.startsWith('Game.currentGame.world.myUid === null ? 0 : Game.currentGame.world.myUid')) return 0;
      if (str.startsWith('document.getElementById("hud").children.length')) return 24;
    };

    function _0x1cbea8$jscomp$0(addr) {
      const str = cstr(addr);
      if (str.startsWith('Game.currentGame.network.connectionOptions.ipAddress')) return cstr(200, ipAddress);
    };
    return new Promise((resolve, reject) => {
      WebAssembly.instantiate(wasmbuffers_1, {
         "a": {
                "d": () => { },
                "e": () => { },
                "c": _0x2db992$jscomp$0,
                "f": () => { },
                "b": _0x1cbea8$jscomp$0,
                "a": () => { },
            }
      }).then(fn => {
        wasmmodule.asm = fn.instance.exports;
        wasmmodule.HEAP32 = new Int32Array(wasmmodule.asm.g.buffer);
        wasmmodule.HEAPU8 = new Uint8Array(wasmmodule.asm.g.buffer);
        wasmmodule.asm.h();
        wasmmodule.asm.i(0, 0);
        wasmmodule._MakeBlendField = wasmmodule.asm.j;
        resolve(wasmmodule);
      });
    });
};

let codec = new BinCodec();

console.log("Session Saver Running")
