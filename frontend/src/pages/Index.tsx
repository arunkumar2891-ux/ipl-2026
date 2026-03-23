import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Target, BarChart3, Calendar,Settings, Shield } from "lucide-react";
import MatchCard from "@/components/MatchCard";
import LeaderboardTable from "@/components/LeaderboardTable";
import BidTable from "@/components/BidTable";
import AdminConsole from "@/components/AdminConsole";
import UpcomingMatches from "@/components/UpcomingMatches";
import NextMatchCountdown from "@/components/NextMatchCountdown";
import { matchData, getTodaysMatches } from "@/data/matchData";

const tabs = [
  { id: "predict", label: "Submit Bid", icon: Target },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "bids", label: "Bid Details", icon: BarChart3 },
  { id: "admin", label: "Admin  Details", icon: Shield  }
] as const;

type TabId = (typeof tabs)[number]["id"];

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("predict");
  const todaysMatches = getTodaysMatches();
  //console.log(import.meta.env.VITE_API_URL);
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
	  
      <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div>
              <img
				src="/favicon.ico"
				alt="App icon"
				className="h-10 w-25"
			/> 

          </div>
		<div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">IPL Prediction Game</h1>
            <p className="text-xs text-muted-foreground">All entries should be submitted before 15 minutes of the first ball. Multiple bids allowed — latest bid will be considered.</p>
          </div>
          
        </div>
      </header>
	  {/* Tabs */}
		<div className="container max-w-6xl mx-auto px-4 py-4" >		  
          <nav className="flex gap-1 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary rounded-lg glow-primary"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            ))}
          </nav>
		</div>
      {/* Content */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "predict" && (
            <motion.div
              key="predict"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {todaysMatches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm card-surface p-8">
                  <p className="text-lg mb-2">🏏</p>
                  <p>Relax… No fours, no sixes and most importantly no wrong predictions possible today</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {todaysMatches.map((match, i) => (
                    <MatchCard key={match.MatchNumber} match={match} index={i} />
                  ))}
                </div>
              )}

              {/* Next Match Countdown */}
              <NextMatchCountdown />

              {/* Upcoming Matches */}
              <UpcomingMatches />
            </motion.div>
          )}

          {activeTab === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-lg font-semibold mb-4 text-foreground">IPL Prediction Game - Leaderboard</h2>
              <LeaderboardTable />
            </motion.div>
          )}

          {activeTab === "bids" && (
            <motion.div
              key="bids"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-lg font-semibold mb-4 text-foreground">IPL Prediction Game - Bidding Details</h2>
              <BidTable />
            </motion.div>
          )}
		  {activeTab === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-lg font-semibold mb-4 text-foreground">IPL Prediction Game - Admin</h2>
              <AdminConsole />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
