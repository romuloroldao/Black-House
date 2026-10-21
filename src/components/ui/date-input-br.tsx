import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatISODateToBR, maskDateBR, parseBRDateToISO } from "@/lib/date-format";

interface DateInputBRProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function DateInputBR({
  id,
  value,
  onChange,
  required,
  disabled,
  placeholder = "DD/MM/AAAA",
}: DateInputBRProps) {
  const [displayValue, setDisplayValue] = useState(formatISODateToBR(value));

  useEffect(() => {
    setDisplayValue(formatISODateToBR(value));
  }, [value]);

  const handleChange = (nextValue: string) => {
    const maskedValue = maskDateBR(nextValue);
    setDisplayValue(maskedValue);

    if (!maskedValue) {
      onChange("");
      return;
    }

    if (maskedValue.length === 10) {
      const isoDate = parseBRDateToISO(maskedValue);
      if (isoDate) {
        onChange(isoDate);
      }
    }
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      maxLength={10}
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
