import { useState, useEffect } from "react";
import { api } from "@/api/api";
import OtpInput from "@/components/OtpInput";

type Match = {
  matchnumber: number;
  home: string;
  away: string;
};

type AdminEntry = {
  name: string;
  email: string;
};

export default function AdminConsole() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [selectedWinners, setSelectedWinners] = useState<Record<number, string>>({});

  const [loadingMatches, setLoadingMatches] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [adminList, setAdminList] = useState<AdminEntry[]>([]);
  const [selectedAdminEmail, setSelectedAdminEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    verifyAdmin();
  }, []);

  const verifyAdmin = async () => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      setNeedsAuth(true);
      setIsAdmin(false);
      fetchAdminList();
      return;
    }

    try {
      const res = await api.checkAdmin();
      if (res.isAdmin) {
        setIsAdmin(true);
        setNeedsAuth(false);
      } else {
        setIsAdmin(false);
        setNeedsAuth(false);
      }
    } catch {
      setNeedsAuth(true);
      setIsAdmin(false);
      fetchAdminList();
    }
  };

  const fetchAdminList = async () => {
    try {
      const data = await api.getAdminList();
      setAdminList(data);
    } catch (err) {
      console.error("Failed to fetch admin list", err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMatches();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (otp.length === 6 && selectedAdminEmail && !authLoading) {
      handleAdminOtp();
    }
  }, [otp]);

  const handleAdminOtp = async () => {
    setAuthError(null);

    if (!selectedAdminEmail) {
      setAuthError("Please select your name.");
      return;
    }
    if (otp.length !== 6) {
      setAuthError("OTP must be 6 digits.");
      return;
    }

    setAuthLoading(true);

    try {
      await api.otp({
        email: selectedAdminEmail.trim().toLowerCase(),
        flow: "validateOTP",
        otp,
      });

      setNeedsAuth(false);
      setOtp("");
      setAuthError(null);

      const res = await api.checkAdmin();
      if (res.isAdmin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setAuthError("You are not authorized as an admin.");
      }
    } catch (err: any) {
      setAuthError(err?.message || "Invalid OTP. Please try again.");
      setOtp("");
    } finally {
      setAuthLoading(false);
    }
  };

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

  const submitResult = async (matchnumber: number) => {
    const winner = selectedWinners[matchnumber];

    if (!winner) {
      alert("Select winner");
      return;
    }

    if (!confirm(`Confirm ${winner} as winner for Match ${matchnumber}?`)) return;

    try {
      setProcessing(true);
      const res = await api.calculateMatchResult(winner, matchnumber);
      alert(`Match ${matchnumber} result processed`);
    } catch (err) {
      console.error(err);
      alert("Failed to calculate result");
    } finally {
      setProcessing(false);
    }
  };

  /* ---------- Auth Gate: Admin login with dropdown + OTP ---------- */
  if (needsAuth) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Admin Login</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Your session has expired or you are not logged in. Please authenticate to continue.
        </p>

        <div className="space-y-4 max-w-xs mx-auto">
          <select
            value={selectedAdminEmail}
            onChange={(e) => {
              setSelectedAdminEmail(e.target.value);
              setOtp("");
              setAuthError(null);
            }}
            className="w-full border rounded-md px-3 py-2 bg-background"
          >
            <option value="">Select your name</option>
            {adminList.map((admin) => (
              <option key={admin.email} value={admin.email}>
                {admin.name}
              </option>
            ))}
          </select>

          {selectedAdminEmail && (
            <OtpInput otp={otp} setOtp={setOtp} disabled={authLoading} />
          )}

          {authLoading && (
            <p className="text-xs text-muted-foreground text-center">Validating...</p>
          )}

          {authError && (
            <p className="text-xs text-destructive text-center">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return <div style={{ padding: 40 }}>Verifying Supreme Authority...</div>;
  }

  if (!isAdmin) {
    return <div style={{ padding: 40 }}>403 – You're not in the playing XI for this console</div>;
  }

  if (loadingMatches) {
    return <div style={{ padding: 40 }}>Preparing Questionable Admin Decisions...</div>;
  }

  /* ---------- Admin Dashboard ---------- */
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
            onChange={(e) => setSelectedMatch(Number(e.target.value))}
            className="w-full border rounded-md px-3 py-2 bg-background"
          >
            <option value="">Select Match</option>
            {matches.map((m) => (
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
        {matches.map((m) => (
          <div key={m.matchnumber} style={styles.row}>
            <label style={{ width: 80 }}>Match {m.matchnumber}</label>

            <select
              style={styles.dropdown}
              value={selectedWinners[m.matchnumber] || ""}
              className="w-full border rounded-md px-3 py-2 bg-background"
              onChange={(e) => {
                setSelectedWinners({
                  ...selectedWinners,
                  [m.matchnumber]: e.target.value,
                });
              }}
            >
              <option value="">Select Winner</option>
              <option value="No Result">No Result</option>
              {[m.home, m.away].map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <button
              style={styles.button}
              disabled={processing}
              className="p-3 rounded-lg border text-sm font-medium transition-all duration-200"
              onClick={() => submitResult(m.matchnumber)}
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
    fontFamily: "Arial",
  },
  title: {
    textAlign: "center" as const,
    marginBottom: 30,
  },
  section: {
    marginBottom: 40,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  dropdown: {
    padding: 6,
    minWidth: 140,
  },
  button: {
    padding: "6px 14px",
    cursor: "pointer",
  },
};
