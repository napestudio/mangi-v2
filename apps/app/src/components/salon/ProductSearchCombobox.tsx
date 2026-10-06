import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiClient, type ApiEnvelope } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency";
import type { ProductOption } from "./types";

interface ProductSearchComboboxProps {
  onSelect: (product: ProductOption, unitPrice: number) => void;
}

export function ProductSearchCombobox({ onSelect }: ProductSearchComboboxProps) {
  const [query, setQuery] = useState("");

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
      .filter((product) => product.isActive && product.prices.some((price) => price.type === "DINE_IN"))
      .filter((product) => product.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [products, query]);

  return (
    <div className="relative">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto..." />
      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          {matches.map((product) => {
            const price = product.prices.find((candidate) => candidate.type === "DINE_IN")!;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  onSelect(product, Number(price.price));
                  setQuery("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-900">{product.name}</span>
                <span className="text-neutral-500">{formatCurrency(Number(price.price))}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
