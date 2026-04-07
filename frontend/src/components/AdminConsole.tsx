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
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  const userEmail = localStorage.getItem("email");
  
  const uniqueMembers = Array.from(
	new Map(members.map((m) => [m.Email, m])).values()
  );
  
  useEffect(() => {

	  const checkAdmin = async () => {

	  //const userEmail = localStorage.getItem("email");

	  //console.log(`local email: ${userEmail}`);

	  if (!userEmail) {
		setIsAdmin(false);
		return;
	  }

	  try {

		const res = await api.checkAdmin(userEmail);
	    //console.log(`res.isadmin ${res.isAdmin}`);
		setIsAdmin(res.isAdmin);

	  } catch (err) {
		console.error("Admin check failed", err);
		setIsAdmin(false);
	  }
	};

	checkAdmin();
	//fetchMatches();

  }, []);
  
  useEffect(() => {

    if (isAdmin) {
      fetchMatches();
    }

  }, [isAdmin]);
  
  if (isAdmin === null) {
	return <div style={{ padding: 40 }}>Verifying Supreme Authority...</div>;
  }

  if (!isAdmin) {
	return <div style={{ padding: 40 }}>403 – You’re not in the playing XI for this console</div>;
  }
  
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

		const res = await api.generateUnbids(selectedMatch, userEmail);

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
    return <div style={{padding:40}}>Preparing Questionable Admin Decisions...</div>;
  }

  if (isAdmin) {
  return (
    

    <div style={styles.container}>

      <h2 style={styles.title}>IPL Admin Console</h2>

      {/* Generate Unbids */}

      <section style={styles.section}>

        <h3>Generate Unbids</h3>

        <div style={styles.row}>

          <select
            style={styles.dropdown}
            value={selectedMatch ?? "No Matches Today"}
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
            disabled={processing || !selectedMatch}
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
              {/* No Result Logic */}
              <option value="No Result">No Result</option>

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
	  {/* Change Active emails */}

      <section style={styles.section}>

        <h3>Change Active Email</h3>
	 <select
  value={selectedEmail}
  onChange={(e) => {
    const tempEmail = e.target.value;
    localStorage.setItem("email", tempEmail);
    setSelectedEmail(tempEmail);
  }}
  className="w-full border rounded-md px-3 py-2 bg-background"
>
  <option value="">Select your name</option>
  {uniqueMembers.map((member) => (
    <option key={`${member.Email}-${member.Group}`} value={member.Email}>
      {member.Name}
    </option>
  ))}
</select>
</section>
    </div>
  );
  }
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
