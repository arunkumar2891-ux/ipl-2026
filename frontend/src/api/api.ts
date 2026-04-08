const API_URL = import.meta.env.VITE_API_URL || "";
//console.log(import.meta.env.VITE_API_URL);
//console.log(`API_URL: ${API_URL}`);

export const api = {

 submitPrediction: async (payload) => {
   
   const res = await fetch(`${API_URL}/api/prediction`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
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

 /*getBids: async () => {
   const res = await fetch(`${API_URL}/api/bids`);
   return res.json();
 },*/
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
   return res.json();
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

   const res = await fetch(`${API_URL}/api/admin/todayMatches`);

   if (!res.ok) {
     throw new Error("Failed to fetch today's matches");
   }

   return res.json();
 },
 
 checkAdmin: async (userEmail) => {

   const res = await fetch(`${API_URL}/api/admin/checkAdmin?email=${userEmail}`);

   if (!res.ok) {
     throw new Error("403 - Unauthorized");
   }
   
	//console.log("res: ",res);
	
   return res.json();
 },
	
 generateUnbids: async (matchnumber, userEmail) => {

   const res = await fetch(
     `${API_URL}/api/generateunbids?matchnumber=${matchnumber}&useremail=${userEmail}`
   );

   if (!res.ok) {
     throw new Error("Failed to generate unbids");
   }

   return res.json();
 },

 calculateMatchResult: async (winner, matchnumber) => {

   const res = await fetch(
     `${API_URL}/api/calculateMatchResult?winner=${winner}&matchnumber=${matchnumber}`
   );

   if (!res.ok) {
     throw new Error("Failed to calculate match result");
   }

   return res.json();
 }

};
