import { useMemo, useState, type KeyboardEvent } from "react";
import type { PriceType } from "@mangiar/shared";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ProductOption } from "./types";

interface ProductSearchComboboxProps {
  priceType: PriceType;
  onSelect: (product: ProductOption, unitPrice: number) => void;
  /** Enter con el buscador vacío (sin resultados para elegir) — ej. confirmar los productos ya agregados. */
  onConfirm?: () => void;
}

export function ProductSearchCombobox({ priceType, onSelect, onConfirm }: ProductSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ProductOption[]>>("/products");
      return data.data;
    },
  });

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return (products ?? [])
      .filter((product) => product.isActive && product.prices.some((price) => price.type === priceType))
      .filter((product) => product.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [products, query, priceType]);

  function selectMatch(product: ProductOption) {
    const price = product.prices.find((candidate) => candidate.type === priceType)!;
    onSelect(product, Number(price.price));
    setQuery("");
    setHighlightedIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (matches.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (matches.length > 0) {
        selectMatch(matches[Math.min(highlightedIndex, matches.length - 1)]);
      } else {
        onConfirm?.();
      }
    }
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar producto..."
      />
      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          {matches.map((product, index) => {
            const price = product.prices.find((candidate) => candidate.type === priceType)!;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => selectMatch(product)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50",
                  index === highlightedIndex && "bg-neutral-100",
                )}
              >
                <span className="font-medium text-neutral-900">{product.name}</span>
                <span className="text-neutral-500">{formatPrice(Number(price.price))}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
