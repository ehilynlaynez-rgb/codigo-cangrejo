
const API_RENDER = "https://sistema-aulas-intecap.onrender.com";
const API_LOCAL = "http://localhost:3001";
let API_BASE = API_RENDER;

async function detectBackend(){
  try{const r=await fetch(API_RENDER+"/api/summary",{cache:"no-store"}); if(!r.ok) throw 0; API_BASE=API_RENDER;}
  catch{ try{const r=await fetch(API_LOCAL+"/api/summary",{cache:"no-store"}); if(!r.ok) throw 0; API_BASE=API_LOCAL;} catch{ API_BASE=null; } }
}
detectBackend();

function $(id){return document.getElementById(id)}
function me(){try{return JSON.parse(localStorage.getItem('me')||'null')}catch{return null}}
function setMe(v){localStorage.setItem('me',JSON.stringify(v||null))}
function logout(){setMe(null); location.href='index.html'}

async function api(path,opts={}){
  if(!API_BASE) throw new Error("no-backend");
  const r = await fetch(API_BASE+path,opts);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function register(){
  const u=$('r_user').value.trim(), p=$('r_pass').value;
  try{const res=await api('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}); setMe(res.user);}
  catch{setMe({username:u,role:'demo'})}
  location.href='dashboard.html';
}
async function login(){
  const u=$('l_user').value.trim(), p=$('l_pass').value;
  try{const res=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}); setMe(res.user);}
  catch{setMe({username:u,role:'demo'})}
  location.href='dashboard.html';
}

function groupByModulo(xs){return xs.reduce((m,x)=>((m[x.Modulo]=m[x.Modulo]||[]).push(x),m),{})}

let __RES_COUNT={};
async function buildResourceCount(aulas){
  __RES_COUNT={};
  if(API_BASE){
    try{
      await Promise.all(aulas.map(a=> fetch(API_BASE+'/api/recursos?aulaId='+a.Id).then(r=>r.json()).then(rows=>{__RES_COUNT[a.Id]=rows.length;})));
      return __RES_COUNT;
    }catch(e){}
  }
  const demo = await fetch('data/data.json').then(r=>r.json());
  const rec = demo.recursos||[];
  aulas.forEach(a=>{__RES_COUNT[a.Id]=rec.filter(x=>Number(x.Aula_ID)===Number(a.Id)).length;});
  return __RES_COUNT;
}

async function initDashboard(){
  const u=me(); if(!u) return location.href='index.html';
  $('who').textContent = u.username+' · '+(u.role||'usuario');
  await refreshDash();
}
async function refreshDash(){
  let aulas=[], summary={aulas:0,ocupadas:0,recursos:0,reportes:0};
  try{ aulas=await api('/api/aulas'); summary=await api('/api/summary'); }
  catch{ const demo=await fetch('data/data.json').then(r=>r.json()); aulas=demo.aulas; summary={aulas:aulas.length,ocupadas:0,recursos:(demo.recursos||[]).length,reportes:0} }
  $('k_aulas').textContent=summary.aulas; $('k_ocupadas').textContent=summary.ocupadas||0; $('k_recursos').textContent=summary.recursos||0; $('k_reportes').textContent=summary.reportes||0;
  window.__AULAS=aulas; await buildResourceCount(aulas); drawModulos(aulas);
}
function drawModulos(aulas){
  const q=($('q')?.value||'').toLowerCase();
  aulas=aulas.filter(a=>(a.Nombre||'').toLowerCase().includes(q)||String(a.Id).includes(q)||(a.Modulo||'').toLowerCase().includes(q)||(a.OcupadaPor||'').toLowerCase().includes(q));
  const wrap=$('modulos'); wrap.innerHTML='';
  const byM=groupByModulo(aulas);
  Object.keys(byM).sort().forEach(mod=>{
    const sec=document.createElement('section'); sec.className='card'; sec.innerHTML=`<h3>${mod}</h3><div class="grid"></div>`;
    const grid=sec.querySelector('.grid');
    byM[mod].forEach(a=>{
      const busy=!!a.OcupadaPor;
      const d=document.createElement('div'); d.className='tile';
      d.innerHTML = `
        <div class="tag">Aula ${a.Id}</div>
        <div><b>${a.Nombre}</b></div>
        <span class="badge">${busy?('Ocupada · '+a.OcupadaPor):'Libre'}</span>
        <div class="tag">Recursos: ${(__RES_COUNT[a.Id]||0)}</div>
        <button class="btn" onclick="go(${a.Id}, '${(a.Nombre||'').replace(/'/g,'\\'')}')">Ver</button>
      `;
      grid.appendChild(d);
    });
    wrap.appendChild(sec);
  });
}
function searchAll(){drawModulos(window.__AULAS||[])}
function go(id,nombre){localStorage.setItem('aulaId',id);localStorage.setItem('aulaNombre',nombre);location.href='aula.html'}

// Aula
async function initAula(){
  const id=Number(localStorage.getItem('aulaId')); const nombre=localStorage.getItem('aulaNombre')||'';
  $('title').textContent='Aula #'+id+' · '+nombre;
  await Promise.all([refreshRecursos(), listReportes()]);
}
async function refreshRecursos(){
  const id=Number(localStorage.getItem('aulaId')); let rows=[];
  try{ rows=await api('/api/recursos?aulaId='+id); }
  catch{ const d=await fetch('data/data.json').then(r=>r.json()); rows=(d.recursos||[]).filter(r=>r.Aula_ID==id); }
  $('recursos').innerHTML = rows.length? rows.map(r=>`<div class="tile"><b>${r.Tipo}</b><div class="tag">${r.Codigo}</div><span class="badge">${r.Estado||'OK'}</span></div>`).join('') : '<p class="tag">No hay recursos registrados.</p>';
}
async function addRecurso(){
  const id=Number(localStorage.getItem('aulaId')); const Tipo=$('tipo').value; const Codigo=$('codigo').value;
  try{ await api('/api/recursos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Aula_ID:id,Tipo,Codigo})}); alert('Recurso agregado'); refreshRecursos(); }
  catch{ alert('Demo: sin backend activo'); }
}
async function reservar(){
  const id=Number(localStorage.getItem('aulaId')); const Inicio=$('inicio').value; const Fin=$('fin').value; const user=me()||{username:'demo'};
  try{ await api('/api/reservas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Aula_ID:id,Usuario:user.username,Inicio,Fin})}); alert('Reservada (real)'); }
  catch{ alert('Demo: sin backend activo'); }
}
async function liberar(){
  const id=Number(localStorage.getItem('aulaId'));
  try{ await api('/api/liberar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Aula_ID:id})}); alert('Liberada (real)'); }
  catch{ alert('Demo: sin backend activo'); }
}
async function reportar(){
  const id=Number(localStorage.getItem('aulaId')); const Recurso_ID=$('recursoId').value||''; const Descripcion=$('desc').value; const foto=$('foto').files[0];
  if(!API_BASE){ alert('Demo: sin backend activo'); return; }
  const fd=new FormData(); fd.append('Aula_ID',id); if(Recurso_ID) fd.append('Recurso_ID',Recurso_ID); fd.append('Descripcion',Descripcion); if(foto) fd.append('foto',foto);
  const r=await fetch(API_BASE+'/api/reportes',{method:'POST',body:fd}); if(!r.ok) alert('Error al reportar'); else alert('Reporte enviado'); listReportes();
}
async function listReportes(){
  const id=Number(localStorage.getItem('aulaId'));
  try{ const h=await api('/api/historicos'); const rep=(h.reportes||[]).filter(x=>x.Aula_ID==id);
       $('reportes').innerHTML=rep.map(r=>`<div class="tile"><b>Reporte #${r.Id}</b> · ${r.Estado}<div class="tag">${r.Descripcion}</div>${r.FotoRuta?`<a href="${API_BASE}${r.FotoRuta}" target="_blank">Ver foto</a>`:''}</div>`).join(''); }
  catch{ $('reportes').innerHTML='<p class="tag">Histórico disponible cuando el backend esté activo.</p>'; }
}
