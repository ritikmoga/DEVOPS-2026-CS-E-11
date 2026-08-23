import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import api from "./api/client";

export default function EventAdminDetail() {
  const { id } = useParams();
  const eventQuery = useQuery({
    queryKey: ["admin-event", id],
    queryFn: () => api.get(`/admin/events/${id}`).then((r) => r.data.data),
  });
  const attendanceQuery = useQuery({
    queryKey: ["event-attendance", id],
    enabled: Boolean(id),
    queryFn: () => api.get(`/admin/events/${id}/attendance`).then((r) => r.data.data),
  });
  if (eventQuery.isLoading)
    return (
      <div className="page-content">
        <div className="skeleton large" />
      </div>
    );
  const event = eventQuery.data;
  return (
    <div className="page-content">
      <Link className="back-admin" to="/dashboard/events">
        ← All events
      </Link>
      <div className="page-title">
        <div>
          <p className="kicker">EVENT DETAIL</p>
          <h1>{event?.title || "Event"}</h1>
          <p className="muted">{event?.shortDescription}</p>
        </div>
      </div>
      <div className="metrics">
        <div className="metric">
          <span>Status</span>
          <strong>{event?.status}</strong>
          <small>Lifecycle state</small>
        </div>
        <div className="metric">
          <span>Capacity</span>
          <strong>{event?.capacity}</strong>
          <small>Configured seats</small>
        </div>
        <div className="metric">
          <span>Start</span>
          <strong>{event?.startAt ? format(new Date(event.startAt), "dd MMM") : "—"}</strong>
          <small>{event?.venueName || event?.mode}</small>
        </div>
        <div className="metric">
          <span>Attendance</span>
          <strong>{attendanceQuery.data?.length ?? 0}</strong>
          <small>Attendance records</small>
        </div>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="kicker">ATTENDANCE RECORDS</p>
            <h2>Participants recorded</h2>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>PARTICIPANT</th>
              <th>CHECK IN</th>
              <th>CHECK OUT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {attendanceQuery.data?.length ? (
              attendanceQuery.data.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <div className="table-primary">
                      <span className="table-icon">
                        <CalendarDays size={15} />
                      </span>
                      <span>
                        <strong>{row.user.fullName}</strong>
                        <small>{row.registration.registrationNumber}</small>
                      </span>
                    </div>
                  </td>
                  <td>{row.checkInAt ? format(new Date(row.checkInAt), "dd MMM, HH:mm") : "—"}</td>
                  <td>
                    {row.checkOutAt ? format(new Date(row.checkOutAt), "dd MMM, HH:mm") : "—"}
                  </td>
                  <td>
                    <span className={`status ${row.status.toLowerCase()}`}>{row.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <p>No attendance records yet.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
