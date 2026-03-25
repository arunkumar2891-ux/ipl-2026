import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export const convertToIST = (utcDate: string): string => {
  const date = new Date(utcDate);
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().replace("T", " ").replace(".000Z", " IST");
};

export const isSubmissionAllowed = (dateUtc: string): boolean => {
  const matchTime = new Date(dateUtc).getTime();
  const cutoffTime = matchTime - 15 * 60 * 1000;
  const currentTime = new Date().getTime();
  return currentTime < cutoffTime;
};

export const getTimeRemaining = (dateUtc: string) => {
  const matchTime = new Date(dateUtc).getTime();
  const cutoffTime = matchTime - 15 * 60 * 1000;
  const now = new Date().getTime();
  const diff = cutoffTime - now;

  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };

  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { hours, minutes, seconds, expired: false };
};

export const validateEmail = (email: string): boolean => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return EMAIL_WHITELIST.includes(email.toLowerCase());
};

/*export const aggregateBids = (bids: any[]) => {
  const stats: Record<string, { group: string; team: string; count: number; totalBid: number; customMetric: number }> = {};

  bids.forEach(({ group, selectedValue, bid }) => {
    const key = `${group}|${selectedValue}`;
    const bidAmount = parseFloat(bid);

    if (!stats[key]) {
      stats[key] = { group, team: selectedValue, count: 0, totalBid: 0, customMetric: 0 };
    }

    stats[key].count += 1;
    stats[key].totalBid += bidAmount;
  });

  return Object.values(stats).map(item => ({
    ...item,
    customMetric: parseFloat((item.totalBid / 20).toFixed(2)),
  }));
};*/

export const aggregateBidsByMatch = (bids: any[]) => {
  const stats: Record<
    string,
    {
      matchNumber: number
      group: string
      team: string
      count: number
      totalBid: number
      customMetric: number
    }
  > = {}

  bids.forEach(({ matchNumber, group, selectedValue, bid }) => {
    const key = `${matchNumber}|${group}|${selectedValue}`
    const bidAmount = parseFloat(bid)

    if (!stats[key]) {
      stats[key] = {
        matchNumber,
        group,
        team: selectedValue,
        count: 0,
        totalBid: 0,
        customMetric: 0
      }
    }

    stats[key].count += 1
    stats[key].totalBid += bidAmount
  })

  return Object.values(stats).map(item => ({
    ...item,
    customMetric: parseFloat((item.totalBid / 20).toFixed(2))
  }))
};

export const EMAIL_WHITELIST = [
  "arjunsuresh2104@gmail.com",
  "iamarunkumor@gmail.com",
  "adhivm@gmail.com",
  "rbala045@gmail.com",
  "charanmohan05@gmail.com",
  "gopi13karthick@gmail.com",
  "nw.gowtham@gmail.com",
  "harisriram.h14@gmail.com",
  "sriniha2.dec06@gmail.com",
  "kishorezum07@gmail.com",
  "midun.mib@gmail.com",
  "naveenalexisit@gmail.com",
  "prabhud465@gmail.com",
  "sathya.it39@gmail.com",
  "sethusandhiya44@gmail.com",
  "sri.true@gmail.com",
  "sundarster@gmail.com",
  "venkat1979gc@gmail.com",
  "isudarsan93@gmail.com",
  "vinay.baskie@gmail.com",
  "vijay.raghavan4321@gmail.com",
  "parthiece08@gmail.com",
  "singh.ajaykumar@gmail.com",
  "ashsubram@gmail.com",
  "lord.deeps@gmail.com",
  "mailjisjoseph@gmail.com",
  "matrixmohanbabu@gmail.com",
  "skaran1988@gmail.com",
  "prash.cts@gmail.com",
  "ramya.cse2@gmail.com",
  "srinivaskumar.mv30@gmail.com",
  "vedantvyas91@gmail.com",
];

export const formatISTDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
};
