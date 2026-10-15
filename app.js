import{initializeApp}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import{getDatabase,ref,get,set,push,onValue,update,remove}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

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
          data-player-remove="${id}"
          style="border-color:#c62828;color:#c62828"
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

        <button
          type="button"
          class="secondary"
          data-team-remove="${id}"
          style="margin-top:14px;border-color:#c62828;color:#c62828;width:100%"
        >
          Remove Team
        </button>

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
   ADMIN REMOVE ACTIONS
========================= */
document.addEventListener("click", async e => {
  const removePlayerButton = e.target.closest("[data-player-remove]");
  const removeTeamButton = e.target.closest("[data-team-remove]");
  if (!removePlayerButton && !removeTeamButton) return;

  // Only allow removals while an admin session is active.
  if (!document.body.classList.contains("admin-logged-in")) {
    alert("Only the admin can remove players or teams.");
    return;
  }

  try {
    if (removePlayerButton) {
      const playerId = removePlayerButton.dataset.playerRemove;
      const playerSnap = await get(ref(db, "tournaments/main/players/" + playerId));
      if (!playerSnap.exists()) {
        alert("This player was already removed.");
        return;
      }
      const currentSnap = await get(ref(db, "tournaments/main/auction/current"));
      const current = currentSnap.exists() ? currentSnap.val() : null;
      if (current && String(current.playerId || "") === String(playerId)) {
        alert("This player is currently in the live auction. Mark the player SOLD/UNSOLD or finish the auction before removing them.");
        return;
      }
      const player = playerSnap.val();
      if (!confirm("Remove " + (player.name || "this player") + " permanently from AuctionXI? This cannot be undone.")) return;
      removePlayerButton.disabled = true;
      await remove(ref(db, "tournaments/main/players/" + playerId));
      alert("Player removed successfully.");
      return;
    }

    if (removeTeamButton) {
      const teamId = removeTeamButton.dataset.teamRemove;
      const teamSnap = await get(ref(db, "tournaments/main/teams/" + teamId));
      if (!teamSnap.exists()) {
        alert("This team was already removed.");
        return;
      }
      const team = teamSnap.val();
      const bought = Number(team.bought || 0);
      const warning = bought > 0
        ? "\n\nWARNING: This team has bought " + bought + " player(s). Removing it will erase its team record and points from this tournament."
        : "";
      if (!confirm("Remove team "" + (team.name || "Unnamed Team") + "" from this tournament?" + warning + "\n\nThis does not delete the team's Firebase login account.")) return;
      removeTeamButton.disabled = true;
      await remove(ref(db, "tournaments/main/teams/" + teamId));
      alert("Team removed from the tournament. Its login account still exists and must be disabled separately if needed.");
    }
  } catch (err) {
    console.error(err);
    alert("Could not remove item: " + (err.message || err));
  }
});

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
            "tournamen
