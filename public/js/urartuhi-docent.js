class UrartuhiDocent {
  constructor() { this.backend = window.URARTUHI_BACKEND || "https://urartuhi-docent.up.railway.app/api/narrate"; this.bind(); }
  bind() { document.addEventListener('click', (e) => { const b = e.target.closest('[data-play],.play-btn'); if(!b) return; const t=(b.textContent||'').toLowerCase(); if(!t.includes('play') &&!b.hasAttribute('data-play')) return; e.preventDefault(); this.narrate(); }); }
  async narrate(q=null) {
    const img=document.querySelector('.gallery-piece.active img,.lightbox img,main img,.gallery img')||document.querySelector('img'); const imageUrl=img?.src||location.href; const pieceId=document.querySelector('[data-piece-id]')?.dataset.pieceId||document.title||'Gallery Piece';
    this.showUI(`<em>Urartuhi is observing ${pieceId}...</em>`);
    try {
      const res=await fetch(this.backend,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageUrl,pieceId,question:q})});
      if(!res.ok){ const err=await res.json(); this.showUI(`Docent sleeping: ${err.error}`); return; }
      const reader=res.body.getReader(); const dec=new TextDecoder(); let full=""; let buf="";
      while(true){ const {done,value}=await reader.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const lines=buf.split('\n'); buf=lines.pop()||""; for(const line of lines){ if(!line.startsWith('data: ')) continue; const data=line.slice(6).trim(); if(data==='[DONE]') continue; try{ const j=JSON.parse(data); const tok=j.choices?.[0]?.delta?.content||""; full+=tok; this.showUI(full); }catch{} } }
      this.showChat(full,pieceId,imageUrl);
    } catch(e){ this.showUI(e.message); }
  }
  showUI(html){ let el=document.getElementById('urartuhi-whisper'); if(!el){ el=document.createElement('div'); el.id='urartuhi-whisper'; el.style.cssText='position:fixed;bottom:80px;left:20px;right:20px;max-width:640px;margin:auto;background:rgba(10,10,12,0.92);color:#e8dcc6;padding:18px 22px;border-radius:14px;border:1px solid #3a3a3a;font-family:Georgia,serif;font-size:15px;line-height:1.6;z-index:9999;backdrop-filter:blur(12px)'; document.body.appendChild(el); } el.innerHTML=html; }
  showChat(t,pid,url){ let c=document.getElementById('urartuhi-chat'); if(!c){ c=document.createElement('div'); c.id='urartuhi-chat'; c.style.cssText='position:fixed;bottom:20px;left:20px;right:20px;max-width:640px;margin:auto;display:flex;gap:8px;z-index:9999'; c.innerHTML=`<input id="urartuhi-input" placeholder="Ask Urartuhi about this piece..." style="flex:1;padding:12px 16px;border-radius:24px;border:1px solid #444;background:#111;color:#e8dcc6"><button id="urartuhi-send" style="padding:12px 20px;border-radius:24px;background:#e8dcc6;color:#111;border:none;cursor:pointer;font-weight:600">Ask</button>`; document.body.appendChild(c); document.getElementById('urartuhi-input').addEventListener('keydown',(e)=>{ if(e.key==='Enter') this.narrate(e.target.value); }); document.getElementById('urartuhi-send').addEventListener('click',()=>{ this.narrate(document.getElementById('urartuhi-input').value); }); } }
}
window.urartuhiDocent=new UrartuhiDocent();
