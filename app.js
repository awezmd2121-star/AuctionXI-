import{initializeApp}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import{getDatabase,ref,get,set,push,onValue,update}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

/* AuctionXI Firebase Web App */
const firebaseConfig={
  apiKey:"AIzaSyCL556A_syoypvLv8w6S951LdnMsuqAxUc",
  authDomain:"auctionxi-7f389.firebaseapp.com",
  databaseURL:"https://auctionxi-7f389-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"auctionxi-7f389",
  storageBucket:"auctionxi-7f389.firebasestorage.app",
  messagingSenderId:"173927110591",
  appId:"1:173927110591:web:c26f96c9516e1a9296730a",
  measurementId:"G-SG22FQD9TF"
};

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getDatabase(app);

const $=id=>document.getElementById(id);
const show=(id,v)=>$(id).classList.toggle("hidden",!v);

let settings={
  tournamentName:"AuctionXI Tournament",
  totalPoints:1200,
  playersRequired:8,
  minBid:30
};

let liveAuctionTeams={};

/* =========================
   PHOTO COMPRESSION
========================= */

async function compressPhoto(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onload=()=>{
      const img=new Image();

      img.onload=()=>{
        const max=700;
        const scale=Math.min(
          1,
          max/Math.max(img.width,img.height)
        );

        const canvas=document.createElement("canvas");

        canvas.width=Math.round(img.width*scale);
        canvas.height=Math.round(img.height*scale);

        const ctx=canvas.getContext("2d");

        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(
          canvas.toDataURL("image/jpeg",0.75)
        );
      };

      img.onerror=()=>{
        reject(new Error("Invalid image."));
      };

      img.src=reader.result;
    };

    reader.onerror=()=>{
      reject(new Error("Could not read photo."));
    };

    reader.readAsDataURL(file);
  });
}


/* =========================
   MAX BID CALCULATION
========================= */

function maxBid(remaining,bought){
  const need=Math.max(
    0,
    settings.playersRequired-(bought+1)
  );

  return bought===0
    ? Math.max(
        0,
        settings.totalPoints-
        settings.playersRequired*settings.minBid
      )
    : Math.max(
        0,
        remaining-
        need*settings.minBid
      );
}


/* =========================
   RENDER SETTINGS
========================= */

function renderSettings(){

  $("tName").value=
    settings.tournamentName||"";

  $("points").value=
    settings.totalPoints;

  $("required").value=
    settings.playersRequired;

  $("minBid").value=
    settings.minBid;

  $("startMax").textContent=
    Math.max(
      0,
      settings.totalPoints-
      settings.playersRequired*settings.minBid
    );

  $("sName").textContent=
    settings.tournamentName||"—";

  $("sPoints").textContent=
    settings.totalPoints;

  $("sReq").textContent=
    settings.playersRequired;
}


/* =========================
   TEAM AUCTION STATUS
========================= */
let teamDashboardPlayers = {};
let teamCurrentAuction = null;
let teamDashboardTeams = {};

function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}

function teamPlayerCard(player, extra=""){
  const name=escapeHTML(player.name || "Player");
  const photo=player.photo ? `<img class="team-auction-photo" src="${escapeHTML(player.photo)}" alt="${name}">` : `<div class="team-auction-photo team-photo-placeholder">🏏</div>`;
  const meta=[player.playerId,player.city].filter(Boolean).map(escapeHTML).join(" · ");
  return `<article class="team-auction-player">${photo}<div class="team-auction-info"><strong>${name}</strong>${meta?`<small>${meta}</small>`:""}${extra}</div></article>`;
}

/* =========================
   MY SQUAD
========================= */

function renderMySquad(players){

  const el = $("mySquad");

  if(!el) {
    console.warn("My Squad container not found: mySquad");
    return;
  }

  const entries = Object.entries(players || {})
    .filter(([id, player]) => player && player.status === "sold")
    .sort((a, b) =>
      Number(b[1].soldFor || 0) - Number(a[1].soldFor || 0)
    );

  if(!entries.length){
    el.innerHTML =
      '<p class="note">You have not purchased any players yet.</p>';
    return;
  }

  el.innerHTML = entries.map(([id, player]) => {

    const name = escapeHTML(player.name || "Player");
    const photo = player.photo
      ? `<img class="squad-photo" src="${escapeHTML(player.photo)}" alt="${name}">`
      : `<div class="squad-photo team-photo-placeholder">🏏</div>`;

    const playerId = escapeHTML(player.playerId || "");
    const city = escapeHTML(player.city || "");
    const previous = escapeHTML(player.previous || "");
    const cricheroes = escapeHTML(player.cricheroes || "");
    const price = Number(player.soldFor || 0).toLocaleString("en-IN");

    return `
      <article class="squad-player">
        ${photo}

        <div class="squad-player-info">
          <strong>${name}</strong>

          ${playerId ? `<small>${playerId}</small>` : ""}
          ${city ? `<small>City: ${city}</small>` : ""}
          ${cricheroes ? `<small>CricHeroes: ${cricheroes}</small>` : ""}
          ${previous ? `<small>Previous team: ${previous}</small>` : ""}

          <div class="squad-price">
            Bought for ${price} points
          </div>
        </div>
      </article>
    `;

  }).join("");
}

function renderTeamAuctionSections(){
  const liveEl=$("teamCurrentAuction");
  const poolEl=$("teamAuctionPool");
  const soldEl=$("teamSoldPlayers");
  const unsoldEl=$("teamUnsoldPlayers");
  if(!liveEl || !poolEl || !soldEl || !unsoldEl) return;

  const players=Object.entries(teamDashboardPlayers || {});
  const current=teamCurrentAuction;
  if(current && current.state==="live"){
    const bid=Number(current.currentBid||0);
    const leader=current.highestTeamName ? escapeHTML(current.highestTeamName) : "No bids yet";
    liveEl.innerHTML=`<div class="live-player-banner"><span class="live-pill">● LIVE NOW</span>${teamPlayerCard(current, `<small class="live-bid-line">Current bid: <strong>${bid.toLocaleString("en-IN")} points</strong></small><small>Highest team: <strong>${leader}</strong></small>`)}</div>`;
  }else{
    liveEl.innerHTML='<p class="note">No player is being auctioned right now. The next player will appear here when the admin starts the auction.</p>';
  }

  const pool=players.filter(([id,p])=>p && p.status==="auction_pool" && !(current && current.state==="live" && current.databaseId===id));
  poolEl.innerHTML=pool.length ? pool.map(([id,p])=>teamPlayerCard(p,'<small class="status-label">Waiting for auction</small>')).join("") : '<p class="note">No upcoming players are currently in the auction pool.</p>';

  const sold=players.filter(([id,p])=>p && p.status==="sold").sort((a,b)=>Number(b[1].soldAt||0)-Number(a[1].soldAt||0));
  soldEl.innerHTML=sold.length ? sold.map(([id,p])=>{
    const teamId=p.soldTo || "";
    const team=(teamId && teamDashboardTeams[teamId]) || {};
    const teamName=team.name || (teamId ? "Team record unavailable" : "Team not recorded");
    const price=Number(p.soldFor||0).toLocaleString("en-IN");
    return teamPlayerCard(p, `<small class="sold-detail">Sold for <strong>${price} points</strong></small><small>Sold to: <strong>${escapeHTML(teamName)}</strong></small>`);
  }).join("") : '<p class="note">No players have been sold yet.</p>';

  const unsold=players.filter(([id,p])=>p && p.status==="unsold");
  unsoldEl.innerHTML=unsold.length ? unsold.map(([id,p])=>teamPlayerCard(p,'<small class="unsold-label">UNSOLD</small>')).join("") : '<p class="note">No unsold players at the moment.</p>';
}

/* =========================
   PLAYER MANAGEMENT
========================= */

function renderPlayers(data){

  const el=$("playerList");

  if(!el)return;

  if(!data){
    el.innerHTML=
      "<p class='note'>No players registered yet.</p>";
    return;
  }

  const players=Object.entries(data);

  el.innerHTML=players.map(([id,p])=>`

    <div class="box" style="margin-bottom:12px">

      <div style="display:flex;gap:12px;align-items:center">

        <img
          src="${p.photo||""}"
          alt="Player photo"
          style="width:70px;height:70px;object-fit:cover;border-radius:10px"
        >

        <div>

          <b>${p.name||"Unnamed player"}</b><br>

          <small>
            ${p.playerId||""} · ${p.city||""}
          </small><br>

          <small>
            CricHeroes: ${p.cricheroes||"—"}
          </small><br>

          <small>
            Status:
            <b>${p.status||"pending"}</b>
          </small>

        </div>

      </div>


      <div
        style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"
      >

        ${
          p.status==="pending"
          ? `
            <button
              type="button"
              class="primary"
              data-player-action="approve"
              data-player-id="${id}"
            >
              Approve
            </button>
          `
          : ""
        }


        ${
          p.status==="pending"||
          p.status==="approved"
          ? `
            <button
              type="button"
              class="secondary"
              data-player-action="reject"
              data-player-id="${id}"
            >
              Reject
            </button>
          `
          : ""
        }


        ${
          p.status==="approved"
          ? `
            <button
              type="button"
              class="primary"
              data-player-action="auction"
              data-player-id="${id}"
            >
              Add to Auction
            </button>
          `
          : ""
        }


        ${
          p.status==="auction_pool"
          ? `
            <button
              type="button"
              class="secondary"
              disabled
            >
              In Auction Pool
            </button>
          `
          : ""
        }

        <button
          type="button"
          class="secondary"
          data-player-action="remove"
          data-player-id="${id}"
          style="border-color:#ef4444;color:#fecaca"
        >
          Remove Player
        </button>

      </div>

    </div>

  `).join("");
}


/* =========================
   AUCTION POOL
========================= */

function renderAuctionPool(data){

  const el=$("auctionPool");

  if(!el)return;

  if(!data){

    el.innerHTML=
      "<p class='note'>No players in the auction pool.</p>";

    return;
  }

  const players=Object.entries(data)
    .filter(([id,p])=>
      p.status==="auction_pool"
    );

  if(!players.length){

    el.innerHTML=
      "<p class='note'>No players in the auction pool.</p>";

    return;
  }

  el.innerHTML=players.map(([id,p])=>`

    <div
      class="box"
      style="margin-bottom:12px"
    >

      <div
        style="display:flex;gap:12px;align-items:center"
      >

        <img
          src="${p.photo||""}"
          alt="Player photo"
          style="width:80px;height:80px;object-fit:cover;border-radius:10px"
        >

        <div>

          <b>
            ${p.name||"Unnamed player"}
          </b><br>

          <small>
            ${p.playerId||""} · ${p.city||""}
          </small><br>

          <small>
            CricHeroes: ${p.cricheroes||"—"}
          </small><br>

          <small>
            Status:
            <b>In Auction Pool</b>
          </small>

        </div>

      </div>


      <div style="margin-top:10px">

        <button
          type="button"
          class="primary"
          data-auction-action="start"
          data-player-id="${id}"
        >
          Start Auction
        </button>

      </div>

    </div>

  `).join("");
}
  /* =========================
   LIVE AUCTION
========================= */

function renderLiveAuction(data){

  const el=$("liveAuction");

  if(!el)return;

  if(!data || data.state!=="live"){

    el.innerHTML=
      "<p class='note'>No player is currently live.</p>";

    return;
  }

  const teams=Object.entries(liveAuctionTeams||{});

  const teamOptions=teams.length
    ? teams.map(([id,t])=>{

        const remaining=Number(t.remaining||0);
        const bought=Number(t.bought||0);
        const legalMax=maxBid(remaining,bought);

        return `
          <option value="${id}">
            ${t.name||"Unnamed Team"} — Max ${legalMax}
          </option>
        `;

      }).join("")
    : `<option value="">No teams available</option>`;


  el.innerHTML=`

    <div
      class="box"
      style="margin-bottom:12px"
    >

      <div
        style="display:flex;gap:14px;align-items:center"
      >

        <img
          src="${data.photo||""}"
          alt="Player photo"
          style="
            width:100px;
            height:100px;
            object-fit:cover;
            border-radius:12px;
          "
        >

        <div>

          <h3 style="margin:0 0 6px">
            ${data.name||"Player"}
          </h3>

          <small>
            ${data.playerId||""} · ${data.city||""}
          </small>

          <br>

          <small>
            CricHeroes: ${data.cricheroes||"—"}
          </small>

        </div>

      </div>


      <div style="margin-top:18px">

        <p>
          Current Bid:
          <b>${data.currentBid||0} points</b>
        </p>

        <p>
          Highest Team:
          <b>
            ${data.highestTeamName||"No bids yet"}
          </b>
        </p>

      </div>


      <!-- ADMIN BIDDING -->

      <div
        class="box"
        style="margin-top:16px"
      >

        <h3 style="margin-top:0">
          Admin Bidding
        </h3>

        <label>
          Team
        </label>

        <select
          id="liveBidTeam"
          style="width:100%;padding:10px;margin-top:6px"
        >

          <option value="">
            Select team
          </option>

          ${teamOptions}

        </select>


        <label
          style="display:block;margin-top:12px"
        >
          Bid Amount
        </label>

        <input
          id="liveBidAmount"
          type="number"
          min="${settings.minBid}"
          step="${settings.minBid}"
          placeholder="Enter bid"
          style="width:100%;padding:10px;margin-top:6px"
        >


        <button
          type="button"
          class="primary"
          data-live-action="bid"
          style="margin-top:12px"
        >
          Place Bid
        </button>

        <p
          id="liveBidMsg"
          class="note"
          style="margin-top:8px"
        ></p>

      </div>


      <!-- SOLD / UNSOLD -->

      <div
        style="
          margin-top:16px;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="primary"
          data-live-action="sold"
        >
          SOLD
        </button>

        <button
          type="button"
          class="secondary"
          data-live-action="unsold"
        >
          UNSOLD
        </button>

      </div>

    </div>

  `;
}



/* =========================
   ADMIN LISTENERS
========================= */
function renderRegisteredTeams(data){

  const el=$("registeredTeams");

  if(!el)return;

  if(!data){

    el.innerHTML=
      "<p class='note'>No teams registered yet.</p>";

    return;
  }

  const teams=Object.entries(data);

  if(!teams.length){

    el.innerHTML=
      "<p class='note'>No teams registered yet.</p>";

    return;
  }

  const required=
    Number(settings.playersRequired||0);

  const totalPoints=
    Number(settings.totalPoints||0);

  const minBid=
    Number(settings.minBid||0);

  el.innerHTML=teams.map(([id,t])=>{

    const remaining=
      Number(t.remaining ?? totalPoints);

    const bought=
      Number(t.bought||0);

    const playersRemaining=
      Math.max(
        0,
        required-bought
      );

    const spent=
      Math.max(
        0,
        totalPoints-remaining
      );

    const reserved=
      playersRemaining*minBid;

    const legalMax=
      bought>=required
        ? 0
        : maxBid(
            remaining,
            bought
          );

    return `

      <div
        class="box"
        style="margin-bottom:12px"
      >

        <h3 style="margin:0 0 12px">
          ${t.name||"Unnamed Team"}
        </h3>

        <div class="grid two">

          <div>
            <small>Remaining Points</small>
            <br>
            <b>${remaining}</b>
          </div>

          <div>
            <small>Maximum Legal Bid</small>
            <br>
            <b>${legalMax}</b>
          </div>

          <div>
            <small>Players Bought</small>
            <br>
            <b>${bought} / ${required}</b>
          </div>

          <div>
            <small>Players Remaining</small>
            <br>
            <b>${playersRemaining}</b>
          </div>

          <div>
            <small>Total Spent</small>
            <br>
            <b>${spent}</b>
          </div>

          <div>
            <small>Reserved Minimum</small>
            <br>
            <b>${reserved}</b>
          </div>

        </div>

        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button
            type="button"
            class="secondary"
            data-team-action="remove"
            data-team-id="${id}"
            style="border-color:#ef4444;color:#fecaca"
          >
            Remove Team
          </button>
        </div>

      </div>

    `;

  }).join("");
}
function adminListeners(){

  onValue(
    ref(db,"tournaments/main/settings"),
    s=>{

      if(s.exists()){
        settings={
          ...settings,
          ...s.val()
        };
      }

      renderSettings();

    }
  );


  onValue(
    ref(db,"tournaments/main/teams"),
    s=>{

      const teams =
        s.exists()
          ? s.val()
          : {};

      liveAuctionTeams = teams;

      renderRegisteredTeams(teams);

      get(
        ref(db,"tournaments/main/auction/current")
      ).then(currentSnap=>{

        renderLiveAuction(
          currentSnap.exists()
            ? currentSnap.val()
            : null
        );

      });

    }
  );

  /* Player Management */

  onValue(
    ref(db,"tournaments/main/players"),
    s=>{
      renderPlayers(
        s.exists()?s.val():null
      );
    }
  );


  /* Auction Pool */

  onValue(
    ref(db,"tournaments/main/players"),
    s=>{
      renderAuctionPool(
        s.exists()?s.val():null
      );
    }
  );


  /* Live Auction */

  onValue(
    ref(db,"tournaments/main/auction/current"),
    s=>{
      renderLiveAuction(
        s.exists()?s.val():null
      );
    }
  );

}

/* =========================
   PLAYER ACTIONS
========================= */

document.addEventListener(
  "click",
  async e=>{

    const b=e.target.closest(
      "[data-player-action]"
    );

    if(!b)return;

    const id=b.dataset.playerId;
    const action=b.dataset.playerAction;

    if(action==="remove"){
      const confirmed=confirm("Remove this player permanently from AuctionXI? This deletes the player record and cannot be undone.");
      if(!confirmed)return;
      try{
        await set(ref(db,"tournaments/main/players/"+id),null);
      }catch(err){
        console.error(err);
        alert("Could not remove player: "+err.message);
      }
      return;
    }

    try{

      await update(
        ref(
          db,
          "tournaments/main/players/"+id
        ),
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

      alert(
        "Could not update player: "+
        err.message
      );

    }

  }
);

/* =========================
   REMOVE TEAM ACTION
========================= */

document.addEventListener("click", async e=>{
  const b=e.target.closest("[data-team-action=\"remove\"]");
  if(!b)return;
  const id=b.dataset.teamId;
  if(!id)return;
  const confirmed=confirm("Remove this team permanently from AuctionXI? The team record and its squad will be deleted. This does not delete a Firebase Authentication login or its users/{uid} role record.");
  if(!confirmed)return;
  b.disabled=true;
  try{
    await set(ref(db,"tournaments/main/teams/"+id),null);
  }catch(err){
    console.error(err);
    alert("Could not remove team: "+err.message);
    b.disabled=false;
  }
});

/* =========================
   LIVE AUCTION ACTIONS
========================= */

document.addEventListener(
  "click",
  async e=>{

    const b=e.target.closest("[data-live-action]");
    if(!b)return;

    const action=b.dataset.liveAction;

    try{

      const snap=await get(
        ref(db,"tournaments/main/auction/current")
      );

      if(!snap.exists())return;

      const auction=snap.val();

      if(!auction.playerId){
        alert("No player is currently live.");
        return;
      }

      if(action==="bid"){

  const teamId=
    $("liveBidTeam")?.value||"";

  const bid=
    Number(
      $("liveBidAmount")?.value||0
    );

  const msg=
    $("liveBidMsg");


  if(!teamId){

    if(msg){
      msg.textContent=
        "Please select a team.";
    }

    return;
  }


  if(!Number.isFinite(bid)||bid<=0){

    if(msg){
      msg.textContent=
        "Enter a valid bid amount.";
    }

    return;
  }


  if(bid<Number(settings.minBid)){

    if(msg){
      msg.textContent=
        "Minimum bid is "+
        settings.minBid+
        " points.";
    }

    return;
  }


  const currentBid=
    Number(auction.currentBid||0);


  if(bid<=currentBid){

    if(msg){
      msg.textContent=
        "Bid must be higher than the current bid of "+
        currentBid+
        " points.";
    }

    return;
  }


  const teamSnap=
    await get(
      ref(
        db,
        "tournaments/main/teams/"+teamId
      )
    );


  if(!teamSnap.exists()){

    if(msg){
      msg.textContent=
        "Selected team was not found.";
    }

    return;
  }


  const team=
    teamSnap.val();


  const remaining=
    Number(team.remaining||0);

  const bought=
    Number(team.bought||0);


  const legalMax=
    maxBid(
      remaining,
      bought
    );


  if(bid>legalMax){

    if(msg){
      msg.textContent=
        "Maximum legal bid for this team is "+
        legalMax+
        " points.";
    }

    return;
  }


  const teamName=
    team.name||
    "Unnamed Team";


  await update(
    ref(
      db,
      "tournaments/main/auction/current"
    ),
    {
      currentBid:bid,
      highestTeamId:teamId,
      highestTeamName:teamName,
      lastBidAt:Date.now()
    }
  );


  if(msg){

    msg.textContent=
      "Bid placed: "+
      bid+
      " points by "+
      teamName;

  }

  return;
      }
      
      if(action==="unsold"){

        await update(
          ref(
            db,
            "tournaments/main/players/"+auction.databaseId
          ),
          {
            status:"unsold"
          }
        );

        await update(
          ref(
            db,
            "tournaments/main/auction/current"
          ),
          {
            state:"unsold"
          }
        );

        return;
      }

      if(action==="sold"){

        if(!auction.highestTeamId){
          alert("There is no winning team.");
          return;
        }

        if(!auction.currentBid || auction.currentBid<=0){
          alert("There is no bid for this player.");
          return;
        }

        const teamRef=ref(
          db,
          "tournaments/main/teams/"+auction.highestTeamId
        );

        const teamSnap=await get(teamRef);

        if(!teamSnap.exists()){
          alert("Winning team was not found.");
          return;
        }

        const team=teamSnap.val();

        const remaining=Number(team.remaining||0);
        const bought=Number(team.bought||0);
        const bid=Number(auction.currentBid||0);

        if(bid>remaining){
          alert("Winning team does not have enough points.");
          return;
        }

        const newRemaining=remaining-bid;
        const newBought=bought+1;

        const squadPlayer={
          playerId:auction.playerId,
          name:auction.name||"Player",
          city:auction.city||"",
          cricheroes:auction.cricheroes||"",
          previous:auction.previous||"",
          photo:auction.photo||"",
          soldFor:bid,
          status:"sold"
        };

        const updates={};

        updates[
          "tournaments/main/players/"+auction.databaseId+"/status"
        ]="sold";

        updates[
          "tournaments/main/players/"+auction.databaseId+"/soldTo"
        ]=auction.highestTeamId;

        updates[
          "tournaments/main/players/"+auction.databaseId+"/soldFor"
        ]=bid;

        updates[
          "tournaments/main/players/"+auction.databaseId+"/soldAt"
        ]=Date.now();

        updates[
          "tournaments/main/teams/"+auction.highestTeamId+"/remaining"
        ]=newRemaining;

        updates[
          "tournaments/main/teams/"+auction.highestTeamId+"/bought"
        ]=newBought;

        const squadKey=push(
          ref(
            db,
            "tournaments/main/teams/"+auction.highestTeamId+"/players"
          )
        ).key;

        updates[
          "tournaments/main/teams/"+auction.highestTeamId+"/players/"+squadKey
        ]=squadPlayer;

        updates[
          "tournaments/main/auction/current/state"
        ]="sold";

        await update(ref(db),updates);

        alert(
          "SOLD to "+
          (auction.highestTeamName||team.name||"winning team")+
          " for "+
          bid+
          " points."
        );

      }

    }catch(err){

      console.error(err);

      alert(
        "Auction action failed: "+
        err.message
      );

    }

  }
);

/* =========================
   START AUCTION
========================= */

document.addEventListener(
  "click",
  async e=>{

    const b=e.target.closest(
      "[data-auction-action]"
    );

    if(!b)return;

    const action=b.dataset.auctionAction;
    const id=b.dataset.playerId;

    if(action!=="start")return;

    try{

      /* Get selected player */

      const playerSnap=await get(
        ref(
          db,
          "tournaments/main/players/"+id
        )
      );

      if(!playerSnap.exists()){

        alert("Player not found.");

        return;
      }

      const player=playerSnap.val();


      /* Verify player is actually in auction pool */

      if(player.status!=="auction_pool"){

        alert(
          "This player is not in the auction pool."
        );

        return;
      }


      /* Check whether another auction is already live */

      const currentSnap=await get(
        ref(
          db,
          "tournaments/main/auction/current"
        )
      );

      if(
        currentSnap.exists() &&
        currentSnap.val().state==="live"
      ){

        alert(
          "Another auction is already live."
        );

        return;
      }


      /* Start auction */

      await update(
        ref(db),
        {

          [`tournaments/main/players/${id}/status`]:
            "auction_live",

          "tournaments/main/auction/current":{
            playerId:player.playerId||"",
            databaseId:id,
            name:player.name||"",
            city:player.city||"",
            cricheroes:player.cricheroes||"",
            previous:player.previous||"",
            photo:player.photo||"",
            state:"live",
            currentBid:0,
            highestTeamId:"",
            highestTeamName:"",
            startedAt:Date.now()
          }

        }
      );


      alert(
        `${player.name||"Player"} auction started.`
      );

    }catch(err){

      console.error(err);

      alert(
        "Could not start auction: "+
        err.message
      );

    }

  }
);


/* =========================
   LOGIN
========================= */

async function login(){

  const email=$("email")?.value.trim()||"";
  const password=$("password")?.value||"";
  const msg=$("loginMsg");
  const btn=$("loginBtn");

  if(!email || !password){

    if(msg){
      msg.textContent="Please enter both email and password.";
    }

    return;
  }

  if(btn){
    btn.disabled=true;
    btn.textContent="Signing in...";
  }

  try{

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  }catch(error){

    console.error("AuctionXI login error:",error);

    if(msg){
      msg.textContent=
        error.message||"Login failed.";
    }

  }finally{

    if(btn){
      btn.disabled=false;
      btn.textContent="Sign in";
    }

  }

}

$("loginBtn")?.addEventListener(
  "click",
  login
);

$("password")?.addEventListener(
  "keydown",
  e=>{
    if(e.key==="Enter"){
      login();
    }
  }
);


/* =========================
   PLAYER REGISTRATION
========================= */

async function addPlayer(e){

  e?.preventDefault();

  const msgEl=$("playerMsg");

  const name=
    $("pName")?.value.trim();

  const city=
    $("pCity")?.value.trim();

  const cricheroes=
    $("pCric")?.value.trim();

  const previous=
    $("pPrevious")?.value.trim();

  const file=
    $("pPhoto")?.files?.[0];


  if(
    !name||
    !city||
    !cricheroes||
    !file
  ){

    if(msgEl){

      msgEl.textContent=
        "Please fill all required fields and select a photo.";

    }

    return;
  }


  try{

    if(msgEl){

      msgEl.textContent=
        "Registering player...";

    }


    const photo=
      await compressPhoto(file);


    const snap=
      await get(
        ref(db,"tournaments/main/players")
      );


    const existing=
      snap.exists()
        ? snap.val()
        : {};


    let highest=0;


    Object.values(existing).forEach(p=>{

      const n=
        Number(
          String(p.playerId||"")
            .replace("AXI-","")
        );

      if(Number.isFinite(n)){

        highest=
          Math.max(
            highest,
            n
          );

      }

    });


    const playerId=
      `AXI-${String(highest+1).padStart(4,"0")}`;


    const newPlayer=
      push(
        ref(db,"tournaments/main/players")
      );


    await set(
      newPlayer,
      {
        playerId,
        name,
        city,
        cricheroes,
        previous,
        photo,
        status:"pending",
        selected:false,
        createdAt:Date.now()
      }
    );


    $("pName").value="";
    $("pCity").value="";
    $("pCric").value="";
    $("pPrevious").value="";
    $("pPhoto").value="";
    $("photoPreview").innerHTML="";


    if(msgEl){

      msgEl.textContent=
        `Player registered successfully — ${playerId}`;

    }

  }catch(err){

    console.error(err);

    if(msgEl){

      msgEl.textContent=
        "Could not register player: "+
        err.message;

    }

  }

}


$("addPlayer").onclick=
  addPlayer;


/* =========================
   LOGOUT
========================= */

$("logout").onclick=
  ()=>signOut(auth);


/* =========================
   SAVE TOURNAMENT SETTINGS
========================= */

$("save").onclick=async()=>{

  const total=
    +$("points").value;

  const req=
    +$("required").value;

  const min=
    +$("minBid").value;


  if(total<req*min){

    $("saveMsg").textContent=
      "Total points must be at least "+
      req*min;

    return;
  }


  await set(
    ref(db,"tournaments/main/settings"),
    {
      tournamentName:
        $("tName").value.trim()||
        "AuctionXI Tournament",

      totalPoints:total,

      playersRequired:req,

      minBid:min
    }
  );


  $("saveMsg").textContent=
    "Settings saved.";

};

/* =========================
   ADD TEAM
========================= */

$("addTeam")?.addEventListener(
  "click",
  async ()=>{

    const name=
      $("newTeamName")?.value.trim()||"";

    const email=
      $("newTeamEmail")?.value.trim()||"";

    const msg=
      $("teamMsg");


    if(!name){

      if(msg){
        msg.textContent=
          "Please enter a team name.";
      }

      return;
    }


    try{

      if(msg){
        msg.textContent=
          "Adding team...";
      }


      const teamsRef=
        ref(
          db,
          "tournaments/main/teams"
        );


      const newTeam=
        push(teamsRef);


      await set(
        newTeam,
        {
          name:name,
          email:email,
          remaining:Number(
            settings.totalPoints
          ),
          bought:0,
          players:{},
          createdAt:Date.now()
        }
      );


      $("newTeamName").value="";
      $("newTeamEmail").value="";


      if(msg){

        msg.textContent=
          "Team added successfully.";

      }

    }catch(err){

      console.error(err);

      if(msg){

        msg.textContent=
          "Could not add team: "+
          err.message;

      }

    }

  }
);

/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(
  auth,
  async u=>{

    /* Not logged in */

    if(!u){
      
      document.body.classList.remove("admin-logged-in");

      show("login",true);
      show("admin",false);
      show("team",false);
      show("logout",false);

      return;
    }


    show("login",false);
    show("logout",true);


    /* Load user role */

    const s=
      await get(
        ref(db,"users/"+u.uid)
      );


    if(!s.exists()){

      alert(
        "This account is not assigned an AuctionXI role."
      );

      await signOut(auth);

      return;
    }


    const p=s.val();


    /* =========================
       ADMIN
    ========================= */

    if(p.role==="admin"){

      document.body.classList.add("admin-logged-in");

      show("admin",true);
      show("team",false);

      adminListeners();

    }


    /* =========================
       TEAM
    ========================= */

    else if(p.role==="team"){

      show("team",true);
      show("admin",false);


      /* Tournament settings */

      onValue(
        ref(db,"tournaments/main/settings"),
        x=>{

          if(x.exists()){

            settings={
              ...settings,
              ...x.val()
            };

          }

        }
      );


            /* Team data */

      onValue(
        ref(
          db,
          "tournaments/main/teams/"+p.teamId
        ),
        x=>{

          if(!x.exists()){
            console.error(
              "Team not found. Check the teamId in users/"+u.uid
            );
            $("teamNameOut").textContent="Team not linked";
            return;
          }

          const t=x.val();
          const b=+(t.bought||0);
          const r=+(t.remaining??settings.totalPoints);

          renderMySquad(t.players || {});
          
          $("teamNameOut").textContent=
            t.name||"Team";

          $("teamTournament").textContent=
            settings.tournamentName;

          $("remaining").textContent=r;

          $("bought").textContent=
            b+" / "+settings.playersRequired;

          $("maxBid").textContent=
            maxBid(r,b);
        }
      );

      /* Team auction screens: current live player, upcoming pool, sold and unsold lists */
      onValue(ref(db,"tournaments/main/players"), snapshot=>{
        teamDashboardPlayers = snapshot.exists() ? snapshot.val() : {};
        renderTeamAuctionSections();
      });

      onValue(ref(db,"tournaments/main/auction/current"), snapshot=>{
        teamCurrentAuction = snapshot.exists() ? snapshot.val() : null;
        renderTeamAuctionSections();
      });

      /* Other teams live information */
      onValue(
        ref(db,"tournaments/main/teams"),
        snapshot=>{
          teamDashboardTeams = snapshot.exists() ? snapshot.val() : {};
          renderTeamAuctionSections();
          const container=$("otherTeams");
          if(!container)return;

          if(!snapshot.exists()){
            container.innerHTML='<p class="note">No teams registered yet.</p>';
            return;
          }

          const teams=snapshot.val();
          const otherTeams=Object.entries(teams)
            .filter(([teamId])=>teamId!==p.teamId);

          if(!otherTeams.length){
            container.innerHTML='<p class="note">No other teams registered yet.</p>';
            return;
          }

          container.innerHTML=otherTeams.map(([teamId,team])=>{
            const bought=Number(team.bought||0);
            const remaining=Number(team.remaining??settings.totalPoints);
            const limit=maxBid(remaining,bought);
            const name=String(team.name||"Unnamed Team")
              .replace(/[&<>"']/g,char=>({
                "&":"&amp;",
                "<":"&lt;",
                ">":"&gt;",
                '"':"&quot;",
                "'":"&#39;"
              })[char]);

            return `
              <div class="box" style="margin-bottom:12px">
                <h3>${name}</h3>
                <p>Remaining points: <strong>${remaining}</strong></p>
                <p>Players bought: <strong>${bought} / ${settings.playersRequired}</strong></p>
                <p>Maximum legal bid: <strong>${limit}</strong></p>
              </div>
            `;
          }).join("");
        }
      );

    }

  }
);
