import { useEffect } from 'react';
import { AppHeader } from './AppHeader.tsx';
import { de } from './i18n/de.ts';
import { MAP_PATH } from './routes.ts';
import { ALL_STATUSES, statusName } from './traffic.ts';

const SOURCES: { key: keyof typeof de.info.sources; url: string }[] = [
  { key: 'measurements', url: 'https://opentransportdata.swiss/de/dataset/trafficcounters' },
  { key: 'definition', url: 'https://www.bfs.admin.ch/asset/de/8288664' },
  { key: 'tmc', url: 'https://data.opentransportdata.swiss/dataset/rds-tmc' },
  { key: 'sensors', url: 'https://www.arcgis.com/apps/dashboards/1673b262537546098589ad3820e5ece2' },
  { key: 'basemap', url: 'https://www.swisstopo.admin.ch/de/web-maps-base-map' },
];

export function InfoPage() {
  useEffect(() => {
    document.title = de.info.documentTitle;
    // Der Browser springt beim Laden zur Sprungmarke, bevor React den Abschnitt gerendert hat.
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    <div className="app">
      <AppHeader link={{ href: MAP_PATH, label: de.nav.toMap }} />
      <main className="info">
        <div className="container container--narrow">
          <h1>{de.info.title}</h1>
          <p className="info__lead">{de.info.intro}</p>

          <section aria-labelledby="info-what">
            <h2 id="info-what">{de.info.whatHeading}</h2>
            {de.info.what.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </section>

          <section id="lage" aria-labelledby="info-status">
            <h2 id="info-status">{de.info.statusHeading}</h2>
            <p>{de.info.statusIntro}</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">{de.info.statusColumn}</th>
                  <th scope="col">{de.info.meaningColumn}</th>
                </tr>
              </thead>
              <tbody>
                {ALL_STATUSES.map((status) => (
                  <tr key={status}>
                    <th scope="row">
                      <span className="status-badge">
                        <span className={`dot dot--${status}`} aria-hidden="true" />
                        {statusName(status)}
                      </span>
                    </th>
                    <td>{de.info.statusMeaning[status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="legend-note">
              <span className="dot dot--partial" aria-hidden="true" />
              {de.info.partial}
            </p>

            <h3>{de.info.rulesHeading}</h3>
            <ul>
              {de.info.rules.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="info-limits">
            <h2 id="info-limits">{de.info.limitsHeading}</h2>
            <ul>
              {de.info.limits.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="info-sources">
            <h2 id="info-sources">{de.info.sourcesHeading}</h2>
            <ul>
              {SOURCES.map(({ key, url }) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {de.info.sources[key]}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <p>
            <a className="button button--outline" href={MAP_PATH}>
              {de.nav.toMap}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
