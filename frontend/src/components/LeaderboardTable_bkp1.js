import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { api } from "@/api/api";
import { ArrowUpDown } from "lucide-react";

interface LeaderEntry {
  name: string;
  group: string;
  amount: number;
  winAmount: number;
  matchNumber: number;
  [key: string]: any;
}

type SortKey = "name" | "amount" | "winAmount" | "matchNumber" | "group";

const LeaderboardTable = () => {
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("group");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getLeaderboard();
        setData(result || []);
      } catch {
        setError("Leaderboard Fetch Error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? a[sortKey.charAt(0).toUpperCase() + sortKey.slice(1)];
      const bVal = b[sortKey] ?? b[sortKey.charAt(0).toUpperCase() + sortKey.slice(1)];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const getRankStyle = (index: number) => {
    if (index === 0) return "border-l-4 border-l-gold";
    if (index === 1) return "border-l-4 border-l-silver";
    if (index === 2) return "border-l-4 border-l-bronze";
    return "";
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center py-20 text-destructive text-sm">{error}</div>;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Summoning cricket stats from the cloud… brace yourself!
      </div>
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Total Win Amount" },
    { key: "winAmount", label: "Win Amount" },
    { key: "matchNumber", label: "As Of" },
	{ key: "group", label: "Group" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 backdrop-blur-md bg-card/80">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                S.No.
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Group
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${getRankStyle(i)}`}
              >
                <td className="px-4 py-3 font-mono-data">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{entry.Name ?? entry.name}</td>
                <td className="px-4 py-3 font-mono-data">₹{entry.Amount ?? entry.amount}</td>
                <td className="px-4 py-3 font-mono-data">₹{entry.matchWinAmount ?? entry.matchWinAmount}</td>
                <td className="px-4 py-3 font-mono-data">Match {entry.matchNumber ?? entry.MatchNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.Group ?? entry.group}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

export default LeaderboardTable;
