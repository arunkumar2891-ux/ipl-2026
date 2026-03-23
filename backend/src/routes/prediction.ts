import express from "express";
import axios from "axios";
import { supabase } from "../lib/supabase";

const router = express.Router();

router.post("/submitPrediction", async (req, res) => {
  try {
    const { email, matchNumber, selectedWinner, matchStart } = req.body;

    // 1️. Insert into Supabase
    const { data, error } = await supabase
      .from("predictions")
      .insert([
        {
          email,
          match_number: matchNumber,
          winner: selectedWinner,
          match_start: matchStart
        }
      ]);

    if (error) {
      console.error("DB Error:", error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    // 2️. Call SnapLogic (existing system)
    await axios.post(process.env.SNAPLOGIC_URL!, {
      email,
      matchNumber,
      selectedWinner,
      matchStart
    });

    res.json({
      success: true,
      message: "Prediction submitted"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

export default router;