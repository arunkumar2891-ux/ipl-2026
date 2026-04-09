//process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { supabase } from "./src/lib/supabase.js";
import { getMemberDetails } from "./src/utils/memberUtils.js";
import { startMatchChecker } from "./src/jobs/matchChecker.js";

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-to-a-real-secret";

const app = express();

app.use(cors({
  origin: ["https://ipl-2026-wx6e.onrender.com", "http://localhost:8080"],
}));
app.use(express.json({ limit: "10kb" }));

/* ---------- Rate Limiters ---------- */

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP attempts, please try again after 15 minutes" },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use("/api/", generalLimiter);

/* ---------- Auth Middleware ---------- */

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

async function requireAdmin(req, res, next) {
  const email = req.user?.email;
  if (!email) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/* ---------- Prediction DB ---------- */

app.post("/api/prediction", authenticateToken, async (req, res) => {
  try {

    const email = req.user.email;
    const { matchNumber, selectedTeam, name, group } = req.body;

    if (!matchNumber) {
      return res.status(400).json({ error: "Match number missing" });
    }

    // Fetch match start time from fixtures DB (single source of truth)
    const { data: fixture, error: fixtureError } = await supabase
      .from("fixtures")
      .select("dateutc")
      .eq("matchnumber", matchNumber)
      .maybeSingle();

    if (fixtureError || !fixture) {
      return res.status(400).json({ error: "Match not found in fixtures" });
    }

    const startTime = new Date(fixture.dateutc);
    const cutoff = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (new Date() > cutoff) {
      return res.status(403).json({
        error: "Predictions closed 15 minutes before match start"
      });
    }
	console.log("selectedWinner", selectedTeam);
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("name, bgroup, amount")
      .eq("email", email)
	  .limit(1)
      .maybeSingle();
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
    console.error("Prediction endpoint error:", err);
    res.status(500).json({ error: "Internal server error" });
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
    console.error("Leaderboard endpoint error:", err);
    res.status(500).json({ error: "Internal server error" });
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
	const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
	if (!email) {
	  return res.status(400).json({ error: "email query parameter required" });
	}

	const { data, error } = await supabase.rpc("get_bids_today", {
		user_email: email,
	});
    if (error) {
      console.error("get_bids_today RPC error:", error.message, error.details, error.hint);
      return res.status(500).json({ error: "Failed to fetch bids" });
    }

    const rows = Array.isArray(data) ? data : [];
    const response = rows.map((row) => ({
      Name: row.name,
      selectedValue: row.selectedvalue,
      bid: row.bid,
      group: row.bgroup,
      matchNumber: row.matchnumber,
    }));

    res.json(response);

  } catch (err) {
    console.error("Bids endpoint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------- OTP DB ---------- */
app.post("/api/otp", otpLimiter, async (req, res) => {
  try {

    const { email, otp, flow } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
	const otpNumber = Number(otp);
    const { data, error } = await supabase
	  .from("otp")
	  .select("id")
	  .eq("email", normalizedEmail)
	  .eq("otp", otp)
	  .maybeSingle();

    if (error) {
	  console.error("OTP query error:", error);
	  return res.status(500).json({ error: "OTP query failed" });
	}

	if (!data) {
	  return res.status(401).json({ error: "Invalid OTP" });
	}

	const token = jwt.sign(
	  { email: normalizedEmail },
	  JWT_SECRET,
	  { expiresIn: "15m" }
	);
	
	return res.json({
	  success: true,
	  message: "OTP validated",
	  token
	});
	

  } catch (err) {
    console.error("OTP endpoint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------- GENERATE UNBIDS DB ---------- */
app.post("/api/generateunbids", authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  const { matchnumber } = req.body;
  const useremail = req.user.email;
  
  if (!matchnumber) {
    return res.status(400).json({ error: "matchnumber is required" });
  }

  const { data, error } = await supabase.rpc("insert_unbid_predictions", {
    p_matchnumber: matchnumber,
	p_useremail: useremail
  });

  if (error) {
    console.error("generateunbids error:", error);
    return res.status(500).json({ error: "Failed to generate unbids" });
  }

  res.json({ message: "Unbid predictions inserted" });
});


/* ---------- GENERATE MATCHDATA DB ---------- */

app.post("/api/calculateMatchResult", authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  try {
	const { winner, matchnumber } = req.body;

	const userMultipliers = {
	  "vinay.baskie@gmail.com": 5,
	  "kishorezum07@gmail.com": 5,
	  "sethusandhiya44@gmail.com": 2
	};
	const matchNum = parseInt(matchnumber, 10);

	if (isNaN(matchNum)) {
	  return res.status(400).json({
		error: "matchnumber must be a number"
	  });
	}

	if (!winner) {
      return res.status(400).json({ error: "Winner query param required" });
    }

	//No Result Logic
	if (winner === "No Result") {
	  console.log("No Result for match:", matchNum);

	  const processNoResultGroup = async (group) => {
		const { data: prevLeaderboard, error: prevError } = await supabase
		  .from("leaderboard")
		  .select("name, bgroup, winamount")
		  .eq("matchnumber", matchNum - 1)
		  .eq("bgroup", group);

		if (prevError) throw prevError;

		if (!prevLeaderboard || prevLeaderboard.length === 0) {
		  console.log(`No previous leaderboard rows for group ${group}`);
		  return;
		}

		const { error: delError } = await supabase
		  .from("leaderboard")
		  .delete()
		  .eq("matchnumber", matchNum)
		  .eq("bgroup", group);

		if (delError) {
		  console.error("Delete error:", delError);
		}

		const leaderboardRows = prevLeaderboard.map(p => ({
		  name: p.name,
		  bgroup: p.bgroup,
		  matchnumber: matchNum,
		  winamount: p.winamount || 0,
		  matchwinamount: 0
		}));

		const { error: insertError } = await supabase
		  .from("leaderboard")
		  .insert(leaderboardRows);

		if (insertError) throw insertError;

		console.log(`No Result leaderboard inserted for group ${group}:`, leaderboardRows.length, "rows");
	  };

	  await processNoResultGroup("G1");

	  return res.json({
		success: true,
		matchnumber,
		noResult: true
	  });
	}

	const shortName = winner?.toString().toUpperCase();
	
	const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("fullname")
      .eq("shortname", shortName)
      .maybeSingle();

    if (teamError || !team) {
      return res.status(400).json({ error: "Invalid team shortname" });
    }

    const winnerFullName = team.fullname;

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
      //No Result Logic
      const amt = row.matchwinamount ?? 0;
      formMap[key].form.push({
        match: row.matchnumber,
        result: amt > 0 ? "W" : amt === 0 ? "NR" : "L"
      });
    });

    res.json(Object.values(formMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- Fixtures (single source of truth for match schedule) ---------- */

app.get("/api/fixtures/today", async (req, res) => {
  try {
    const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00Z";
    const tomorrowStart = new Date(new Date(todayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

    console.log("fixtures/today range:", todayStart, "to", tomorrowStart);

    const { data, error } = await supabase
      .from("fixtures")
      .select("matchnumber, dateutc, home, away, location")
      .gte("dateutc", todayStart)
      .lt("dateutc", tomorrowStart)
      .order("dateutc", { ascending: true });

    if (error) {
      console.error("fixtures/today error:", error);
      return res.status(500).json({ error: "Failed to fetch today's fixtures" });
    }

    console.log("fixtures/today rows:", data?.length);

    const response = (data || []).map(row => ({
      MatchNumber: row.matchnumber,
      DateUtc: row.dateutc,
      HomeTeam: row.home,
      AwayTeam: row.away,
      Location: row.location
    }));

    res.json(response);
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

app.get("/api/admin/todayMatches", authenticateToken, requireAdmin, async (req, res) => {
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

app.get("/api/admin/checkAdmin", authenticateToken, async (req, res) => {

  try {

    const email = req.user.email;

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
	
    if (error) {
      console.error("Admin check DB error:", error);
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
  startMatchChecker();
});
