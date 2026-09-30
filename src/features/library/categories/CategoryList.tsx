import type { CSSProperties } from "react";

import type { Category } from "@/features/library/categories/categories";
import { CategoryCard } from "@/features/library/categories/CategoryCard";

interface CategoryListProps {
  categories: Category[];
  labelOf: (name: string) => string;
}

/** Not virtualised: the list is short whatever the library size. */
export function CategoryList({ categories, labelOf }: CategoryListProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {categories.map((category, position) => (
        <CategoryCard
          key={category.name}
          category={category}
          label={labelOf(category.name)}
          style={{ "--row-stagger": `${position * 0.03}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
