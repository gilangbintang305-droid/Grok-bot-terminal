// MEME RADAR — modul Scout + Filter + Analyst untuk koin meme Solana.
// Hanya mendeteksi dan meranking kandidat. TIDAK terhubung ke Executor / trading asli.
// Skor = sinyal awal yang bisa diukur, bukan ramalan. Akurasinya diuji lewat "forward test" di kartu.
(()=>{
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=id=>document.getElementById(id);
const R=Object.assign({on:true,list:[],seen:{},scan:0,c:{s:0,p:0,k:0}},JSON.parse(localStorage.getItem('gbr')||'{}'));
const persist=()=>{
 const t=Date.now();Object.keys(R.seen).forEach(k=>{if(t-R.seen[k]>6*36e5)delete R.seen[k]});
 if(R.list.length>80)R.list=R.list.sort((a,b)=>b.t-a.t).slice(0,80);
 localStorage.setItem('gbr',JSON.stringify(R))};
const rp=(m,p)=>http(RPC,JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p}));
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const fm=n=>'$'+(n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'k':n.toFixed(0));
let busy=false;

// ---- Analyst: skor potensi 0-100 ----
function potential(x,age,mc,liq){
 const v=x.volume||{},pc=x.priceChange||{},t=x.txns?.h1||{},b=t.buys||0,s=t.sells||0;
 const r5=(v.m5||0)*12/((v.h1||0)||1),r1=(v.h1||0)/(((v.h6||0)/6)||1);
 const accel=(clamp(r5*50)+clamp(r1*50))/2;                       // volume sedang menguat
 const br=b/((b+s)||1);
 const buyers=(clamp((br-0.4)*250)+clamp(b/3))/2;                  // tekanan beli + jumlah transaksi
 const room=clamp(100-(Math.log10(mc)-5)*40);                      // ruang naik: mcap kecil
 const health=(clamp(liq/mc*600)+clamp(liq/500))/2;                // likuiditas sehat terhadap mcap
 const h1=pc.h1||0,m5=pc.m5||0;
 const base=h1<=0?clamp(40+h1):h1<=60?50+h1*0.8:h1<=150?98-(h1-60)*0.6:40;
 const trend=clamp(base+clamp(m5,-10,10)*2);                       // naik awal, belum kepanjangan
 const soc=((x.info?.websites?.length||0)+(x.info?.socials?.length||0))>0?100:30;
 const f={'volume menguat':accel,'tekanan beli':buyers,'ruang mcap':room,'kesehatan LP':health,'tren awal':trend,'sosial':soc};
 const w={'volume menguat':.25,'tekanan beli':.2,'ruang mcap':.2,'kesehatan LP':.15,'tren awal':.1,'sosial':.1};
 return{f,total:Math.round(Object.keys(f).reduce((a,k)=>a+f[k]*w[k],0)),accel:r5}}

// ---- Filter on-chain ----
async function mint(a){
 const r=await rp('getAccountInfo',[a,{encoding:'jsonParsed'}]);
 if(!r||!r.result)return null;                                      // RPC gagal / rate limit -> coba lagi nanti
 const i=r.result.value?.data?.parsed?.info;if(!i)return false;
 const ext=(i.extensions||[]).map(e=>e.extension);
 if(ext.some(e=>['permanentDelegate','transferHook','transferFeeConfig'].includes(e)))return false;
 return i.mintAuthority==null&&i.freezeAuthority==null}
async function holders(a){
 const [lg,su]=await Promise.all([rp('getTokenLargestAccounts',[a]),rp('getTokenSupply',[a])]);
 const v=lg?.result?.value,sup=+su?.result?.value?.uiAmount;if(!v||!v.length||!sup)return null;
 const arr=v.map(z=>+z.uiAmount||0).sort((x,y)=>y-x);
 return{top1:arr[0]/sup*100,top10:arr.slice(1,11).reduce((s,z)=>s+z,0)/sup*100}} // pemegang terbesar dilewati: biasanya pool

async function evalPair(x){
 const a=x.baseToken.address,sym=x.baseToken.symbol;R.seen[a]=Date.now();R.c.s++;
 const age=(Date.now()-x.pairCreatedAt)/36e5,mc=x.marketCap||x.fdv||0,liq=x.liquidity?.usd||0,v=x.volume||{},pc=x.priceChange||{};
 if(!(age>=0.25&&age<=48)||liq<15e3||mc<5e4||mc>1e7||(v.h1||0)<1e4||(pc.h24||0)>600)return;
 const sc=potential(x,age,mc,liq);if(sc.total<55)return;
 const m=await mint(a);
 if(m===null){R.seen[a]=Date.now()-10*6e4;return}
 if(!m){R.c.k++;log('RADAR X',`$${sym} mint/freeze/extension berisiko`);return}
 const h=await holders(a);let total=sc.total;const flags=['mint/freeze dicabut'];
 if(h){
  if(h.top10>55){R.c.k++;log('RADAR X',`$${sym} top holder ${h.top10.toFixed(0)}%`);return}
  if(h.top10>35){total-=15;flags.push(`top10 ${h.top10.toFixed(0)}% (berisiko)`)}else flags.push(`top10 ${h.top10.toFixed(0)}%`);
 }else flags.push('holder tidak terbaca');
 if(total<60)return;
 const p=+x.priceUsd;if(!p)return;
 const url=String(x.url||'').startsWith('https://dexscreener.com/')?x.url:'';
 const ex=R.list.find(c=>c.addr===a);
 if(ex){Object.assign(ex,{score:total,flags,f:sc.f,age,mc,pc1:pc.h1||0})}
 else{R.c.p++;R.list.push({addr:a,sym,url,t:Date.now(),p0:p,mc0:mc,mc,age,score:total,flags,f:sc.f,pc1:pc.h1||0,last:p,peak:p,u:0});
  log('RADAR',`$${sym} skor ${total} · mcap ${fm(mc)} · umur ${age.toFixed(1)}j`);save()}
}

// ---- Forward test: pantau harga kandidat setelah terdeteksi ----
async function track(){
 const act=R.list.filter(c=>Date.now()-c.t<48*36e5).sort((a,b)=>a.u-b.u).slice(0,30);
 if(!act.length)return;
 const r=await http(DS+'latest/dex/tokens/'+act.map(c=>c.addr).join(','));
 const m={};pick(r?.pairs||[]).forEach(x=>m[x.baseToken.address]=x);
 act.forEach(c=>{c.u=Date.now();const x=m[c.addr];if(!x)return;const p=+x.priceUsd;if(!p)return;
  c.last=p;c.peak=Math.max(c.peak||c.p0,p);c.mc=x.marketCap||x.fdv||c.mc;c.pc1=x.priceChange?.h1||0})}
function stats(){
 const L=R.list.filter(c=>c.last&&c.p0),ch=L.map(c=>c.last/c.p0-1).sort((a,b)=>a-b);
 return{m:L.length,med:ch.length?ch[Math.floor(ch.length/2)]:0,
  h100:L.filter(c=>c.peak/c.p0>=2).length,h300:L.filter(c=>c.peak/c.p0>=4).length,d50:L.filter(c=>c.last/c.p0<=0.5).length}}

async function scan(){
 if(!R.on||busy)return;busy=true;
 try{
  const srcs=await Promise.all(['token-profiles/latest/v1','token-boosts/latest/v1','token-boosts/top/v1'].map(u=>http(DS+u)));
  const now=Date.now(),set=new Set();
  srcs.forEach(a=>(Array.isArray(a)?a:[]).forEach(z=>{if(z&&z.chainId==='solana'&&z.tokenAddress&&now-(R.seen[z.tokenAddress]||0)>15*6e4)set.add(z.tokenAddress)}));
  const addrs=[...set].slice(0,30);R.scan=now;
  if(addrs.length){const r=await http(DS+'latest/dex/tokens/'+addrs.join(','));for(const x of pick(r?.pairs||[]))await evalPair(x)}
  await track();
 }catch(e){}
 busy=false;persist();draw()}

// ---- UI ----
const box=document.createElement('div');box.className='card';box.id='radar';
q('stats').parentElement.before(box);
function draw(){
 const s=stats(),now=Date.now();
 const top=R.list.filter(c=>now-c.t<12*36e5).sort((a,b)=>b.score-a.score).slice(0,8);
 const row=c=>{const g=(c.last/c.p0-1)*100,ag=(now-c.t)/6e4;
  const nm=c.url?`<a href="${esc(c.url)}" style="color:var(--cy);text-decoration:none">$${esc(c.sym)}</a>`:`$${esc(c.sym)}`;
  return `<div class="row"><b>${nm} <span class="tag ${c.score>=75?'g':'y'}">${c.score}</span></b><span class="${g>=0?'g':'r'}">sejak deteksi ${g>=0?'+':''}${g.toFixed(0)}%</span></div>
<div class="row m"><span>mcap ${fm(c.mc)} · 1j ${c.pc1>=0?'+':''}${(+c.pc1).toFixed(0)}%</span><span>${ag<90?ag.toFixed(0)+'m':(ag/60).toFixed(1)+'j'} lalu</span></div>
<div class="sub" style="margin-bottom:6px">${c.flags.map(esc).join(' · ')}</div>`};
 box.innerHTML=`<h3>MEME RADAR · KANDIDAT POTENSI (BUKAN JAMINAN)</h3>
<div class="sub">${R.on?'aktif':'dijeda'} · scan ${R.scan?new Date(R.scan).toTimeString().slice(0,8):'-'} · ${R.c.s} dipindai · ${R.c.k} dibuang (rug) · ${R.c.p} lolos</div>
<div style="margin-top:6px">${top.length?top.map(row).join(''):'<span class="m">belum ada kandidat yang lolos</span>'}</div>
<h3 style="margin-top:8px">FORWARD TEST · SEJAK DETEKSI</h3>
<div class="row"><span class="m">dipantau</span><span>${s.m}</span></div>
<div class="row"><span class="m">pernah ≥ +100%</span><span class="g">${s.h100}</span></div>
<div class="row"><span class="m">pernah ≥ +300%</span><span class="g">${s.h300}</span></div>
<div class="row"><span class="m">sekarang ≤ -50%</span><span class="r">${s.d50}</span></div>
<div class="row"><span class="m">median perubahan</span><span class="${s.med>=0?'g':'r'}">${s.m?(s.med>=0?'+':'')+(s.med*100).toFixed(0)+'%':'-'}</span></div>
<div class="sub">Skor = sinyal awal (volume menguat, tekanan beli, mcap kecil, LP sehat, filter rug). Bukan prediksi. Percayai angka forward test, bukan skor. Bukan nasihat keuangan.</div>
<div style="margin-top:8px"><button id="rt">${R.on?'Jeda radar':'Aktifkan radar'}</button><button id="rs">Scan sekarang</button><button id="rr">Reset radar</button></div>`;
 q('rt').onclick=()=>{R.on=!R.on;persist();draw()};
 q('rs').onclick=()=>{scan()};
 q('rr').onclick=()=>{if(confirm('Hapus semua kandidat dan statistik radar?')){R.list=[];R.seen={};R.c={s:0,p:0,k:0};persist();draw()}}}
window.RADAR={get list(){return R.list.slice()}};  // hanya baca; belum disambungkan ke Executor
draw();setTimeout(scan,4000);setInterval(scan,45000);
})();
