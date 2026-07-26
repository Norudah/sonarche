import type { CSSProperties } from "react";

import type { Category } from "@/features/library/categories/categories";
import { CategoryCard } from "@/features/library/categories/CategoryCard";

interface CategoryListProps {
  categories: Category[];
  labelOf: (name: string) => string;
}

/** Not virtualised for the same reason FamilyList is not: the taxonomy is a
 * handful of curated values plus whatever free tags exist — the one other
 * shelf whose length does not depend on the library's size. */
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
