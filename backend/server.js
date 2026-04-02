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
  origin: ["https://ipl-2026-wx6e.onrender.com","http://localhost:8080/"]
}));
app.use(express.json());

/* ---------- Prediction DB ---------- */

app.post("/api/prediction", async (req, res) => {
  try {

    const email = req.body.email.trim().toLowerCase();
    const { matchNumber, selectedTeam, name, matchStartUtc, group } = req.body;
	console.log("Request body:", req.body);

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
	  
	const bid = member.amount;
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

/* ---------- Bids DB ---------- 
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
});*/
/* ---------- Bids DB with Email---------- */
app.get("/api/bids", async (req, res) => {
  try {
	const { email } = req.query;
	
	//const { data, error } = await supabase.rpc("get_bids_today");
	console.log(email);
	const { data, error } = await supabase.rpc('get_bids_today', {
		user_email: email
	});
	
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
  const { matchnumber, useremail } = req.query;
  
  //const { data, error } = await supabase.rpc("insert_unbid_predictions");
  console.log("matchNumber:", matchnumber);
  console.log("userEmail:", useremail);
  
  const { data, error } = await supabase.rpc("insert_unbid_predictions", {
    p_matchnumber: matchnumber,
	p_useremail: useremail
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

	const userMultipliers = {
	  "vinay.baskie@gmail.com": 5,
	  "kishorezum07@gmail.com": 5,
	  "sethusandhiya44@gmail.com": 2
	};
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
	  
      const groupPlayers = bids.filter(p => p.bgroup === group);
	  
	  let winnersCount = 0;
	  let losersCount = 0;

	  groupPlayers.forEach(p => {
		  const multiplier = userMultipliers[p.email?.toLowerCase()] || 1;
		  const isWinner = p.selectedvalue?.toLowerCase() === winnerTeam;

		  if (isWinner) {
			winnersCount += multiplier;
		  } else {
			losersCount += multiplier;
		  }

	  });
	  let matchWinAmount = 0;
	  const round2 = (num) => Math.round(num * 100) / 100;
	  if (winnersCount > 0) {
	    matchWinAmount = round2((losersCount * bidValue) / winnersCount);
	  }
	  
	  console.log("matchwinamount: ",matchWinAmount);
	  
	  const rows = groupPlayers.map(p => {

		  //const multiplier = fiveUsers.includes(p.email?.toLowerCase()) ? 5 : 1;
		  const multiplier = userMultipliers[p.email?.toLowerCase()] || 1;
		  //console.log("Email:", p.email, "Multiplier:", multiplier);
		  const isWinner = p.selectedvalue?.toLowerCase() === winnerTeam;

		  let winAmount = 0;

		  if (isWinner) {
			winAmount = matchWinAmount * multiplier;
		  } else {
			winAmount = -bidValue * multiplier;
		  }

		  return {
			email: p.email,
			selectedvalue: p.selectedvalue,
			bgroup: p.bgroup,
			winner: winnerTeam,
			winamount: winAmount,
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
		winamount: round2(prevTotal + matchWinAmount),
		matchwinamount: matchWinAmount
	  };
	});
	
	const { error: leaderboardError } = await supabase
	  .from("leaderboard")
	  .insert(leaderboardRows);

	if (leaderboardError) throw leaderboardError;
	  
    };

    await processGroup("G1");
    //await processGroup("G2");
	
    res.json({
      success: true,
      matchnumber
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- Last 5 Match Form (W/L dots) ---------- */

app.get("/api/leaderboard/form", async (req, res) => {
  try {
    const { data: matchRows, error: matchError } = await supabase
      .from("leaderboard")
      .select("matchnumber")
      .order("matchnumber", { ascending: false });

    if (matchError) {
      console.error(matchError);
      return res.status(500).json({ error: "Failed to fetch match numbers" });
    }

    const uniqueMatches = [...new Set(matchRows.map(r => r.matchnumber))]
      .sort((a, b) => b - a)
      .slice(0, 5);

    if (uniqueMatches.length === 0) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("leaderboard")
      .select("name, bgroup, matchnumber, matchwinamount")
      .in("matchnumber", uniqueMatches)
      .order("matchnumber", { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch form data" });
    }

    const formMap = {};
    data.forEach(row => {
      const key = `${row.name}_${row.bgroup}`;
      if (!formMap[key]) {
        formMap[key] = { name: row.name, group: row.bgroup, form: [] };
      }
      formMap[key].form.push({
        match: row.matchnumber,
        result: row.matchwinamount > 0 ? "W" : "L"
      });
    });

    res.json(Object.values(formMap));
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
