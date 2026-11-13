import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAddressDetails, suggestAddresses, type AddressDetails, type AddressSuggestion } from "@/utils/address.functions";

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: AddressDetails) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const suggest = useServerFn(suggestAddresses);
  const details = useServerFn(getAddressDetails);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const token = useRef<string | null>(null);
  const typed = useRef(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!typed.current || value.trim().length < 3) {
      setItems([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      token.current ??= crypto.randomUUID();
      try {
        const res = await suggest({ data: { input: value, sessionToken: token.current } });
        if (id === reqId.current) {
          setItems(res);
          setOpen(true);
          setActive(-1);
        }
      } catch {
        if (id === reqId.current) setItems([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, suggest]);

  async function pick(s: AddressSuggestion) {
    setOpen(false);
    setItems([]);
    typed.current = false;
    const sessionToken = token.current ?? crypto.randomUUID();
    token.current = null;
    try {
      onSelect(await details({ data: { placeId: s.placeId, sessionToken } }));
    } catch {
      onChange(s.text);
    }
  }

  return (
    <div className="relative">
      <Input
        value={value}
        required={required}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); void pick(items[active]!); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && items.length > 0 && (
        <ul role="listbox" className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {items.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); void pick(s); }}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{s.text}</span>
            </li>
          ))}
          <li className="px-3 py-1 text-right text-[10px] text-muted-foreground">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
