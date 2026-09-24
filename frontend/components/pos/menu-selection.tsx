import type { MenuItem } from "@/lib/api/client";

type MenuSelectionProps = {
  categories: string[];
  category: string;
  search: string;
  items: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
};

export function MenuSelection({
  categories,
  category,
  search,
  items,
  onAddItem,
  onCategoryChange,
  onSearchChange,
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
        <div className="menu-grid">
          {items.map((item) => (
            <button className="menu-item" key={item.id} onClick={() => onAddItem(item)} type="button">
              <strong>{item.name}</strong>
              <span className="muted" style={{ display: "block", marginTop: 10 }}>
                NPR {item.price}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty">No menu items match “{search}”.</p>
      )}
    </section>
  );
}
