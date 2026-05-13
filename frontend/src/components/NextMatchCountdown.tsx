import { useEffect, useState } from "react";
import { getUpcomingMatches, MatchDataItem } from "@/data/matchData";

const NextMatchCountdown = () => {
  const upcoming = getUpcomingMatches();
  const nextMatch = upcoming.length > 0 ? upcoming[0] : null;

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!nextMatch) return;

    const update = () => {
      const now = new Date();
      const matchTime = new Date(nextMatch.DateUtc);
      const diff = matchTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        expired: false,
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

  if (!nextMatch) return null;

  return (
    <div className="card-surface p-6 text-center">
      <h3 className="font-display font-semibold text-foreground mb-4">⏳ Next Match Countdown</h3>
      {timeLeft.expired ? (
        <p className="text-accent text-lg font-semibold">🎉 It's match time!</p>
      ) : (
        <div className="flex justify-center gap-6">
          <TimeUnit value={timeLeft.days} label="Days" />
          <TimeUnit value={timeLeft.hours} label="Hours" />
          <TimeUnit value={timeLeft.minutes} label="Minutes" />
          <TimeUnit value={timeLeft.seconds} label="Seconds" />
        </div>
      )}
      <p className="text-sm text-muted-foreground mt-4">🏏 Get your jerseys ready — the action returns soon!</p>
    </div>
  );
};

const TimeUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="text-2xl font-mono-data text-warning font-bold">
      {String(value).padStart(2, "0")}
    </span>
    <span className="text-xs text-muted-foreground mt-1">{label}</span>
  </div>
);

export default NextMatchCountdown;
