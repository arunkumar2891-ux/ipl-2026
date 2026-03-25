export interface MatchDataItem {
  MatchNumber: number;
  RoundNumber: number | string;
  DateUtc: string;
  Location: string;
  HomeTeam: string;
  AwayTeam: string;
  Group: null;
}

export const matchData: MatchDataItem[] = [
  {
    "MatchNumber": 0,
    "DateUtc": "2026-03-25T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Royal Challengers Bengaluru",
    "AwayTeam": "Sunrisers Hyderabad",
    "Location": "Bengaluru"
  },
  {
    "MatchNumber": 1,
    "DateUtc": "2026-03-28T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Royal Challengers Bengaluru",
    "AwayTeam": "Sunrisers Hyderabad",
    "Location": "Bengaluru"
  },
  {
    "MatchNumber": 2,
    "DateUtc": "2026-03-29T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Mumbai Indians",
    "AwayTeam": "Kolkata Knight Riders",
    "Location": "Mumbai"
  },
  {
    "MatchNumber": 3,
    "DateUtc": "2026-03-30T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Rajasthan Royals",
    "AwayTeam": "Chennai Super Kings",
    "Location": "Guwahati"
  },
  {
    "MatchNumber": 4,
    "DateUtc": "2026-03-31T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Punjab Kings",
    "AwayTeam": "Gujarat Titans",
    "Location": "New Chandigarh"
  },
  {
    "MatchNumber": 5,
    "DateUtc": "2026-04-01T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Lucknow Super Giants",
    "AwayTeam": "Delhi Capitals",
    "Location": "Lucknow"
  },
  {
    "MatchNumber": 6,
    "DateUtc": "2026-04-02T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Kolkata Knight Riders",
    "AwayTeam": "Sunrisers Hyderabad",
    "Location": "Kolkata"
  },
  {
    "MatchNumber": 7,
    "DateUtc": "2026-04-03T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Chennai Super Kings",
    "AwayTeam": "Punjab Kings",
    "Location": "Chennai"
  },
  {
    "MatchNumber": 8,
    "DateUtc": "2026-04-04T10:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Delhi Capitals",
    "AwayTeam": "Mumbai Indians",
    "Location": "Delhi"
  },
  {
    "MatchNumber": 9,
    "DateUtc": "2026-04-04T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Gujarat Titans",
    "AwayTeam": "Rajasthan Royals",
    "Location": "Ahmedabad"
  },
  {
    "MatchNumber": 10,
    "DateUtc": "2026-04-05T10:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Sunrisers Hyderabad",
    "AwayTeam": "Lucknow Super Giants",
    "Location": "Hyderabad"
  },
  {
    "MatchNumber": 11,
    "DateUtc": "2026-04-05T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Royal Challengers Bengaluru",
    "AwayTeam": "Chennai Super Kings",
    "Location": "Bengaluru"
  },
  {
    "MatchNumber": 12,
    "DateUtc": "2026-04-06T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Kolkata Knight Riders",
    "AwayTeam": "Punjab Kings",
    "Location": "Kolkata"
  },
  {
    "MatchNumber": 13,
    "DateUtc": "2026-04-07T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Rajasthan Royals",
    "AwayTeam": "Mumbai Indians",
    "Location": "Guwahati"
  },
  {
    "MatchNumber": 14,
    "DateUtc": "2026-04-08T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Delhi Capitals",
    "AwayTeam": "Gujarat Titans",
    "Location": "Delhi"
  },
  {
    "MatchNumber": 15,
    "DateUtc": "2026-04-09T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Kolkata Knight Riders",
    "AwayTeam": "Lucknow Super Giants",
    "Location": "Kolkata"
  },
  {
    "MatchNumber": 16,
    "DateUtc": "2026-04-10T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Rajasthan Royals",
    "AwayTeam": "Royal Challengers Bengaluru",
    "Location": "Guwahati"
  },
  {
    "MatchNumber": 17,
    "DateUtc": "2026-04-11T10:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Punjab Kings",
    "AwayTeam": "Sunrisers Hyderabad",
    "Location": "New Chandigarh"
  },
  {
    "MatchNumber": 18,
    "DateUtc": "2026-04-11T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Chennai Super Kings",
    "AwayTeam": "Delhi Capitals",
    "Location": "Chennai"
  },
  {
    "MatchNumber": 19,
    "DateUtc": "2026-04-12T10:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Lucknow Super Giants",
    "AwayTeam": "Gujarat Titans",
    "Location": "Lucknow"
  },
  {
    "MatchNumber": 20,
    "DateUtc": "2026-04-12T14:00:00Z",
    "RoundNumber": 1,
    "HomeTeam": "Mumbai Indians",
    "AwayTeam": "Royal Challengers Bengaluru",
    "Location": "Mumbai"
  }
];

export const getTodaysMatches = (): MatchDataItem[] => {
  const today = new Date().toISOString().split("T")[0];
  return matchData.filter((match) => {
    const matchDate = new Date(match.DateUtc).toISOString().split("T")[0];
    return matchDate === today;
  });
};

export const getUpcomingMatches = (): MatchDataItem[] => {
  const now = new Date();
  return matchData.filter((match) => {
    const matchDate = new Date(match.DateUtc);
    return matchDate >= new Date(now.toDateString());
  });
};
