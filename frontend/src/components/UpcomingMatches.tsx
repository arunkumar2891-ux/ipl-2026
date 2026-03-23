import { getUpcomingMatches } from "@/data/matchData";

const UpcomingMatches = () => {
  const upcoming = getUpcomingMatches();

  if (upcoming.length === 0) {
    return (
      <div className="card-surface p-6 text-center text-muted-foreground text-sm">
        🎉 No more matches remaining!
      </div>
    );
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-foreground">🏏 Upcoming IPL Matches</h3>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 backdrop-blur-md bg-card/80">
            <tr className="border-b border-border">
              {["Match", "Date", "Time", "Venue", "Home", "Away"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upcoming.map((match) => {
              const dateObj = new Date(match.DateUtc);
              const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
              const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <tr key={match.MatchNumber} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2 font-mono-data">{match.MatchNumber}</td>
                  <td className="px-4 py-2 font-mono-data">{dateStr}</td>
                  <td className="px-4 py-2 font-mono-data">{timeStr}</td>
                  <td className="px-4 py-2 text-muted-foreground">{match.Location}</td>
                  <td className="px-4 py-2">{match.HomeTeam}</td>
                  <td className="px-4 py-2">{match.AwayTeam}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UpcomingMatches;
