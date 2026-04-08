import cron from "node-cron";
import { supabase } from "../lib/supabase.js";

const CRIC_API_URL =
  "https://api.cricapi.com/v1/currentMatches?apikey=32873d41-895d-4066-8015-c354cc70046f&offset=0";

const CHECK_WINDOW_BEFORE_MS = 20 * 60 * 1000;
const POSTPONE_OFFSET_MS = 25 * 60 * 1000;

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

export function startMatchChecker() {
  cron.schedule("*/10 * * * *", () => {
    checkMatches().catch((err) =>
      console.error("[MatchChecker] Unhandled error:", err)
    );
  });

  console.log("[MatchChecker] Scheduled — checks every 10 minutes.");
}
