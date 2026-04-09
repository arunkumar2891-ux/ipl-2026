const API_URL = import.meta.env.VITE_API_URL || "";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {

 submitPrediction: async (payload) => {
   
   const res = await fetch(`${API_URL}/api/prediction`, {
     method: "POST",
     headers: getAuthHeaders(),
     body: JSON.stringify(payload)
   });

   return res.json();
 },

 getLeaderboard: async () => {
   const res = await fetch(`${API_URL}/api/leaderboard`);
   return res.json();
 },

 getLeaderboardForm: async () => {
   const res = await fetch(`${API_URL}/api/leaderboard/form`);
   return res.json();
 },

 getBids: async (activeUser) => {
   const q = encodeURIComponent(activeUser ?? "");
   const res = await fetch(`${API_URL}/api/bids?email=${q}`);
   const body = await res.json();
   if (!res.ok) {
     throw new Error(
       typeof body?.error === "string" ? body.error : "Failed to fetch bids"
     );
   }
   return Array.isArray(body) ? body : [];
 },

 otp: async (payload) => {
   const res = await fetch(`${API_URL}/api/otp`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(payload)
   });
	if (res.status !== 200) {
    throw new Error("OTP validation failed");
  }
   const data = await res.json();
   if (data.token) {
     localStorage.setItem("auth_token", data.token);
   }
   return data;
 },
 
 /* ---------------- FIXTURE APIS ---------------- */

 getTodaysFixtures: async () => {
   const res = await fetch(`${API_URL}/api/fixtures/today`);
   if (!res.ok) {
     throw new Error("Failed to fetch today's fixtures");
   }
   return res.json();
 },

 /* ---------------- ADMIN APIS ---------------- */

 getTodayMatches: async () => {

   const res = await fetch(`${API_URL}/api/admin/todayMatches`, {
     headers: getAuthHeaders(),
   });

   if (!res.ok) {
     throw new Error("Failed to fetch today's matches");
   }

   return res.json();
 },
 
 checkAdmin: async () => {

   const res = await fetch(`${API_URL}/api/admin/checkAdmin`, {
     headers: getAuthHeaders(),
   });

   if (!res.ok) {
     throw new Error("403 - Unauthorized");
   }
   
   return res.json();
 },
	
 generateUnbids: async (matchnumber) => {

   const res = await fetch(`${API_URL}/api/generateunbids`, {
     method: "POST",
     headers: getAuthHeaders(),
     body: JSON.stringify({ matchnumber }),
   });

   if (!res.ok) {
     throw new Error("Failed to generate unbids");
   }

   return res.json();
 },

 calculateMatchResult: async (winner, matchnumber) => {

   const res = await fetch(`${API_URL}/api/calculateMatchResult`, {
     method: "POST",
     headers: getAuthHeaders(),
     body: JSON.stringify({ winner, matchnumber }),
   });

   if (!res.ok) {
     throw new Error("Failed to calculate match result");
   }

   return res.json();
 }

};
