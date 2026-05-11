import cron from "node-cron";
import { supabase } from "../lib/supabase.js";
import { calculateMatchResult } from "../services/calculateMatchResult.js";

const CRIC_API_KEY = process.env.CRIC_API_KEY;
const CRIC_SCORE_URL = `https://api.cricapi.com/v1/cricScore?apikey=${CRIC_API_KEY}`;

const CHECK_WINDOW_BEFORE_MS = 10 * 60 * 1000;
const POSTPONE_OFFSET_MS = 25 * 60 * 1000;
const RESULT_RETRY_MS = 30 * 60 * 1000;

/* ================================================================
   SHARED — CricScore API fetch & match lookup
   ================================================================ */

async function fetchCricScore() {
  try {
    const res = await fetch(CRIC_SCORE_URL);
    if (!res.ok) {
      console.error("[CricScore] HTTP error:", res.status);
      return null;
    }
    const json = await res.json();
    if (json.status !== "success") {
      console.error("[CricScore] Returned status:", json.status);
      return null;
    }
    const rows = json.data || [];
    console.log(`[CricScore] Fetch success: ${rows.length} row(s) returned.`);
    return rows;
  } catch (err) {
    console.error("[CricScore] Fetch error:", err.message);
    return null;
  }
}

function findMatchInCricScore(cricScoreData, homeTeam, awayTeam) {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  return cricScoreData.find((m) => {
    const t1 = (m.t1 || "").toLowerCase();
    const t2 = (m.t2 || "").toLowerCase();
    return (t1.includes(homeLower) && t2.includes(awayLower)) ||
           (t1.includes(awayLower) && t2.includes(homeLower));
  });
}

function isStartedState(scoreMatch) {
  if (!scoreMatch) return false;

  const ms = (scoreMatch.ms || "").toLowerCase();
  if (ms === "live" || ms === "result") return true;

  // CricAPI can still report ms="fixture" right after toss.
  // Treat toss-declared status as started to avoid postponing active matches.
  const status = (scoreMatch.status || "").toLowerCase();
  if (ms === "fixture" && /opt to bat|opt to bowl|opt to field|won the toss/.test(status)) {
    return true;
  }

  return false;
}

/* ================================================================
   PART 1 — Match-start detection
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

function isInCheckWindow(fixture) {
  const now = Date.now();
  const matchStart = new Date(fixture.dateutc).getTime();
  return now >= matchStart - CHECK_WINDOW_BEFORE_MS;
}

async function markMatchStarted(fixtureId, matchnumber) {
  console.log(`[MatchChecker] START update: marking match #${matchnumber} as started.`);
  const { error } = await supabase
    .from("fixtures")
    .update({ matchstarted: "Y" })
    .eq("id", fixtureId);

  if (error) {
    console.error(
      `[MatchChecker] FAIL update: could not mark match #${matchnumber} as started:`,
      error
    );
    return false;
  }

  console.log(`[MatchChecker] SUCCESS update: match #${matchnumber} marked as started.`);

  const unbidsOk = await generateUnbids(matchnumber);
  if (!unbidsOk) {
    console.error(
      `[MatchChecker] FAIL post-start: unbid generation failed for match #${matchnumber}.`
    );
    return false;
  }

  console.log(
    `[MatchChecker] SUCCESS post-start: unbids generated for match #${matchnumber}.`
  );
  return true;
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
    return false;
  } else {
    console.log(
      `[MatchChecker] Unbids generated successfully for match ${matchnumber}`
    );
    return true;
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
      `[MatchChecker] FAIL postpone: could not update dateutc for match #${matchnumber}:`,
      error
    );
  } else {
    console.log(
      `[MatchChecker] SUCCESS postpone: match #${matchnumber} dateutc pushed to ${newTimeISO}`
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

  const cricScoreData = await fetchCricScore();
  if (cricScoreData === null) {
    console.error("[MatchChecker] Could not fetch cricScore data, will retry next cycle.");
    return;
  }

  for (const fixture of fixturesToCheck) {
    const scoreMatch = findMatchInCricScore(cricScoreData, fixture.home, fixture.away);
    const found = isStartedState(scoreMatch);

    if (found) {
      console.log(
        `[MatchChecker] MATCHED + STARTED: #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) ` +
        `apiId=${scoreMatch.id || "n/a"} ms=${scoreMatch.ms || "n/a"} status="${scoreMatch.status || ""}"`
      );
      const marked = await markMatchStarted(fixture.id, fixture.matchnumber);
      if (!marked) {
        console.error(
          `[MatchChecker] FAIL flow: start flow incomplete for match #${fixture.matchnumber}.`
        );
      } else {
        console.log(
          `[MatchChecker] SUCCESS flow: start flow completed for match #${fixture.matchnumber}.`
        );
      }
      console.log(
        `[MatchChecker] Match #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) FOUND in cricScore (ms=${scoreMatch.ms}) — marked as started.`
      );
    } else {
      if (scoreMatch) {
        console.log(
          `[MatchChecker] MATCHED + NOT STARTED: #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) ` +
          `apiId=${scoreMatch.id || "n/a"} ms=${scoreMatch.ms || "n/a"} status="${scoreMatch.status || ""}"`
        );
      } else {
        console.log(
          `[MatchChecker] NOT MATCHED: #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) not found in cricScore response.`
        );
      }
      await updateFixtureTime(fixture.id, fixture.matchnumber, fixture.dateutc);
    }
  }
}

/* ================================================================
   PART 2 — Match-result detection
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

function parseWinnerFromStatus(status, homeTeam, awayTeam, teamsMap) {
  if (!status) return null;

  const noResultPattern = /no result|match abandoned/i;
  if (noResultPattern.test(status)) {
    return { winner: "No Result", resolved: true };
  }

  const tiedPattern = /match tied/i;
  if (tiedPattern.test(status) && !/won the super over/i.test(status)) {
    return { winner: "No Result", resolved: true };
  }

  let winningTeamFull = null;

  const wonByMatch = status.match(/^(.+?)\s+won\s+by\s+/i);
  if (wonByMatch) {
    winningTeamFull = wonByMatch[1].trim();
  }

  if (!winningTeamFull) {
    const superOverMatch = status.match(/\((.+?)\s+won\s+the\s+super\s+over\)/i);
    if (superOverMatch) {
      winningTeamFull = superOverMatch[1].trim();
    }
  }

  if (!winningTeamFull) return null;

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
  console.log(
    `[ResultChecker] Calling calculateMatchResult directly — match: ${matchnumber}, winner: ${winner}`
  );

  try {
    const result = await calculateMatchResult(matchnumber, winner);

    if (!result.success) {
      console.error(
        `[ResultChecker] calculateMatchResult failed for match ${matchnumber}:`,
        result.error || result.message
      );
      return false;
    }

    console.log(
      `[ResultChecker] calculateMatchResult succeeded for match ${matchnumber}`,
      result
    );
    return true;
  } catch (err) {
    console.error(
      `[ResultChecker] calculateMatchResult threw for match ${matchnumber}:`,
      err.message
    );
    return false;
  }
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
let resultCheckRunning = false;

async function checkMatchResults() {
  if (resultCheckRunning) {
    console.log("[ResultChecker] Already running, skipping duplicate invocation.");
    return;
  }
  resultCheckRunning = true;

  try {
    await _checkMatchResultsInner();
  } finally {
    resultCheckRunning = false;
  }
}

async function _checkMatchResultsInner() {
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

  const cricScoreData = await fetchCricScore();
  if (cricScoreData === null) {
    console.error(
      "[ResultChecker] Could not fetch cricScore data, will retry in 30 min."
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

    const scoreMatch = findMatchInCricScore(cricScoreData, fixture.home, fixture.away);

    if (!scoreMatch) {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} (${fixture.home} vs ${fixture.away}) not found in cricScore.`
      );
      pendingResults = true;
      continue;
    }

    if (scoreMatch.ms !== "result") {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} in cricScore but ms="${scoreMatch.ms}", not a result yet. Will retry.`
      );
      pendingResults = true;
      continue;
    }

    const result = parseWinnerFromStatus(
      scoreMatch.status,
      fixture.home,
      fixture.away,
      teamsMap
    );

    if (!result) {
      console.log(
        `[ResultChecker] Match #${fixture.matchnumber} status not final yet: "${scoreMatch.status}". Will retry.`
      );
      pendingResults = true;
      continue;
    }

    const success = await callCalculateMatchResult(
      fixture.matchnumber,
      result.winner
    );

    if (success) {
      const leaderboardOk = await isLeaderboardPopulated(fixture.matchnumber);
      if (leaderboardOk) {
        await markResultProcessed(fixture.id, fixture.matchnumber);
        console.log(
          `[ResultChecker] Match #${fixture.matchnumber} result processed — winner: ${result.winner}`
        );
      } else {
        console.error(
          `[ResultChecker] Match #${fixture.matchnumber} API returned 200 but leaderboard is EMPTY. Will retry.`
        );
        pendingResults = true;
      }
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
  if (resultRetryTimer) {
    clearTimeout(resultRetryTimer);
  }
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
  cron.schedule("*/10 9-23 * * *", () => {
    checkMatches().catch((err) =>
      console.error("[MatchChecker] Unhandled error:", err)
    );
  });

  cron.schedule("*/30 13-23 * * *", () => {
    checkMatchResults().catch((err) =>
      console.error("[ResultChecker] Unhandled error:", err)
    );
  });

  console.log("[MatchChecker] Scheduled — match-start checks every 10 minutes (using cricScore).");
  console.log(
    "[ResultChecker] Scheduled — result checks every 30 min between 13:00–23:59 UTC (using cricScore)."
  );
}
