import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/api/api";
import { validateEmail } from "@/lib/utils";
import OtpInput from "@/components/OtpInput";
import { useQueryClient } from "@tanstack/react-query";
import { members } from "@/data/members";

interface PredictionFormProps {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  disabled: boolean;
}

interface OtpInputProps {
  otp: string;
  setOtp: (value: string) => void;
  disabled?: boolean;
}

const PredictionForm = ({ matchId, homeTeam, awayTeam, disabled }: PredictionFormProps) => {
  const queryClient = useQueryClient();
  //const [email, setEmail] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpValidated, setOtpValidated] = useState(false);
  const uniqueMembers = Array.from(
	new Map(members.map((m) => [m.Email, m])).values()
  ).sort((a, b) => a.Email.localeCompare(b.Email));
  
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teams = [homeTeam, awayTeam];
  useEffect(() => {
	if (otp.length === 6 && !otpValidated) {
		handleValidateOtp();
	}
  }, [otp]);
  const handleValidateOtp = async () => {
	  //console.log("validateOTP triggered", { email, otp });
    setError(null);

    /*if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }*/
   //console.log("validateEmail result:", validateEmail(email.trim()));
    /*if (!validateEmail(email.trim())) {
      setError("Email not registered.");
      return;
    }*/
	if (!selectedEmail) {
      setError("Please select your name.");
      return;
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }

    setLoading(true);
	
    try {
	  //console.log("api object:", api);
	  await api.otp({
        email: selectedEmail.trim().toLowerCase(),//email.trim().toLowerCase(),
        flow: "validateOTP",
        otp: otp
      });

      setOtpValidated(true);

    } catch {
      setError("Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!otpValidated) {
      setError("Please validate OTP first.");
      return;
    }

    if (!selectedTeam) {
      setError("Please select a team.");
      return;
    }

    setLoading(true);

    try {
	  //const userGroups = members.filter((m) => m.Email === selectedEmail).map((m) => m.Group);
	  const userGroups = [
		...new Set(members.filter((m) => m.Email === selectedEmail).map((m) => m.Group)),
	  ];
	  
      /*const result = await api.submitPrediction({
        email: selectedEmail.toLowerCase(), //email.trim().toLowerCase(),
        matchNumber: matchId,
		matchStartUtc: matchStart,
        selectedTeam
      });*/
	  const teamMember = members.find(
		(m) => m.Email.toLowerCase() === selectedEmail.toLowerCase()
	  );

	  const selectedName = teamMember?.Name || "Player";
	  
	  /*console.log("Name", selectedName);
	  console.log("email", selectedEmail);
	  console.log("userGroups", userGroups);
	  console.log("email", selectedEmail);
	  console.log("matchId", matchId);
	  console.log("selectedTeam", selectedTeam);*/
    localStorage.setItem("email", selectedEmail.toLowerCase());
    //console.log("email", localStorage.getItem("email"));
	const result = await Promise.all(
	  userGroups.map((group) => {
		//console.log("Submitting prediction for group:", group);

		return api.submitPrediction({
		  email: selectedEmail.toLowerCase(),
		  group,
		  name: selectedName,
		  matchNumber: matchId,
		  selectedTeam,
		});
	  })
	);	  
	  /*queryClient.invalidateQueries({
 		queryKey: ["leaderboard"]
	  });*/
	  const failed = result.find((r) => !r.success);

		if (failed) {
		  throw new Error(failed.message || "Prediction failed");
		}

		await queryClient.refetchQueries({
		  queryKey: ["bids"]
		});
	  setResponse(result);
      setSubmitted(true);

    } catch (err: any) {
	  console.error("Prediction error:", err);
	  setError(err?.response?.data?.error || "Failed to submit.");
	} finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {submitted ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm text-accent font-medium mb-1">
            ✅ Prediction Submitted!
          </p>
			{response && (
			  <pre className="text-xs font-mono-data text-muted-foreground overflow-auto max-h-24">
				{response.map((r: any) => r.response)[0]}
			  </pre>
			)}
        </div>
      ) : (
        <>
          {/* EMAIL */}
          <select
			  value={selectedEmail}
			  disabled={disabled || otpValidated}
			  onChange={(e) => setSelectedEmail(e.target.value)}
			  className="w-full border rounded-md px-3 py-2 bg-background"
			>
			  <option value="">Select your name</option>
			  {uniqueMembers.map((member) => (
			    <option key={`${member.Email}-${member.Group}`} value={member.Email}>
			      {member.Name}
			    </option>
			  ))}
		  </select>

         {selectedEmail && (
  <>
          {/* OTP INPUT */}
          <OtpInput
			otp={otp}
			setOtp={setOtp}
			disabled={!selectedEmail || otpValidated}
		  />
		  </>
)}

          {otpValidated && (
            <p className="text-xs text-green-500">✅ OTP validated. You may place your bid.</p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
		
		  {otpValidated && (
  <>
    {/* TEAM SELECTION */}
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Select your prediction
      </p>

      <div className="grid grid-cols-2 gap-3">
        {teams.map((team) => (
          <button
            key={team}
            type="button"
            disabled={disabled}
            onClick={() => setSelectedTeam(team)}
            className={`p-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
              selectedTeam === team
                ? "border-primary bg-primary/10 text-foreground glow-primary"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {team}
          </button>
        ))}
      </div>
    </div>

    {/* SUBMIT */}
    <Button
      onClick={handleSubmit}
      disabled={disabled || loading || !selectedTeam}
      className="w-full glow-primary"
    >
      {loading
        ? "Submitting..."
        : disabled
        ? "⛔ Submissions Closed"
        : "Submit Prediction"}
    </Button>
  </>
)}
        </>
      )}
    </div>
  );
};

export default PredictionForm;
