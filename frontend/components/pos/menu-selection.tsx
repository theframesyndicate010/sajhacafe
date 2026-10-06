import type { MenuItem } from "@/lib/api/client";

// The menu grid and the category tab row are both capped so a long menu stays
// scannable on every screen size, not just on phones.
const ITEM_LIMIT = 4;
const CATEGORY_LIMIT = 4;

type MenuSelectionProps = {
  /** `categories[0]` is the "All" tab the POS page prepends; the rest are real categories. */
  categories: string[];
  category: string;
  search: string;
  items: MenuItem[];
  showAllItems: boolean;
  showAllCategories: boolean;
  onAddItem: (item: MenuItem) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onToggleItems: () => void;
  onToggleCategories: () => void;
};

export function MenuSelection({
  categories,
  category,
  search,
  items,
  showAllItems,
  showAllCategories,
  onAddItem,
  onCategoryChange,
  onSearchChange,
  onToggleItems,
  onToggleCategories,
}: MenuSelectionProps) {
  // An active search is a deliberate hunt for one dish, so it lifts the cap
  // entirely. Otherwise only the first tiles show until "Show more" is tapped.
  const searching = search.trim().length > 0;
  const visibleItems = searching || showAllItems ? items : items.slice(0, ITEM_LIMIT);
  // Index 0 is the "All" tab, which always stays visible, so the real
  // categories begin at index 1 and the cap is one deeper than the limit.
  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, CATEGORY_LIMIT + 1);
  // Counted against the full list, not the visible slice, so the toggle keeps
  // rendering in its expanded state and can offer "Show less" again.
  const hiddenCategories = Math.max(categories.length - CATEGORY_LIMIT - 1, 0);

  return (
    <section>
      <label className="pos-search field">
        Search menu
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search food, coffee, drinks…"
        />
      </label>

      <div className="tabs" id="pos-menu-categories">
        {visibleCategories.map((name) => (
          <button
            className={`tab ${category === name ? "active" : ""}`}
            key={name}
            onClick={() => onCategoryChange(name)}
            type="button"
          >
            {name}
          </button>
        ))}
        {hiddenCategories > 0 && (
          <button
            aria-controls="pos-menu-categories"
            aria-expanded={showAllCategories}
            className="pos-show-more"
            onClick={onToggleCategories}
            type="button"
          >
            {showAllCategories ? "Show less" : `Show more (${hiddenCategories})`}
          </button>
        )}
      </div>

      {items.length ? (
        <>
          <div className="menu-grid" id="pos-menu-items">
            {visibleItems.map((item) => (
              <button className="menu-item" key={item.id} onClick={() => onAddItem(item)} type="button">
                <strong>{item.name}</strong>
                <span className="muted" style={{ display: "block", marginTop: 10 }}>
                  NPR {item.price}
                </span>
              </button>
            ))}
          </div>
          {!searching && items.length > ITEM_LIMIT && (
            <button
              aria-controls="pos-menu-items"
              aria-expanded={showAllItems}
              className="pos-show-more"
              onClick={onToggleItems}
              type="button"
            >
              {showAllItems ? "Show less" : `Show more (${items.length - ITEM_LIMIT})`}
            </button>
          )}
        </>
      ) : (
        <p className="empty">No menu items match “{search}”.</p>
      )}
    </section>
  );
}