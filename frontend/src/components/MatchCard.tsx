import { motion } from "framer-motion";
import { MatchDataItem } from "@/data/matchData";
import { isSubmissionAllowed, convertToIST } from "@/lib/utils";
import CountdownTimer from "./CountdownTimer";
import PredictionForm from "./PredictionForm";
import { teamLogos } from "@/data/teamLogos";


interface MatchCardProps {
  match: MatchDataItem;
  index: number;
}

const MatchCard = ({ match, index }: MatchCardProps) => {
  const allowed = isSubmissionAllowed(match.DateUtc);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="p-6 card-surface bg-gradient-to-br from-card to-background"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="font-mono-data text-xs text-muted-foreground uppercase tracking-widest">
          Match #{match.MatchNumber}
        </span>
        <CountdownTimer targetDate={match.DateUtc} />
      </div>
      <div className="grid grid-cols-3 items-center gap-4 mb-2">
        <div className="flex items-center justify-center gap-2">
    <img
      src={teamLogos[match.HomeTeam]}
      alt={match.HomeTeam}
      className="w-10 h-10 object-contain"
    />
    <span className="font-display font-semibold text-sm text-foreground leading-tight">
      {match.HomeTeam}
    </span>
  </div>

  <span className="text-center text-muted-foreground italic text-xs">vs</span>

  <div className="flex items-center justify-center gap-2">
    <img
      src={teamLogos[match.AwayTeam]}
      alt={match.AwayTeam}
      className="w-10 h-10 object-contain"
    />
    <span className="font-display font-semibold text-sm text-foreground leading-tight">
      {match.AwayTeam}
    </span>
  </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-5">
        <span>📍 {match.Location}</span>
        <div className="flex justify-between">
          <span className="font-mono-data">UTC: {match.DateUtc}</span>
          <span className="font-mono-data">IST: {convertToIST(match.DateUtc)}</span>
        </div>
      </div>

      <PredictionForm
        matchId={match.MatchNumber}
        homeTeam={match.HomeTeam}
        awayTeam={match.AwayTeam}
        disabled={!allowed}
        matchStart={match.DateUtc}
      />
    </motion.div>
  );
};

export default MatchCard;
