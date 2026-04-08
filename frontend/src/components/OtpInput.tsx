import { useRef } from "react";
import { Input } from "@/components/ui/input";

interface OtpInputProps {
  otp: string;
  setOtp: (value: string) => void;
  disabled?: boolean;
}

const OtpInput = ({ otp, setOtp, disabled }: OtpInputProps) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = otp.split("");
    newOtp[index] = value;

    const joined = newOtp.join("");
    setOtp(joined);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };
  /*const handleChange = (value: string, index: number) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) return;

  const newOtp = otp.split("");

  if (digits.length > 1) {
    digits.split("").forEach((d, i) => {
      if (index + i < 6) {
        newOtp[index + i] = d;
      }
    });

    setOtp(newOtp.join(""));
    inputs.current[Math.min(index + digits.length, 5)]?.focus();
    return;
  }

  newOtp[index] = digits;
  setOtp(newOtp.join(""));

  if (index < 5) {
    inputs.current[index + 1]?.focus();
  }
};*/

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    setOtp(pasted);

    pasted.split("").forEach((digit, i) => {
      if (inputs.current[i]) {
        inputs.current[i]!.value = digit;
      }
    });

    const nextIndex = pasted.length < 6 ? pasted.length : 5;
    inputs.current[nextIndex]?.focus();
  };
  
  /*const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();

  const pastedData = e.clipboardData.getData("text");
  const digits = pastedData.replace(/\D/g, "").slice(0, 6);

  if (!digits) return;

  const otpArray = digits.split("");

  setOtp(digits);

  otpArray.forEach((digit, index) => {
    const input = inputs.current[index];
    if (input) {
      input.value = digit;
    }
  });

  const focusIndex = Math.min(digits.length - 1, 5);
  inputs.current[focusIndex]?.focus();
};*/

  return (
   <div className="flex gap-2 justify-center w-full max-w-xs mx-auto">
  {[...Array(6)].map((_, i) => (
    <Input
      key={i}
      type="password"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={1}
      disabled={disabled}
      ref={(el) => (inputs.current[i] = el)}
      value={otp[i] || ""}
      onChange={(e) => handleChange(e.target.value, i)}
      onKeyDown={(e) => handleKeyDown(e, i)}
      onPaste={handlePaste}
      className="flex-1 aspect-square max-w-[50px] text-center text-lg font-semibold bg-secondary/30 border-border focus:border-primary focus:ring-1 focus:ring-primary"
    />
  ))}
</div>
  );
};

export default OtpInput;
