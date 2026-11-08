(()=>{
const SOLM='So11111111111111111111111111111111111111112',JUP='https://lite-api.jup.ag/swap/v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const day=()=>new Date().toDateString();
const L=Object.assign({on:false,maxSol:0.02,dayLoss:0.05,loss:0,day:day()},JSON.parse(localStorage.getItem('gbl')||'{}'));
const lsave=()=>localStorage.setItem('gbl',JSON.stringify(L));
if(L.day!==day()){L.day=day();L.loss=0}
S.pos=S.pos.filter(p=>!p.pending);S.pos.forEach(p=>p.selling=false);
let ADDR=native?Android.wallet():'',BAL=0,lastBal=0;
const rpc=(m,p)=>http(RPC,JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p}));
const signSend=tx=>new Promise(res=>{const id=++cbid;cbs[id]=t=>{try{res(JSON.parse(t))}catch(e){res(null)}};Android.signSend(id,RPC,tx)});
async function solBal(){const r=await rpc('getBalance',[ADDR]);return (r?.result?.value||0)/1e9}
async function confirm_(sig){for(let i=0;i<20;i++){await sleep(1500);const r=await rpc('getSignatureStatuses',[[sig],{searchTransactionHistory:true}]);const v=r?.result?.value?.[0];
 if(v){if(v.err)return false;if(v.confirmationStatus==='confirmed'||v.confirmationStatus==='finalized')return true}}return false}
async function swap(a,b,amount,slip){
 const q=await http(`${JUP}/quote?inputMint=${a}&outputMint=${b}&amount=${amount}&slippageBps=${slip}`);
 if(!q||!q.outAmount)return{err:'quote gagal'};
 const s=await http(`${JUP}/swap`,JSON.stringify({quoteResponse:q,userPublicKey:ADDR,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:{priorityLevelWithMaxLamports:{maxLamports:1000000,priorityLevel:'high'}}}));
 if(!s||!s.swapTransaction)return{err:'build swap gagal'};
 const r=await signSend(s.swapTransaction);
 if(!r||!r.result)return{err:r?.error?.message||'kirim gagal'};
 return (await confirm_(r.result))?{sig:r.result}:{err:'tidak terkonfirmasi'};
}
async function buy(p,x,sc){
 try{
  BAL=await solBal();const sol=Math.min(L.maxSol,BAL*SIZE);
  if(BAL<0.02||sol<0.003)throw 'saldo SOL terlalu kecil';
  const r=await swap(SOLM,p.addr,Math.floor(sol*1e9),300);if(r.err)throw r.err;
  p.solIn=sol;p.pending=false;log('BUY*',`$${p.sym} skor ${sc} · ${sol.toFixed(4)} SOL`);
 }catch(e){S.pos=S.pos.filter(z=>z!==p);log('BUY X',`$${p.sym} ${e}`)}
 save();render();
}
async function sell(p,why){
 try{
  const b0=await solBal();
  const ta=await rpc('getTokenAccountsByOwner',[ADDR,{mint:p.addr},{encoding:'jsonParsed'}]);
  let amt=0n;(ta?.result?.value||[]).forEach(v=>{amt+=BigInt(v.account.data.parsed.info.tokenAmount.amount)});
  if(amt===0n){S.pos=S.pos.filter(z=>z!==p);log(why,`$${p.sym} saldo token 0, posisi dihapus`);return}
  const r=await swap(p.addr,SOLM,amt.toString(),1000);if(r.err)throw r.err;
  const pnl=(await solBal())-b0-p.solIn;
  S.pos=S.pos.filter(z=>z!==p);S.trades++;if(pnl>=0)S.wins++;else{S.losses++;L.loss+=-pnl;lsave()}
  log(why+'*',`$${p.sym} ${pnl>=0?'+':''}${pnl.toFixed(4)} SOL`);
 }catch(e){p.selling=false;log('SELL X',`$${p.sym} ${e} (coba lagi)`)}
 save();render();
}
const _open=open,_close=close;
window.open=function(x,sc){
 if(!L.on||!ADDR)return _open(x,sc);
 const entry=+x.priceUsd;if(!entry)return;
 if(L.loss>=L.dayLoss){log('LIVE','batas rugi harian tercapai, tidak membeli');return}
 const p={addr:x.baseToken.address,sym:x.baseToken.symbol,entry,size:0,units:0,peak:entry,last:entry,trail:false,live:true,pending:true};
 S.pos.push(p);buy(p,x,sc);
};
window.close=function(p,price,why){
 if(!p.live)return _close(p,price,why);
 if(p.pending||p.selling)return;p.selling=true;sell(p,why);
};
// ---- UI wallet ----
const inp='width:90px;padding:4px;background:#0a0b14;color:#e8eaff;border:1px solid #23264a;border-radius:6px;font:inherit;text-align:right';
const box=document.createElement('div');box.className='card';
box.innerHTML=`<h3>WALLET · TRADING ASLI</h3>
<div id="w0"><div class="sub">Pakai wallet BARU khusus bot dengan dana kecil. Jangan pakai wallet utama.</div>
<input id="wk" type="password" placeholder="private key (base58)" style="width:100%;margin:6px 0;padding:8px;background:#0a0b14;color:#e8eaff;border:1px solid #23264a;border-radius:8px;font:inherit"><button id="wsave">Simpan kunci</button></div>
<div id="w1" style="display:none">
<div class="row"><span class="m">alamat</span><span id="wa"></span></div>
<div class="row"><span class="m">saldo</span><span id="wb"></span></div>
<div class="row"><span class="m">mode</span><b id="wm"></b></div>
<div class="row"><span class="m">maks SOL / trade</span><input id="wmax" type="number" step="0.005" style="${inp}"></div>
<div class="row"><span class="m">batas rugi harian (SOL)</span><input id="wlim" type="number" step="0.01" style="${inp}"></div>
<div class="row"><span class="m">rugi hari ini</span><span id="wl"></span></div>
<div style="margin-top:8px"><button id="wt"></button><button id="wx" class="r">STOP DARURAT</button><button id="wd">Hapus kunci</button></div></div>`;
document.querySelector('.agents').before(box);
const $$=id=>document.getElementById(id);
function wr(){
 $$('w0').style.display=ADDR?'none':'block';$$('w1').style.display=ADDR?'block':'none';
 if(!ADDR)return;
 $$('wa').textContent=ADDR.slice(0,4)+'…'+ADDR.slice(-4);$$('wb').textContent=BAL.toFixed(4)+' SOL';
 $$('wm').textContent=L.on?'LIVE (uang asli)':'PAPER';$$('wm').className=L.on?'r':'y';
 $$('wt').textContent=L.on?'Matikan LIVE':'Aktifkan LIVE';$$('wl').textContent=L.loss.toFixed(4)+' SOL';
}
async function refBal(){if(ADDR&&Date.now()-lastBal>15000){lastBal=Date.now();BAL=await solBal();wr()}}
$$('wsave').onclick=()=>{if(!native){alert('Hanya di aplikasi APK');return}const r=Android.setKey($$('wk').value);$$('wk').value='';
 if(r==='ERR'||!r){alert('Kunci tidak valid');return}ADDR=r;lastBal=0;wr();refBal()};
$$('wt').onclick=()=>{if(!L.on&&!confirm('Bot akan MEMBELI dan MENJUAL memakai uang asli di wallet ini. Anda bisa kehilangan seluruh saldo. Lanjut?'))return;L.on=!L.on;lsave();wr()};
$$('wx').onclick=()=>{L.on=false;run=false;lsave();wr();render()};
$$('wd').onclick=()=>{if(confirm('Hapus kunci dari aplikasi? Posisi terbuka tidak akan dijual otomatis.')){Android.clearKey();ADDR='';L.on=false;lsave();wr()}};
$$('wmax').value=L.maxSol;$$('wlim').value=L.dayLoss;
$$('wmax').onchange=e=>{L.maxSol=Math.max(0.003,+e.target.value||0.02);lsave()};
$$('wlim').onchange=e=>{L.dayLoss=Math.max(0,+e.target.value||0.05);lsave()};
wr();setInterval(refBal,5000);refBal();
})();
