import { useState, useEffect } from "react";
import { members } from "@/data/members";

interface UserInfo {
  email: string | null;
  groups: string[];
  isLoggedIn: boolean;
  logout: () => void;
}

export const useLoggedInUser = (): UserInfo => {
  const [email, setEmail] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    const storedEmail = localStorage.getItem("email");

    if (!storedEmail) {
      setEmail(null);
      setGroups([]);
      return;
    }

    const detectedGroups = members
      .filter((m) => m.Email.toLowerCase() === storedEmail.toLowerCase())
      .map((m) => m.Group);

    setEmail(storedEmail);
    setGroups([...new Set(detectedGroups)]);
  }, []);

  const logout = () => {
    localStorage.removeItem("email");
    setEmail(null);
    setGroups([]);
  };

  return {
    email,
    groups,
    isLoggedIn: !!email,
    logout,
  };
};