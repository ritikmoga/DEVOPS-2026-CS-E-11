/* global $ */
$(function () {
  function loadEvents() {
    $("#request-status").text("Loading events with AJAX…");
    $.ajax({ url: "/data/events.json", dataType: "json" })
      .done(function (events) {
        const cards = events.map(function (event) {
          return `<article><strong>${event.date}</strong><h2>${event.title}</h2><p>${event.description}</p><small>${event.location}</small></article>`;
        });
        $("#event-list").html(cards.join(""));
        $("#request-status").text(`${events.length} events loaded successfully.`);
      })
      .fail(function () {
        $("#request-status").text("Could not load the event data.");
      });
  }
  $("#reload-events").on("click", loadEvents);
  loadEvents();
});
