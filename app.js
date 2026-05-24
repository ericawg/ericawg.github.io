(() => {
  const OPEN_HOUR = 7;
  const CLOSE_HOUR = 22;
  const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const WEEKLY_LIMIT = 4;
  const STORAGE_BOOKINGS = "tennis.bookings";
  const STORAGE_ME = "tennis.me";
  const STORAGE_SEEDED = "tennis.seeded";

  let viewWeekStart = mondayOf(new Date());
  let pendingSlot = null;

  const $ = (id) => document.getElementById(id);

  function mondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function ymd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseYmd(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function slotDate(dateStr, hour) {
    const d = parseYmd(dateStr);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  function formatHour(h) {
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12} ${ampm}`;
  }

  function formatDateLong(d) {
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_BOOKINGS) || "[]");
    } catch {
      return [];
    }
  }

  function saveBookings(list) {
    localStorage.setItem(STORAGE_BOOKINGS, JSON.stringify(list));
  }

  function loadMe() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_ME) || "null");
    } catch {
      return null;
    }
  }

  function saveMe(me) {
    localStorage.setItem(STORAGE_ME, JSON.stringify(me));
  }

  function seedIfFirstVisit() {
    if (localStorage.getItem(STORAGE_SEEDED)) return;
    localStorage.setItem(STORAGE_SEEDED, "1");
    if (loadBookings().length > 0) return;
    const today = new Date();
    const monday = mondayOf(today);
    const sampleNames = [
      { name: "Alex", email: "alex@example.com" },
      { name: "Sam", email: "sam@example.com" },
      { name: "Jordan", email: "jordan@example.com" },
      { name: "Riley", email: "riley@example.com" },
    ];
    const picks = [
      [1, 18], [2, 8], [3, 19], [4, 17], [5, 9], [5, 18], [6, 10], [6, 11],
    ];
    const seeded = picks.map(([dayOffset, hour], i) => {
      const d = addDays(monday, dayOffset);
      const who = sampleNames[i % sampleNames.length];
      return {
        id: `seed-${i}`,
        date: ymd(d),
        hour,
        name: who.name,
        email: who.email,
        createdAt: Date.now(),
      };
    });
    saveBookings(seeded);
  }

  function hoursThisWeekFor(email, weekStart) {
    const start = weekStart.getTime();
    const end = addDays(weekStart, 7).getTime();
    return loadBookings().filter((b) => {
      if (b.email.toLowerCase() !== email.toLowerCase()) return false;
      const t = slotDate(b.date, b.hour).getTime();
      return t >= start && t < end;
    }).length;
  }

  function renderHeader() {
    const me = loadMe();
    const chip = $("me-chip");
    if (me) {
      chip.hidden = false;
      $("me-name").textContent = me.name;
    } else {
      chip.hidden = true;
    }
  }

  function renderStatus() {
    const status = $("status");
    const now = new Date();
    const todayStr = ymd(now);
    const currentHour = now.getHours();
    const bookings = loadBookings();
    const current = bookings.find((b) => b.date === todayStr && b.hour === currentHour);

    if (now.getHours() >= CLOSE_HOUR || now.getHours() < OPEN_HOUR) {
      status.className = "status";
      status.textContent = `Court is closed. Opens ${formatHour(OPEN_HOUR)}.`;
      return;
    }

    if (current) {
      let endHour = currentHour + 1;
      while (bookings.find((b) => b.date === todayStr && b.hour === endHour && b.email === current.email)) {
        endHour++;
      }
      status.className = "status busy";
      status.textContent = `Right now: ${current.name} is playing until ${formatHour(endHour)}.`;
    } else {
      let nextBooked = null;
      for (let h = currentHour + 1; h < CLOSE_HOUR; h++) {
        if (bookings.find((b) => b.date === todayStr && b.hour === h)) {
          nextBooked = h;
          break;
        }
      }
      status.className = "status";
      if (nextBooked) {
        status.textContent = `Court is free now — next booking at ${formatHour(nextBooked)}.`;
      } else {
        status.textContent = `Court is free for the rest of today.`;
      }
    }
  }

  function renderWeekLabel() {
    const end = addDays(viewWeekStart, 6);
    const opts = { month: "short", day: "numeric" };
    $("week-label").textContent = `${viewWeekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }

  function renderGrid() {
    const grid = $("grid");
    grid.innerHTML = "";
    const bookings = loadBookings();
    const me = loadMe();
    const now = new Date();
    const todayStr = ymd(now);
    const currentHour = now.getHours();

    grid.appendChild(headCell(""));
    for (let i = 0; i < 7; i++) {
      const d = addDays(viewWeekStart, i);
      const isToday = ymd(d) === todayStr;
      const cell = headCell(`${DAYS[i]} ${d.getDate()}`);
      if (isToday) cell.classList.add("today");
      grid.appendChild(cell);
    }

    for (const hour of HOURS) {
      const timeCell = document.createElement("div");
      timeCell.className = "time";
      timeCell.textContent = formatHour(hour);
      grid.appendChild(timeCell);

      for (let i = 0; i < 7; i++) {
        const d = addDays(viewWeekStart, i);
        const dateStr = ymd(d);
        const slotEl = document.createElement("button");
        slotEl.type = "button";
        slotEl.className = "slot";
        slotEl.dataset.date = dateStr;
        slotEl.dataset.hour = String(hour);

        const slotMs = slotDate(dateStr, hour).getTime();
        const isPast = slotMs + 60 * 60 * 1000 <= now.getTime();
        const booking = bookings.find((b) => b.date === dateStr && b.hour === hour);
        const isMine = me && booking && booking.email.toLowerCase() === me.email.toLowerCase();
        const isNow = dateStr === todayStr && hour === currentHour;

        if (isPast) slotEl.classList.add("past");
        if (isNow) slotEl.classList.add("now");

        if (booking) {
          if (isMine) {
            slotEl.classList.add("mine");
            slotEl.textContent = "You";
            slotEl.title = `Your booking — click to cancel`;
            slotEl.setAttribute("aria-label", `Your booking at ${formatHour(hour)} on ${DAYS[i]}. Click to cancel.`);
          } else {
            slotEl.classList.add("booked");
            slotEl.textContent = firstName(booking.name);
            slotEl.title = `Booked by ${booking.name}`;
            slotEl.setAttribute("aria-label", `Booked by ${booking.name} at ${formatHour(hour)} on ${DAYS[i]}`);
            slotEl.disabled = true;
          }
        } else {
          slotEl.textContent = isPast ? "" : "Free";
          slotEl.setAttribute("aria-label", `Free slot at ${formatHour(hour)} on ${DAYS[i]}. Click to book.`);
          if (isPast) slotEl.disabled = true;
        }

        slotEl.addEventListener("click", () => handleSlotClick(dateStr, hour));
        grid.appendChild(slotEl);
      }
    }
  }

  function headCell(text) {
    const c = document.createElement("div");
    c.className = "head";
    c.textContent = text;
    return c;
  }

  function firstName(full) {
    return (full || "").trim().split(/\s+/)[0].slice(0, 10);
  }

  function handleSlotClick(dateStr, hour) {
    const me = loadMe();
    const bookings = loadBookings();
    const booking = bookings.find((b) => b.date === dateStr && b.hour === hour);

    if (booking) {
      if (me && booking.email.toLowerCase() === me.email.toLowerCase()) {
        if (confirm(`Cancel your booking on ${formatDateLong(parseYmd(dateStr))} at ${formatHour(hour)}?`)) {
          saveBookings(bookings.filter((b) => b.id !== booking.id));
          renderAll();
        }
      }
      return;
    }

    const slotMs = slotDate(dateStr, hour).getTime();
    if (slotMs + 60 * 60 * 1000 <= Date.now()) return;

    pendingSlot = { date: dateStr, hour };
    openBookDialog();
  }

  function openBookDialog() {
    const me = loadMe();
    const dlg = $("book-dialog");
    const d = parseYmd(pendingSlot.date);
    $("book-when").textContent = `${formatDateLong(d)} · ${formatHour(pendingSlot.hour)}`;
    $("input-name").value = me ? me.name : "";
    $("input-email").value = me ? me.email : "";
    $("book-error").hidden = true;
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
      setTimeout(() => {
        const field = me ? $("book-confirm") : $("input-name");
        field.focus();
      }, 50);
    } else {
      const name = prompt("Your name");
      const email = name ? prompt("Email") : null;
      if (name && email) confirmBooking(name, email);
    }
  }

  function confirmBooking(name, email) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) {
      showBookError("Please enter a name and a valid email.");
      return false;
    }

    const weekStart = mondayOf(parseYmd(pendingSlot.date));
    const used = hoursThisWeekFor(email, weekStart);
    if (used >= WEEKLY_LIMIT) {
      showBookError(`You've already booked ${WEEKLY_LIMIT} hours that week. Cancel one to book another.`);
      return false;
    }

    const bookings = loadBookings();
    if (bookings.find((b) => b.date === pendingSlot.date && b.hour === pendingSlot.hour)) {
      showBookError("Someone just took that slot. Please pick another.");
      return false;
    }

    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    bookings.push({
      id,
      date: pendingSlot.date,
      hour: pendingSlot.hour,
      name,
      email,
      createdAt: Date.now(),
    });
    saveBookings(bookings);
    saveMe({ name, email });
    pendingSlot = null;
    renderAll();
    return true;
  }

  function showBookError(msg) {
    const err = $("book-error");
    err.textContent = msg;
    err.hidden = false;
  }

  function renderMyBookings() {
    const me = loadMe();
    const section = $("my-bookings");
    if (!me) {
      section.hidden = true;
      return;
    }
    const now = Date.now();
    const mine = loadBookings()
      .filter((b) => b.email.toLowerCase() === me.email.toLowerCase())
      .filter((b) => slotDate(b.date, b.hour).getTime() + 60 * 60 * 1000 > now)
      .sort((a, b) => slotDate(a.date, a.hour) - slotDate(b.date, b.hour));

    const list = $("my-list");
    list.innerHTML = "";
    if (mine.length === 0) {
      const li = document.createElement("li");
      li.style.color = "var(--muted)";
      li.style.fontSize = "0.9rem";
      li.textContent = "No upcoming bookings.";
      list.appendChild(li);
    } else {
      for (const b of mine) {
        const li = document.createElement("li");
        const when = document.createElement("span");
        when.textContent = `${formatDateLong(parseYmd(b.date))} · ${formatHour(b.hour)}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Cancel";
        btn.addEventListener("click", () => {
          if (confirm("Cancel this booking?")) {
            saveBookings(loadBookings().filter((x) => x.id !== b.id));
            renderAll();
          }
        });
        li.appendChild(when);
        li.appendChild(btn);
        list.appendChild(li);
      }
    }

    const used = hoursThisWeekFor(me.email, mondayOf(new Date()));
    const pct = Math.min(100, (used / WEEKLY_LIMIT) * 100);
    $("limit-text").textContent = `This week: ${used} of ${WEEKLY_LIMIT} hours used`;
    const fill = $("limit-fill");
    fill.style.width = `${pct}%`;
    fill.classList.toggle("warn", used >= WEEKLY_LIMIT - 1 && used < WEEKLY_LIMIT);
    fill.classList.toggle("full", used >= WEEKLY_LIMIT);
    section.hidden = false;
  }

  function renderAll() {
    renderHeader();
    renderStatus();
    renderWeekLabel();
    renderGrid();
    renderMyBookings();
  }

  function wireEvents() {
    $("prev-week").addEventListener("click", () => {
      viewWeekStart = addDays(viewWeekStart, -7);
      renderWeekLabel();
      renderGrid();
    });
    $("next-week").addEventListener("click", () => {
      viewWeekStart = addDays(viewWeekStart, 7);
      renderWeekLabel();
      renderGrid();
    });
    $("today-btn").addEventListener("click", () => {
      viewWeekStart = mondayOf(new Date());
      renderWeekLabel();
      renderGrid();
    });

    $("me-edit").addEventListener("click", () => {
      const me = loadMe();
      const newName = prompt("Your name", me ? me.name : "");
      if (newName === null) return;
      const newEmail = prompt("Email", me ? me.email : "");
      if (newEmail === null) return;
      if (newName.trim() && newEmail.trim().includes("@")) {
        saveMe({ name: newName.trim(), email: newEmail.trim().toLowerCase() });
        renderAll();
      }
    });

    const dlg = $("book-dialog");
    $("book-cancel").addEventListener("click", () => {
      pendingSlot = null;
      dlg.close();
    });
    $("book-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = confirmBooking($("input-name").value, $("input-email").value);
      if (ok) dlg.close();
    });
    dlg.addEventListener("close", () => {
      pendingSlot = null;
    });

    setInterval(() => {
      renderStatus();
      renderGrid();
    }, 60 * 1000);
  }

  seedIfFirstVisit();
  wireEvents();
  renderAll();
})();
