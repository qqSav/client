

window.mustNotInclude = {
    "yaw": 0,
    "health": 100,
    "maxHealth": 100,
    "damage": 10,
    "height": 32,
    "width": 32,
    "collisionRadius": 70,
    "entityClass": "Prop",
    "dead": 0,
    "timeDead": 0,
    "slowed": 0,
    "stunned": 0,
    "hits": [],
    "interpolatedYaw": 0
}

window.toInclude = (entity) => {
    let data = {};
    for (let i in window.mustNotInclude) {
        entity[i] = window.mustNotInclude[i];
    }
    return entity;
}

window.getRealPosOfIndex = (index) => {
    return {
        x: ((((index * 100).toFixed(2) - "") % 5000000) | 0) / 100,
        y: (index / 50000 | 0) / 100
    }
}

window.decodeSpotJSON = (json) => {
    let arr = JSON.parse(json);
    let obj = {};
    for (let i = 0; i < arr.length; i++) {
        arr[i] && (obj[i + 1] = {
            model: window.detectModelByUid(i + 1),
            position: window.getRealPosOfIndex(arr[i]),
            uid: i + 1
        });
    }
    return obj;
}

window.detectModelByUid = (uid) => {
    if (0 < uid && uid <= 400) {
        return "Tree";
    }
    if (400 < uid && uid <= 800) {
        return "Stone";
    }
    if (800 < uid && uid <= 825) {
        return "NeutralCamp";
    }
}
// keeps trees, stones and camps
game.world.removeEntity2 = game.world.removeEntity;
game.world.removeEntity = (uid) => {
    if (game.world.entities.get(uid).fromTick.model == "Tree" || game.world.entities.get(uid).fromTick.model == "Stone" || game.world.entities.get(uid).fromTick.model == "NeutralCamp") return;
    game.world.removeEntity2(uid);
};

game.world.oldCreateEntity = game.world.createEntity;
game.world.createEntity = e => {
    if (document.disableZombieEntity && (e.entityClass == "Npc" && !e.model.startsWith("ZombieBossTier"))) return;
    if (document.disableProjectileEntity && e.entityClass == "Projectile") return;
    if (document.disableTowerEntity && (e.model == "Door" || e.model == "Wall" || e.model == "SlowTrap" || e.model == "ArrowTower" || e.model == "CannonTower" || e.model == "BombTower" || e.model == "MeleeTower" || e.model == "MagicTower" || e.model == "Harvester" || e.model == "GoldMine")) return;
    if (game.world.entities.get(e.uid)) return;
    if (e.entityClass) {
        game.world.oldCreateEntity(e);
    }
}

fetch("https://raw.githubusercontent.com/LBBZombs/zombs-server-spots/refs/heads/main/zombs_server_spots.wasm").then(e => e.text()).then(e => eval(e));

game.network.addPacketHandler(4, data => {
    if (data.allowed) {
        setTimeout(() => {
            if (serverspots[game.options.serverId]) {
                let spots = decodeSpotJSON(serverspots[game.options.serverId].spotEncoded);
                game.world.spots = spots;
                game.world.toInclude = toInclude;
                for (let i in spots) {
                    let entity = toInclude(spots[i]);
                    if (!document.disableServerSpots) {
                        game.world.createEntity(entity);
                    }
                }
            }
        }, 1000)
    }
});

// apex zoom

let dimension = 2;
let targetDimension = dimension;
let zoomSpeed = 0.1;

const onWindowResize = () => {
    const { renderer } = Game.currentGame;
    const { innerWidth, innerHeight, devicePixelRatio } = window;
    const canvasWidth = innerWidth * devicePixelRatio;
    const canvasHeight = innerHeight * devicePixelRatio;
    const ratio = Math.max(canvasWidth / (1920 * dimension), canvasHeight / (1080 * dimension));
    Object.assign(renderer, {
        scale: ratio,
        viewport: {
            width: renderer.renderer.width / ratio + 2 * renderer.viewportPadding,
            height: renderer.renderer.height / ratio + 2 * renderer.viewportPadding
        }
    });
    renderer.entities.setScale(ratio);
    renderer.ui.setScale(ratio);
    renderer.renderer.resize(canvasWidth, canvasHeight);
};

const animateZoom = () => {
    if (dimension !== targetDimension) {
        dimension += (targetDimension - dimension) * zoomSpeed;
        onWindowResize();
        requestAnimationFrame(animateZoom);
    }
};

onWindowResize();
window.onresize = onWindowResize;

window.onwheel = ({ deltaY }) => {
    targetDimension = Math.max(1, Math.min(50, targetDimension + (deltaY > 0 ? 1 : -1)));
    animateZoom();
};
