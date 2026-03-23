import { members } from "../data/members.js";

const tripleUsers = [
  "vinay.baskie@gmail.com",
  "kishorezum07@gmail.com"
];

export function getMemberDetails(email) {

  const member = members.find(
    m => m.Email.toLowerCase() === email.toLowerCase()
  );

  if (!member) {
    throw new Error("Member not registered");
  }

  const bgroup = member.Group;
  const amount = member.Amount;

  const bid = tripleUsers.includes(email.toLowerCase())
    ? amount * 3
    : amount;

  return { bgroup, bid };
}