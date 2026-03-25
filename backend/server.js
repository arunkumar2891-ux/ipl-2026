process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import { supabase } from "./src/lib/supabase.js";
import { getMemberDetails } from "./src/utils/memberUtils.js";

const PORT = process.env.PORT || 3001;

const app = express();
//app.use(cors());
app.use(cors({
  origin: ["https://ipl-2026-wx6e.onrender.com"]
}));
app.use(express.json());

/*const SNAP_BASE = "https://prod-paloaltonetworks-dev-cloud-fm.snaplogic.io/api/1/rest/feed-master/queue/PaloAltoNetworks-Dev/projects/Arunkumar%20J%20S";

async function callSnap(url, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "*//*"
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error("API failed");
  }

  return response.json();
}*/

/* ---------- Prediction DB ---------- */

app.post("/api/prediction", async (req, res) => {
  try {

    const email = req.body.email.trim().toLowerCase();
    const { matchNumber, selectedTeam, name, matchStartUtc, group } = req.body;
	console.log("Request body:", req.body);
	const tripleUsers = [
	  "vinay.baskie@gmail.com",
	  "kishorezum07@gmail.com"
	];
    if (!matchStartUtc) {
      return res.status(400).json({ error: "Match start time missing" });
    }

    // 15 minute cutoff validation
    const startTime = new Date(matchStartUtc);
    const cutoff = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (new Date() > cutoff) {
      return res.status(403).json({
        error: "Predictions closed 15 minutes before match start"
      });
    }
	console.log("selectedWinner", selectedTeam);
    // 1️.Fetch member from Supabase
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("name, bgroup, amount")
      .eq("email", email)
	  .limit(1)
      .maybeSingle();
	console.log("Member query result:", member);
	console.log("Member query error:", memberError);
    if (memberError || !member) {
      return res.status(400).json({ error: "Member not found" });
    }

    // 2️.Calculate bid
    const bid = tripleUsers.includes(email)
      ? member.amount * 3
      : member.amount;
	
    // 3️.Insert prediction
    const { error: insertError } = await supabase
      .from("prediction")
      .insert([
        {
          email,
          matchnumber: matchNumber,
          selectedvalue: selectedTeam,
		  bgroup: group,
          bid: bid,
		  name: name
        }
      ]);

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: "Prediction insert failed" });
    }

    res.json({
      success: true,
      response: `Thank you ${name}, for Bidding on ${selectedTeam}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ---------- Prediction Only SL---------- */
/*app.post("/api/prediction", async (req, res) => {
  try {
    const url = `${SNAP_BASE}/GetDataTask?bearer_token=${encodeURIComponent(process.env.SNAP_PREDICTION_TOKEN)}`;
    const data = await callSnap(url, "POST", req.body);
    res.json(data.response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/

/* ---------- Prediction SL and DB ---------- */
/*app.post("/api/prediction", async (req, res) => {
  try {

    const { email, matchNumber, selectedValue, matchStartUtc } = req.body;
	const { bgroup, bid } = getMemberDetails(email);
	const tripleUsers = [
	  "vinay.baskie@gmail.com",
	  "kishorezum07@gmail.com"
	];
    if (!matchStartUtc) {
      return res.status(400).json({ error: "Match start time missing" });
    }

    const startTime = new Date(matchStartUtc);
    const cutoff = new Date(startTime.getTime() - (15 * 60 * 1000));
    const now = new Date();

    if (now > cutoff) {
      return res.status(403).json({
        error: "Predictions closed 15 minutes before match start"
      });
    }
	
	// 1️. Insert prediction into Supabase
    const { error } = await supabase
      .from("predictions")
      .insert([
        {
          email: email.toLowerCase(),
          matchnumber: matchNumber,
          selectedvalue: selectedWinner,
          bgroup: bgroup,
          bid: bid
        }
      ]);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "DB insert failed" });
    }
	
	// 2️. Existing SnapLogic call (unchanged)
    const url = `${SNAP_BASE}/GetDataTask?bearer_token=${encodeURIComponent(process.env.SNAP_PREDICTION_TOKEN)}`;

    const data = await callSnap(url, "POST", req.body);

    res.json(data.response);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/

/* ---------- Leaderboard SL---------- */
/*
app.get("/api/leaderboard", async (req, res) => {
  try {
    const url = `${SNAP_BASE}/LeaderBoardAPITask?bearer_token=${encodeURIComponent(process.env.SNAP_LEADER_TOKEN)}`;
    const data = await callSnap(url);
    res.json(data.response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/



/* ---------- Leaderboard DB ---------- */

app.get("/api/leaderboard", async (req, res) => {
  try {

    // 1️. Get latest matchnumber
    const { data: latestMatch, error: matchError } = await supabase
      .from("leaderboard")
      .select("matchnumber")
      .order("matchnumber", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchError) {
      console.error(matchError);
      return res.status(500).json({ error: "Failed to fetch latest match" });
    }

    const latestMatchNumber = latestMatch?.matchnumber ?? 0;

    // 2️. Get leaderboard rows for that match
    const { data, error } = await supabase
      .from("leaderboard")
      .select("name, winamount, bgroup, matchnumber, matchwinamount")
      .eq("matchnumber", latestMatchNumber)
      .order("bgroup", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }

    // 3️. Transform response to frontend format
    const response = data.map(row => ({
      Name: row.name,
      Amount: row.winamount ?? 0,
      Group: row.bgroup,
      matchNumber: row.matchnumber ?? 0,
      matchWinAmount: row.matchwinamount ?? 0
    }));

    res.json(response);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Bids SL ---------- */

/*app.get("/api/bids", async (req, res) => {
  try {
    const url = `${SNAP_BASE}/Bid_APITask?bearer_token=${encodeURIComponent(process.env.SNAP_BID_TOKEN)}`;
    const data = await callSnap(url);
    res.json(data.response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/

/* ---------- Bids DB ---------- */
app.get("/api/bids", async (req, res) => {
  try {

    const { data, error } = await supabase.rpc("get_bids_today");

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch bids" });
    }

    const response = data.map(row => ({
      Name: row.name,
      selectedValue: row.selectedvalue,
      bid: row.bid,
      group: row.bgroup,
      matchNumber: row.matchnumber
	  
    }));

    res.json(response);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ---------- OTP SL ---------- */

/*app.post("/api/otp", async (req, res) => {
  try {
    const url = `${SNAP_BASE}/manageOTPUltra?bearer_token=${encodeURIComponent(process.env.SNAP_OTP_TOKEN)}`;
    const data = await callSnap(url, "POST", req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/

/* ---------- OTP DB ---------- */
app.post("/api/otp", async (req, res) => {
  try {

    const { email, otp, flow } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP required" });
    }
	console.log("email: ",email);
    const normalizedEmail = email.trim().toLowerCase();
	const otpNumber = Number(otp);
    console.log("normalizedEmail: ",normalizedEmail);
	console.log("otp:",otpNumber);
    // Query OTP table
    const { data, error } = await supabase
	  .from("otp")
	  .select("id")
	  .eq("email", normalizedEmail)
	  .eq("otp", otp)
	  .maybeSingle();
	console.log("OTP query result:", data);
	console.log("OTP query error:", error);
    if (error) {
	  console.error("OTP query error:", error);
	  return res.status(500).json({ error: "OTP query failed" });
	}

	if (!data) {
	  return res.status(401).json({ error: "Invalid OTP" });
	}
	
	return res.json({
	  success: true,
	  message: "OTP validated"
	});
	

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- GENERATE UNBIDS DB ---------- */
app.get("/api/generateunbids", async (req, res) => {
  const { matchnumber } = req.query;
  
  //const { data, error } = await supabase.rpc("insert_unbid_predictions");
  
  const { data, error } = await supabase.rpc("insert_unbid_predictions", {
    p_matchnumber: matchnumber
  });

  if (error) {
    return res.status(500).json(error);
  }

  res.json({ message: "Unbid predictions inserted" });
});


/* ---------- GENERATE MATCHDATA DB ---------- */

app.get("/api/calculateMatchResult", async (req, res) => {
  try {
	const { winner, matchnumber } = req.query;
	
	const shortName = winner?.toString().toUpperCase();
	const matchNum = parseInt(matchnumber, 10);

	if (isNaN(matchNum)) {
	  return res.status(400).json({
		error: "matchnumber must be a number"
	  });
	}
	console.log("shortName: ",shortName);
	
	if (!winner) {
      return res.status(400).json({ error: "Winner query param required" });
    }
	
	const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("fullname")
      .eq("shortname", shortName)
      .maybeSingle();

    console.log("team error: ",teamError);
	console.log("team: ",team);
	
    if (teamError || !team) {
      return res.status(400).json({ error: "Invalid team shortname" });
    }

    const winnerFullName = team.fullname;
	
	console.log("winnerFullName: ", winnerFullName);

	const winnerTeam = winnerFullName.trim().toLowerCase();
	
    //const { data: bids, error } = await supabase.rpc("get_bids_today");
	const { data: bids, error: bidError } = await supabase
      .from("final_prediction")
      .select("email, matchnumber, selectedvalue, bgroup, bid, name")
      .eq("matchnumber", matchNum);

    if (bidError) throw bidError;

    if (!bids || bids.length === 0) {
      return res.json({ message: "No bids found" });
    }
	
    let bidValue = 20;

    if (matchNum > 70 && matchNum < 74) bidValue = 50;
    if (matchNum === 74) bidValue = 100;

    const processGroup = async (group) => {
	  
	  console.log("running for ",group);
	  //console.log("bids: ", bids);
	  
      const groupPlayers = bids.filter(p => p.bgroup === group);

      const winners = groupPlayers.filter(p => p.selectedvalue?.toLowerCase() === winnerTeam);
      const losers = groupPlayers.filter(p => p.selectedvalue?.toLowerCase() !== winnerTeam);

      const winnerCount = winners.length;
      const loserCount = losers.length;
	  
	  let matchWinAmount = 0;
	  
	  if (winnerCount > 0){
		matchWinAmount = (loserCount * bidValue) / winnerCount;
	  }
	  
	  const rows = groupPlayers.map(p => {
		  const isWinner =
			p.selectedvalue?.toLowerCase() === winnerTeam;

		  return {
			email: p.email,
			selectedvalue: p.selectedvalue,
			bgroup: p.bgroup,
			winner: winnerTeam,
			winamount: isWinner ? matchWinAmount : -bidValue,
			name: p.name,
			matchnumber: p.matchnumber
		  };
	  });
	  
	  const { data, error } = await supabase
		  .from("matchdata")
		  .delete()
		  .eq("matchnumber", matchNum);

		if (error) {
		  console.error("Delete error:", error);
		} else {
		  console.log("Rows deleted:", data);
	  }
	  
	  
      const { error: insertError } = await supabase
        .from("matchdata")
		.insert(rows);

      if (insertError) throw insertError;
	  
	  const { data: prevLeaderboard, error: prevError } = await supabase
	  .from("leaderboard")
	  .select("name, bgroup, winamount")
	  .eq("matchnumber", matchNum - 1)
	  .eq("bgroup", group);

	if (prevError) throw prevError;
	
	const prevMap = {};
	prevLeaderboard?.forEach(p => {
	  prevMap[p.name + "_" + p.bgroup] = p.winamount || 0;
	});
	
	const leaderboardRows = rows.map(r => {

	const prevTotal = prevMap[r.name + "_" + r.bgroup] || 0;

	const matchWinAmount = r.winamount;
	
	console.log("Name:",r.name);
	console.log("Win Amount", matchWinAmount);
	
	  return {
		name: r.name,
		bgroup: r.bgroup,
		matchnumber: matchNum,
		winamount: prevTotal + matchWinAmount,
		matchwinamount: matchWinAmount
	  };
	});
	
	const { error: leaderboardError } = await supabase
	  .from("leaderboard")
	  .insert(leaderboardRows);

	if (leaderboardError) throw leaderboardError;
	  
    };

    await processGroup("G1");
    await processGroup("G2");
	
    res.json({
      success: true,
      matchnumber
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- Health check (for keeping Render awake) ---------- */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ---------- Admin todayMatches ---------- */

app.get("/api/admin/todayMatches", async (req, res) => {
	try{
	const { data, error } = await supabase.rpc("get_todaymatches");

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch bids" });
    }

    const response = data.map(row => ({
      matchnumber: row.matchnumber,
      home: row.home,
      away: row.away
    }));

    res.json(response);
	} catch (err){
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
	
});

/* ---------- Admin Validation ---------- */

app.get("/api/admin/checkAdmin", async (req, res) => {

  try {

    const { email } = req.query;
	
	console.log("admin email", email);
	
    if (!email) {
      return res.status(400).json({
        error: "Email is required"
      });
    }

    const { data, error } = await supabase
      .from("admins")
      .select("id")
      .eq("email", email)
      .limit(1);
	
	console.log("admin data: ", data);
	
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "DB error" });
    }

    const isAdmin = data.length > 0;

    res.json({
      isAdmin
    });

  } catch (err) {

    console.error("Admin check failed:", err);

    res.status(500).json({
      error: "Internal server error"
    });

  }

});
/* ---------- Start server ---------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
