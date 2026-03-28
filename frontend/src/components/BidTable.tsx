import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api/api";
import { aggregateBidsByMatch } from "@/lib/utils";
import EmailGate from "@/components/EmailGate";
import { ArrowUpDown } from "lucide-react";
import { useLoggedInUser } from "@/hooks/useLoggedInUser";

type SortKey = "Name" | "selectedValue";

const BidTable = () => {
  const { data: bids = [], isLoading, isError } = useQuery({
  queryKey: ["bids"],
  queryFn: api.getBids,
  staleTime: 0,
  refetchOnWindowFocus: true
  });
  
  /*const [userGroups, setUserGroups] = useState<string[]>(
  JSON.parse(localStorage.getItem("userGroups") || "[]")
  );*/
  const { groups, isLoggedIn, logout } = useLoggedInUser();
  console.log(`${groups} - ${isLoggedIn}`);
  //const analytics = useMemo(() => aggregateBids(bids), [bids]);
  
  const [sortKey, setSortKey] = useState<SortKey>("Name");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredBids = useMemo(() => {
    return bids.filter((b) => groups.includes(b.group));
  }, [bids, groups]);
  
  /*const sorted = useMemo(() => {
  return [...filteredBids].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });
  }, [filteredBids, sortKey, sortAsc]);*/
  
  const analytics = useMemo(
  () => aggregateBidsByMatch(filteredBids),
  [filteredBids]
  );
  //console.log("User groups:", userGroups);
  console.log("Filtered bids:", filteredBids);
	
  const filteredAnalytics = useMemo(() => {
  return analytics.filter((a) =>
    groups.includes(a.group)
  );
  }, [analytics, groups]);
  
  
  const sorted = useMemo(() => {
	  return [...filteredBids].sort((a, b) => {

		// 1️⃣ Group
		const groupCompare = (a.group ?? "").localeCompare(b.group ?? "");
		if (groupCompare !== 0) return groupCompare;

		// 2️⃣ Name
		const nameCompare = (a.Name ?? a.name ?? "")
		  .localeCompare(b.Name ?? b.name ?? "");
		if (nameCompare !== 0) return nameCompare;

		// 3️⃣ Team
		return (a.selectedValue ?? "")
		  .localeCompare(b.selectedValue ?? "");

	  });
  }, [filteredBids]);
  
  const groupedByMatchGroup = useMemo(() => {
  const map: Record<number, Record<string, any[]>> = {};

  sorted.forEach((bid) => {
    const match = bid.matchNumber ?? bid.MatchNumber;
    const group = bid.group ?? "Unknown";

    if (!map[match]) map[match] = {};
    if (!map[match][group]) map[match][group] = [];

    map[match][group].push(bid);
  });

  return Object.entries(map).map(([matchNumber, groups]) => ({
    matchNumber,
    groups: Object.entries(groups).map(([group, data]) => ({
      group,
      data
    }))
  }));
}, [sorted]);
  
  /*const sortedAnalytics = useMemo(() => {
	  return [...filteredAnalytics].sort((a, b) => {

		// 1️⃣ Group
		const groupCompare = (a.group ?? "").localeCompare(b.group ?? "");
		if (groupCompare !== 0) return groupCompare;

		// 2️⃣ Team
		return (a.team ?? "").localeCompare(b.team ?? "");

	  });
  }, [filteredAnalytics]);*/
  const sortedAnalytics = useMemo(() => {
  return [...analytics].sort(
    (a, b) =>
      a.matchNumber - b.matchNumber ||
      a.group.localeCompare(b.group) ||
      a.team.localeCompare(b.team)
  )
}, [analytics]);
  
  const analyticsByMatchGroup = useMemo(() => {
  const map: Record<number, Record<string, any[]>> = {}

  sortedAnalytics.forEach(row => {
    if (!map[row.matchNumber]) map[row.matchNumber] = {}
    if (!map[row.matchNumber][row.group]) map[row.matchNumber][row.group] = []

    map[row.matchNumber][row.group].push(row)
  })

  return Object.entries(map).map(([matchNumber, groups]) => ({
    matchNumber,
    groups: Object.entries(groups).map(([group, data]) => ({
      group,
      data
    }))
  }))
}, [sortedAnalytics]);
  
  /*const analyticsByGroup = useMemo(() => {
	  const map: Record<string, any[]> = {};

	  sortedAnalytics.forEach((row) => {
		const g = row.group ?? "Unknown";

		if (!map[g]) map[g] = [];
		map[g].push(row);
	  });

	  return Object.entries(map).map(([group, data]) => ({
		group,
		data
	  }));
  }, [sortedAnalytics]);
  
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };*/
  
  const groupedByMatch = useMemo(() => {
  const map: Record<number, any[]> = {};

  sorted.forEach((bid) => {
    const match = bid.matchNumber ?? bid.MatchNumber;

    if (!map[match]) map[match] = [];
    map[match].push(bid);
  });

  return Object.entries(map).map(([matchNumber, data]) => ({
    matchNumber,
    data,
  }));
  }, [sorted]);
  
  /*const groupedVisible = userGroups.map((group) => ({
  group,
  data: sorted.filter((x) => x.group === group),
  }));*/

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  //if (isError) return <div className="text-center py-20 text-destructive text-sm">{error}</div>;
  if (isError)
  return (
    <div className="text-center py-20 text-destructive text-sm">
      Fetch Error. Please try again.
    </div>
  );
  if(filteredBids.length === 0){
	  return (
    <div className="font-display font-semibold text-sm text-foreground">
      The bids are warming up in the pavilion. Reveal when the players walk out.
    </div>
  )
  }
  /*if (userGroups.length === 0) {
		return <EmailGate onGroupDetected={setUserGroups} />;
  }*/
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Raw Bid Log */}
	  {groupedByMatchGroup.map((matchBlock) =>
  matchBlock.groups.map((groupBlock) => (
    <div
      key={`${matchBlock.matchNumber}-${groupBlock.group}`}
      className="card-surface overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-foreground">
          Match {matchBlock.matchNumber} - {groupBlock.group}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Individual bid records
        </p>
      </div>

      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 backdrop-blur-md bg-card/80">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-xs uppercase">S.No</th>
              <th className="px-4 py-3 text-xs uppercase">Name</th>
              <th className="px-4 py-3 text-xs uppercase">Match #</th>
              <th className="px-4 py-3 text-xs uppercase">Team Bid</th>
              <th className="px-4 py-3 text-xs uppercase">Group</th>
            </tr>
          </thead>
          <tbody>
            {groupBlock.data.map((bid: any, i: number) => (
              <tr key={`${bid.Name}-${bid.matchNumber}-${i}`}>
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2">{bid.Name ?? bid.name}</td>
                <td className="px-4 py-2">{bid.matchNumber}</td>
                <td className="px-4 py-2">{bid.selectedValue}</td>
                <td className="px-4 py-2">{bid.group}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ))
)}

{/* Bid Analytics */}
{analyticsByMatchGroup.map(matchBlock =>
  matchBlock.groups.map(groupBlock => (
    <div
      key={`analytics-${matchBlock.matchNumber}-${groupBlock.group}`}
      className="card-surface overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-foreground">
          Match {matchBlock.matchNumber} - {groupBlock.group} Analytics
        </h3>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3 text-xs uppercase">Team</th>
            <th className="px-4 py-3 text-xs uppercase">Custom Metric</th>
          </tr>
        </thead>

        <tbody>
          {groupBlock.data.map((item, i) => (
            <tr key={`${item.matchNumber}-${item.group}-${item.team}`}>
              <td className="px-4 py-2">{item.team}</td>
              <td className="px-4 py-2 font-mono-data">{item.customMetric}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))
)}
	  
    </motion.div>
  );
};

export default BidTable;
