import cron from "node-cron";
import { supabase } from "../lib/supabase.js";

const CRIC_API_KEY = process.env.CRIC_API_KEY;
const CRIC_API_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${CRIC_API_KEY}&offset=0`;

const CHECK_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const POSTPONE_OFFSET_MS = 25 * 60 * 1000;
const RESULT_RETRY_MS = 30 * 60 * 1000;

/* ================================================================
   PART 1 — Match-start detection (existing logic)
   ================================================================ */

async function fetchTodayFixtures() {
  const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00Z";
  const tomorrowStart = new Date(
    new Date(todayStart).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("fixtures")
    .select("id, matchnumber, dateutc, home, away")
    .gte("dateutc", todayStart)
    .lt("dateutc", tomorrowStart)
    .eq("matchstarted", "N")
    .order("dateutc", { ascending: true });

  if (error) {
    console.error("[MatchChecker] Failed to fetch fixtures:", error);
    return [];
  }
  return data || [];
}

async function fetchCurrentMatches() {
  try {
    const res = await fetch(CRIC_API_URL);
    if (!res.ok) {
      console.error("[MatchChecker] CricAPI HTTP error:", res.status);
      return null;
    }
    const json = await res.json();
    if (json.status !== "success") {
      console.error("[MatchChecker] CricAPI returned status:", json.status);
      return null;
    }
    return json.data || [];
  } catch (err) {
    console.error("[MatchChecker] CricAPI fetch error:", err.message);
    return null;
  }
}

function isMatchInApiResponse(apiMatches, homeTeam, awayTeam) {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  return apiMatches.some((m) => {
    const name = (m.name || "").toLowerCase();
    return name.includes(homeLower) && name.includes(awayLower);
  });
}

function isInCheckWindow(fixture) {
  const now = Date.now();
  const matchStart = new Date(fixture.dateutc).getTime();
  return now >= matchStart - CHECK_WINDOW_BEFORE_MS;
}

async function markMatchStarted(fixtureId, matchnumber) {
  const { error } = await supabase
    .from("fixtures")
    .update({ matchstarted: "Y" })
    .eq("id", fixtureId);

  if (error) {
    console.error(
      `[MatchChecker] Failed to mark match ${matchnumber} as started:`,
      error
    );
    return;
  }

  await generateUnbids(matchnumber);
}

async function generateUnbids(matchnumber) {
  const useremail = "automated@process.com";
  console.log(
    `[MatchChecker] Generating unbids for match ${matchnumber} (useremail: ${useremail})`
  );

  const { data, error } = await supabase.rpc("insert_unbid_predictions", {
    p_matchnumber: matchnumber,
    p_useremail: useremail,
  });

  if (error) {
    console.error(
      `[MatchChecker] Failed to generate unbids for match ${matchnumber}:`,
      error
    );
  } else {
    console.log(
      `[MatchChecker] Unbids generated successfully for match ${matchnumber}`
    );
  }
}

async function updateFixtureTime(fixtureId, matchnumber, currentDateutc) {
  const newTime = new Date(Date.now() + POSTPONE_OFFSET_MS);
  newTime.setSeconds(0, 0);

  const currentTime = new Date(currentDateutc);
  if (newTime <= currentTime) {
    console.log(
      `[MatchChecker] Match ${matchnumber} dateutc (${currentDateutc}) already ahead of now+25min. Skipping.`
    );
    return;
  }

  const newTimeISO = newTime.toISOString();

  const { error } = await supabase
    .from("fixtures")
    .update({ dateutc: newTimeISO })
    .eq("id", fixtureId);

  if (error) {
    console.error(
      `[MatchChecker] Failed to update dateutc for match ${matchnumber}:`,
      error
    );
  } else {
    console.log(
      `[MatchChecker] Match ${matchnumber} NOT found in API. dateutc pushed to ${newTimeISO}`
    );
  }
}

async function checkMatches() {
  console.log(`[MatchChecker] Running check at ${new Date().toISOString()}`);

  const fixtures = await fetchTodayFixtures();
  if (fixtures.length === 0) {
    console.log("[MatchChecker] No unstarted fixtures today, skipping.");
    return;
  }

  const fixturesToCheck = fixtures.filter(isInCheckWindow);

  if (fixturesToCheck.length === 0) {
    console.log("[MatchChecker] No fixtures in check window right now.");
    return;
  }

  console.log(
    `[MatchChecker] Checking ${fixturesToCheck.length} fixture(s):`,
    fixturesToCheck.map((f) => `#${f.matchnumber} ${f.home} vs ${f.away}`)
  );

  const apiMatches = await fetchCurrentMatches();
  if (apiMatches === null) {
    console.error("[MatchChecker] Could not fetch API data, will retry next cycle.");
    return;
  }

  for (const fixture of fixturesToCheck) {
    const found = isMatchInApiResponse(apiMatches, fixture.home, fixture.away);
    if (found) {
      await markMatchStarted(fixture.id, fixture.matchnumber);
      console.log(
        `[MatchChecker] Match #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) FOUND in API — marked as started.`
      );
    } else {
      await updateFixtureTime(fixture.id, fixture.matchnumber, fixture.dateutc);
    }
  }
}

/* ================================================================
   PART 2 — Match-result detection (new logic)
   For double-header days: starts at 13:30 UTC (7:00 PM IST)
   For single-match days:  starts at 18:00 UTC (11:30 PM IST)
   ================================================================ */

async function getTodayStartedCount() {
  const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00Z";
  const tomorrowStart = new Date(
    new Date(todayStart).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const { count, error } = await supabase
    .from("fixtures")
    .select("id", { count: "exact", head: true })
    .gte("dateutc", todayStart)
    .lt("dateutc", tomorrowStart)
    .eq("matchstarted", "Y");

  if (error) {
    console.error("[ResultChecker] Failed to count started fixtures:", error);
    return 0;
  }
  return count || 0;
}

async function fetchStartedTodayFixtures() {
  const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00Z";
  const tomorrowStart = new Date(
    new Date(todayStart).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("fixtures")
    .select("id, matchnumber, dateutc, home, away, resultprocessed")
    .gte("dateutc", todayStart)
    .lt("dateutc", tomorrowStart)
    .eq("matchstarted", "Y")
    .order("dateutc", { ascending: true });

  if (error) {
    console.error("[ResultChecker] Failed to fetch started fixtures:", error);
    return [];
  }
  return (data || []).filter((f) => f.resultprocessed !== "Y");
}

async function loadTeamsMap() {
  const { data, error } = await supabase
    .from("teams")
    .select("fullname, shortname");

  if (error) {
    console.error("[ResultChecker] Failed to load teams:", error);
    return null;
  }

  const map = {};
  (data || []).forEach((t) => {
    map[t.fullname.toLowerCase()] = t.shortname;
  });
  return map;
}

function findApiMatch(apiMatches, homeTeam, awayTeam) {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  return apiMatches.find((m) => {
    const name = (m.name || "").toLowerCase();
    return name.includes(homeLower) && name.includes(awayLower);
  });
}

function parseWinnerFromStatus(status, homeTeam, awayTeam, teamsMap) {
  if (!status) return null;

  const noResultPattern = /no result/i;
  if (noResultPattern.test(status)) {
    return { winner: "No Result", resolved: true };
  }

  const wonByPattern = /^(.+?)\s+won\s+by\s+/i;
  const match = status.match(wonByPattern);
  if (!match) return null;

  const winningTeamFull = match[1].trim();
  const winnerLower = winningTeamFull.toLowerCase();

  const shortname = teamsMap[winnerLower];
  if (shortname) {
    return { winner: shortname, resolved: true };
  }

  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  if (winnerLower.includes(homeLower) || homeLower.includes(winnerLower)) {
    const homeShort = teamsMap[homeLower];
    if (homeShort) return { winner: homeShort, resolved: true };
  }
  if (winnerLower.includes(awayLower) || awayLower.includes(winnerLower)) {
    const awayShort = teamsMap[awayLower];
    if (awayShort) return { winner: awayShort, resolved: true };
  }

  console.warn(
    `[ResultChecker] Could not map winner "${winningTeamFull}" to a shortname`
  );
  return null;
}

async function callCalculateMatchResult(matchnumber, winner) {
  const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
  const ADMIN_EMAIL = process.env.AUTO_ADMIN_EMAIL || "automated@process.com";
  const JWT_SECRET = process.env.JWT_SECRET || "change-this-to-a-real-secret";

  const { default: jwt } = await import("jsonwebtoken");
  const token = jwt.sign({ email: ADMIN_EMAIL }, JWT_SECRET, {
    expiresIn: "5m",
  });

  console.log(
    `[ResultChecker] Calling calculateMatchResult — match: ${matchnumber}, winner: ${winner}`
  );

  const res = await fetch(`${BASE_URL}/api/calculateMatchResult`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ matchnumber, winner }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error(
      `[ResultChecker] calculateMatchResult failed (${res.status}):`,
      body
    );
    return false;
  }

  console.log(
    `[ResultChecker] calculateMatchResult succeeded for match ${matchnumber}:`,
    body
  );
  return true;
}

async function markResultProcessed(fixtureId, matchnumber) {
  const { error } = await supabase
    .from("fixtures")
    .update({ resultprocessed: "Y" })
    .eq("id", fixtureId);

  if (error) {
    console.error(
      `[ResultChecker] Failed to mark match ${matchnumber} resultprocessed:`,
      error
    );
  }
}

async function isLeaderboardPopulated(matchnumber) {
  const { count, error } = await supabase
    .from("leaderboard")
    .select("id", { count: "exact", head: true })
    .eq("matchnumber", matchnumber);

  if (error) {
    console.error(
      `[ResultChecker] Leaderboard check failed for match ${matchnumber}:`,
      error
    );
    return false;
  }
  return count > 0;
}

let resultRetryTimer = null;

async function checkMatchResults() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();

  const totalStarted = await getTodayStartedCount();
  if (totalStarted === 0) {
    console.log("[ResultChecker] No started fixtures today, skipping.");
    return;
  }

  const isDoubleHeader = totalStarted >= 2;
  const gateHour = isDoubleHeader ? 13 : 18;
  const gateMin = isDoubleHeader ? 30 : 0;

  if (
    utcHour < gateHour ||
    (utcHour === gateHour && utcMin < gateMin)
  ) {
    console.log(
      `[ResultChecker] Too early for ${isDoubleHeader ? "double" : "single"} match day ` +
      `(${utcHour}:${String(utcMin).padStart(2, "0")} UTC). ` +
      `Gate: ${gateHour}:${String(gateMin).padStart(2, "0")} UTC.`
    );
    return;
  }

  console.log(
    `[ResultChecker] Running result check at ${now.toISOString()}`
  );

  const fixtures = await fetchStartedTodayFixtures();
  if (fixtures.length === 0) {
    console.log("[ResultChecker] No started (unprocessed) fixtures today.");
    if (resultRetryTimer) {
      clearTimeout(resultRetryTimer);
      resultRetryTimer = null;
    }
    return;
  }

  const apiMatches = await fetchCurrentMatches();
  if (apiMatches === null) {
    console.error(
      "[ResultChecker] Could not fetch API data, will retry in 30 min."
    );
    scheduleResultRetry();
    return;
  }

  const teamsMap = await loadTeamsMap();
  if (!teamsMap) {
    console.error("[ResultChecker] Could not load teams map, will retry.");
    scheduleResultRetry();
    return;
  }

  let pendingResults = false;

  for (const fixture of fixtures) {
    const alreadyProcessed = await isLeaderboardPopulated(fixture.matchnumber);
    if (alreadyProcessed) {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} already has leaderboard entries (admin processed). Marking done.`
      );
      await markResultProcessed(fixture.id, fixture.matchnumber);
      continue;
    }

    const apiMatch = findApiMatch(apiMatches, fixture.home, fixture.away);

    if (!apiMatch) {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) not found in API response.`
      );
      pendingResults = true;
      continue;
    }

    const result = parseWinnerFromStatus(
      apiMatch.status,
      fixture.home,
      fixture.away,
      teamsMap
    );

    if (!result) {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} status not final yet: "${apiMatch.status}". Will retry.`
      );
      pendingResults = true;
      continue;
    }

    const success = await callCalculateMatchResult(
      fixture.matchnumber,
      result.winner
    );

    if (success) {
      await markResultProcessed(fixture.id, fixture.matchnumber);
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} result processed — winner: ${result.winner}`
      );
    } else {
      pendingResults = true;
    }
  }

  if (pendingResults) {
    scheduleResultRetry();
  } else if (resultRetryTimer) {
    clearTimeout(resultRetryTimer);
    resultRetryTimer = null;
    console.log("[ResultChecker] All results processed. No more retries.");
  }
}

function scheduleResultRetry() {
  if (resultRetryTimer) return;
  console.log("[ResultChecker] Scheduling retry in 30 minutes.");
  resultRetryTimer = setTimeout(() => {
    resultRetryTimer = null;
    checkMatchResults().catch((err) =>
      console.error("[ResultChecker] Retry error:", err)
    );
  }, RESULT_RETRY_MS);
}

/* ================================================================
   SCHEDULER
   ================================================================ */

export function startMatchChecker() {
  cron.schedule("*/10 10-23 * * *", () => {
    checkMatches().catch((err) =>
      console.error("[MatchChecker] Unhandled error:", err)
    );
  });

  cron.schedule("*/30 13-23 * * *", () => {
    checkMatchResults().catch((err) =>
      console.error("[ResultChecker] Unhandled error:", err)
    );
  });

  console.log("[MatchChecker] Scheduled — match-start checks every 10 minutes.");
  console.log(
    "[ResultChecker] Scheduled — result checks every 30 min between 13:30–23:59 UTC (dynamic gate: double-header 7 PM IST, single 11:30 PM IST)."
  );
}
