import type { MenuItem } from "@/lib/api/client";

type MenuSelectionProps = {
  categories: string[];
  category: string;
  search: string;
  items: MenuItem[];
  mobileShowMore: boolean;
  showAllMobileItems: boolean;
  onAddItem: (item: MenuItem) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onToggleMobileItems: () => void;
};

export function MenuSelection({
  categories,
  category,
  search,
  items,
  mobileShowMore,
  showAllMobileItems,
  onAddItem,
  onCategoryChange,
  onSearchChange,
  onToggleMobileItems,
}: MenuSelectionProps) {
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

      <div className="tabs">
        {categories.map((name) => (
          <button
            className={`tab ${category === name ? "active" : ""}`}
            key={name}
            onClick={() => onCategoryChange(name)}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>

      {items.length ? (
        <>
          <div className={`menu-grid ${showAllMobileItems ? "show-all-mobile" : ""}`} id="pos-menu-items">
            {items.map((item) => (
              <button className="menu-item" key={item.id} onClick={() => onAddItem(item)} type="button">
                <strong>{item.name}</strong>
                <span className="muted" style={{ display: "block", marginTop: 10 }}>
                  NPR {item.price}
                </span>
              </button>
            ))}
          </div>
          {mobileShowMore && items.length > 4 && <button
            aria-controls="pos-menu-items"
            aria-expanded={showAllMobileItems}
            className="pos-show-more"
            onClick={onToggleMobileItems}
            type="button"
          >
            {showAllMobileItems ? "Show less" : `Show more (${items.length - 4})`}
          </button>}
        </>
      ) : (
        <p className="empty">No menu items match “{search}”.</p>
      )}
    </section>
  );
}
