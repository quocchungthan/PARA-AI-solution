import { competitors } from "./data/competitors";

export function Competitors() {
  return (
    <section className="competitors" aria-labelledby="competitors-title">
      <h2 id="competitors-title">Competitors</h2>
      <p className="sub">Explore other agent-team and kanban orchestrators. Available even while the Bridge is offline.</p>
      <ul className="competitorList">
        {competitors.map(({ githubUrl, description }) => (
          <li key={githubUrl} className="competitorCard">
            <h3><a href={githubUrl}>{githubUrl.replace("https://github.com/", "")}</a></h3>
            <p>{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
