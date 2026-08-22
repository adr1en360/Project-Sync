import type { ReactNode } from "react";

/**
 * A screen with no data yet.
 *
 * An empty state says what the surface holds and what to do to fill it. It is
 * not a shrug. The action, if there is one, comes as a child.
 */

type Props = {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, children, action }: Props) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children !== undefined && <p className="empty-body">{children}</p>}
      {action}
    </div>
  );
}