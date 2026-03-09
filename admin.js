// ╔═══════════════════════════════════════════════╗
// ║  admin.js  —  Admin Panel Logic               ║
// ╚═══════════════════════════════════════════════╝

import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  ref as sref, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { getSession, clearSession, checkAdmin } from './auth.js';

// ── Auth guard (admin only) ───────────────────────
const sess   = getSession();
const fbUser = await new Promise(r=>{ const u=onAuthStateChanged(auth,f=>{u();r(f)}) });
const uid    = fbUser?.uid || sess?.uid || '';
if(!checkAdmin(uid, fbUser?.email||sess?.email||'')){ location.href='index.html'; }

// ── Populate header ───────────────────────────────
const uName  = fbUser?.displayName || sess?.name  || 'ADMIN';
const uEmail = fbUser?.email        || sess?.email || '';
const uPhoto = fbUser?.photoURL     || sess?.photo || '';
document.getElementById('navEmail').textContent = uEmail;
document.getElementById('navAvPl').textContent  = (uName[0]||'A').toUpperCase();
document.getElementById('sbName').textContent   = uName.split(' ')[0].toUpperCase();
if(uPhoto){
  document.getElementById('navAvImg').src          = uPhoto;
  document.getElementById('navAvImg').style.display = 'block';
  document.getElementById('navAvPl').style.display  = 'none';
}

// ── Toast ─────────────────────────────────────────
function toast(msg,type='info'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast toast-${type} on`;
  setTimeout(()=>t.classList.remove('on'),3400);
}

// ── Sidebar nav ───────────────────────────────────
document.querySelectorAll('.sb-item').forEach(item=>{
  item.addEventListener('click',()=>{
    document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('on'));
    document.querySelectorAll('.adm-sec').forEach(s=>s.classList.remove('on'));
    item.classList.add('on');
    const sec=item.dataset.sec;
    document.getElementById('sec-'+sec)?.classList.add('on');
    document.getElementById('pageTitle').textContent='// '+item.querySelector('span:last-child').textContent.trim().toUpperCase();
    if(sec==='projects') loadProjects();
    if(sec==='users')    loadUsers();
    if(sec==='settings') loadSettings();
  });
});

// ── Logout ────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click',async()=>{
  if(fbUser)await signOut(auth); clearSession(); location.href='index.html';
});

// ── Dashboard stats ───────────────────────────────
async function loadStats(){
  try{
    const [ps,us]=await Promise.all([
      getCountFromServer(collection(db,'projects')),
      getCountFromServer(collection(db,'users')),
    ]);
    document.getElementById('statProj').textContent=ps.data().count;
    document.getElementById('statUser').textContent=us.data().count;
  }catch(e){console.warn('Stats:',e)}
}
loadStats();
document.getElementById('statDate').textContent=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short'});

// ════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════
export async function loadProjects(){
  const tb=document.getElementById('projTbody');
  tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td);letter-spacing:2px">// Loading...</td></tr>';
  try{
    const snap=await getDocs(query(collection(db,'projects'),orderBy('createdAt','desc')));
    document.getElementById('statProj').textContent=snap.size;
    if(snap.empty){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// No projects yet — add one above</td></tr>';return}
    tb.innerHTML='';
    snap.docs.forEach(d=>{
      const p={id:d.id,...d.data()};
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${p.image?`<img src="${p.image}" class="ti" alt="">`:'<div class="ti-ph">⬡</div>'}</td>
        <td style="color:var(--tb);font-weight:600">${p.title||'—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description||'—'}</td>
        <td>${p.link?`<a href="${p.link}" target="_blank" style="color:var(--cyan);font-family:var(--fmono);font-size:.64rem">↗</a>`:'—'}</td>
        <td><div class="act">
          <button class="ab ab-c" onclick="window.openEdit('${d.id}')">Edit</button>
          <button class="ab ab-r" onclick="window.delProj('${d.id}','${p.image||''}')">Del</button>
        </div></td>`;
      tb.appendChild(tr);
    });
  }catch(e){tb.innerHTML=`<tr><td colspan="5" style="color:var(--red);font-family:var(--fmono);padding:18px">// Error: ${e.message}</td></tr>`}
}
window.loadProjects=loadProjects;

// ── Add project button ────────────────────────────
document.getElementById('addProjBtn').addEventListener('click',()=>openModal(null));

let editId=null,pendingImg='';

function openModal(data){
  editId=data?data.id:null; pendingImg=data?.image||'';
  document.getElementById('mTitle').textContent=data?'// EDIT PROJECT':'// ADD PROJECT';
  document.getElementById('inpTitle').value=data?.title||'';
  document.getElementById('inpDesc').value=data?.description||'';
  document.getElementById('inpLink').value=data?.link||'';
  document.getElementById('inpTags').value=data?.tags||'';
  const prev=document.getElementById('imgPrev');
  if(data?.image){prev.src=data.image;prev.style.display='block'}else{prev.style.display='none';prev.src=''}
  document.getElementById('imgInp').value='';
  document.getElementById('mMsg').style.display='none';
  document.getElementById('projModal').classList.add('open');
}

window.openEdit=async(id)=>{
  const snap=await getDocs(collection(db,'projects'));
  const d=snap.docs.find(x=>x.id===id);
  if(d)openModal({id:d.id,...d.data()});
};

function closeModal(){document.getElementById('projModal').classList.remove('open')}
document.getElementById('mClose').addEventListener('click',closeModal);
document.getElementById('projModal').addEventListener('click',e=>{if(e.target.id==='projModal')closeModal()});

document.getElementById('imgInp').addEventListener('change',()=>{
  const f=document.getElementById('imgInp').files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>{const p=document.getElementById('imgPrev');p.src=ev.target.result;p.style.display='block'};
  reader.readAsDataURL(f);
});

async function uploadImg(file){
  const path=`projects/${Date.now()}_${file.name.replace(/\s/g,'_')}`;
  const r=sref(storage,path);
  const s=await uploadBytes(r,file);
  return await getDownloadURL(s.ref);
}

document.getElementById('saveBtn').addEventListener('click',async()=>{
  const title=document.getElementById('inpTitle').value.trim();
  const desc=document.getElementById('inpDesc').value.trim();
  const link=document.getElementById('inpLink').value.trim();
  const tags=document.getElementById('inpTags').value.trim();
  if(!title){showMMsg('Title is required.','e');return}
  const btn=document.getElementById('saveBtn');
  btn.disabled=true;btn.querySelector('span').innerHTML='<span class="bspin"></span> Saving...';
  try{
    let img=pendingImg;
    const file=document.getElementById('imgInp').files[0];
    if(file)img=await uploadImg(file);
    const data={title,description:desc,link,tags,image:img};
    if(editId){await updateDoc(doc(db,'projects',editId),data);toast('// Project updated','ok')}
    else{await addDoc(collection(db,'projects'),{...data,createdAt:serverTimestamp()});toast('// Project added','ok')}
    closeModal();loadProjects();loadStats();
  }catch(e){showMMsg('Error: '+e.message,'e')}
  finally{btn.disabled=false;btn.querySelector('span').textContent='// Save Project'}
});

window.delProj=async(id,imgUrl)=>{
  if(!confirm('Delete this project? This cannot be undone.'))return;
  try{
    await deleteDoc(doc(db,'projects',id));
    if(imgUrl&&imgUrl.includes('firebasestorage'))try{await deleteObject(sref(storage,imgUrl))}catch(_){}
    toast('// Deleted','ok');loadProjects();loadStats();
  }catch(e){toast('Delete failed: '+e.message,'err')}
};

function showMMsg(txt,type){const el=document.getElementById('mMsg');el.textContent=txt;el.className=`msg msg-${type}`;el.style.display='block'}

// ════════════════════════════════════════
//  USERS
// ════════════════════════════════════════
async function loadUsers(){
  const tb=document.getElementById('userTbody');
  tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// Loading...</td></tr>';
  try{
    const snap=await getDocs(query(collection(db,'users'),orderBy('createdAt','desc')));
    document.getElementById('statUser').textContent=snap.size;
    if(snap.empty){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:28px;font-family:var(--fmono);color:var(--td)">// No users yet</td></tr>';return}
    tb.innerHTML='';
    snap.docs.forEach(d=>{
      const u=d.data();
      const joined=u.createdAt?new Date(u.createdAt.seconds*1000).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td style="color:var(--tb)">${u.displayName||'—'}</td>
        <td style="font-family:var(--fmono);font-size:.7rem">${u.email||'—'}</td>
        <td><span class="ub ${u.loginMethod==='google'?'ub-g':'ub-e'}">${u.loginMethod||'email'}</span></td>
        <td style="font-family:var(--fmono);font-size:.68rem">${joined}</td>
        <td>${u.isAdmin?`<span class="ub" style="border-color:var(--pink);color:var(--pink)">Admin</span>`:'<span style="color:var(--td);font-family:var(--fmono);font-size:.64rem">User</span>'}`;
      tb.appendChild(tr);
    });
  }catch(e){tb.innerHTML=`<tr><td colspan="5" style="color:var(--red);padding:18px;font-family:var(--fmono)">// Error: ${e.message}</td></tr>`}
}

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════
function loadSettings(){
  document.getElementById('setAbout').value  = localStorage.getItem('r_about')    ||"I'm Rishi — a full-stack developer who builds futuristic digital experiences.";
  document.getElementById('setEmail').value  = localStorage.getItem('r_email')    ||'rishi@dev.com';
  document.getElementById('setGH').value     = localStorage.getItem('r_github')   ||'https://github.com';
  document.getElementById('setLI').value     = localStorage.getItem('r_linkedin') ||'https://linkedin.com';
}
document.getElementById('saveSetBtn').addEventListener('click',()=>{
  localStorage.setItem('r_about',   document.getElementById('setAbout').value);
  localStorage.setItem('r_email',   document.getElementById('setEmail').value);
  localStorage.setItem('r_github',  document.getElementById('setGH').value);
  localStorage.setItem('r_linkedin',document.getElementById('setLI').value);
  toast('// Settings saved locally','ok');
});
