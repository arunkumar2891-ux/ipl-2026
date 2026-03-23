import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/api/api";
import { validateEmail } from "@/lib/utils";
import OtpInput from "@/components/OtpInput";
import { useQueryClient } from "@tanstack/react-query";
import { members } from "@/data/members";

type Match = {
  matchnumber: number;
  home: string;
  away: string
};

export default function AdminConsole() {

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [selectedWinners, setSelectedWinners] = useState<Record<number,string>>({});

  const [loadingMatches, setLoadingMatches] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [selectedEmail, setSelectedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpValidated, setOtpValidated] = useState(false);
  const uniqueMembers = Array.from(
	new Map(members.map((m) => [m.Email, m])).values()
  );

  const ADMIN_EMAILS = [
    "iamarunkumor@gmail.com",
	"midun.mib@gmail.com",
	"gopi13karthick@gmail.com",
	"parthiece08@gmail.com",
	"isudarsan93@gmail.com"
  ];

  const userEmail = localStorage.getItem("email");
  console.log(`local email: ${userEmail}`);

  if (!ADMIN_EMAILS.includes(userEmail || "")) {
    return <div style={{padding:40}}>Access Denied</div>;
  }

  useEffect(() => {
    fetchMatches();
  }, []);
  
  const fetchMatches = async () => {

    try {

      setLoadingMatches(true);
      const data = await api.getTodayMatches();
	  setMatches(data);

    } catch (err) {

      console.error(err);
      alert("Failed to load matches");

    } finally {

      setLoadingMatches(false);

    }
  };

  const generateUnbids = async () => {

	  if (!selectedMatch) {
		alert("Select a match");
		return;
	  }

	  if (!confirm(`Generate unbids for Match ${selectedMatch}?`)) return;

	  try {

		setProcessing(true);

		const res = await api.generateUnbids(selectedMatch);

		console.log(res);

		alert(res.message || "Unbids generated successfully");

	  } catch (err) {

		console.error(err);
		alert("Error generating unbids");

	  } finally {

		setProcessing(false);

	  }
  };

  const submitResult = async (matchnumber:number) => {

    const winner = selectedWinners[matchnumber];

    if (!winner) {
      alert("Select winner");
      return;
    }

    if (!confirm(`Confirm ${winner} as winner for Match ${matchnumber}?`))
      return;

    try {

      setProcessing(true);

      const res = await api.calculateMatchResult(winner, matchnumber);

      //if (!res.ok) throw new Error("Result calculation failed");

      alert(`Match ${matchnumber} result processed`);

    } catch (err) {

      console.error(err);
      alert("Failed to calculate result");

    } finally {

      setProcessing(false);

    }
  };

  if (loadingMatches) {
    return <div style={{padding:40}}>Loading Admin Console...</div>;
  }

  return (
    

    <div style={styles.container}>

      <h2 style={styles.title}>IPL Admin Console</h2>

      {/* Generate Unbids */}

      <section style={styles.section}>

        <h3>Generate Unbids</h3>

        <div style={styles.row}>

          <select
            style={styles.dropdown}
            value={selectedMatch ?? ""}
            onChange={(e)=>setSelectedMatch(Number(e.target.value))}
			className="w-full border rounded-md px-3 py-2 bg-background"
          >

            <option value="">Select Match</option>

            {matches.map((m)=>(
              <option key={m.matchnumber} value={m.matchnumber}>
                Match {m.matchnumber}
              </option>
            ))}

          </select>

          <button
            style={styles.button}
            onClick={generateUnbids}
            disabled={processing}
			className="p-3 rounded-lg border text-sm font-medium transition-all duration-200"
          >
            Generate
          </button>

        </div>

      </section>

      {/* Calculate Results */}

      <section style={styles.section}>

        <h3>Calculate Results</h3>

        {matches.map((m)=>(
          <div key={m.matchnumber} style={styles.row}>

            <label style={{width:80}}>
              Match {m.matchnumber}
            </label>

            <select
              style={styles.dropdown}
              value={selectedWinners[m.matchnumber] || ""}
			  className="w-full border rounded-md px-3 py-2 bg-background"
              onChange={(e)=>{

                setSelectedWinners({
                  ...selectedWinners,
                  [m.matchnumber]: e.target.value
                });

              }}
            >

              <option value="">Select Winner</option>

              {[m.home, m.away].map(team => (
				  <option key={team} value={team}>
					{team}
				  </option>
			  ))}

            </select>

            <button
              style={styles.button}
              disabled={processing}
			  className="p-3 rounded-lg border text-sm font-medium transition-all duration-200"
              onClick={()=>submitResult(m.matchnumber)}
            >
              Submit
            </button>

          </div>
        ))}

      </section>

    </div>
  );
}

const styles = {

  container: {
    maxWidth: 600,
    margin: "40px auto",
    padding: 30,
    fontFamily: "Arial"
  },

  title: {
    textAlign: "center",
    marginBottom: 30
  },

  section: {
    marginBottom: 40
  },

  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },

  dropdown: {
    padding: 6,
    minWidth: 140
  },

  button: {
    padding: "6px 14px",
    cursor: "pointer"
  }

};