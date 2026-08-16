import { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("Loading events with jQuery AJAX…");

  // React owns the dashboard UI; jQuery performs its asynchronous data request.
  useEffect(() => {
    if (!window.jQuery) {
      setStatus("jQuery could not be loaded. Check your internet connection.");
      return;
    }
    window.jQuery.ajax({ url: "/data/events.json", dataType: "json" })
      .done((data) => {
        setEvents(data);
        setStatus("");
      })
      .fail(() => setStatus("Events are unavailable right now."));
  }, []);

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">EVENTFLOW</p>
        <h1>Find an event worth remembering.</h1>
        <p>One dashboard built with HTML, CSS, JavaScript, React, jQuery, and AJAX.</p>
        <div className="technology-tags" aria-label="Technologies used">
          <span>HTML</span><span>CSS</span><span>JavaScript</span><span>React</span><span>jQuery</span><span>AJAX</span>
        </div>
      </header>

      <section aria-labelledby="events-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">UPCOMING</p>
            <h2 id="events-heading">Featured events</h2>
          </div>
          <span>{events.length} events</span>
        </div>
        {status && <p className="status">{status}</p>}
        <div className="event-grid">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <span className="event-date">{event.date}</span>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <footer><span>{event.location}</span><button type="button">Register</button></footer>
            </article>
          ))}
        </div>
        <p className="integration-note">This dashboard is rendered by React and requests its event data with <code>jQuery.ajax()</code>.</p>
      </section>
    </main>
  );
}
