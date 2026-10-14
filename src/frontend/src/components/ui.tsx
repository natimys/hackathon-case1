import {useEffect, type ReactNode} from "react";

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
