import type { ReactNode } from "react";
import type { PortfolioCard } from "../api/types";
import { shortRepo } from "./draw";

/**
 * The face of one card.
 *
 * The gallery, the deck and the print page all draw this same face, so a person
 * sees one object in three places and not three that nearly agree.
 *
 * `foot` is what changes between the three. The gallery puts the state of the run
 * and the control of the choice there, and the deck puts nothing.
 */

type Props = {
  card: PortfolioCard;
  repoName: string;
  foot?: ReactNode;
};

export function CardFace({ card, repoName, foot }: Props) {
  return (
    <div className="face">
      <span className="face-bar" aria-hidden="true" />
      <div className="face-body">
        <p className="face-repo mono">{repoName}</p>
        <h3 className="face-title">{card.title}</h3>
        <p className="face-lede">{card.tagline}</p>

        {card.stack.length > 0 && (
          <ul className="face-stack">
            {card.stack.slice(0, 8).map((name) => (
              <li key={name} className="mono">
                {name}
              </li>
            ))}
          </ul>
        )}

        {card.highlights.length > 0 && (
          <ul className="face-points">
            {card.highlights.slice(0, 3).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        )}

        <p className="face-foot mono">{shortRepo(card.repo_url)}</p>
        {foot}
      </div>
    </div>
  );
}
