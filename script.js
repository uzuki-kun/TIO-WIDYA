/**
 * Adiwiyata Guardian: Tactical Strike
 * Logika Game menggunakan Three.js
 */

let scene, camera, renderer, clock, currentGun;
let guns = { 1: null, 2: null, 3: null };
let activeSlot = 1;
let player = { height: 1.7, speed: 0.15, health: 100 };
let score = 0;
let gameActive = false;
let enemies = [], bullets = [], particles = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let pitch = 0, yaw = 0;
let isFiring = false;
let lastFire = 0;

// Statistik untuk masing-masing senjata
const weaponStats = {
    1: { name: "SEED RIFLE", fireRate: 250, spread: 0.01, color: 0x00ff88, pellets: 1 },
    2: { name: "ECO SHOTGUN", fireRate: 800, spread: 0.15, color: 0xffff00, pellets: 8 },
    3: { name: "RAPID BLASTER", fireRate: 80, spread: 0.04, color: 0x00ffff, pellets: 1 }
};

/**
 * Inisialisasi Dunia 3D
 */
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Langit Cerah
    scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Pencahayaan Taktis
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    // Lantai Sekolah (Beton)
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xcccccc }); 
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Area Hijau (Taman)
    const gardenGeo = new THREE.PlaneGeometry(180, 180);
    const gardenMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    const garden = new THREE.Mesh(gardenGeo, gardenMat);
    garden.rotation.x = -Math.PI / 2;
    garden.position.y = 0.01;
    scene.add(garden);

    createArsenal();
    createSchoolBuildings();

    // Event Listeners
    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', (e) => onKey(e, false));
    document.addEventListener('mousedown', () => { isFiring = true; });
    document.addEventListener('mouseup', () => { isFiring = false; });
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);
    
    spawnEnemies(25);
    animate();
}

/**
 * Membuat Senjata (Viewmodel ala COD)
 */
function createArsenal() {
    guns[1] = createGunModel(0x333333, 0.8); // Model Rifle
    guns[2] = createGunModel(0x1a1a1a, 0.6); // Model Shotgun
    guns[3] = createGunModel(0x004422, 0.7); // Model Rapid

    Object.values(guns).forEach(gun => {
        camera.add(gun);
        gun.visible = false;
    });

    currentGun = guns[1];
    currentGun.visible = true;
    scene.add(camera);
}

function createGunModel(color, length) {
    const group = new THREE.Group();
    // Badan Senjata
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.18, length), 
        new THREE.MeshStandardMaterial({ color: color, metalness: 0.9, roughness: 0.1 })
    );
    // Laras Senjata
    const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.4), 
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -length/2 - 0.1;
    
    // Cahaya Muzzle Flash
    const muzzleLight = new THREE.PointLight(0x00ff88, 0, 1);
    muzzleLight.position.z = -length/2;
    
    group.add(body, barrel, muzzleLight);
    group.position.set(0.45, -0.35, -0.7);
    return group;
}

/**
 * Logika Penggantian Senjata
 */
function switchWeapon(id) {
    if (!guns[id]) return;
    Object.values(guns).forEach(g => g.visible = false);
    activeSlot = id;
    currentGun = guns[id];
    currentGun.visible = true;
    
    // Sinkronisasi dengan UI HTML
    const slots = document.querySelectorAll('.slot');
    if (slots.length > 0) {
        slots.forEach(s => s.classList.remove('active'));
        const activeElem = document.getElementById('slot' + id);
        if (activeElem) activeElem.classList.add('active');
    }
    const nameElem = document.getElementById('weapon-name');
    if (nameElem) nameElem.innerText = weaponStats[id].name;
}

/**
 * Lingkungan Sekolah (Gedung-gedung)
 */
function createSchoolBuildings() {
    const buildMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for(let i=0; i<8; i++) {
        const h = 10 + Math.random() * 10;
        const b = new THREE.Mesh(new THREE.BoxGeometry(15, h, 30), buildMat);
        const angle = (i / 8) * Math.PI * 2;
        b.position.set(Math.cos(angle) * 70, h/2, Math.sin(angle) * 70);
        b.rotation.y = -angle;
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
    }
}

/**
 * Logika Menembak
 */
function shoot() {
    const now = Date.now();
    const stat = weaponStats[activeSlot];
    if(now - lastFire < stat.fireRate) return;
    lastFire = now;

    // Animasi Recoil
    currentGun.position.z += 0.15;
    
    for(let i=0; i<stat.pellets; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: stat.color }));
        b.position.copy(camera.position);
        
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        dir.x += (Math.random()-0.5) * stat.spread;
        dir.y += (Math.random()-0.5) * stat.spread;
        
        b.userData = { velocity: dir.multiplyScalar(1.5), life: 100 };
        scene.add(b);
        bullets.push(b);
    }
}

/**
 * Membuat Musuh (Polusi)
 */
function spawnEnemies(count) {
    const geo = new THREE.IcosahedronGeometry(1.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x330000 });
    for(let i=0; i<count; i++) {
        const en = new THREE.Mesh(geo, mat);
        en.position.set(Math.random()*100-50, 1.2, Math.random()*100-50);
        en.userData = { velocity: new THREE.Vector3((Math.random()-0.5)*0.1, 0, (Math.random()-0.5)*0.1) };
        en.castShadow = true;
        scene.add(en);
        enemies.push(en);
    }
}

/**
 * Input Handler
 */
function handleKey(e) {
    onKey(e, true);
    if(e.key === '1') switchWeapon(1);
    if(e.key === '2') switchWeapon(2);
    if(e.key === '3') switchWeapon(3);
}

function onKey(e, val) {
    if(e.code === 'KeyW') moveForward = val;
    if(e.code === 'KeyS') moveBackward = val;
    if(e.code === 'KeyA') moveLeft = val;
    if(e.code === 'KeyD') moveRight = val;
}

function onMouseMove(e) {
    if (!gameActive) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, pitch));
}

function startGame() {
    const menu = document.getElementById('instructions');
    if (menu) menu.style.display = 'none';
    gameActive = true;
    document.body.requestPointerLock();
}

/**
 * Loop Permainan Utama
 */
function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        renderer.render(scene, camera);
        return;
    }

    const time = clock.getElapsedTime();
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    // Pergerakan Taktis
    const moveDir = new THREE.Vector3();
    if(moveForward) moveDir.z -= 1;
    if(moveBackward) moveDir.z += 1;
    if(moveLeft) moveDir.x -= 1;
    if(moveRight) moveDir.x += 1;
    
    if(moveDir.length() > 0) {
        moveDir.normalize().applyQuaternion(camera.quaternion);
        moveDir.y = 0;
        camera.position.add(moveDir.multiplyScalar(player.speed));
        
        // Animasi Berjalan (Sway)
        currentGun.position.y = -0.35 + Math.sin(time * 12) * 0.015;
        currentGun.position.x = 0.45 + Math.cos(time * 6) * 0.01;
    }
    
    // Smooth Recovery Recoil
    currentGun.position.z += (-0.7 - currentGun.position.z) * 0.15;

    if(isFiring) shoot();

    // Update Peluru & Deteksi Tabrakan
    for(let i=bullets.length-1; i>=0; i--) {
        const b = bullets[i];
        b.position.add(b.userData.velocity);
        b.userData.life--;
        
        enemies.forEach((en, eIdx) => {
            if(b.position.distanceTo(en.position) < 2) {
                // Efek Transformasi: Musuh hancur dan jadi pohon
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3), new THREE.MeshStandardMaterial({color: 0x4d2926}));
                trunk.position.set(en.position.x, 1.5, en.position.z);
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.5), new THREE.MeshStandardMaterial({color: 0x228b22}));
                leaf.position.set(en.position.x, 3.5, en.position.z);
                scene.add(trunk, leaf);

                scene.remove(en);
                enemies.splice(eIdx, 1);
                scene.remove(b);
                bullets.splice(i, 1);
                
                score++;
                const scoreElem = document.getElementById('score');
                if (scoreElem) scoreElem.innerText = score;
                
                if(score >= 25) {
                    gameActive = false;
                    document.exitPointerLock();
                    const winScreen = document.getElementById('ending-screen');
                    if (winScreen) winScreen.style.display = 'flex';
                }
            }
        });

        if(b.userData.life <= 0 && bullets[i]) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }

    // AI Musuh (Pergerakan Acak)
    enemies.forEach(en => {
        en.position.add(en.userData.velocity);
        if(Math.abs(en.position.x) > 85) en.userData.velocity.x *= -1;
        if(Math.abs(en.position.z) > 85) en.userData.velocity.z *= -1;
        en.rotation.x += 0.02;
        en.rotation.y += 0.02;
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
