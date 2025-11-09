interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, isCollapsed, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className={isCollapsed ? 'collapsed' : ''}>
      <h2 onClick={onToggle}>
        {title}
        <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
      </h2>
      {!isCollapsed && <div className="section-content">{children}</div>}
    </section>
  );
}
