import{initializeApp}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import{getDatabase,ref,get,set,push,onValue,update}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
/* Replace only this config with the config from your NEW AuctionXI Firebase Web App. */
const firebaseConfig={apiKey:"AIzaSyCL556A_syoypvLv8w6S951LdnMsuqAxUc",authDomain:"auctionxi-7f389.firebaseapp.com",databaseURL:"https://auctionxi-7f389-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"auctionxi-7f389",storageBucket:"auctionxi-7f389.firebasestorage.app",messagingSenderId:"173927110591",appId:"1:173927110591:web:c26f96c9516e1a9296730a",measurementId:"G-SG22FQD9TF"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id), show=(id,v)=>$(id).classList.toggle("hidden",!v);
let settings={tournamentName:"AuctionXI Tournament",totalPoints:1200,playersRequired:8,minBid:30};
async function compressPhoto(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onload=()=>{
      const img=new Image();

      img.onload=()=>{
        const max=700;
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement("canvas");

        canvas.width=Math.round(img.width*scale);
        canvas.height=Math.round(img.height*scale);

        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,canvas.width,canvas.height);

        resolve(canvas.toDataURL("image/jpeg",0.75));
      };

      img.onerror=()=>reject(new Error("Invalid image."));
      img.src=reader.result;
    };

    reader.onerror=()=>reject(new Error("Could not read photo."));
    reader.readAsDataURL(file);
  });
}
function maxBid(remaining,bought){const need=Math.max(0,settings.playersRequired-(bought+1));return bought===0?Math.max(0,settings.totalPoints-settings.playersRequired*settings.minBid):Math.max(0,remaining-need*settings.minBid)}
function renderSettings(){ $("tName").value=settings.tournamentName||"";$("points").value=settings.totalPoints;$("required").value=settings.playersRequired;$("minBid").value=settings.minBid;$("startMax").textContent=Math.max(0,settings.totalPoints-settings.playersRequired*settings.minBid);$("sName").textContent=settings.tournamentName||"—";$("sPoints").textContent=settings.totalPoints;$("sReq").textContent=settings.playersRequired}
function renderPlayers(data){
  const el=$("playerList");
  if(!el)return;

  if(!data){
    el.innerHTML="<p class='note'>No players registered yet.</p>";
    return;
  }

  const players=Object.entries(data);

  el.innerHTML=players.map(([id,p])=>`
    <div class="box" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${p.photo||""}" alt="Player photo"
             style="width:70px;height:70px;object-fit:cover;border-radius:10px">

        <div>
          <b>${p.name||"Unnamed player"}</b><br>
          <small>${p.playerId||""} · ${p.city||""}</small><br>
          <small>CricHeroes: ${p.cricheroes||"—"}</small><br>
          <small>Status: <b>${p.status||"pending"}</b></small>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">

        ${p.status==="pending"
          ? `<button type="button" class="primary"
               data-player-action="approve" data-player-id="${id}">
               Approve
             </button>`
          : ""}

        ${p.status==="pending"||p.status==="approved"
          ? `<button type="button" class="secondary"
               data-player-action="reject" data-player-id="${id}">
               Reject
             </button>`
          : ""}

        ${p.status==="approved"
          ? `<button type="button" class="primary"
               data-player-action="auction" data-player-id="${id}">
               Add to Auction
             </button>`
          : ""}

        ${p.status==="auction_pool"
          ? `<button type="button" class="secondary"
               disabled>
               In Auction Pool
             </button>`
          : ""}

      </div>
    </div>
  `).join("");
}
function renderAuctionPool(data){
  const el=$("auctionPool");
  if(!el)return;

  if(!data){
    el.innerHTML="<p class='note'>No players in the auction pool.</p>";
    return;
  }

  const players=Object.entries(data)
    .filter(([id,p])=>p.status==="auction_pool");

  if(!players.length){
    el.innerHTML="<p class='note'>No players in the auction pool.</p>";
    return;
  }

  el.innerHTML=players.map(([id,p])=>`
    <div class="box" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${p.photo||""}" alt="Player photo"
             style="width:80px;height:80px;object-fit:cover;border-radius:10px">

        <div>
          <b>${p.name||"Unnamed player"}</b><br>
          <small>${p.playerId||""} · ${p.city||""}</small><br>
          <small>CricHeroes: ${p.cricheroes||"—"}</small><br>
          <small>Status: <b>In Auction Pool</b></small>
        </div>
      </div>

      <div style="margin-top:10px">
        <button type="button"
                class="primary"
                data-auction-action="start"
                data-player-id="${id}">
          Start Auction
        </button>
      </div>
    </div>
  `).join("");
}
function adminListeners(){
  onValue(ref(db,"tournaments/main/settings"),s=>{
    if(s.exists())settings={...settings,...s.val()};
    renderSettings();
  });

  onValue(ref(db,"tournaments/main/teams"),s=>{
    const el=$("teams");
    el.innerHTML="";

    if(!s.exists()){
      el.innerHTML="<p class='note'>No teams yet.</p>";
      return;
    }

    Object.values(s.val()).forEach(t=>{
      const d=document.createElement("div");
      d.innerHTML="<b>"+(t.name||"Unnamed team")+"</b><br><small>"+(t.email||"")+"</small>";
      el.appendChild(d);
    });
  });

  onValue(ref(db,"tournaments/main/players"),s=>{
    renderPlayers(s.exists()?s.val():null);
  });
onValue(ref(db,"tournaments/main/players"),s=>{
  renderAuctionPool(s.exists()?s.val():null);
});
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-player-action]");
  if(!b)return;

  const id=b.dataset.playerId;
  const action=b.dataset.playerAction;

  try{
    await update(
      ref(db,"tournaments/main/players/"+id),
      {
  status:
    action==="approve"
      ? "approved"
      : action==="auction"
        ? "auction_pool"
        : "rejected"
}
    );
  }catch(err){
    console.error(err);
    alert("Could not update player: "+err.message);
  }
});
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(e){$("loginMsg").textContent=e.message}};
async function addPlayer(e){
  e?.preventDefault();

  const msgEl=$("playerMsg");
  const name=$("pName")?.value.trim();
  const city=$("pCity")?.value.trim();
  const cricheroes=$("pCric")?.value.trim();
  const previous=$("pPrevious")?.value.trim();
  const file=$("pPhoto")?.files?.[0];

  if(!name||!city||!cricheroes||!file){
    if(msgEl)msgEl.textContent="Please fill all required fields and select a photo.";
    return;
  }

  try{
    if(msgEl)msgEl.textContent="Registering player...";

    const photo=await compressPhoto(file);

    const snap=await get(ref(db,"tournaments/main/players"));
    const existing=snap.exists()?snap.val():{};

    let highest=0;
    Object.values(existing).forEach(p=>{
      const n=Number(String(p.playerId||"").replace("AXI-",""));
      if(Number.isFinite(n))highest=Math.max(highest,n);
    });

    const playerId=`AXI-${String(highest+1).padStart(4,"0")}`;
    const newPlayer=push(ref(db,"tournaments/main/players"));

    await set(newPlayer,{
      playerId,
      name,
      city,
      cricheroes,
      previous,
      photo,
      status:"pending",
      selected:false,
      createdAt:Date.now()
    });

    $("pName").value="";
    $("pCity").value="";
    $("pCric").value="";
    $("pPrevious").value="";
    $("pPhoto").value="";
    $("photoPreview").innerHTML="";

    if(msgEl)msgEl.textContent=`Player registered successfully — ${playerId}`;
  }catch(err){
    console.error(err);
    if(msgEl)msgEl.textContent="Could not register player: "+err.message;
  }
}
$("addPlayer").onclick=addPlayer;
$("logout").onclick=()=>signOut(auth);
$("save").onclick=async()=>{const total=+$("points").value,req=+$("required").value,min=+$("minBid").value;if(total<req*min){$("saveMsg").textContent="Total points must be at least "+req*min;return}await set(ref(db,"tournaments/main/settings"),{tournamentName:$("tName").value.trim()||"AuctionXI Tournament",totalPoints:total,playersRequired:req,minBid:min});$("saveMsg").textContent="Settings saved."};
onAuthStateChanged(auth,async u=>{if(!u){show("login",true);show("admin",false);show("team",false);show("logout",false);return}show("login",false);show("logout",true);const s=await get(ref(db,"users/"+u.uid));if(!s.exists()){alert("This account is not assigned an AuctionXI role.");await signOut(auth);return}const p=s.val();if(p.role==="admin"){show("admin",true);show("team",false);adminListeners()}else if(p.role==="team"){show("team",true);show("admin",false);onValue(ref(db,"tournaments/main/settings"),x=>{if(x.exists())settings={...settings,...x.val()};});onValue(ref(db,"tournaments/main/teams/"+p.teamId),x=>{if(!x.exists())return;const t=x.val(),b=+(t.bought||0),r=+(t.remaining??settings.totalPoints);$("teamNameOut").textContent=t.name||"Team";$("teamTournament").textContent=settings.tournamentName;$("remaining").textContent=r;$("bought").textContent=b+" / "+settings.playersRequired;$("maxBid").textContent=maxBid(r,b);$("reserve").textContent=Math.max(0,settings.playersRequired-b)*settings.minBid})}});
