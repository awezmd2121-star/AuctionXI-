import{initializeApp}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import{getDatabase,ref,get,set,onValue}from"https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

/* Replace only this config with the config from your NEW AuctionXI Firebase Web App. */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCL556A_syoypvLv8w6S951LdnMsuqAxUc",
  authDomain: "auctionxi-7f389.firebaseapp.com",
  databaseURL: "https://auctionxi-7f389-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "auctionxi-7f389",
  storageBucket: "auctionxi-7f389.firebasestorage.app",
  messagingSenderId: "173927110591",
  appId: "1:173927110591:web:c26f96c9516e1a9296730a",
  measurementId: "G-SG22FQD9TF"
};const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id);
const show=(id,v)=>{
  const el=$(id);
  if(el) el.classList.toggle("hidden",!v);
};

let settings={
  tournamentName:"AuctionXI Tournament",
  totalPoints:1200,
  playersRequired:8,
  minBid:30
};

function maxBid(remaining,bought){
  const need=Math.max(0,settings.playersRequired-(bought+1));
  return bought===0
    ? Math.max(0,settings.totalPoints-settings.playersRequired*settings.minBid)
    : Math.max(0,remaining-need*settings.minBid);
}

function renderSettings(){
  if($("tName")) $("tName").value=settings.tournamentName||"";
  if($("points")) $("points").value=settings.totalPoints;
  if($("required")) $("required").value=settings.playersRequired;
  if($("minBid")) $("minBid").value=settings.minBid;
  if($("startMax")) $("startMax").textContent=
    Math.max(0,settings.totalPoints-settings.playersRequired*settings.minBid);
  if($("sName")) $("sName").textContent=settings.tournamentName||"—";
  if($("sPoints")) $("sPoints").textContent=settings.totalPoints;
  if($("sReq")) $("sReq").textContent=settings.playersRequired;
}

async function login(){
  const email=$("email")?.value.trim()||"";
  const password=$("password")?.value||"";
  const msg=$("loginMsg");

  if(!email||!password){
    if(msg) msg.textContent="Please enter email and password.";
    return;
  }

  try{
    if(msg) msg.textContent="Signing in...";
    await signInWithEmailAndPassword(auth,email,password);
  }catch(e){
    console.error(e);
    if(msg) msg.textContent="Login error: "+(e.code||e.message);
  }
}

$("loginBtn")?.addEventListener("click",login);

$("password")?.addEventListener("keydown",e=>{
  if(e.key==="Enter") login();
});

$("logout")?.addEventListener("click",()=>signOut(auth));

$("save")?.addEventListener("click",async()=>{
  const total=+$("points").value;
  const req=+$("required").value;
  const min=+$("minBid").value;

  if(total<req*min){
    $("saveMsg").textContent="Total points must be at least "+req*min;
    return;
  }

  try{
    await set(ref(db,"tournaments/main/settings"),{
      tournamentName:$("tName").value.trim()||"AuctionXI Tournament",
      totalPoints:total,
      playersRequired:req,
      minBid:min
    });

    $("saveMsg").textContent="Settings saved.";
  }catch(e){
    $("saveMsg").textContent="Save error: "+e.message;
  }
});

onAuthStateChanged(auth,async u=>{
  try{
    if(!u){
      show("login",true);
      show("admin",false);
      show("team",false);
      show("logout",false);
      return;
    }

    show("login",false);
    show("logout",true);

    const s=await get(ref(db,"users/"+u.uid));

    if(!s.exists()){
      if($("loginMsg"))
        $("loginMsg").textContent="Account has no AuctionXI role.";
      await signOut(auth);
      return;
    }

    const p=s.val();

    if(p.role==="admin"){
      show("admin",true);
      show("team",false);

      onValue(ref(db,"tournaments/main/settings"),snap=>{
        if(snap.exists())
          settings={...settings,...snap.val()};
        renderSettings();
      });

    }else if(p.role==="team"){
      show("team",true);
      show("admin",false);

      onValue(ref(db,"tournaments/main/settings"),snap=>{
        if(snap.exists())
          settings={...settings,...snap.val()};
      });

      onValue(ref(db,"tournaments/main/teams/"+p.teamId),snap=>{
        if(!snap.exists()) return;

        const t=snap.val();
        const b=+(t.bought||0);
        const r=+(t.remaining??settings.totalPoints);

        if($("teamNameOut")) $("teamNameOut").textContent=t.name||"Team";
        if($("teamTournament")) $("teamTournament").textContent=settings.tournamentName;
        if($("remaining")) $("remaining").textContent=r;
        if($("bought")) $("bought").textContent=b+" / "+settings.playersRequired;
        if($("maxBid")) $("maxBid").textContent=maxBid(r,b);
        if($("reserve")) $("reserve").textContent=
          Math.max(0,settings.playersRequired-b)*settings.minBid;
      });
    }

  }catch(e){
    console.error(e);
    show("login",true);
    if($("loginMsg"))
      $("loginMsg").textContent="AuctionXI error: "+e.message;
  }
});

renderSettings();
