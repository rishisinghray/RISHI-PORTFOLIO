// ╔═══════════════════════════════════════════════╗
// ║  admin.js  —  Clean rewrite, no storage       ║
// ╚═══════════════════════════════════════════════╝

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, getDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getSession, clearSession, checkAdmin } from './auth.js';

// ── Auth guard ────────────────────────────────────
const sess   = getSession();
const fbUser = await new Promise(r=>{ const u=onAuthStateChanged(auth,f=>{u();r(f)}) });
const uid    = fbUser?.uid || sess?.uid || '';
const email  = fbUser?.email || sess?.email || '';
if(!checkAdmin(uid, email)){ location.href='index.html'; }

// ── Header ────────────────────────────────────────
const uName  = fbUser?.displayName || sess?.name || 'ADMIN';
const uEmail = email;
const uPhoto = fbUser?.photoURL || sess?.photo || '';
document.getElementById('navEmail').textContent = uEmail;
document.getElementById('navAvPl').textContent  = (uName[0]||'A').toUpperCase();
document.getElementById('sbName').textContent   = uName.split(' ')[0].toUpperCase();
if(uPhoto){
  document.getElementById('navAvImg').src = uPhoto;
  document.getElementById('navAvImg').style.display = 'block';
  document.getElementById('navAvPl').style.display  = 'none';
}

// ── Toast ─────────────────────────────────────────
function toast(msg, type='ok'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} on`;
  setTimeout(()=>t.classList.remove('on'), 3000);
}

// ── Logout ────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async()=>{
  if(fbUser) await signOut(auth);
  clearSession(); location.href='index.html';
});
document.getElementById('portfolioBtn').addEventListener('click',()=>{ location.href='portfolio.html'; });

// ── Sidebar nav ───────────────────────────────────
document.querySelectorAll('.sbi').forEach(item=>{
  item.addEventListener('click',()=>{
    const sec = item.dataset.sec;
    document.querySelectorAll('.sbi').forEach(i=>i.classList.remove('on'));
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
    item.classList.add('on');
    document.getElementById('sec-'+sec).classList.add('on');
    if(sec==='projects') loadProjects();
    if(sec==='users')    loadUsers();
    if(sec==='settings') loadSettings();
  });
});

// ── Stats ─────────────────────────────────────────
async function loadStats(){
  try{
    const [ps, us] = await Promise.all([
      getDocs(collection(db,'projects')),
      getDocs(collection(db,'users')),
    ]);
    document.getElementById('statProj').textContent = ps.size;
    document.getElementById('statUser').textContent = us.size;
  } catch(e){ console.warn('Stats error:', e.message); }
}
loadStats();
document.getElementById('statDate').textContent = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short'});

// ════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════
async function loadProjects(){
  const grid = document.getElementById('projTable');
  grid.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// Loading...</td></tr>';
  try{
    const snap = await getDocs(query(collection(db,'projects'), orderBy('createdAt','desc')));
    document.getElementById('statProj').textContent = snap.size;
    if(snap.empty){
      grid.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// No projects yet — add one above</td></tr>';
      return;
    }
    grid.innerHTML = '';
    snap.docs.forEach(d=>{
      const p = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.image?`<img src="${p.image}" style="width:48px;height:36px;object-fit:cover;border-radius:2px">`:'<div style="width:48px;height:36px;background:rgba(0,229,255,.07);border-radius:2px;display:flex;align-items:center;justify-content:center;color:var(--td);font-size:.7rem">⬡</div>'}</td>
        <td style="color:var(--tb);font-family:var(--fmono);font-size:.72rem">${p.title||'—'}</td>
        <td style="color:var(--tm);font-size:.7rem">${(p.description||'').slice(0,50)}${(p.description||'').length>50?'...':''}</td>
        <td>${p.link?`<a href="${p.link}" target="_blank" style="color:var(--cyan);font-family:var(--fmono);font-size:.65rem">↗</a>`:'—'}</td>
        <td>
          <button class="ab ab-c" onclick="window.openEdit('${d.id}')">Edit</button>
          <button class="ab ab-r" onclick="window.delProj('${d.id}')">Del</button>
        </td>`;
      grid.appendChild(tr);
    });
  } catch(e){
    grid.innerHTML = `<tr><td colspan="5" style="color:var(--pink);padding:18px;font-family:var(--fmono)">// Error: ${e.message}</td></tr>`;
  }
}

document.getElementById('addProjBtn').addEventListener('click', ()=>openModal(null));

let editId = null, pendingImg = '';

function openModal(data){
  editId = data ? data.id : null;
  pendingImg = data?.image || '';
  document.getElementById('mTitle').textContent = data ? '// EDIT PROJECT' : '// ADD PROJECT';
  document.getElementById('inpTitle').value  = data?.title || '';
  document.getElementById('inpDesc').value   = data?.description || '';
  document.getElementById('inpLink').value   = data?.link || '';
  document.getElementById('inpTags').value   = data?.tags || '';
  document.getElementById('inpImgUrl').value = data?.image || '';
  const prev = document.getElementById('imgPrev');
  if(data?.image){ prev.src = data.image; prev.style.display='block'; }
  else { prev.style.display='none'; prev.src=''; }
  document.getElementById('mMsg').style.display = 'none';
  document.getElementById('saveBtn').disabled = false;
  document.getElementById('saveBtn').querySelector('span').textContent = '// Save Project';
  document.getElementById('projModal').classList.add('open');
}

window.openEdit = async(id)=>{
  try{
    const snap = await getDocs(collection(db,'projects'));
    const d = snap.docs.find(x=>x.id===id);
    if(d) openModal({id:d.id,...d.data()});
  } catch(e){ toast('Error: '+e.message,'err'); }
};

function closeModal(){ document.getElementById('projModal').classList.remove('open'); }
document.getElementById('mClose').addEventListener('click', closeModal);
document.getElementById('projModal').addEventListener('click', e=>{ if(e.target.id==='projModal') closeModal(); });

document.getElementById('inpImgUrl').addEventListener('input', ()=>{
  const url = document.getElementById('inpImgUrl').value.trim();
  const prev = document.getElementById('imgPrev');
  if(url){ prev.src=url; prev.style.display='block'; }
  else { prev.style.display='none'; prev.src=''; }
});

function showMMsg(txt,type){ const el=document.getElementById('mMsg'); el.textContent=txt; el.className=`msg msg-${type}`; el.style.display='block'; }

document.getElementById('saveBtn').addEventListener('click', async()=>{
  const title = document.getElementById('inpTitle').value.trim();
  const desc  = document.getElementById('inpDesc').value.trim();
  const link  = document.getElementById('inpLink').value.trim();
  const tags  = document.getElementById('inpTags').value.trim();
  const img   = document.getElementById('inpImgUrl').value.trim() || pendingImg;
  if(!title){ showMMsg('Title is required.','e'); return; }
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.querySelector('span').innerHTML = '<span class="bspin"></span> Saving...';
  try{
    const data = { title, description:desc, link, tags, image:img };
    if(editId){
      await updateDoc(doc(db,'projects',editId), data);
      toast('// Project updated','ok');
    } else {
      await addDoc(collection(db,'projects'), {...data, createdAt:serverTimestamp()});
      toast('// Project added','ok');
    }
    closeModal();
    loadProjects();
    loadStats();
  } catch(e){ showMMsg('Error: '+e.message,'e'); }
  finally{ btn.disabled=false; btn.querySelector('span').textContent='// Save Project'; }
});

window.delProj = async(id)=>{
  if(!confirm('Delete this project?')) return;
  try{
    await deleteDoc(doc(db,'projects',id));
    toast('// Deleted','ok');
    loadProjects();
    loadStats();
  } catch(e){ toast('Delete failed: '+e.message,'err'); }
};

// ════════════════════════════════════════
//  USERS
// ════════════════════════════════════════
async function loadUsers(){
  const tb = document.getElementById('userTbody');
  tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// Loading...</td></tr>';
  try{
    const snap = await getDocs(query(collection(db,'users'), orderBy('createdAt','desc')));
    document.getElementById('statUser').textContent = snap.size;
    if(snap.empty){ tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// No users yet</td></tr>'; return; }
    tb.innerHTML = '';
    snap.docs.forEach(d=>{
      const u = d.data();
      const joined = u.createdAt ? new Date(u.createdAt.seconds*1000).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--tb)">${u.displayName||'—'}</td>
        <td style="font-family:var(--fmono);font-size:.7rem">${u.email||'—'}</td>
        <td><span class="ub ${u.loginMethod==='google'?'ub-g':'ub-e'}">${u.loginMethod||'email'}</span></td>
        <td style="font-family:var(--fmono);font-size:.68rem">${joined}</td>
        <td>${u.isAdmin?`<span class="ub" style="border-color:var(--pink);color:var(--pink)">Admin</span>`:'<span style="color:var(--td);font-family:var(--fmono);font-size:.64rem">User</span>'}</td>`;
      tb.appendChild(tr);
    });
  } catch(e){ tb.innerHTML=`<tr><td colspan="5" style="color:var(--pink);padding:18px;font-family:var(--fmono)">// Error: ${e.message}</td></tr>`; }
}

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════
async function loadSettings(){
  try{
    const snap = await getDoc(doc(db,'settings','portfolio'));
    const d = snap.exists() ? snap.data() : {};
    document.getElementById('setAbout').value   = d.about   || "I'm Rishi — a full-stack developer who builds futuristic digital experiences.";
    document.getElementById('setEmail').value   = d.email   || 'rishisinghray@gmail.com';
    document.getElementById('setGH').value      = d.github  || 'https://github.com/rishisinghray';
    document.getElementById('setLI').value      = d.linkedin|| 'https://www.linkedin.com/in/rishisinghray';
  } catch(e){ console.error('Settings load:', e.message); }
}

document.getElementById('saveSetBtn').addEventListener('click', async()=>{
  const btn = document.getElementById('saveSetBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try{
    await setDoc(doc(db,'settings','portfolio'),{
      about:    document.getElementById('setAbout').value,
      email:    document.getElementById('setEmail').value,
      github:   document.getElementById('setGH').value,
      linkedin: document.getElementById('setLI').value,
    },{ merge:true });
    toast('// Settings saved!','ok');
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally{ btn.disabled=false; btn.textContent='// Save Settings'; }
});
