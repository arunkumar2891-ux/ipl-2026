import { supabase } from "../lib/supabase.js";

const USER_MULTIPLIERS = {
  "vinay.baskie@gmail.com": 5,
  "kishorezum07@gmail.com": 5,
  "sethusandhiya44@gmail.com": 2,
};

const round2 = (num) => Math.round(num * 100) / 100;

function getBidValue(matchNum) {
  if (matchNum > 70 && matchNum < 74) return 50;
  if (matchNum === 74) return 100;
  return 20;
}

async function processNoResultGroup(matchNum, group) {
  const { data: prevLeaderboard, error: prevError } = await supabase
    .from("leaderboard")
    .select("name, bgroup, winamount")
    .eq("matchnumber", matchNum - 1)
    .eq("bgroup", group);

  if (prevError) throw prevError;

  if (!prevLeaderboard || prevLeaderboard.length === 0) {
    console.log(`[calculateMatchResult] No previous leaderboard rows for group ${group}`);
    return;
  }

  const { error: delError } = await supabase
    .from("leaderboard")
    .delete()
    .eq("matchnumber", matchNum)
    .eq("bgroup", group);

  if (delError) {
    console.error("[calculateMatchResult] Delete error:", delError);
  }

  const leaderboardRows = prevLeaderboard.map((p) => ({
    name: p.name,
    bgroup: p.bgroup,
    matchnumber: matchNum,
    winamount: p.winamount || 0,
    matchwinamount: 0,
  }));

  const { error: insertError } = await supabase
    .from("leaderboard")
    .insert(leaderboardRows);

  if (insertError) throw insertError;

  console.log(
    `[calculateMatchResult] No Result leaderboard inserted for group ${group}: ${leaderboardRows.length} rows`
  );
}

async function processGroup(bids, winnerTeam, matchNum, bidValue, group) {
  console.log(`[calculateMatchResult] Processing group ${group}`);

  const groupPlayers = bids.filter((p) => p.bgroup === group);

  let winnersCount = 0;
  let losersCount = 0;

  groupPlayers.forEach((p) => {
    const multiplier = USER_MULTIPLIERS[p.email?.toLowerCase()] || 1;
    const isWinner = p.selectedvalue?.toLowerCase() === winnerTeam;
    if (isWinner) {
      winnersCount += multiplier;
    } else {
      losersCount += multiplier;
    }
  });

  let matchWinAmount = 0;
  if (winnersCount > 0) {
    matchWinAmount = round2((losersCount * bidValue) / winnersCount);
  }

  console.log(`[calculateMatchResult] matchWinAmount: ${matchWinAmount}`);

  const rows = groupPlayers.map((p) => {
    const multiplier = USER_MULTIPLIERS[p.email?.toLowerCase()] || 1;
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
      matchnumber: p.matchnumber,
    };
  });

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
  prevLeaderboard?.forEach((p) => {
    prevMap[p.name + "_" + p.bgroup] = p.winamount || 0;
  });

  const leaderboardRows = rows.map((r) => {
    const prevTotal = prevMap[r.name + "_" + r.bgroup] || 0;
    const mwa = r.winamount;
    console.log(`[calculateMatchResult] ${r.name} — Win: ${mwa}, Prev: ${prevTotal}`);
    return {
      name: r.name,
      bgroup: r.bgroup,
      matchnumber: matchNum,
      winamount: round2(prevTotal + mwa),
      matchwinamount: mwa,
    };
  });

  console.log(
    `[calculateMatchResult] Inserting ${leaderboardRows.length} leaderboard rows for group ${group}`
  );

  const { error: leaderboardError } = await supabase
    .from("leaderboard")
    .insert(leaderboardRows);

  if (leaderboardError) {
    console.error(
      `[calculateMatchResult] Leaderboard insert failed for group ${group}:`,
      leaderboardError
    );
    throw leaderboardError;
  }

  console.log(
    `[calculateMatchResult] Leaderboard insert succeeded for group ${group}`
  );
}

/**
 * Core match-result calculation logic.
 * Called directly by the result checker job and by the admin API endpoint.
 *
 * @param {number|string} matchnumber
 * @param {string} winner - team shortname or "No Result"
 * @returns {{ success: boolean, matchnumber: number, noResult?: boolean, message?: string, error?: string }}
 */
export async function calculateMatchResult(matchnumber, winner) {
  const matchNum = parseInt(matchnumber, 10);

  console.log(
    `[calculateMatchResult] Starting — match: ${matchNum}, winner: ${winner}`
  );

  if (isNaN(matchNum)) {
    return { success: false, error: "matchnumber must be a number" };
  }

  if (!winner) {
    return { success: false, error: "Winner is required" };
  }

  if (winner === "No Result") {
    console.log(`[calculateMatchResult] No Result for match ${matchNum}`);

    await processNoResultGroup(matchNum, "G1");

    const { error: rpError } = await supabase
      .from("fixtures")
      .update({ resultprocessed: "Y" })
      .eq("matchnumber", matchNum);

    if (rpError) {
      console.error("[calculateMatchResult] Failed to mark resultprocessed:", rpError);
    }

    return { success: true, matchnumber: matchNum, noResult: true };
  }

  const shortName = winner.toString().toUpperCase();
  console.log(`[calculateMatchResult] Winner shortname: ${shortName}`);

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("fullname")
    .eq("shortname", shortName)
    .maybeSingle();

  if (teamError || !team) {
    return { success: false, error: "Invalid team shortname" };
  }

  const winnerTeam = team.fullname.trim().toLowerCase();

  const { data: bids, error: bidError } = await supabase
    .from("final_prediction")
    .select("email, matchnumber, selectedvalue, bgroup, bid, name")
    .eq("matchnumber", matchNum);

  if (bidError) throw bidError;

  if (!bids || bids.length === 0) {
    return { success: true, matchnumber: matchNum, message: "No bids found" };
  }

  const bidValue = getBidValue(matchNum);

  await processGroup(bids, winnerTeam, matchNum, bidValue, "G1");

  const { error: rpError } = await supabase
    .from("fixtures")
    .update({ resultprocessed: "Y" })
    .eq("matchnumber", matchNum);

  if (rpError) {
    console.error("[calculateMatchResult] Failed to mark resultprocessed:", rpError);
  }

  console.log(
    `[calculateMatchResult] Completed successfully for match ${matchNum}`
  );

  return { success: true, matchnumber: matchNum };
}
