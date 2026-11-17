/* Two-Dimensional Refraction Lab — UI wiring.
 * Live controls are kept separate from saved snapshots: saving copies the
 * parameters, so later slider movement never changes historical points.
 */
(function () {
  "use strict";

  var P = window.RefractionPhysics;
  var SVG_NS = "http://www.w3.org/2000/svg";

  // ----- State -----
  var live = { n1: 1, n2: 1.5, theta1: 30 };
  var saved = [];            // independent snapshots
  var compareSelection = []; // record ids, max 2
  var nextId = 1;
  var markerUid = 0;

  // ----- DOM -----
  function $(id) { return document.getElementById(id); }
  var els = {
    n1Slider: $("n1-slider"), n1Number: $("n1-number"), n1Error: $("n1-error"),
    n2Slider: $("n2-slider"), n2Number: $("n2-number"), n2Error: $("n2-error"),
    angleSlider: $("angle-slider"), angleNumber: $("angle-number"), angleError: $("angle-error"),
    saveBtn: $("save-point"), announce: $("live-announce"),
    diagram: $("ray-diagram"),
    resMedia: $("res-media"), resTheta1: $("res-theta1"), resS: $("res-s"),
    resTheta2: $("res-theta2"), resStatus: $("res-status"),
    criticalRow: $("critical-row"), resCritical: $("res-critical"),
    experimentList: $("experiment-list"),
    savedEmpty: $("saved-empty"), savedTable: $("saved-table"), savedTbody: $("saved-tbody"),
    exportCsv: $("export-csv"), exportJson: $("export-json"), printBtn: $("print-table"),
    exportError: $("export-error"),
    comparePanel: $("compare-panel"), compareGrid: $("compare-grid")
  };

  // ----- Formatting -----
  function fmt(value, digits) {
    return value === null || value === undefined ? null : Number(value).toFixed(digits);
  }
  function fmtAngle(value) {
    return value === null ? null : fmt(value, 2) + "°";
  }
  function statusText(record) {
    return record.tir ? "Total internal reflection" : "Refraction";
  }

  // ----- Controls -----
  function bindControl(param, slider, number, errorEl, validate, rangeText) {
    slider.addEventListener("input", function () {
      live[param] = parseFloat(slider.value);
      number.value = slider.value;
      errorEl.hidden = true;
      update();
    });
    number.addEventListener("change", function () {
      var value = parseFloat(number.value);
      if (!validate(value)) {
        errorEl.textContent = "Invalid value “" + number.value + "”. " + rangeText +
          " The previous valid value was kept.";
        errorEl.hidden = false;
        number.value = String(live[param]);
        number.focus();
        return;
      }
      errorEl.hidden = true;
      live[param] = value;
      slider.value = String(value);
      update();
    });
  }

  bindControl("n1", els.n1Slider, els.n1Number, els.n1Error, P.isValidIndex,
    "Refractive index must be between " + P.N_MIN + " and " + P.N_MAX + ".");
  bindControl("n2", els.n2Slider, els.n2Number, els.n2Error, P.isValidIndex,
    "Refractive index must be between " + P.N_MIN + " and " + P.N_MAX + ".");
  bindControl("theta1", els.angleSlider, els.angleNumber, els.angleError, P.isValidAngle,
    "Angle of incidence must be between " + P.ANGLE_MIN + " and " + P.ANGLE_MAX + " degrees.");

  // ----- SVG diagram -----
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function svgText(parent, x, y, content, attrs) {
    var t = svgEl("text", Object.assign({ x: x, y: y, "font-size": "13", fill: "#1c2733" }, attrs || {}), parent);
    t.textContent = content;
    return t;
  }

  function addMarker(defs, id, color) {
    var m = svgEl("marker", {
      id: id, viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
    }, defs);
    svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }, m);
  }

  // Arc of radius r around origin, from the normal to a ray at angleDeg from it.
  function angleArc(parent, origin, r, angleDeg, side, direction, color) {
    // side: -1 = left of normal, +1 = right; direction: -1 = up (medium 1), +1 = down (medium 2)
    var rad = angleDeg * Math.PI / 180;
    var nx = origin.x, ny = origin.y + direction * r;
    var ex = origin.x + side * r * Math.sin(rad), ey = origin.y + direction * r * Math.cos(rad);
    var sweep = (side * direction > 0) ? 0 : 1;
    svgEl("path", {
      d: "M " + nx + " " + ny + " A " + r + " " + r + " 0 0 " + sweep + " " + ex + " " + ey,
      fill: "none", stroke: color, "stroke-width": "1.5"
    }, parent);
    var mid = rad / 2;
    var lx = origin.x + side * (r + 18) * Math.sin(mid);
    var ly = origin.y + direction * (r + 18) * Math.cos(mid);
    return { x: lx, y: ly };
  }

  function renderDiagram(svg, params, result) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var uid = "m" + (++markerUid);
    var origin = { x: 220, y: 160 };
    var L = 115;
    var rad1 = params.theta1 * Math.PI / 180;

    var defs = svgEl("defs", {}, svg);
    addMarker(defs, uid + "-i", "#e65100");
    addMarker(defs, uid + "-r", "#00796b");
    addMarker(defs, uid + "-f", "#c62828");

    // Media, interface, normal
    svgEl("rect", { x: 0, y: 0, width: 440, height: 160, fill: "#e9f1fb" }, svg);
    svgEl("rect", { x: 0, y: 160, width: 440, height: 160, fill: "#eaf6ee" }, svg);
    svgEl("line", { x1: 20, y1: 160, x2: 420, y2: 160, stroke: "#37474f", "stroke-width": "2" }, svg);
    svgEl("line", {
      x1: 220, y1: 28, x2: 220, y2: 292, stroke: "#78909c",
      "stroke-width": "1", "stroke-dasharray": "6 5"
    }, svg);
    svgText(svg, 226, 45, "Normal", { "font-size": "11", fill: "#546e7a" });
    svgText(svg, 28, 34, "Medium 1: n1 = " + fmt(params.n1, 2), { "font-weight": "bold" });
    svgText(svg, 28, 306, "Medium 2: n2 = " + fmt(params.n2, 2), { "font-weight": "bold" });
    svgText(svg, 416, 34, "Interface below", { "font-size": "11", fill: "#546e7a", "text-anchor": "end" });

    // Incident ray (travels down-right toward the origin, left of the normal)
    var sx = origin.x - L * Math.sin(rad1), sy = origin.y - L * Math.cos(rad1);
    svgEl("line", {
      x1: sx, y1: sy, x2: origin.x, y2: origin.y,
      stroke: "#e65100", "stroke-width": "2.5", "marker-end": "url(#" + uid + "-i)"
    }, svg);
    var pi = angleArc(svg, origin, 42, params.theta1, -1, -1, "#e65100");
    svgText(svg, pi.x - 6, pi.y, "θ1=" + fmt(params.theta1, 1) + "°",
      { "text-anchor": "end", fill: "#e65100" });

    if (result.tir) {
      // Reflected ray: back into medium 1, right of the normal, same angle
      var fx = origin.x + L * Math.sin(rad1), fy = origin.y - L * Math.cos(rad1);
      svgEl("line", {
        x1: origin.x, y1: origin.y, x2: fx, y2: fy,
        stroke: "#c62828", "stroke-width": "2.5", "marker-end": "url(#" + uid + "-f)"
      }, svg);
      var pf = angleArc(svg, origin, 42, params.theta1, 1, -1, "#c62828");
      svgText(svg, pf.x + 6, pf.y, "θr=" + fmt(params.theta1, 1) + "°", { fill: "#c62828" });
      svgText(svg, origin.x, 18, "Total internal reflection — no refracted ray",
        { "text-anchor": "middle", "font-weight": "bold", fill: "#b3261e" });
    } else {
      // Refracted ray into medium 2, right of the normal
      var rad2 = result.theta2 * Math.PI / 180;
      var ex = origin.x + L * Math.sin(rad2), ey = origin.y + L * Math.cos(rad2);
      svgEl("line", {
        x1: origin.x, y1: origin.y, x2: ex, y2: ey,
        stroke: "#00796b", "stroke-width": "2.5", "marker-end": "url(#" + uid + "-r)"
      }, svg);
      var pr = angleArc(svg, origin, 42, result.theta2, 1, 1, "#00796b");
      svgText(svg, pr.x + 6, pr.y, "θ2=" + fmt(result.theta2, 1) + "°", { fill: "#00796b" });
    }
  }

  // ----- Live result -----
  function announce(msg) {
    els.announce.textContent = "";
    els.announce.textContent = msg;
  }

  function update() {
    var result = P.compute(live);
    els.resMedia.textContent = fmt(live.n1, 2) + " → " + fmt(live.n2, 2);
    els.resTheta1.textContent = fmtAngle(live.theta1);
    els.resS.textContent = fmt(result.s, 6);
    if (result.tir) {
      els.resTheta2.textContent = "— (no refracted ray)";
      els.resStatus.textContent = "Total internal reflection";
    } else {
      els.resTheta2.textContent = fmtAngle(result.theta2);
      els.resStatus.textContent = "Refraction";
    }
    if (result.critical !== null) {
      els.criticalRow.hidden = false;
      els.resCritical.textContent = fmtAngle(result.critical);
    } else {
      els.criticalRow.hidden = true;
      els.resCritical.textContent = "";
    }
    renderDiagram(els.diagram, live, result);
    announce(result.tir
      ? "Total internal reflection at " + fmt(live.theta1, 1) + " degrees."
      : "Angle of refraction " + fmt(result.theta2, 1) + " degrees.");
  }

  // ----- Saved points -----
  function renderSaved() {
    els.savedTbody.textContent = "";
    els.savedEmpty.hidden = saved.length > 0;
    els.savedTable.hidden = saved.length === 0;
    els.exportCsv.disabled = saved.length === 0;
    els.exportJson.disabled = saved.length === 0;
    els.printBtn.disabled = saved.length === 0;

    saved.forEach(function (rec) {
      var tr = document.createElement("tr");

      var tdCmp = document.createElement("td");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = compareSelection.indexOf(rec.id) !== -1;
      cb.setAttribute("aria-label", "Select point " + rec.id + " for comparison");
      cb.addEventListener("change", function () { toggleCompare(rec.id, cb.checked); });
      tdCmp.appendChild(cb);
      tr.appendChild(tdCmp);

      [rec.id, fmt(rec.n1, 2), fmt(rec.n2, 2), fmt(rec.theta1, 2),
       rec.tir ? "—" : fmt(rec.theta2, 2), statusText(rec),
       rec.critical === null ? "—" : fmt(rec.critical, 2)]
        .forEach(function (text) {
          var td = document.createElement("td");
          td.textContent = text;
          tr.appendChild(td);
        });

      var tdDel = document.createElement("td");
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.setAttribute("aria-label", "Delete point " + rec.id);
      del.addEventListener("click", function () {
        saved = saved.filter(function (r) { return r.id !== rec.id; });
        compareSelection = compareSelection.filter(function (id) { return id !== rec.id; });
        renderSaved();
        renderCompare();
        announce("Point " + rec.id + " deleted.");
      });
      tdDel.appendChild(del);
      tr.appendChild(tdDel);

      els.savedTbody.appendChild(tr);
    });
  }

  els.saveBtn.addEventListener("click", function () {
    var result = P.compute(live);
    var rec = {
      id: "P" + nextId++,
      n1: live.n1, n2: live.n2, theta1: live.theta1,
      theta2: result.tir ? null : result.theta2,
      tir: result.tir,
      critical: result.critical,
      savedAt: new Date().toISOString()
    };
    saved.push(rec);
    renderSaved();
    announce("Saved point " + rec.id + ".");
  });

  // ----- Compare -----
  function toggleCompare(id, checked) {
    if (checked) {
      if (compareSelection.length >= 2) compareSelection.shift();
      compareSelection.push(id);
    } else {
      compareSelection = compareSelection.filter(function (x) { return x !== id; });
    }
    renderSaved();
    renderCompare();
  }

  function renderCompare() {
    var recs = compareSelection
      .map(function (id) { return saved.find(function (r) { return r.id === id; }); })
      .filter(Boolean);
    els.comparePanel.hidden = recs.length !== 2;
    els.compareGrid.textContent = "";
    if (recs.length !== 2) return;

    recs.forEach(function (rec) {
      var card = document.createElement("div");
      card.className = "compare-card";
      var h = document.createElement("h4");
      h.textContent = "Point " + rec.id;
      card.appendChild(h);

      var svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "0 0 440 320");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Ray diagram for point " + rec.id);
      card.appendChild(svg);
      renderDiagram(svg, rec, {
        tir: rec.tir,
        theta2: rec.tir ? null : rec.theta2
      });

      var dl = document.createElement("dl");
      var rows = [
        ["n1 → n2", fmt(rec.n1, 2) + " → " + fmt(rec.n2, 2)],
        ["θ1", fmtAngle(rec.theta1)],
        ["θ2", rec.tir ? "— (no refracted ray)" : fmtAngle(rec.theta2)],
        ["Status", statusText(rec)]
      ];
      if (rec.critical !== null) rows.push(["θc", fmtAngle(rec.critical)]);
      rows.forEach(function (row) {
        var dt = document.createElement("dt");
        dt.textContent = row[0];
        var dd = document.createElement("dd");
        dd.textContent = row[1];
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      card.appendChild(dl);
      els.compareGrid.appendChild(card);
    });
  }

  // ----- Export -----
  function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doExport(kind) {
    els.exportError.hidden = true;
    if (saved.length === 0) {
      els.exportError.textContent = "Nothing to export yet — save at least one experiment point first.";
      els.exportError.hidden = false;
      return;
    }
    try {
      if (kind === "csv") {
        var header = "point,n1,n2,angle_of_incidence_deg,angle_of_refraction_deg,status,critical_angle_deg,saved_at";
        var lines = saved.map(function (rec) {
          return [
            rec.id, fmt(rec.n1, 2), fmt(rec.n2, 2), fmt(rec.theta1, 2),
            rec.tir ? "" : fmt(rec.theta2, 2),
            '"' + statusText(rec) + '"',
            rec.critical === null ? "" : fmt(rec.critical, 2),
            rec.savedAt
          ].join(",");
        });
        download("refraction-points-" + timestamp() + ".csv",
          header + "\r\n" + lines.join("\r\n") + "\r\n", "text/csv;charset=utf-8");
      } else {
        download("refraction-points-" + timestamp() + ".json",
          JSON.stringify({ exportedAt: new Date().toISOString(), records: saved }, null, 2),
          "application/json");
      }
      announce("Exported " + saved.length + " point(s) as " + kind.toUpperCase() + ".");
    } catch (err) {
      els.exportError.textContent = "Export failed: " + err.message +
        ". Your saved points are unchanged — please try again.";
      els.exportError.hidden = false;
    }
  }

  els.exportCsv.addEventListener("click", function () { doExport("csv"); });
  els.exportJson.addEventListener("click", function () { doExport("json"); });
  els.printBtn.addEventListener("click", function () { window.print(); });

  // ----- Suggested experiments -----
  function renderExperiments() {
    var list = window.SUGGESTED_EXPERIMENTS || [];
    list.forEach(function (exp) {
      var li = document.createElement("li");
      li.className = "experiment-card";
      var title = document.createElement("span");
      title.className = "exp-id";
      title.textContent = exp.id + ": n1=" + exp.n1 + ", n2=" + exp.n2 +
        ", θ1=" + exp.angle + "°";
      var q = document.createElement("p");
      q.className = "exp-question";
      q.textContent = exp.question;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Load " + exp.id;
      btn.setAttribute("aria-label", "Load experiment " + exp.id +
        ": n1 " + exp.n1 + ", n2 " + exp.n2 + ", angle " + exp.angle + " degrees");
      btn.addEventListener("click", function () {
        live.n1 = exp.n1; live.n2 = exp.n2; live.theta1 = exp.angle;
        els.n1Slider.value = els.n1Number.value = String(exp.n1);
        els.n2Slider.value = els.n2Number.value = String(exp.n2);
        els.angleSlider.value = els.angleNumber.value = String(exp.angle);
        [els.n1Error, els.n2Error, els.angleError].forEach(function (e) { e.hidden = true; });
        update();
        announce("Loaded experiment " + exp.id + ".");
      });
      li.appendChild(title);
      li.appendChild(q);
      li.appendChild(btn);
      els.experimentList.appendChild(li);
    });
  }

  // ----- Init -----
  renderExperiments();
  update();
  renderSaved();
})();
