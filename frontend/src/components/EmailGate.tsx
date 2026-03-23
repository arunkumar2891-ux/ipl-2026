import { useState } from "react";
import { members } from "@/data/members";
import { Input } from "@/components/ui/input";

interface Props {
  onGroupDetected: (groups: string[]) => void;
}

const EmailGate = ({ onGroupDetected }: Props) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const uniqueMembers = Array.from(
	new Map(members.map((m) => [m.Email, m])).values()
  );
  const handleSubmit = () => {
    const users = members.filter(
      (m) => m.Email.toLowerCase() === email.toLowerCase()
    );

    if (users.length === 0) {
      alert("Email not found in player list");
      return;
    }

    //const groups = users.map((u) => u.Group);
	const groups = users.map((u) => u.Group)
    localStorage.setItem("userGroups", JSON.stringify(groups));
    onGroupDetected(groups);
  };
  /*const handleSubmit = async () => {
  try {
	  console.log("In submit");
    const result = await api.getLeaderboard();
	console.log(result);
    const payload = result ?? [];

    const matched = payload.filter(
      (x: any) => x.Name.toLowerCase() === name.trim().toLowerCase()
    );

    if (matched.length === 0) {
      setError("User not found");
      return;
    }

    const groups = [...new Set(matched.map((x: any) => x.Group))];

    localStorage.setItem("userGroups", JSON.stringify(groups));

    onGroupDetected(groups);

  } catch (err) {
    setError("Something went wrong");
  }
  };*/

  return (
    <div className="max-w-md mx-auto card-surface p-6 text-center">
      <h2 className="text-lg font-semibold mb-4">
        Select your email to view
      </h2>

	  <select
	  value={email}
	  onChange={(e) => setEmail(e.target.value)}
	  className="w-full border rounded-md px-3 py-2 bg-background"
	  >
	  <option value="">Select Player</option>
	  {uniqueMembers.map((member) => (
			    <option key={`${member.Email}-${member.Group}`} value={member.Email}>
			      {member.Name}
			    </option>
			  ))}
	  </select>
      <button
        onClick={handleSubmit}
        className="bg-primary text-white px-4 py-2 rounded"
      >
        View
      </button>
    </div>
  );
};

export default EmailGate;