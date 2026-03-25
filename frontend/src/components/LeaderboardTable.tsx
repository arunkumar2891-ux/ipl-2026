import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api/api";
import EmailGate from "@/components/EmailGate";
import { Input } from "@/components/ui/input";
import { ArrowUpDown } from "lucide-react";
import { members } from "@/data/members";
import { useLoggedInUser } from "@/hooks/useLoggedInUser";

interface LeaderEntry {
  name: string;
  group: string;
  amount: number;
  winAmount: number;
  matchNumber: number;
}

type SortKey = "name" | "amount" | "winAmount";

const LeaderboardTable = () => {
  const { data = [], isLoading, isError } = useQuery({
  queryKey: ["leaderboard"],
  queryFn: async () => {
    const result = await api.getLeaderboard();

    const payload = result ?? [];

    const normalized: LeaderEntry[] = payload.map((x: any) => ({
      name: x.Name,
      group: x.Group,
      amount: x.Amount,
      winAmount: x.matchWinAmount,
      matchNumber: x.matchNumber,
    }));

    return normalized;
  }
});

  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortAsc, setSortAsc] = useState(false);

  /*const [userGroups, setUserGroups] = useState<string[]>(
  JSON.parse(localStorage.getItem("userGroups") || "[]")
  );
  console.log(`userGroups ${userGroups}`);*/
  
  /*const [userGroups, setUserGroups] = useState<string[]>(() => {
	  const email = localStorage.getItem("email");
	  console.log(`local email: ${email}`);
	  if (!email) return [];

	  const groups = members
		.filter((m) => m.Email.toLowerCase() === email.toLowerCase())
		.map((m) => m.Group);

	  return [...new Set(groups)];
  });*/
  const { groups, isLoggedIn, logout } = useLoggedInUser();
  
  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

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
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  /*const groupedVisible = userGroups.map((group) => ({
  group,
  data: sorted.filter((x) => x.group === group),
  }));*/
  const groupedVisible = groups.map((group) => ({
    group,
    data: sorted.filter((x) => x.group === group),
  }));

  if (isLoading) return <LoadingSpinner />;
if (isError) return <div className="text-center py-20 text-destructive text-sm">Leaderboard Fetch Error. Please try again.</div>;

  /*if (!userGroups) {
    return <EmailGate onGroupDetected={setUserGroups} />
  }*/
  /*if (userGroups.length === 0) {
		return <EmailGate onGroupDetected={setUserGroups} />;
  }*/
	/*useEffect(() => {
	  const storedGroups = localStorage.getItem("userGroups");

	  if (storedGroups) {
		setUserGroups(JSON.parse(storedGroups));
	  }
	}, []);*/
	
  return (
   <motion.div className="max-w-4xl mx-auto space-y-6">
  {groupedVisible.map((g) => (
    <LeaderboardGroup
      key={g.group}
      title={`Group ${g.group} Leaderboard`}
      data={g.data}
      toggleSort={toggleSort}
    />
  ))}

  <div className="text-center mt-6">
    <p>The leaderboard will be visible once you submit your first bid</p>
  </div>
</motion.div>
  );
};

const LeaderboardGroup = ({ title, data, toggleSort }: any) => {

  const columns = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Total Win Amount" },
    { key: "winAmount", label: "Win Amount" },
    { key: "matchNumber", label: "As Of" },
  ];

  const getRankStyle = (index: number) => {
    if (index === 0) return "border-l-4 border-l-gold";
    if (index === 1) return "border-l-4 border-l-silver";
    if (index === 2) return "border-l-4 border-l-bronze";
    return "";
  };

  return (
    <div className="card-surface overflow-hidden">

      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">

          <thead className="sticky top-0 backdrop-blur-md bg-card/80">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">
                S.No
              </th>

              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-4 py-3 text-left text-xs uppercase text-muted-foreground cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
              ))}

            </tr>
          </thead>

          <tbody>
            {data.map((entry: LeaderEntry, i: number) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`border-b border-border/50 hover:bg-secondary/30 ${getRankStyle(i)}`}
              >
                <td className="px-4 py-3 font-mono">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{entry.name}</td>
                <td className="px-4 py-3">₹{entry.amount}</td>
                <td className="px-4 py-3">₹{entry.winAmount}</td>
                <td className="px-4 py-3">Match {entry.matchNumber}</td>
              </motion.tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

export default LeaderboardTable;
