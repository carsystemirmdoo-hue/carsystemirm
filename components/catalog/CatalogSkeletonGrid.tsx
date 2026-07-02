export function CatalogSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="cs-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="cs-skeleton-card" key={index}>
          <span>
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}
