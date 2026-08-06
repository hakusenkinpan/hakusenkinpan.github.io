'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const $ = id => document.getElementById(id);
const stageConfig = window.PUYU_STAGE_CONFIG;
const equipmentConfig = window.PUYU_EQUIPMENT_CONFIG;

const state = {
  running:false, paused:true, wave:1, score:0, waveTime:45, timeLeft:45,
  target:90, totalBricks:0, destroyed:0, xp:0, nextXp:75, sound:true,
  stats:{power:1,speed:1,paddle:100,respawn:2,balls:1},
  balls:[], shots:[], bricks:[], particles:[], equipment:[], lastTime:0, pendingChoices:0
};

const upgrades = [
  {id:'power',icon:'✦',name:'ボールパワー',desc:'最大POWERを1増やす',rarity:'COMMON',weight:40,apply:()=>state.stats.power++},
  {id:'speed',icon:'»',name:'ボール速度',desc:'移動速度を8%上げる',rarity:'COMMON',weight:30,apply:()=>state.stats.speed+=.08},
  {id:'paddle',icon:'↔',name:'ラケットサイズ',desc:'横幅を16広げる',rarity:'UNCOMMON',weight:18,apply:()=>state.stats.paddle=Math.min(210,state.stats.paddle+16)},
  {id:'respawn',icon:'◴',name:'復活時間',desc:'復活を0.25秒早める',rarity:'RARE',weight:8,apply:()=>state.stats.respawn=Math.max(.5,state.stats.respawn-.25)},
  {id:'balls',icon:'🥺',name:'ボール個数',desc:'同時に飛ぶぷゆを1個増やす',rarity:'EPIC',weight:4,apply:()=>{state.stats.balls=Math.min(7,state.stats.balls+1);spawnBall(true)}}
];

const paddle = {x:W/2,y:H-42,w:100,h:12};
let audioCtx;
function beep(freq=420,dur=.05){if(!state.sound)return;try{audioCtx ||= new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='square';g.gain.value=.025;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.stop(audioCtx.currentTime+dur)}catch(e){}}

function resetGame(){
  Object.assign(state,{running:false,paused:true,wave:1,score:0,timeLeft:45,totalBricks:0,destroyed:0,xp:0,nextXp:75,balls:[],shots:[],bricks:[],particles:[],equipment:[],pendingChoices:0});
  Object.assign(state.stats,{power:1,speed:1,paddle:100,respawn:2,balls:1});
  paddle.x=W/2; makeWave(); updateUI(); renderEquipment();
}

function makeWave(){
  const stages=stageConfig.stages;
  const stage=stages[(state.wave-1)%stages.length];
  const cycle=Math.floor((state.wave-1)/stages.length);
  const endless=stageConfig.endless;
  const rows=stage.layout.length;
  const cols=Math.max(...stage.layout.map(row=>row.length));
  const gap=7, margin=42, bw=(W-margin*2-gap*(cols-1))/cols;
  const availableHeight=H*.49;
  const bh=Math.min(34,(availableHeight-gap*(rows-1))/rows);
  const powerBonus=cycle*endless.powerBonusPerCycle;
  state.bricks=[];
  state.destroyed=0;
  state.timeLeft=Math.max(endless.minimumTime,stage.timeLimit-cycle*endless.timePenaltyPerCycle);
  state.waveTime=state.timeLeft;

  for(let r=0;r<rows;r++)for(let c=0;c<stage.layout[r].length;c++){
    if(stage.layout[r][c]==='.')continue;
    const maxPower=pickBlockPower(stage.powerWeights)+powerBonus;
    state.bricks.push({x:margin+c*(bw+gap),y:68+r*(bh+gap),w:bw,h:bh,power:maxPower,maxPower,hue:(c*19+r*13+state.wave*9)%70});
  }
  state.totalBricks=state.bricks.length; state.balls=[];
  for(let i=0;i<state.stats.balls;i++)spawnBall(i>0);
  updateUI();
}

function pickBlockPower(weights){
  const entries=Object.entries(weights);
  const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  let roll=Math.random()*total;
  for(const [power,weight] of entries){
    roll-=weight;
    if(roll<=0)return Number(power);
  }
  return Number(entries[entries.length-1][0]);
}

function spawnBall(extra=false){
  if(state.balls.length>=state.stats.balls&&!extra)return;
  const angle=(-Math.PI/2)+(Math.random()-.5)*.7;
  state.balls.push({x:paddle.x,y:paddle.y-18,vx:Math.cos(angle)*280,vy:Math.sin(angle)*280,power:state.stats.power,angry:false,deadUntil:extra?performance.now()+400:0});
}

function start(){
  state.target=Math.max(50,Math.min(100,Number($('clearTarget').value)||90));
  $('clearTarget').value=state.target; $('clearGoal').textContent='GOAL '+state.target+'%'; $('startTarget').textContent=state.target;
  $('startOverlay').classList.add('hidden'); $('resultOverlay').classList.add('hidden');
  state.running=true; state.paused=false; state.lastTime=performance.now(); beep(520,.1);
}

function weightedThree(pool){
  const bag=[...pool], out=[];
  while(out.length<3&&bag.length){const total=bag.reduce((a,u)=>a+(u.weight||10),0);let n=Math.random()*total,idx=0;for(;idx<bag.length;idx++){n-=bag[idx].weight||10;if(n<=0)break}out.push(bag.splice(Math.min(idx,bag.length-1),1)[0])}
  return out;
}

function showChoices(bonus=false){
  state.paused=true;
  const availableEquipment=equipmentConfig.filter(def=>equipmentLevel(def.id)<def.maxLevel).map(def=>({
    ...def,type:'equipment',weight:def.choiceWeight,rarity:'EQUIPMENT',
    desc:def.description(equipmentLevel(def.id)+1)
  }));
  const pool=bonus?availableEquipment:[...upgrades,...availableEquipment];
  if(!pool.length){advanceWave();return}
  const picks=bonus?[...pool].sort(()=>Math.random()-.5).slice(0,Math.min(3,pool.length)):weightedThree(pool);
  $('choiceEyebrow').textContent=bonus?'PERFECT WAVE — BONUS':'LEVEL UP';
  $('choiceTitle').textContent=bonus?'ボーナス装備を選べ':'強化をひとつ選べ';
  $('choiceList').innerHTML='';
  picks.forEach(item=>{const nextLevel=item.type==='equipment'?equipmentLevel(item.id)+1:null;const b=document.createElement('button');b.className='choice-card';b.innerHTML=`<span class="choice-icon">${item.icon}</span><strong>${item.name}${nextLevel?' Lv.'+nextLevel:''}</strong><small>${item.desc}</small><em>${bonus?'BONUS EQUIPMENT':item.rarity}</em>`;b.onclick=()=>{if(item.type==='equipment')obtainEquipment(item);else item.apply();$('choiceOverlay').classList.add('hidden');renderEquipment();updateUI();if(bonus)advanceWave();else{state.paused=false;state.lastTime=performance.now();if(state.pendingChoices>0){state.pendingChoices--;setTimeout(()=>showChoices(false),100)}}};$('choiceList').appendChild(b)});
  $('choiceOverlay').classList.remove('hidden'); beep(bonus?820:660,.12);
}

function equipmentLevel(id){return state.equipment.find(item=>item.id===id)?.level||0}
function equipmentDef(id){return equipmentConfig.find(def=>def.id===id)}
function addScore(amount){
  const card=state.equipment.find(item=>item.id==='pointCard');
  const multiplier=card?equipmentDef(card.id).multiplier(card.level):1;
  state.score+=Math.round(amount*multiplier);
}
function tryFireball(ball){
  if(ball.angry)return;
  const owned=state.equipment.find(item=>item.id==='fireball');
  if(!owned)return;
  const def=equipmentDef(owned.id);
  if(Math.random()<def.triggerChance){ball.angry=true;ball.power=Math.max(1,Math.floor(ball.power*def.powerMultiplier(owned.level)));burst(ball.x,ball.y,'#ff6a2f');beep(1040,.1)}
}
function obtainEquipment(def){
  const owned=state.equipment.find(item=>item.id===def.id);
  if(owned){owned.level=Math.min(def.maxLevel,owned.level+1);if(def.id==='peashooter')owned.cooldown=Math.min(owned.cooldown,def.interval(owned.level))}
  else state.equipment.push({id:def.id,level:1,cooldown:def.id==='peashooter'?def.interval(1):0});
  beep(880,.14);
}

function applyPaddleEquipment(ball,hit){
  const bow=state.equipment.find(item=>item.id==='yoichiBow');
  if(bow){const def=equipmentDef(bow.id);if(Math.abs(hit)<=def.tolerance(bow.level)){ball.power+=def.powerBonus;burst(ball.x,ball.y,'#ffd33d');beep(780,.08)}}
  const dice=state.equipment.find(item=>item.id==='luckyDice');
  if(dice){const def=equipmentDef(dice.id);if(Math.random()<def.triggerChance){const bonus=Math.floor(Math.random()*(def.maxBonus(dice.level)+1));ball.power+=bonus;if(bonus>0){burst(ball.x,ball.y,'#9b6cff');beep(920,.08)}}}
}

function updateEquipment(dt){
  const gun=state.equipment.find(item=>item.id==='peashooter');
  if(gun){const def=equipmentDef(gun.id);gun.cooldown-=dt;if(gun.cooldown<=0){state.shots.push({x:paddle.x,y:paddle.y-8,vy:-520,damage:def.bulletDamage});gun.cooldown+=def.interval(gun.level);beep(620,.04)}}
  for(const shot of state.shots){
    shot.y+=shot.vy*dt;
    for(const brick of state.bricks){if(brick.power<=0)continue;if(shot.x>=brick.x&&shot.x<=brick.x+brick.w&&shot.y>=brick.y&&shot.y<=brick.y+brick.h){
      brick.power-=shot.damage;shot.dead=true;burst(shot.x,shot.y,'#62e6ef');
      if(brick.power<=0){state.destroyed++;const pts=10+brick.maxPower*4;addScore(pts);addXp(12+brick.maxPower*2);if(state.destroyed===state.totalBricks)finishWave(true)}else beep(300,.03);
      break
    }}
  }
  state.shots=state.shots.filter(shot=>!shot.dead&&shot.y>-15);
}

function addXp(amount){
  state.xp+=amount;
  while(state.xp>=state.nextXp){state.xp-=state.nextXp;state.nextXp=Math.round(state.nextXp*1.28);state.pendingChoices++}
  if(state.pendingChoices&&!state.paused){state.pendingChoices--;showChoices(false)}
}

function damageBrick(brick,ball){
  const bp=ball.power, ep=brick.power;
  brick.power-=bp;
  ball.power=Math.max(0,ball.power-ep);
  const shouldReflect=ball.power<=0;
  burst(ball.x,ball.y,brick.power<=0?'#ff4f93':'#9b6cff');
  if(brick.power<=0){state.destroyed++;const pts=10+brick.maxPower*4;addScore(pts);addXp(12+brick.maxPower*2);beep(510+brick.maxPower*35)}else beep(260);
  if(ball.power<=0)ball.power=1;
  updateUI();
  if(state.destroyed===state.totalBricks)finishWave(true);
  return shouldReflect;
}

function finishWave(perfect=false){
  if(!state.running||state.paused)return;state.paused=true;
  const ratio=state.destroyed/state.totalBricks*100;
  if(perfect||ratio>=100){addScore(Math.ceil(state.timeLeft)*20);showChoices(true)}
  else if(ratio>=state.target){addScore(state.wave*100);setTimeout(advanceWave,650)}
  else endGame(ratio);
}
function advanceWave(){state.wave++;makeWave();state.paused=false;state.lastTime=performance.now();flashCountdown('WAVE '+String(state.wave).padStart(2,'0'));beep(740,.16)}
function endGame(ratio){state.running=false;state.paused=true;$('resultTitle').textContent='サバイバル終了';$('resultText').innerHTML=`WAVE ${String(state.wave).padStart(2,'0')} ／ SCORE ${state.score.toLocaleString()}<br>破壊率 ${ratio.toFixed(1)}%（突破ライン ${state.target}%）`;$('resultOverlay').classList.remove('hidden');beep(120,.35)}
function flashCountdown(text){const el=$('countdown');el.textContent=text;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),800)}

function burst(x,y,color){for(let i=0;i<7;i++)state.particles.push({x,y,vx:(Math.random()-.5)*170,vy:(Math.random()-.5)*170,life:.45,color})}

function update(dt,now){
  if(!state.running||state.paused)return;
  state.timeLeft-=dt;if(state.timeLeft<=0){state.timeLeft=0;finishWave(false);return}
  paddle.w=state.stats.paddle;
  for(const b of state.balls){
    if(b.deadUntil){if(now<b.deadUntil)continue;b.deadUntil=0;b.x=paddle.x;b.y=paddle.y-20;const a=-Math.PI/2+(Math.random()-.5)*.5;b.vx=Math.cos(a)*280;b.vy=Math.sin(a)*280;b.power=state.stats.power;b.angry=false}
    const fireball=equipmentDef('fireball');
    const scale=state.stats.speed*(b.angry?fireball.speedMultiplier:1);b.x+=b.vx*scale*dt;b.y+=b.vy*scale*dt;
    if(b.x<15){b.x=15;b.vx=Math.abs(b.vx)}if(b.x>W-15){b.x=W-15;b.vx=-Math.abs(b.vx)}if(b.y<15){b.y=15;b.vy=Math.abs(b.vy)}
    if(b.vy>0&&b.y+14>=paddle.y&&b.y-14<paddle.y+paddle.h&&b.x>=paddle.x-paddle.w/2&&b.x<=paddle.x+paddle.w/2){
      b.y=paddle.y-15;const hit=(b.x-paddle.x)/(paddle.w/2);const angle=-Math.PI/2+hit*1.05;const sp=Math.hypot(b.vx,b.vy);const wasAngry=b.angry;b.vx=Math.cos(angle)*sp;b.vy=Math.sin(angle)*sp;b.angry=false;b.power=Math.max(1,Math.floor(state.stats.power));applyPaddleEquipment(b,hit);if(!wasAngry)tryFireball(b);beep(390)
    }
    if(b.y>H+25){b.deadUntil=now+state.stats.respawn*1000;b.angry=false;b.x=-100;b.y=-100;beep(150,.12)}
    for(const brick of state.bricks){if(brick.power<=0)continue;if(b.x+13>brick.x&&b.x-13<brick.x+brick.w&&b.y+13>brick.y&&b.y-13<brick.y+brick.h){
      const ox=Math.min(b.x+13-brick.x,brick.x+brick.w-(b.x-13)),oy=Math.min(b.y+13-brick.y,brick.y+brick.h-(b.y-13));
      const hitFromX=ox<oy, incomingVx=b.vx, incomingVy=b.vy;
      if(damageBrick(brick,b)){
        if(hitFromX){b.vx*=-1;b.x=incomingVx>0?brick.x-13:brick.x+brick.w+13}
        else{b.vy*=-1;b.y=incomingVy>0?brick.y-13:brick.y+brick.h+13}
      }
      break
    }}
  }
  updateEquipment(dt);
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}state.particles=state.particles.filter(p=>p.life>0);
  updateUI();
}

function draw(){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#10091c';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(155,108,255,.08)';ctx.lineWidth=1;for(let x=0;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.fillStyle='rgba(255,79,147,.06)';ctx.fillRect(0,0,W,48);
  for(const br of state.bricks){if(br.power<=0)continue;const ratio=br.power/br.maxPower;ctx.fillStyle=`hsl(${328-br.hue*.18} 75% ${31+ratio*18}%)`;ctx.fillRect(br.x,br.y,br.w,br.h);ctx.strokeStyle='rgba(255,255,255,.22)';ctx.strokeRect(br.x+.5,br.y+.5,br.w-1,br.h-1);ctx.fillStyle='rgba(8,5,14,.65)';ctx.font='500 10px DM Mono';ctx.textAlign='center';ctx.fillText('◆ '+br.power,br.x+br.w/2,br.y+20)}
  ctx.shadowBlur=18;ctx.shadowColor='#62e6ef';ctx.fillStyle='#62e6ef';ctx.fillRect(paddle.x-paddle.w/2,paddle.y,paddle.w,paddle.h);ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.fillRect(paddle.x-paddle.w*.18,paddle.y,paddle.w*.36,3);
  ctx.fillStyle='#ffd33d';ctx.shadowBlur=10;ctx.shadowColor='#ffd33d';for(const shot of state.shots){ctx.beginPath();ctx.arc(shot.x,shot.y,4,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.textBaseline='middle';for(const b of state.balls){if(b.deadUntil){const left=Math.max(0,(b.deadUntil-performance.now())/1000);ctx.fillStyle='#aaa2bd';ctx.font='500 12px DM Mono';ctx.fillText(left.toFixed(1)+'s',paddle.x,paddle.y-22);continue}ctx.shadowBlur=16;ctx.shadowColor=b.angry?'#ff6a2f':'#ff4f93';ctx.font='27px sans-serif';ctx.fillText(b.angry?'😡':'🥺',b.x,b.y);ctx.shadowBlur=0;ctx.fillStyle=b.angry?'#ffd33d':'#62e6ef';ctx.font='700 9px DM Mono';const shownPower=Number.isInteger(b.power)?b.power:b.power.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');ctx.fillText('P'+shownPower,b.x,b.y+22)}
  for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;
  if(!state.running){ctx.fillStyle='rgba(255,255,255,.05)';ctx.font='500 11px DM Mono';ctx.fillText('PUYU BLOCK SURVIVAL',W/2,H-18)}
}

function updateUI(){
  const destroyedRate=state.totalBricks?state.destroyed/state.totalBricks*100:0;
  $('wave').textContent=String(state.wave).padStart(2,'0');$('score').textContent=String(state.score).padStart(6,'0');$('destroyed').textContent=`${state.destroyed} / ${state.totalBricks} · ${destroyedRate.toFixed(1)}%`;$('timer').textContent=state.timeLeft.toFixed(1);
  $('statPower').textContent=state.stats.power;$('statSpeed').textContent=state.stats.speed.toFixed(2)+'×';$('statPaddle').textContent=Math.round(state.stats.paddle);$('statRespawn').textContent=state.stats.respawn.toFixed(2)+'s';$('statBalls').textContent=state.stats.balls;
  $('xpText').textContent=`${state.xp} / ${state.nextXp}`;$('xpBar').style.width=Math.min(100,state.xp/state.nextXp*100)+'%';$('waveProgress').style.width=destroyedRate+'%';$('rulePercent').textContent=destroyedRate.toFixed(1)+'%';$('timer').style.color=state.timeLeft<10?'#ff4f93':'#ffd33d';
}
function renderEquipment(){const box=$('equipmentSlots');box.innerHTML='';for(let i=0;i<equipmentConfig.length;i++){const e=state.equipment[i],def=e?equipmentDef(e.id):null,d=document.createElement('div');d.className='equip-slot'+(e?' filled':'');d.title=e?def.description(e.level):'未取得';d.innerHTML=e?`<span class="eq-icon">${def.icon}</span><span class="eq-level">LV.${e.level}</span><span class="eq-name">${def.name}</span>`:'＋';box.appendChild(d)}$('equipCount').textContent=state.equipment.length+' / '+equipmentConfig.length}

function pointerMove(e){const rect=canvas.getBoundingClientRect();const clientX=e.touches?e.touches[0].clientX:e.clientX;paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,(clientX-rect.left)*W/rect.width))}
canvas.addEventListener('mousemove',pointerMove);canvas.addEventListener('touchmove',e=>{e.preventDefault();pointerMove(e)},{passive:false});
$('startBtn').onclick=start;$('restartBtn').onclick=()=>{resetGame();start()};$('clearTarget').oninput=e=>{$('startTarget').textContent=e.target.value;state.target=Number(e.target.value);$('clearGoal').textContent='GOAL '+e.target.value+'%'};
$('soundBtn').onclick=()=>{state.sound=!state.sound;$('soundBtn').textContent=state.sound?'♪ ON':'♪ OFF'};$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
function loop(now){const dt=Math.min(.025,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt,now);draw();requestAnimationFrame(loop)}
resetGame();renderEquipment();requestAnimationFrame(loop);
