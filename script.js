const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const p1ScoreTxt = document.getElementById('p1-score');
const p2ScoreTxt = document.getElementById('p2-score');

const BASE_GRAVITY = 0.44; 
const FLOOR_Y = canvas.height - 100; 
const NET_W = 14;
const NET_H = 270; 

// 서브라인 영역 설정
const SERVE_LINE_1P = 300;  
const SERVE_LINE_2P = 1400; 

let score = { p1: 0, p2: 0 };
let gameMsg = "MATCH START";
let msgTimer = 130;
let shakeFrames = 0; 
let currentServer = 1; 
let isServingPhase = true; 
let isGameOver = false;

let p1Touches = 0;
let p2Touches = 0;
let lastTouchPlayer = null; 
let isAutoReceiveShot = false; 

// 🖼️ 실제 웹툰 캐릭터 PNG 이미지 객체 생성 및 경로 지정
const imgP1 = new Image();
imgP1.src = 'p1_character.png'; 

const imgP2 = new Image();
imgP2.src = 'p2_character.png'; 

const imgSetter = new Image();
imgSetter.src = 'setter_character.png'; 

class Spiker {
    constructor(x, color, side, imgObject) {
        this.x = x; 
        this.y = FLOOR_Y - 140; 
        this.width = 90;        
        this.height = 140;      
        this.radius = 28; 
        this.vx = 0; this.vy = 0; this.isJumping = false;
        this.color = color; this.side = side; this.speed = 9.2;
        this.img = imgObject;
    }
    update(ignoreLimits = false) {
        this.x += this.vx; this.y += this.vy;
        this.vy += BASE_GRAVITY;

        if (this.y > FLOOR_Y - this.height) { 
            this.y = FLOOR_Y - this.height; 
            this.vy = 0; 
            this.isJumping = false; 
        }
        
        if (!ignoreLimits) {
            let leftLimit = 60; let rightLimit = canvas.width/2 - 60;
            if (this.side === 'right') { leftLimit = canvas.width/2 + 60; rightLimit = canvas.width - 60; }
            if (this.x < leftLimit) this.x = leftLimit;
            if (this.x > rightLimit) this.x = rightLimit;
        } else {
            if (this.x < 55) this.x = 55;
            if (this.x > canvas.width - 55) this.x = canvas.width - 55;
        }
        this.vx = 0;
    }
    draw() {
        ctx.save();
        // 발밑 그림자 생성
        let shadowSize = this.isJumping ? 30 - (FLOOR_Y - (this.y + this.height)) * 0.02 : 45;
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath(); 
        ctx.ellipse(this.x, FLOOR_Y + 4, shadowSize, shadowSize * 0.25, 0, 0, Math.PI * 2); 
        ctx.fill();

        // 이미지가 로드 완료되었을 때 화면에 드로우
        if (this.img.complete && this.img.width > 0) {
            if (this.side === 'right') {
                ctx.translate(this.x, this.y);
                ctx.scale(-1, 1); // 2P 우측 진영은 좌측을 바라보도록 이미지 반전
                ctx.drawImage(this.img, -this.width/2, 0, this.width, this.height);
            } else {
                ctx.drawImage(this.img, this.x - this.width/2, this.y, this.width, this.height);
            }
        } else {
            // 이미지가 없거나 로딩 중일 때 표시되는 임시 사각형 박스
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("PNG 이미지 필요", this.x, this.y + 30);
        }
        ctx.restore();
    }
}

const players = {
    p1: new Spiker(180, '#ff6d00', 'left', imgP1),
    p2: new Spiker(1520, '#00b8d4', 'right', imgP2)
};

const setters = [
    new Spiker(620, '#ffcc80', 'left', imgSetter),
    new Spiker(1080, '#80deea', 'right', imgSetter)
];
setters[0].base = 620;
setters[1].base = 1080;

const ball = { x: 200, y: 320, vx: 0, vy: 0, radius: 19, isSmashed: false, rotation: 0 };
const keys = {};

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function triggerHit(type) {
    gameMsg = type; msgTimer = 45;
    if (type.includes("SPIKE") || type.includes("FAULT") || type.includes("ATTACK")) { shakeFrames = 15; ball.isSmashed = true; }
    else { ball.isSmashed = false; }
}

function triggerScore(winner) {
    if (winner === 'p1') { score.p1++; p1ScoreTxt.textContent = score.p1 < 10 ? '0' + score.p1 : score.p1; currentServer = 1; } 
    else { score.p2++; p2ScoreTxt.textContent = score.p2 < 10 ? '0' + score.p2 : score.p2; currentServer = 2; }
    p1Touches = 0; p2Touches = 0; lastTouchPlayer = null;

    if (score.p1 >= 15 || score.p2 >= 15) {
        isGameOver = true; gameMsg = winner === 'p1' ? "PLAYER 1 WIN!" : "PLAYER 2 WIN!"; msgTimer = 9999;
    } else {
        initServe(); 
    }
}

function initServe() {
    if (isGameOver) return;
    isServingPhase = true; ball.isSmashed = false; ball.vy = 0; ball.vx = 0; isAutoReceiveShot = false;

    if (currentServer === 1) {
        players.p1.x = 120; ball.x = 120; ball.y = FLOOR_Y - 100;
        triggerHit("1P SERVE TIME");
    } else {
        players.p2.x = 1580; ball.x = 1580; ball.y = FLOOR_Y - 100;
        triggerHit("2P SERVE TIME");
    }
}

function update() {
    if (isGameOver) return;

    if (isServingPhase) {
        if (keys['a']) players.p1.vx = -players.p1.speed; if (keys['d']) players.p1.vx = players.p1.speed;
        if (keys['w'] && !players.p1.isJumping) { players.p1.vy = -16.5; players.p1.isJumping = true; }

        if (keys['arrowleft']) players.p2.vx = -players.p2.speed; if (keys['arrowright']) players.p2.vx = players.p2.speed;
        if (keys['arrowup'] && !players.p2.isJumping) { players.p2.vy = -16.5; players.p2.isJumping = true; }

        if (currentServer === 1) {
            if (!players.p1.isJumping && players.p1.x >= SERVE_LINE_1P) {
                triggerScore('p2'); triggerHit("⚠️ 1P LINE FAULT!"); return;
            }
        } else {
            if (!players.p2.isJumping && players.p2.x <= SERVE_LINE_2P) {
                triggerScore('p1'); triggerHit("⚠️ 2P LINE FAULT!"); return;
            }
        }

        if (currentServer === 1) {
            if (players.p1.isJumping) {
                if (players.p1.vy >= -3 && players.p1.vy <= 3) { 
                    ball.x = players.p1.x + 25; ball.y = players.p1.y + 20; ball.vy = 2.0; 
                    let speed = 26; let angle = 85 * Math.PI / 180;
                    ball.vx = speed * Math.cos(angle * 0.12); ball.vy = speed * Math.sin(angle * 0.08);

                    if (Math.random() < 0.5) { isAutoReceiveShot = true; ball.vx = (players.p2.x - ball.x) / 34; }
                    isServingPhase = false; lastTouchPlayer = 'p1'; p1Touches = 1;
                    triggerHit("💥 JUMP SERVE");
                } else { ball.x = players.p1.x; ball.y = players.p1.y - 40; }
            } else { ball.x = players.p1.x; ball.y = FLOOR_Y - 100; }
        } 
        else { 
            if (players.p2.isJumping) {
                if (players.p2.vy >= -3 && players.p2.vy <= 3) {
                    ball.x = players.p2.x - 25; ball.y = players.p2.y + 20; ball.vy = 2.0;
                    let speed = 26;
                    ball.vx = -speed * Math.cos(85 * Math.PI / 180 * 0.12); ball.vy = speed * Math.sin(85 * Math.PI / 180 * 0.08);

                    if (Math.random() < 0.5) { isAutoReceiveShot = true; ball.vx = (players.p1.x - ball.x) / 34; }
                    isServingPhase = false; lastTouchPlayer = 'p2'; p2Touches = 1;
                    triggerHit("💥 JUMP SERVE");
                } else { ball.x = players.p2.x; ball.y = players.p2.y - 40; }
            } else { ball.x = players.p2.x; ball.y = FLOOR_Y - 100; }
        }
        players.p1.update(true); players.p2.update(true);
        return;
    }

    if (keys['a']) players.p1.vx = -players.p1.speed; if (keys['d']) players.p1.vx = players.p1.speed;
    if (keys['w'] && !players.p1.isJumping) { players.p1.vy = -16.5; players.p1.isJumping = true; }

    if (keys['arrowleft']) players.p2.vx = -players.p2.speed; if (keys['arrowright']) players.p2.vx = players.p2.speed;
    if (keys['arrowup'] && !players.p2.isJumping) { players.p2.vy = -16.5; players.p2.isJumping = true; }

    players.p1.update(false); players.p2.update(false);

    ball.y += ball.vy; ball.vy += BASE_GRAVITY * 0.65; ball.x += ball.vx;
    ball.rotation += ball.vx * 0.03;

    setters.forEach((s) => {
        s.y += s.vy; s.vy += BASE_GRAVITY;
        if (s.y > FLOOR_Y - s.height) { s.y = FLOOR_Y - s.height; s.vy = 0; s.isJumping = false; }

        if ((s.side === 'left' && ball.x < canvas.width/2 && ball.vx < 0) || (s.side === 'right' && ball.x > canvas.width/2 && ball.vx > 0)) {
            s.x += (ball.x - s.x) * 0.28; 
        } else { s.x += (s.base - s.x) * 0.05; }

        let dx = ball.x - s.x; let dy = ball.y - (s.y + s.height/2);
        let teamTouches = s.side === 'left' ? p1Touches : p2Touches;
        let partner = s.side === 'left' ? players.p1 : players.p2;

        if (Math.sqrt(dx*dx + dy*dy) < ball.radius + 65) {
            if (teamTouches < 3) {
                let isPlayerAvailable = (s.side === 'left') ? (partner.x < canvas.width/2 - 60) : (partner.x > canvas.width/2 + 60);
                let mustSendOver = (teamTouches === 2) || !isPlayerAvailable;

                if (mustSendOver) {
                    ball.vy = 4.5; ball.vx = (s.side === 'left' ? 18 : -18);
                    s.vy = -6; s.isJumping = true;
                    if (s.side === 'left') p1Touches++; else p2Touches++;
                    lastTouchPlayer = s.side === 'left' ? 's1' : 's2';
                    triggerHit("🔥 DIRECT ATTACK!");
                } 
                else {
                    ball.vy = -23.5; 
                    ball.vx = (partner.x - s.x) * 0.042; 
                    s.vy = -6.5; s.isJumping = true;
                    if (s.side === 'left') p1Touches++; else p2Touches++;
                    lastTouchPlayer = s.side === 'left' ? 's1' : 's2';
                    triggerHit("🏐 HIGH TOSS");
                }
            }
        }
    });

    // 🕹️ 유저 스파이크 타점 유효 범위 확장 버프 설정 (115px 마진)
    Object.keys(players).forEach((pKey, idx) => {
        const p = players[pKey];
        let dx = ball.x - p.x; 
        let dy = ball.y - (p.y + p.height/3); 
        let dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < ball.radius + 115) { 
            let actionKey = (idx === 0) ? keys['t'] : keys['enter'];

            if (p.isJumping && actionKey) {
                if (idx === 0) p1Touches++; else p2Touches++;
                lastTouchPlayer = pKey;

                let speed = 25;
                ball.vx = (idx === 0) ? speed * 0.5 : -speed * 0.5;
                ball.vy = speed * 0.85;
                triggerHit("💥 SMASH SPIKE");
            } 
            else if (lastTouchPlayer !== pKey) {
                ball.vy = -16; ball.vx = (idx === 0) ? 4.5 : -4.5;
                if (idx === 0) p1Touches = 1; else p2Touches = 1;
                lastTouchPlayer = pKey;
                triggerHit("🛡️ RECEIVE");
            }
        }
    });

    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
    const netX = canvas.width/2 - NET_W/2;
    if (ball.x + ball.radius > netX && ball.x - ball.radius < netX + NET_W && ball.y > FLOOR_Y - NET_H) {
        ball.vx *= -0.7; ball.x = ball.x < canvas.width/2 ? netX - ball.radius : netX + NET_W + ball.radius;
    }

    if (ball.y + ball.radius >= FLOOR_Y) {
        if (ball.x < canvas.width / 2) triggerScore('p2'); else triggerScore('p1');
    }
    if (msgTimer > 0) msgTimer--;
}

function draw() {
    ctx.save();
    if (shakeFrames > 0) { ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); shakeFrames--; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 코트 월 스페이스 그라데이션
    let wallGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    wallGrad.addColorStop(0, "#0f121a"); wallGrad.addColorStop(1, "#222a3a");
    ctx.fillStyle = wallGrad; ctx.fillRect(0, 0, canvas.width, FLOOR_Y);

    // 마룻바닥 설계
    ctx.fillStyle = "#222834"; ctx.fillRect(0, FLOOR_Y, canvas.width, 100); 
    let courtGrad = ctx.createLinearGradient(460, FLOOR_Y, 1240, FLOOR_Y);
    courtGrad.addColorStop(0, "#c66e18"); courtGrad.addColorStop(0.5, "#e59747"); courtGrad.addColorStop(1, "#c66e18");
    ctx.fillStyle = courtGrad; ctx.fillRect(460, FLOOR_Y, 780, 100);

    // 우드 바닥 라운드 텍스처
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"; ctx.lineWidth = 2;
    for(let i = FLOOR_Y; i < canvas.height; i += 16) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // 인코트 규격선 마킹
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(SERVE_LINE_1P - 4, FLOOR_Y, 8, 100); 
    ctx.fillRect(SERVE_LINE_2P - 4, FLOOR_Y, 8, 100); 
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(460, FLOOR_Y, 6, 100);  
    ctx.fillRect(1234, FLOOR_Y, 6, 100);  
    ctx.fillRect(canvas.width/2 - 3, FLOOR_Y, 6, 100); 

    if (isServingPhase) {
        ctx.fillStyle = "rgba(255, 109, 0, 0.15)"; ctx.fillRect(0, FLOOR_Y, SERVE_LINE_1P, 100);
        ctx.fillStyle = "rgba(0, 229, 255, 0.15)"; ctx.fillRect(SERVE_LINE_2P, FLOOR_Y, canvas.width - SERVE_LINE_2P, 100);
    }

    // 심판 네트 구조
    ctx.fillStyle = "#4a5766"; ctx.fillRect(canvas.width/2 - NET_W/2, FLOOR_Y - NET_H, NET_W, NET_H);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(canvas.width/2 - NET_W/2, FLOOR_Y - NET_H, NET_W, 24); 

    // 캐릭터 객체 드로우 호출
    setters.forEach(s => s.draw());
    players.p1.draw(); players.p2.draw();

    // 유저 타점 유효 범위 가이드 서클 링 시각화
    Object.keys(players).forEach(pKey => {
        let p = players[pKey];
        ctx.beginPath(); ctx.arc(p.x, p.y + p.height/3, p.radius + 115, 0, Math.PI*2);
        ctx.strokeStyle = pKey === 'p1' ? "rgba(255, 109, 0, 0.15)" : "rgba(0, 229, 255, 0.15)";
        ctx.lineWidth = 2; ctx.stroke();
    });

    // 배구공 디자인
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.rotation);
    ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI*2);
    if (ball.isSmashed) {
        ctx.shadowBlur = 40; ctx.shadowColor = "#ff3d00"; ctx.fillStyle = "#ffd600"; ctx.fill();
    } else {
        ctx.shadowBlur = 12; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.fillStyle = "#ffffff"; ctx.fill();
    }
    ctx.strokeStyle = "#2979ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-5, -5, ball.radius * 0.75, 0, Math.PI * 0.8); ctx.stroke();
    ctx.restore();

    if (msgTimer > 0 || isGameOver) {
        ctx.font = "italic bold 3.0rem sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 10; ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.fillText(gameMsg, canvas.width / 2, 170);
    }
    ctx.restore();
}

initServe();
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
