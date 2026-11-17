/*
 * Ideal planar-interface refraction model.
 * Implements the Snell relationship exactly as specified in the lab sheet
 * (inputs/lab_sheet.md), including the 1e-10 floating-point tolerance at the
 * comparison boundary. No intensity, polarization, or real ray tracing.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RefractionPhysics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TOLERANCE = 1e-10;
  var N_MIN = 1;
  var N_MAX = 2.5;
  var ANGLE_MIN = 0;
  var ANGLE_MAX = 89.9;

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function toDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function isValidIndex(n) {
    return typeof n === "number" && isFinite(n) && n >= N_MIN && n <= N_MAX;
  }

  function isValidAngle(a) {
    return typeof a === "number" && isFinite(a) && a >= ANGLE_MIN && a <= ANGLE_MAX;
  }

  /*
   * compute({ n1, n2, theta1 }) -> result
   * result = {
   *   s: number,                 // n1*sin(theta1)/n2
   *   tir: boolean,              // total internal reflection
   *   theta2: number|null,       // refraction angle in degrees, null during TIR
   *   critical: number|null,     // critical angle in degrees, only when n1 > n2
   *   reflection: number|null    // reflected-ray angle in degrees during TIR
   * }
   */
  function compute(params) {
    var n1 = params.n1;
    var n2 = params.n2;
    var theta1 = params.theta1;
    if (!isValidIndex(n1) || !isValidIndex(n2) || !isValidAngle(theta1)) {
      throw new RangeError(
        "Parameters out of range: n1,n2 must be " + N_MIN + "–" + N_MAX +
        " and the angle of incidence must be " + ANGLE_MIN + "–" + ANGLE_MAX + " degrees."
      );
    }

    var s = (n1 * Math.sin(toRad(theta1))) / n2;
    var critical = n1 > n2 ? toDeg(Math.asin(n2 / n1)) : null;
    var tir;
    var theta2;

    if (s > 1 + TOLERANCE) {
      // Total internal reflection: no angle of refraction.
      tir = true;
      theta2 = null;
    } else if (s > 1) {
      // Within the floating-point tolerance of the critical point:
      // use the critical value 1, giving a refraction angle of exactly 90 degrees.
      tir = false;
      theta2 = 90;
    } else {
      tir = false;
      theta2 = toDeg(Math.asin(s));
    }

    return {
      s: s,
      tir: tir,
      theta2: theta2,
      critical: critical,
      reflection: tir ? theta1 : null
    };
  }

  return {
    TOLERANCE: TOLERANCE,
    N_MIN: N_MIN,
    N_MAX: N_MAX,
    ANGLE_MIN: ANGLE_MIN,
    ANGLE_MAX: ANGLE_MAX,
    isValidIndex: isValidIndex,
    isValidAngle: isValidAngle,
    compute: compute
  };
});
