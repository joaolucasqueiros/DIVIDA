import type { InputHTMLAttributes } from "react";
import { cents } from "../../shared/finance";
const format = (value: string) =>
  (cents(value) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function MoneyInput({
  defaultValue = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  let initial = String(defaultValue);
  if (initial) {
    try {
      initial = format(initial);
    } catch {
      /* Keep invalid input visible for correction. */
    }
  }
  return (
    <span className="money-input">
      <span aria-hidden="true">R$</span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        defaultValue={initial}
        onFocus={(e) => e.currentTarget.select()}
        onInput={(e) => e.currentTarget.setCustomValidity("")}
        onBlur={(e) => {
          const input = e.currentTarget;
          if (!input.value.trim()) return;
          try {
            input.value = format(input.value);
            input.setCustomValidity("");
          } catch {
            input.setCustomValidity(
              "Informe um valor válido, como 1.234,56 ou 1234.56.",
            );
          }
        }}
      />
    </span>
  );
}
