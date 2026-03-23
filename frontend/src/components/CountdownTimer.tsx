import { useEffect, useState } from "react";
import { getTimeRemaining } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: string;
}

const CountdownTimer = ({ targetDate }: CountdownTimerProps) => {
  const [time, setTime] = useState(getTimeRemaining(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (time.expired) {
    return (
      <span className="font-mono-data text-xs text-muted-foreground">
        CLOSED
      </span>
    );
  }

  const isUrgent = time.hours === 0 && time.minutes < 60;

  return (
    <span className={`font-mono-data text-xs tracking-wide ${isUrgent ? "text-warning" : "text-accent"}`}>
      {String(time.hours).padStart(2, "0")}:{String(time.minutes).padStart(2, "0")}:{String(time.seconds).padStart(2, "0")}
    </span>
  );
};

export default CountdownTimer;
