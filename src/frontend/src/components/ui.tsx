import {useEffect, type ReactNode} from "react";

export function BrandMark({className = ""}: {className?: string}) {
    return <svg className={`brand-mark ${className}`.trim()} aria-hidden="true" viewBox="0 0 48 48" fill="none">
        <path d="M7 22 24 8l7 5V9h6v9l4 4v18H7V22Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M15 27c2.3-4.1 5.3-6.2 9-6.2s6.7 2.1 9 6.2c-2.3 4.1-5.3 6.2-9 6.2S17.3 31.1 15 27Z" stroke="currentColor" strokeWidth="2.6"/>
        <circle cx="24" cy="27" r="2.5" fill="currentColor"/>
        <path d="M8 38c5-4 10-4 15 0" stroke="#10B981" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M24 38c5-4 10-4 15 0" stroke="#3B82F6" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>;
}

export function PageActions({children}: {children: ReactNode}) {
    return <div className="page-actions">{children}</div>;
}

export function PageHeader({eyebrow, title, description, actions}: {eyebrow?: string; title: string; description?: string; actions?: ReactNode}) {
    return <header className="page-header"><div className="page-header-copy">{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <PageActions>{actions}</PageActions>}</header>;
}

export function FilterBar({children, className = ""}: {children: ReactNode; className?: string}) {
    return <div className={`filter-bar ${className}`.trim()}>{children}</div>;
}

export function SectionCard({title, description, actions, children, className = ""}: {title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string}) {
    return <section className={`section-card ${className}`.trim()}><div className="section-card-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-card-actions">{actions}</div>}</div>{children}</section>;
}

export function StatusBadge({children, tone = "neutral"}: {children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger"}) {
    return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}

export function DataTable({children, label}: {children: ReactNode; label: string}) {
    return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table>{children}</table></div>;
}

export function Dialog({title, onClose, children, className = ""}: {title: string; onClose: () => void; children: ReactNode; className?: string}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {if (event.key === "Escape") onClose();};
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);
    return <div className="dialog-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) onClose();}}><section className={`dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="active-dialog-title"><header className="dialog-heading"><h2 id="active-dialog-title">{title}</h2><button type="button" className="dialog-close" aria-label="Закрыть диалог" onClick={onClose}>×</button></header>{children}</section></div>;
}

export function EmptyState({children}: {children: ReactNode}) {
    return <div className="empty-state">{children}</div>;
}
