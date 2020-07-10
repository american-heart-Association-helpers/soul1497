(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Decimal_BE = factory());
}(this, function () { 'use strict';

  var padEnd = function (string, maxLength, fillString) {

    if (string == null || maxLength == null) {
      return string;
    }

    var result    = String(string);
    var targetLen = typeof maxLength === 'number'
      ? maxLength
      : parseInt(maxLength, 10);

    if (isNaN(targetLen) || !isFinite(targetLen)) {
      return result;
    }


    var length = result.length;
    if (length >= targetLen) {
      return result;
    }


    var filled = fillString == null ? '' : String(fillString);
    if (filled === '') {
      filled = ' ';
    }


    var fillLen = targetLen - length;

    while (filled.length < fillLen) {
      filled += filled;
    }

    var truncated = filled.length > fillLen ? filled.substr(0, fillLen) : filled;

    return result + truncated;
  };

  var MAX_SIGNIFICANT_DIGITS = 17; // Highest value you can safely put here is Number.MAX_SAFE_INTEGER-MAX_SIGNIFICANT_DIGITS

  var EXP_LIMIT = 9e15; // If we're ABOVE this value, increase a layer. (9e15 is close to the largest integer that can fit in a Number.)
  
  var LAYER_DOWN = Math.log10(9e15); //If we're BELOW this value, drop down a layer. About 15.954.

  var NUMBER_EXP_MAX = 308; // The smallest exponent that can appear in a Number, though not all mantissas are valid here.

  var NUMBER_EXP_MIN = -324;
  
  var MAX_ES_IN_A_ROW = 5;

  var powerOf10 = function () {
    // We need this lookup table because Math.pow(10, exponent)
    // when exponent's absolute value is large is slightly inaccurate.
    // You can fix it with the power of math... or just make a lookup table.
    // Faster AND simpler
    var powersOf10 = [];

    for (var i = NUMBER_EXP_MIN + 1; i <= NUMBER_EXP_MAX; i++) {
      powersOf10.push(Number("1e" + i));
    }

    var indexOf0InPowersOf10 = 323;
    return function (power) {
      return powersOf10[power + indexOf0InPowersOf10];
    };
  }();

  var D = function D(value) {
    return Decimal_BE.fromValue_noAlloc(value);
  };

  var FC = function FC(sign, layer, mag) {
    return Decimal_BE.fromComponents(sign, layer, mag);
  };

  var FC_NN = function FC_NN(sign, layer, mag) {
    return Decimal_BE.fromComponents_noNormalize(sign, layer, mag);
  };
  
  var Decimal_BEPlaces = function Decimal_BEPlaces(value, places) {
    var len = places + 1;
    var numDigits = Math.ceil(Math.log10(Math.abs(value)));
    var rounded = Math.round(value * Math.pow(10, len - numDigits)) * Math.pow(10, numDigits - len);
    return parseFloat(rounded.toFixed(Math.max(len - numDigits, 0)));
  };
  
  var f_gamma = function(n) {
    if (!isFinite(n)) { return n; }
    if (n < -50)
    {
      if (n == Math.trunc(n)) { return Number.NEGATIVE_INFINITY; }
      return 0;
    }
    
    var scal1 = 1;
    while (n < 10)
    {
      scal1 = scal1*n;
      ++n;
    }
    
    n -= 1;
    var l = 0.9189385332046727; //0.5*Math.log(2*Math.PI)
    l = l + (n+0.5)*Math.log(n);
    l = l - n;
    var n2 = n*n;
    var np = n;
    l = l+1/(12*np);
    np = np*n2;
    l = l+1/(360*np);
    np = np*n2;
    l = l+1/(1260*np);
    np = np*n2;
    l = l+1/(1680*np);
    np = np*n2;
    l = l+1/(1188*np);
    np = np*n2;
    l = l+691/(360360*np);
    np = np*n2;
    l = l+7/(1092*np);
    np = np*n2;
    l = l+3617/(122400*np);

    return Math.exp(l)/scal1;
  };
  
  var Decimal_BE =
  /** @class */
  function () {
  
    function Decimal_BE(value) {
      
      this.sign = Number.NaN;
      this.layer = Number.NaN;
      this.mag = Number.NaN;

      if (value instanceof Decimal_BE) {
        this.fromDecimal_BE(value);
      } else if (typeof value === "number") {
        this.fromNumber(value);
      } else if (typeof value === "string") {
        this.fromString(value);
      } else {
        this.sign = 0;
        this.layer = 0;
        this.mag = 0;
      }
    }

    Object.defineProperty(Decimal_BE.prototype, "m", {
      get: function get() {
        if (this.sign === 0)
        {
          return 0;
        }
        else if (this.layer === 0)
        {
          var exp = Math.floor(Math.log10(this.mag));
          var man = this.mag / powerOf10(exp);
          return this.sign*man;
        }
        else if (this.layer === 1)
        {
          var residue = this.mag-Math.floor(this.mag);
          return this.sign*Math.pow(10, residue);
        }
        else
        {
          //mantissa stops being relevant past 1e9e15 / ee15.954
          return this.sign;
        }
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Decimal_BE.prototype, "e", {
      get: function get() {
        if (this.sign === 0)
        {
          return 0;
        }
        else if (this.layer === 0)
        {
          return Math.floor(Math.log10(this.mag));
        }
        else if (this.layer === 1)
        {
          return Math.floor(this.mag);
        }
        else if (this.layer === 2)
        {
          return Math.floor(Math.pow(10, this.mag));
        }
        else
        {
          return Number.POSITIVE_INFINITY;
        }
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Decimal_BE.prototype, "s", {
      get: function get() {
        return this.sign;
      },
      set: function set(value) {
        if (value === 0) {
          this.sign = 0;
          this.layer = 0;
          this.mag = 0;
        }
        else
        {
          this.sign = value;
        }
      },
      enumerable: true,
      configurable: true
    });

    Decimal_BE.fromComponents = function (sign, layer, mag) {
      return new Decimal_BE().fromComponents(sign, layer, mag);
    };

    Decimal_BE.fromComponents_noNormalize = function (sign, layer, mag) {
      return new Decimal_BE().fromComponents_noNormalize(sign, layer, mag);
    };
    
    Decimal_BE.fromDecimal_BE = function (value) {
      return new Decimal_BE().fromDecimal_BE(value);
    };

    Decimal_BE.fromNumber = function (value) {
      return new Decimal_BE().fromNumber(value);
    };

    Decimal_BE.fromString = function (value) {
      return new Decimal_BE().fromString(value);
    };

    Decimal_BE.fromValue = function (value) {
      return new Decimal_BE().fromValue(value);
    };

    Decimal_BE.fromValue_noAlloc = function (value) {
      return value instanceof Decimal_BE ? value : new Decimal_BE(value);
    };
    
    Decimal_BE.abs = function (value) {
      return D(value).abs();
    };

    Decimal_BE.neg = function (value) {
      return D(value).neg();
    };

    Decimal_BE.negate = function (value) {
      return D(value).neg();
    };

    Decimal_BE.negated = function (value) {
      return D(value).neg();
    };

    Decimal_BE.sign = function (value) {
      return D(value).sign();
    };

    Decimal_BE.sgn = function (value) {
      return D(value).sign();
    };

    Decimal_BE.round = function (value) {
      return D(value).round();
    };

    Decimal_BE.floor = function (value) {
      return D(value).floor();
    };

    Decimal_BE.ceil = function (value) {
      return D(value).ceil();
    };

    Decimal_BE.trunc = function (value) {
      return D(value).trunc();
    };

    Decimal_BE.add = function (value, other) {
      return D(value).add(other);
    };

    Decimal_BE.plus = function (value, other) {
      return D(value).add(other);
    };

    Decimal_BE.sub = function (value, other) {
      return D(value).sub(other);
    };

    Decimal_BE.subtract = function (value, other) {
      return D(value).sub(other);
    };

    Decimal_BE.minus = function (value, other) {
      return D(value).sub(other);
    };

    Decimal_BE.mul = function (value, other) {
      return D(value).mul(other);
    };

    Decimal_BE.multiply = function (value, other) {
      return D(value).mul(other);
    };

    Decimal_BE.times = function (value, other) {
      return D(value).mul(other);
    };

    Decimal_BE.div = function (value, other) {
      return D(value).div(other);
    };

    Decimal_BE.divide = function (value, other) {
      return D(value).div(other);
    };

    Decimal_BE.recip = function (value) {
      return D(value).recip();
    };

    Decimal_BE.reciprocal = function (value) {
      return D(value).recip();
    };

    Decimal_BE.reciprocate = function (value) {
      return D(value).reciprocate();
    };

    Decimal_BE.cmp = function (value, other) {
      return D(value).cmp(other);
    };

	Decimal_BE.cmpabs = function (value, other) {
      return D(value).cmpabs(other);
    };
	
    Decimal_BE.compare = function (value, other) {
      return D(value).cmp(other);
    };

    Decimal_BE.eq = function (value, other) {
      return D(value).eq(other);
    };

    Decimal_BE.equals = function (value, other) {
      return D(value).eq(other);
    };

    Decimal_BE.neq = function (value, other) {
      return D(value).neq(other);
    };

    Decimal_BE.notEquals = function (value, other) {
      return D(value).notEquals(other);
    };

    Decimal_BE.lt = function (value, other) {
      return D(value).lt(other);
    };

    Decimal_BE.lte = function (value, other) {
      return D(value).lte(other);
    };

    Decimal_BE.gt = function (value, other) {
      return D(value).gt(other);
    };

    Decimal_BE.gte = function (value, other) {
      return D(value).gte(other);
    };

    Decimal_BE.max = function (value, other) {
      return D(value).max(other);
    };
    
    Decimal_BE.min = function (value, other) {
      return D(value).min(other);
    };

    Decimal_BE.minabs = function (value, other) {
      return D(value).minabs(other);
    };
	
    Decimal_BE.maxabs = function (value, other) {
      return D(value).maxabs(other);
    };

    Decimal_BE.cmp_tolerance = function (value, other, tolerance) {
      return D(value).cmp_tolerance(other, tolerance);
    };

    Decimal_BE.compare_tolerance = function (value, other, tolerance) {
      return D(value).cmp_tolerance(other, tolerance);
    };

    Decimal_BE.eq_tolerance = function (value, other, tolerance) {
      return D(value).eq_tolerance(other, tolerance);
    };

    Decimal_BE.equals_tolerance = function (value, other, tolerance) {
      return D(value).eq_tolerance(other, tolerance);
    };

    Decimal_BE.neq_tolerance = function (value, other, tolerance) {
      return D(value).neq_tolerance(other, tolerance);
    };

    Decimal_BE.notEquals_tolerance = function (value, other, tolerance) {
      return D(value).notEquals_tolerance(other, tolerance);
    };

    Decimal_BE.lt_tolerance = function (value, other, tolerance) {
      return D(value).lt_tolerance(other, tolerance);
    };

    Decimal_BE.lte_tolerance = function (value, other, tolerance) {
      return D(value).lte_tolerance(other, tolerance);
    };

    Decimal_BE.gt_tolerance = function (value, other, tolerance) {
      return D(value).gt_tolerance(other, tolerance);
    };

    Decimal_BE.gte_tolerance = function (value, other, tolerance) {
      return D(value).gte_tolerance(other, tolerance);
    };

    Decimal_BE.log10 = function (value) {
      return D(value).log10();
    };

    Decimal_BE.log = function (value, base) {
      return D(value).log(base);
    };

    Decimal_BE.log2 = function (value) {
      return D(value).log2();
    };

    Decimal_BE.ln = function (value) {
      return D(value).ln();
    };

    Decimal_BE.logarithm = function (value, base) {
      return D(value).logarithm(base);
    };

    Decimal_BE.pow10 = function (value) {
      return D(value).powbase10();
    };

    Decimal_BE.pow = function (value, other) {
      return D(value).pow(other);
    };
    
    Decimal_BE.root = function (value, other) {
      return D(value).root(other);
    };
    
    Decimal_BE.factorial = function (value, other) {
      return D(value).factorial();
    };
    
    Decimal_BE.gamma = function (value, other) {
      return D(value).gamma();
    };

    Decimal_BE.exp = function (value) {
      return D(value).exp();
    };

    Decimal_BE.sqr = function (value) {
      return D(value).sqr();
    };

    Decimal_BE.sqrt = function (value) {
      return D(value).sqrt();
    };

    Decimal_BE.cube = function (value) {
      return D(value).cube();
    };

    Decimal_BE.cbrt = function (value) {
      return D(value).cbrt();
    };
    
    Decimal_BE.tetrate = function (value, height = 2, payload = FC_NN(1, 0, 1)) {
      return D(value).tetrate(height, payload);
    }
    
    Decimal_BE.pentate = function (value, height = 2, payload = FC_NN(1, 0, 1)) {
      return D(value).pentate(height, payload);
    }
    
    /**
     * If you're willing to spend 'resourcesAvailable' and want to buy something
     * with exponentially increasing cost each purchase (start at priceStart,
     * multiply by priceRatio, already own currentOwned), how much of it can you buy?
     * Adapted from Trimps source code.
     */


    Decimal_BE.affordGeometricSeries = function (resourcesAvailable, priceStart, priceRatio, currentOwned) {
      return this.affordGeometricSeries_core(D(resourcesAvailable), D(priceStart), D(priceRatio), currentOwned);
    };
    /**
     * How much resource would it cost to buy (numItems) items if you already have currentOwned,
     * the initial price is priceStart and it multiplies by priceRatio each purchase?
     */


    Decimal_BE.sumGeometricSeries = function (numItems, priceStart, priceRatio, currentOwned) {
      return this.sumGeometricSeries_core(numItems, D(priceStart), D(priceRatio), currentOwned);
    };
    /**
     * If you're willing to spend 'resourcesAvailable' and want to buy something with additively
     * increasing cost each purchase (start at priceStart, add by priceAdd, already own currentOwned),
     * how much of it can you buy?
     */


    Decimal_BE.affordArithmeticSeries = function (resourcesAvailable, priceStart, priceAdd, currentOwned) {
      return this.affordArithmeticSeries_core(D(resourcesAvailable), D(priceStart), D(priceAdd), D(currentOwned));
    };
    /**
     * How much resource would it cost to buy (numItems) items if you already have currentOwned,
     * the initial price is priceStart and it adds priceAdd each purchase?
     * Adapted from http://www.mathwords.com/a/arithmetic_series.htm
     */


    Decimal_BE.sumArithmeticSeries = function (numItems, priceStart, priceAdd, currentOwned) {
      return this.sumArithmeticSeries_core(D(numItems), D(priceStart), D(priceAdd), D(currentOwned));
    };
    /**
     * When comparing two purchases that cost (resource) and increase your resource/sec by (deltaRpS),
     * the lowest efficiency score is the better one to purchase.
     * From Frozen Cookies:
     * http://cookieclicker.wikia.com/wiki/Frozen_Cookies_(JavaScript_Add-on)#Efficiency.3F_What.27s_that.3F
     */


    Decimal_BE.efficiencyOfPurchase = function (cost, currentRpS, deltaRpS) {
      return this.efficiencyOfPurchase_core(D(cost), D(currentRpS), D(deltaRpS));
    };

    Decimal_BE.randomDecimal_BEForTesting = function (maxLayers) {
      // NOTE: This doesn't follow any kind of sane random distribution, so use this for testing purposes only.
      //5% of the time, return 0
      if (Math.random() * 20 < 1) {
        return FC_NN(0, 0, 0);
      }
      
      var randomsign = Math.random() > 0.5 ? 1 : -1;
      
      //5% of the time, return 1 or -1
      if (Math.random() * 20 < 1) {
        return FC_NN(randomsign, 0, 1);
      }
      
      //pick a random layer
      var layer = Math.floor(Math.random()*(maxLayers+1));

      var randomexp = layer === 0 ? Math.random()*616-308 : Math.random()*16;
      //10% of the time, make it a simple power of 10
      if (Math.random() > 0.9) { randomexp = Math.trunc(randomexp); }
      var randommag = Math.pow(10, randomexp);
      //10% of the time, trunc mag
      if (Math.random() > 0.9) { randommag = Math.trunc(randommag); }
      return FC(randomsign, layer, randommag);
    };

    Decimal_BE.affordGeometricSeries_core = function (resourcesAvailable, priceStart, priceRatio, currentOwned) {
      var actualStart = priceStart.mul(priceRatio.pow(currentOwned));
      return Decimal_BE.floor(resourcesAvailable.div(actualStart).mul(priceRatio.sub(1)).add(1).log10().div(priceRatio.log10()));
    };

    Decimal_BE.sumGeometricSeries_core = function (numItems, priceStart, priceRatio, currentOwned) {
      return priceStart.mul(priceRatio.pow(currentOwned)).mul(Decimal_BE.sub(1, priceRatio.pow(numItems))).div(Decimal_BE.sub(1, priceRatio));
    };

    Decimal_BE.affordArithmeticSeries_core = function (resourcesAvailable, priceStart, priceAdd, currentOwned) {
      // n = (-(a-d/2) + sqrt((a-d/2)^2+2dS))/d
      // where a is actualStart, d is priceAdd and S is resourcesAvailable
      // then floor it and you're done!
      var actualStart = priceStart.add(currentOwned.mul(priceAdd));
      var b = actualStart.sub(priceAdd.div(2));
      var b2 = b.pow(2);
      return b.neg().add(b2.add(priceAdd.mul(resourcesAvailable).mul(2)).sqrt()).div(priceAdd).floor();
    };

    Decimal_BE.sumArithmeticSeries_core = function (numItems, priceStart, priceAdd, currentOwned) {
      var actualStart = priceStart.add(currentOwned.mul(priceAdd)); // (n/2)*(2*a+(n-1)*d)

      return numItems.div(2).mul(actualStart.mul(2).plus(numItems.sub(1).mul(priceAdd)));
    };

    Decimal_BE.efficiencyOfPurchase_core = function (cost, currentRpS, deltaRpS) {
      return cost.div(currentRpS).add(cost.div(deltaRpS));
    };
    
    Decimal_BE.prototype.normalize = function () {
      /*
      PSEUDOCODE:
      Make anything that is partially 0 (sign is 0 or mag and layer is 0) fully 0.
      If mag > EXP_LIMIT (9e15), layer += 1, mag = log10(mag).
      If mag < LAYER_DOWN (15.954) and layer > 0 (not handling negative layers for now), layer -= 1, mag = pow(10, mag).
      I think zero/negative mag already works fine (10^10^-1 becomes 10^0.1 becomes 1.259), but we may need to do it many times.
      Finally, if layer === 0 and mag is negative, make it positive and invert sign.
      
      When we're done, all of the following should be true OR one of the numbers is not IsFinite OR layer is not IsInteger (error state):
      Any 0 is totally zero (0, 0, 0).
      Anything layer 0 has mag >= 0.
      Anything layer 1 or higher has mag >= 15.954 and < 9e15.
      We will assume in calculations that all Decimal_BEs are either erroneous or satisfy these criteria. (Otherwise: Garbage in, garbage out.)
      */
      if (this.sign === 0 || (this.mag === 0 && this.layer === 0))
      {
        this.sign = 0;
        this.mag = 0;
        this.layer = 0;
        return this;
      }
      
      if (this.mag >= EXP_LIMIT)
      {
        if (this.layer === 0 && this.mag < 0)
        {
          this.mag = -this.mag;
          this.sign = -this.sign;
        }
        this.layer += 1;
        this.mag = Math.log10(this.mag);
        return this;
      }
      else
      {
        while (this.mag < LAYER_DOWN && this.layer > 0)
        {
          this.layer -= 1;
          this.mag = Math.pow(10, this.mag);
        }
        if (this.layer === 0 && this.mag < 0)
        {
          this.mag = -this.mag;
          this.sign = -this.sign;
        }
      }

      return this;
    };

    Decimal_BE.prototype.fromComponents = function (sign, layer, mag) {
      this.sign = sign;
      this.layer = layer;
      this.mag = mag;

      this.normalize();
      return this;
    };

    Decimal_BE.prototype.fromComponents_noNormalize = function (sign, layer, mag) {
      this.sign = sign;
      this.layer = layer;
      this.mag = mag;
      return this;
    };

    Decimal_BE.prototype.fromDecimal_BE = function (value) {
      this.sign = value.sign;
      this.layer = value.layer;
      this.mag = value.mag;
      return this;
    };

    Decimal_BE.prototype.fromNumber = function (value) {
      this.mag = Math.abs(value);
      this.sign = Math.sign(value);
      this.layer = 0;
      this.normalize();
      return this;
    };

    var IGNORE_COMMAS = true;
    var COMMAS_ARE_Decimal_BE_POINTS = false;
    
    Decimal_BE.prototype.fromString = function (value) {
      if (IGNORE_COMMAS) { value = value.replace(",", ""); }
      else if (COMMAS_ARE_Decimal_BE_POINTS) { value = value.replace(",", "."); }
    
      //Handle x^^^y format.
      var pentationparts = value.split("^^^");
      if (pentationparts.length === 2)
      {
        var base = parseFloat(pentationparts[0]);
        var height = parseFloat(pentationparts[1]);
        var payload = 1;
        var heightparts = pentationparts[1].split(";");
        if (heightparts.length === 2)
        {
          var payload = parseFloat(heightparts[1]);
          if (!isFinite(payload)) { payload = 1; }
        }
        if (isFinite(base) && isFinite(height))
        {
          var result = Decimal_BE.pentate(base, height, payload);
          this.sign = result.sign;
          this.layer = result.layer;
          this.mag = result.mag;
          return this;
        }
      }
    
      //Handle x^^y format.
      var tetrationparts = value.split("^^");
      if (tetrationparts.length === 2)
      {
        var base = parseFloat(tetrationparts[0]);
        var height = parseFloat(tetrationparts[1]);
        var heightparts = tetrationparts[1].split(";");
        if (heightparts.length === 2)
        {
          var payload = parseFloat(heightparts[1]);
          if (!isFinite(payload)) { payload = 1; }
        }
        if (isFinite(base) && isFinite(height))
        {
          var result = Decimal_BE.tetrate(base, height, payload);
          this.sign = result.sign;
          this.layer = result.layer;
          this.mag = result.mag;
          return this;
        }
      }
      
      //handle X PT Y format.
      var ptparts = value.split("PT");
      if (ptparts.length === 2)
      {
        base = 10;
        height = parseFloat(ptparts[0]);
        ptparts[1] = ptparts[1].replace("(", "");
        ptparts[1] = ptparts[1].replace(")", "");
        var payload = parseFloat(ptparts[1]);
        if (!isFinite(payload)) { payload = 1; }
        if (isFinite(base) && isFinite(height))
        {
          var result = Decimal_BE.tetrate(base, height, payload);
          this.sign = result.sign;
          this.layer = result.layer;
          this.mag = result.mag;
          return this;
        }
      }
      
      //Handle various cases involving it being a Big Number.
      value = value.trim().toLowerCase();
      var parts = value.split("e");
      var ecount = parts.length-1;
    
      //Handle numbers that are exactly floats (0 or 1 es).
      if (ecount < 2)
      {
        var numberAttempt = parseFloat(value);
        if (isFinite(numberAttempt))
        {
          return this.fromNumber(numberAttempt);
        }
      }
      
      //Handle new (e^N)X format.
      var newparts = value.split("e^");
      if (newparts.length === 2)
      {
        var layerstring = "";
        for (var i = 0; i < newparts[1].length; ++i)
        {
          var chrcode = newparts[1].charCodeAt(0);
          if (chrcode >= 48 && chrcode <= 57) //is "0" to "9"
          {
            layerstring += newparts[1].charAt(0);
          }
          else //we found the end of the layer count
          {
            this.layer = parseFloat(layerstring);
            this.mag = parseFloat(newparts[1].substr(i+1));
            this.normalize();
            return this;
          }
        }
      }
      
      if (ecount < 1) { this.sign = 0; this.layer = 0; this.mag = 0; return this; }
      var mantissa = parseFloat(parts[0]);
      if (mantissa === 0) { this.sign = 0; this.layer = 0; this.mag = 0; return this; }
      var exponent = parseFloat(parts[parts.length-1]);
      //handle numbers like AeBeC and AeeeeBeC
      if (ecount >= 2) { var me = parseFloat(parts[parts.length-2]); if (isFinite(me)) { exponent += Math.log10(me); } }
      
      //Handle numbers written like eee... (N es) X
      if (!isFinite(mantissa))
      {
        this.sign = (parts[0] === "-") ? -1 : 1;
        this.layer = ecount;
        this.mag = exponent;
      }
      //Handle numbers written like XeY
      else if (ecount === 1)
      {
        this.sign = Math.sign(mantissa);
        this.layer = 1;
        //Example: 2e10 is equal to 10^log10(2e10) which is equal to 10^(10+log10(2))
        this.mag = exponent + Math.log10(Math.abs(mantissa));
      }
      //Handle numbers written like Xeee... (N es) Y
      else
      {
        this.sign = Math.sign(mantissa);
        this.layer = ecount;
        if (ecount === 2)
        {
          var result = Decimal_BE.mul(FC(1, 2, exponent), D(mantissa));
          this.sign = result.sign;
          this.layer = result.layer;
          this.mag = result.mag;
          return this;
        }
        else
        {
          //at eee and above, mantissa is too small to be recognizable!
          this.mag = exponent;
        }
      }
      
      this.normalize();
      return this;
    };

    Decimal_BE.prototype.fromValue = function (value) {
      if (value instanceof Decimal_BE) {
        return this.fromDecimal_BE(value);
      }

      if (typeof value === "number") {
        return this.fromNumber(value);
      }

      if (typeof value === "string") {
        return this.fromString(value);
      }

      this.sign = 0;
      this.layer = 0;
      this.mag = 0;
      return this;
    };

    Decimal_BE.prototype.toNumber = function () {
      if (this.layer === 0)
      {
        return this.sign*this.mag;
      }
      else if (this.layer === 1)
      {
        return this.sign*Math.pow(10, this.mag);
      }
      else //overflow for any normalized Decimal_BE
      {
        return Number.POSITIVE_INFINITY;
      }
    };
    
    Decimal_BE.prototype.mantissaWithDecimal_BEPlaces = function (places) {
      // https://stackoverflow.com/a/37425022
      if (isNaN(this.m)) {
        return Number.NaN;
      }

      if (this.m === 0) {
        return 0;
      }

      return Decimal_BEPlaces(this.m, places);
    };
    
    Decimal_BE.prototype.magnitudeWithDecimal_BEPlaces = function (places) {
      // https://stackoverflow.com/a/37425022
      if (isNaN(this.mag)) {
        return Number.NaN;
      }

      if (this.mag === 0) {
        return 0;
      }

      return Decimal_BEPlaces(this.mag, places);
    };
    
    Decimal_BE.prototype.toString = function () {
      if (this.layer === 0)
      {
        if (this.mag < 1e21 && this.mag > 1e-7)
        {
          return (this.sign*this.mag).toString();
        }
        return this.m + "e" + this.e;
      }
      else if (this.layer === 1)
      {
        return this.m + "e" + this.e;
      }
      else
      {
        //layer 2+
        if (this.layer <= MAX_ES_IN_A_ROW)
        {
          return "e".repeat(this.layer) + this.mag;
        }
        else
        {
          return "(e^" + this.layer + ")" + this.mag;
        }
      }
    };
    
    Decimal_BE.prototype.toExponential = function (places) {
      if (this.layer === 0)
      {
        return (this.sign*this.mag).toExponential(places);
      }
      return this.toStringWithDecimal_BEPlaces(places);
    };
    
    Decimal_BE.prototype.toFixed = function (places) {
      if (this.layer === 0)
      {
        return (this.sign*this.mag).toFixed(places);
      }
      return this.toStringWithDecimal_BEPlaces(places);
    };
    
    Decimal_BE.prototype.toPrecision = function (places) {
      if (this.e <= -7) {
        return this.toExponential(places - 1);
      }

      if (places > this.e) {
        return this.toFixed(places - this.exponent - 1);
      }

      return this.toExponential(places - 1);
    };
    
    Decimal_BE.prototype.valueOf = function () {
      return this.toString();
    };

    Decimal_BE.prototype.toJSON = function () {
      return this.toString();
    };
    
    Decimal_BE.prototype.toStringWithDecimal_BEPlaces = function (places) {
      if (this.layer === 0)
      {
        if (this.mag < 1e21 & this.mag > 1e-7)
        {
          return (this.sign*this.mag).toFixed(places);
        }
        return Decimal_BEPlaces(this.m, places) + "e" + Decimal_BEPlaces(this.e, places);
      }
      else if (this.layer === 1)
      {
        return Decimal_BEPlaces(this.m, places) + "e" + Decimal_BEPlaces(this.e, places);
      }
      else
      {
        //layer 2+
        if (this.layer <= MAX_ES_IN_A_ROW)
        {
          return "e".repeat(this.layer, places) + Decimal_BEPlaces(this.mag, places);
        }
        else
        {
          return "(e^" + this.layer + ")" + Decimal_BEPlaces(this.mag, places);
        }
      }
    };
    
    Decimal_BE.prototype.abs = function () {
      return FC_NN(this.sign === 0 ? 0 : 1, this.layer, this.mag);
    };

    Decimal_BE.prototype.neg = function () {
      return FC_NN(-this.sign, this.layer, this.mag);
    };

    Decimal_BE.prototype.negate = function () {
      return this.neg();
    };

    Decimal_BE.prototype.negated = function () {
      return this.neg();
    };

    Decimal_BE.prototype.sign = function () {
      return this.sign;
    };

    Decimal_BE.prototype.sgn = function () {
      return this.sign;
    };
    
    Decimal_BE.prototype.round = function () {
      if (this.layer === 0)
      {
        return FC(this.sign, 0, Math.round(this.sign*this.mag));
      }
      return this;
    };

    Decimal_BE.prototype.floor = function () {
      if (this.layer === 0)
      {
        return FC(this.sign, 0, Math.floor(this.sign*this.mag));
      }
      return this;
    };

    Decimal_BE.prototype.ceil = function () {
      if (this.layer === 0)
      {
        return FC(this.sign, 0, this.Math.ceil(this.sign*this.mag));
      }
      return this;
    };

    Decimal_BE.prototype.trunc = function () {
      if (this.layer === 0)
      {
        return FC(this.sign, 0, Math.trunc(this.sign*this.mag));
      }
      return this;
    };

    Decimal_BE.prototype.add = function (value) {
      var Decimal_BE = D(value);
      //Special case - Adding a number to its negation produces 0, no matter how large.
      if (this.sign == -(Decimal_BE.sign) && this.layer == Decimal_BE.layer && this.mag == Decimal_BE.mag) { return FC_NN(0, 0, 0); }
      
      var a;
      var b;
      
      if (Decimal_BE.cmpabs(this, Decimal_BE) > 0)
      {
        a = this;
        b = Decimal_BE;
      }
      else
      {
        a = Decimal_BE;
        b = this;
      }
      
      //Special case: If one of the numbers is layer 2 or higher, just take the bigger number.
      if ((a.layer >= 2 || b.layer >= 2)) { return a; }
      
      if (a.layer == 0 && b.layer == 0) { return D(a.sign*a.mag + b.sign*b.mag); }
      
      if (a.layer == 1 && b.layer == 0)
      {
        if (a.mag-Math.log10(b.mag) > MAX_SIGNIFICANT_DIGITS)
        {
          return a;
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-Math.log10(b.mag));
          var mantissa = (b.sign*1)+(a.sign*magdiff);
          return FC(Math.sign(mantissa), 1, Math.log10(b.mag)+Math.log10(Math.abs(mantissa)));
        }
      }
      
      if (a.layer == 1 && b.layer == 1)
      {
        if (a.mag-b.mag > MAX_SIGNIFICANT_DIGITS)
        {
          return a;
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-b.mag);
          var mantissa = (b.sign*1)+(a.sign*magdiff);
          return FC(Math.sign(mantissa), 1, b.mag+Math.log10(Math.abs(mantissa)));
        }
      }
      
      throw Error("Bad arguments to add: " + this + ", " + value);
    };

    Decimal_BE.prototype.plus = function (value) {
      return this.add(value);
    };

    Decimal_BE.prototype.sub = function (value) {
      return this.add(D(value).neg());
    };

    Decimal_BE.prototype.subtract = function (value) {
      return this.sub(value);
    };

    Decimal_BE.prototype.minus = function (value) {
      return this.sub(value);
    };

    Decimal_BE.prototype.mul = function (value) {
      var Decimal_BE = D(value);
      
      //Special case - if one of the numbers is 0, return 0.
      if (this.sign == 0 || Decimal_BE.sign == 0) { return FC_NN(0, 0, 0); }
            
      var a;
      var b;
      
      if (Decimal_BE.cmpabs(this, Decimal_BE) > 0)
      {
        a = this;
        b = Decimal_BE;
      }
      else
      {
        a = Decimal_BE;
        b = this;
      }
      
      //Special case: If one of the numbers is layer 3 or higher or one of the numbers is 2+ layers bigger than the other, just take the bigger number.
      if ((a.layer >= 3 || b.layer >= 3) || (a.layer - b.layer >= 2)) { return FC(a.sign*b.sign, a.layer, a.mag); }
      
      if (a.layer == 0 && b.layer == 0) { return D(a.sign*b.sign*a.mag*b.mag); }
      
      if (a.layer == 1 && b.layer == 0)
      { 
        return FC(a.sign*b.sign, 1, a.mag+Math.log10(b.mag));
      }
      
      if (a.layer == 1 && b.layer == 1)
      {
        return FC(a.sign*b.sign, 1, a.mag+b.mag);
      }
      
      if (a.layer == 2 && b.layer == 1)
      {
        if (a.mag-Math.log10(b.mag) > MAX_SIGNIFICANT_DIGITS)
        {
          return FC(a.sign*b.sign, a.layer, a.mag);
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-Math.log10(b.mag));
          var mantissa = 1+magdiff;
          return FC(a.sign*b.sign, 2, Math.log10(b.mag)+Math.log10(Math.abs(mantissa)));
        }
      }
      
      if (a.layer == 2 && b.layer == 2)
      {
        if (a.mag-b.mag > MAX_SIGNIFICANT_DIGITS)
        {
          return FC(a.sign*b.sign, a.layer, a.mag);
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-b.mag);
          var mantissa = 1+magdiff;
          return FC(a.sign*b.sign, 2, b.mag+Math.log10(Math.abs(mantissa)));
        }
      }
      
      throw Error("Bad arguments to mul: " + this + ", " + value);
    };

    Decimal_BE.prototype.multiply = function (value) {
      return this.mul(value);
    };

    Decimal_BE.prototype.times = function (value) {
      return this.mul(value);
    };

    Decimal_BE.prototype.div = function (value) {
      var Decimal_BE = D(value);
      
      var a = this;
      var b = Decimal_BE;
      
      //Special case - Dividing a number by its own magnitude yields +/- 1, no matter how large.
      if (a.layer == b.layer && a.mag == b.mag) { return FC_NN(a.sign*b.sign, 0, 1); }
      
      //Special case - if the first number is 0, return 0.
      
      if (a.sign == 0) { return FC_NN(0, 0, 0); }
      
      //Special case - if the second number is 0, explode (Divide by 0).
      
      if (b.sign == 0) { throw Error("Divide by 0"); }
      
      //NOTE: Unlike add/mul, second number can be bigger in magnitude than first number.
      
      //Special case - if the second number is hugely larger than the first number, return 0.
      
      if (b.layer - a.layer >= 2) { return FC_NN(0, 0, 0); }
      
      //Special case - if the first number is hugely larger than the second number, return it.
      
      if (a.layer - b.layer >= 2) { return FC(a.sign*b.sign, a.layer, a.mag); }
      
      //Special case - if either number is layer 3 or higher, whichever number is larger wins.
      if (a.layer >= 3 || b.layer >= 3) { return a.cmpabs(b) > 0 ? FC(a.sign*b.sign, a.layer, a.mag) : FC_NN(0, 0, 0); }
      
      if (a.layer == 0 && b.layer == 0) { return D(a.sign*b.sign*a.mag/b.mag); }
      
      if (a.layer == 1 && b.layer == 0) { return FC(a.sign*b.sign, 1, a.mag-Math.log10(b.mag)); }
      
      if (a.layer == 0 && b.layer == 1) { return FC(a.sign*b.sign, 1, Math.log10(a.mag)-b.mag); }
      
      if (a.layer == 1 && b.layer == 1) { return FC(a.sign*b.sign, 1, a.mag-b.mag); }
      
      if (a.layer == 2 && b.layer == 1)
      {
        if (a.mag < Math.log10(b.mag)) { return FC_NN(0, 0, 0); }
        
        if (a.mag-Math.log10(b.mag) > MAX_SIGNIFICANT_DIGITS)
        {
          return FC(a.sign*b.sign, a.layer, a.mag);
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-Math.log10(b.mag));
          var mantissa = -1+magdiff;
          return FC(a.sign*b.sign, 2, Math.log10(b.mag)+Math.log10(Math.abs(mantissa)));
        }
      }
      
      if (a.layer == 1 && b.layer == 2)
      {
        return FC_NN(0, 0, 0);
      }
      
      if (a.layer == 2 && b.layer == 2)
      {
        if (a.mag < b.mag) { return FC_NN(0, 0, 0); }
        
        if (a.mag-b.mag > MAX_SIGNIFICANT_DIGITS)
        {
          return FC(a.sign*b.sign, a.layer, a.mag);
        }
        else
        {
          var magdiff = Math.pow(10, a.mag-b.mag);
          var mantissa = -1+magdiff;
          return FC(a.sign*b.sign, 2, b.mag+Math.log10(Math.abs(mantissa)));
        }
      }
      
      throw Error("Bad arguments to div: " + this + ", " + value);
    };

    Decimal_BE.prototype.divide = function (value) {
      return this.div(value);
    };

    Decimal_BE.prototype.divideBy = function (value) {
      return this.div(value);
    };

    Decimal_BE.prototype.dividedBy = function (value) {
      return this.div(value);
    };

    Decimal_BE.prototype.recip = function () {
      if (this.layer == 0)
      {
        return FC(this.sign, 0, 1/this.mag);
      }
      else if (this.layer == 1)
      {
        return FC(this.sign, 1, -this.mag);
      }
      else
      {
        return FC_NN(0, 0, 0);
      }
    };

    Decimal_BE.prototype.reciprocal = function () {
      return this.recip();
    };

    Decimal_BE.prototype.reciprocate = function () {
      return this.recip();
    };
    
    /**
     * -1 for less than value, 0 for equals value, 1 for greater than value
     */
    Decimal_BE.prototype.cmp = function (value) {
      var Decimal_BE = D(value);
      if (this.sign > Decimal_BE.sign) { return 1; }
      if (this.sign < Decimal_BE.sign) { return -1; }
      if (this.layer > Decimal_BE.layer) { return 1; }
      if (this.layer < Decimal_BE.layer) { return -1; }
      if (this.mag > Decimal_BE.mag) { return 1; }
      if (this.mag < Decimal_BE.mag) { return -1; }
      return 0;
    };
	
	Decimal_BE.prototype.cmpabs = function (value) {
      var Decimal_BE = D(value);
      if (this.layer > Decimal_BE.layer) { return 1; }
      if (this.layer < Decimal_BE.layer) { return -1; }
      if (this.mag > Decimal_BE.mag) { return 1; }
      if (this.mag < Decimal_BE.mag) { return -1; }
      return 0;
    };

    Decimal_BE.prototype.compare = function (value) {
      return this.cmp(value);
    };

    Decimal_BE.prototype.eq = function (value) {
      var Decimal_BE = D(value);
      return this.sign === Decimal_BE.sign && this.layer === Decimal_BE.layer && this.mag === Decimal_BE.mag;
    };

    Decimal_BE.prototype.equals = function (value) {
      return this.eq(value);
    };

    Decimal_BE.prototype.neq = function (value) {
      return !this.eq(value);
    };

    Decimal_BE.prototype.notEquals = function (value) {
      return this.neq(value);
    };

    Decimal_BE.prototype.lt = function (value) {
      var Decimal_BE = D(value);
      return this.cmp(value) == -1;
    };

    Decimal_BE.prototype.lte = function (value) {
      return !this.gt(value);
    };

    Decimal_BE.prototype.gt = function (value) {
      var Decimal_BE = D(value);
      return this.cmp(value) == 1;
    };

    Decimal_BE.prototype.gte = function (value) {
      return !this.lt(value);
    };

    Decimal_BE.prototype.max = function (value) {
      var Decimal_BE = D(value);
      return this.lt(Decimal_BE) ? Decimal_BE : this;
    };

    Decimal_BE.prototype.min = function (value) {
      var Decimal_BE = D(value);
      return this.gt(Decimal_BE) ? Decimal_BE : this;
    };
	
	Decimal_BE.prototype.maxabs = function (value) {
      var Decimal_BE = D(value);
      return this.cmpabs(Decimal_BE) < 0 ? Decimal_BE : this;
    };

    Decimal_BE.prototype.minabs = function (value) {
      var Decimal_BE = D(value);
      return this.cmpabs(Decimal_BE) > 0 ? Decimal_BE : this;
    };

    Decimal_BE.prototype.cmp_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value);
      return this.eq_tolerance(Decimal_BE, tolerance) ? 0 : this.cmp(Decimal_BE);
    };

    Decimal_BE.prototype.compare_tolerance = function (value, tolerance) {
      return this.cmp_tolerance(value, tolerance);
    };
    
    /**
     * Tolerance is a relative tolerance, multiplied by the greater of the magnitudes of the two arguments.
     * For example, if you put in 1e-9, then any number closer to the
     * larger number than (larger number)*1e-9 will be considered equal.
     */
    Decimal_BE.prototype.eq_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value); // https://stackoverflow.com/a/33024979
      //Numbers that are too far away are never close.
      if (this.sign != Decimal_BE.sign) { return false; }
      if (Math.abs(this.layer - Decimal_BE.layer) > 1) { return false; }
      // return abs(a-b) <= tolerance * max(abs(a), abs(b))
      var magA = this.mag;
      var magB = Decimal_BE.mag;
      if (this.layer > Decimal_BE.layer) { magB = Math.log10(magB); }
      if (this.layer < Decimal_BE.layer) { magA = Math.log10(magA); }
      return Math.abs(magA-magB) <= tolerance*Math.max(Math.abs(magA), Math.abs(magB));
    };

    Decimal_BE.prototype.equals_tolerance = function (value, tolerance) {
      return this.eq_tolerance(value, tolerance);
    };

    Decimal_BE.prototype.neq_tolerance = function (value, tolerance) {
      return !this.eq_tolerance(value, tolerance);
    };

    Decimal_BE.prototype.notEquals_tolerance = function (value, tolerance) {
      return this.neq_tolerance(value, tolerance);
    };

    Decimal_BE.prototype.lt_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value);
      return !this.eq_tolerance(Decimal_BE, tolerance) && this.lt(Decimal_BE);
    };

    Decimal_BE.prototype.lte_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value);
      return this.eq_tolerance(Decimal_BE, tolerance) || this.lt(Decimal_BE);
    };

    Decimal_BE.prototype.gt_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value);
      return !this.eq_tolerance(Decimal_BE, tolerance) && this.gt(Decimal_BE);
    };

    Decimal_BE.prototype.gte_tolerance = function (value, tolerance) {
      var Decimal_BE = D(value);
      return this.eq_tolerance(Decimal_BE, tolerance) || this.gt(Decimal_BE);
    };

    Decimal_BE.prototype.abslog10 = function () {
      if (this.sign === 0)
      {
        throw Error("abslog10(0) is undefined");
      }
      else if (this.layer > 0)
      {
        return FC_NN(this.sign, this.layer-1, this.mag);
      }
      else
      {
        return FC_NN(this.sign, 0, Math.log10(Math.abs(this.mag)));
      }
    };

    Decimal_BE.prototype.log10 = function () {
      if (this.sign <= 0)
      {
        throw Error("log10 is undefined for numbers <= 0");
      }
      else if (this.layer > 0)
      {
        return FC_NN(this.sign, this.layer-1, this.mag);
      }
      else
      {
        return FC_NN(this.sign, 0, Math.log10(this.mag));
      }
    };

    Decimal_BE.prototype.log = function (base) {
      base = D(base);
      if (this.sign <= 0)
      {
        throw Error("log is undefined for numbers <= 0");
      }
      if (base.sign <= 0)
      {
        throw Error("log is undefined for bases <= 0");
      }
      if (base.sign === 1 && base.layer === 0 && base.mag === 1)
      {
        throw Error("log is undefined for base === 1");
      }
      else if (this.layer === 0 && base.layer === 0)
      {
        return FC_NN(this.sign, 0, Math.log(this.mag)/Math.log(base.mag));
      }
      
      return Decimal_BE.div(this.log10(), base.log10());
    };

    Decimal_BE.prototype.log2 = function () {
      if (this.sign <= 0)
      {
        throw Error("ln is undefined for numbers <= 0");
      }
      else if (this.layer === 0)
      {
        return FC_NN(this.sign, 0, Math.log2(this.mag));
      }
      else if (this.layer === 1)
      {
        return FC(1, 0, this.mag*3.321928094887362); //log2(10)
      }
      else if (this.layer === 2)
      {
        return FC(1, 1, this.mag+0.5213902276543247); //-log10(log10(2))
      }
      else
      {
        return FC_NN(1, this.layer-1, this.mag);
      }
    };

    Decimal_BE.prototype.ln = function () {
      if (this.sign <= 0)
      {
        throw Error("ln is undefined for numbers <= 0");
      }
      else if (this.layer === 0)
      {
        return FC_NN(this.sign, 0, Math.log(this.mag));
      }
      else if (this.layer === 1)
      {
        return FC(1, 0, this.mag*2.302585092994046); //ln(10)
      }
      else if (this.layer === 2)
      {
        return FC(1, 1, this.mag+0.36221568869946325); //log10(log10(e))
      }
      else
      {
        return FC_NN(1, this.layer-1, this.mag);
      }
    };

    Decimal_BE.prototype.logarithm = function (base) {
      return this.log(base);
    };

    Decimal_BE.prototype.pow = function (value) {
      var Decimal_BE = D(value);
      var a = this;
      var b = Decimal_BE;
      
      //TODO: Going to worry about negative numbers later and assume stuff is positive for now.
      
      //TODO: Can probably be made slightly less redundant.
      
      //special case: if a is 1, then return 1
      if (a.sign === 1 && a.layer === 0 && a.mag === 1) { return a; }
      //special case: if b is 0, then return 1
      if (b.sign === 0) { return FC_NN(1, 0, 1); }
      //special case: if b is 1, then return a
      if (b.sign === 1 && b.layer === 0 && b.mag === 1) { return a; }
      //special case: if a is 10, then call powbase10
      if (a.sign === 1 && a.layer === 0 && a.mag === 10) { return b.powbase10(); }
      
      if (a.layer === 0 && b.layer === 0)
      {
        var newmag = Math.pow(a.sign*a.mag, b.sign*b.mag);
        if (isFinite(newmag)) { return FC(1, 0, newmag); }
        return FC(1, 1, Math.log10(a.mag)*b.mag);
      }
      
      //TODO: This might not be needed?
      //Special case: if a is < 1 and b.layer > 0 then return 0
      if (a.layer === 0 && a.mag < 1) { return FC_NN(0, 0, 0); }
      
      if (a.layer === 1 && b.layer === 0)
      {
        return FC(1, 2, Math.log10(a.mag)+Math.log10(b.mag));
      }
      
      if (a.layer === 0 && b.layer === 1)
      {
        return FC(1, 2, Math.log10(Math.log10(a.mag))+b.mag);
      }
      
      if (a.layer === 1 && b.layer === 1)
      {
        return FC(1, 2, Math.log10(a.mag)+b.mag);
      }
      
      if (a.layer === 2 && b.layer <= 2)
      {
        var result = Decimal_BE.mul(FC_NN(a.sign, 1, a.mag), FC_NN(b.sign, b.layer, b.mag));
        result.layer += 1;
        return result;
      }
      
      if (b.layer >= 2 && (b.layer - a.layer) >= 0)
      {
        //As far as I can tell, if b.layer >= 2 and a is a layer or more behind, then you just add 1 to b's layer because all precision vanishes.
        return FC(1, b.layer+1, b.mag);
      }
      else
      {
        //mul of increasingly higher layer (eventually turns into max).
        var result = Decimal_BE.mul(FC_NN(a.sign, a.layer-1, a.mag), FC_NN(b.sign, b.layer, b.mag));
        result.layer += 1;
        return result;
      }
      
      throw Error("Bad arguments to pow: " + this + ", " + value);
    };
    
    Decimal_BE.prototype.powbase10 = function () {
      if (this.sign === 0)
      {
        return FC_NN(1, 0, 1);
      }
      else if (this.sign === 1)
      {
        //mag might be too low and it might immediately be bumped down
        return FC(1, this.layer+1, this.mag);
      }
      else if (this.layer === 0)
      {
        //negative layer 0 number - will end up in range (0, 1) though rounding can make it exactly 0 or 1
        var new_mag = Math.pow(10, -this.mag);
        if (new_mag === 0) { return FC_NN(0, 0, 0); }
        return FC_NN(1, 0, new_mag);
      }
      else
      {
        //negative higher layer number - will always be 0
        return FC_NN(0, 0, 0);
      }
    }

    Decimal_BE.prototype.pow_base = function (value) {
      return D(value).pow(this);
    };
    
    Decimal_BE.prototype.root = function (value) {
      var Decimal_BE = D(value);
      var a = this;
      var b = Decimal_BE;
      
      //TODO: Going to worry about negative numbers later and assume stuff is positive for now.
      
      //TODO: Can probably be made slightly less redundant.
      
      //special case: if a is 0, return 0
      if (a.sign === 0) { return a; }
      //special case: if b is 0, return NaN
      if (b.sign === 0) { return FC_NN(Number.NaN, Number.NaN, Number.NaN); }
      //special case: if a is 1, return a
      if (a.sign === 1 && a.layer === 0 && a.mag === 1) { return a; }
      //special case: if b is 1, return a
      if (b.sign === 1 && b.layer === 0 && b.mag === 1) { return a; }
      
      if (a.layer === 0 && b.layer === 0)
      {
        var newmag = Math.pow(a.sign*a.mag, b.sign*(1/b.mag));
        if (isFinite(newmag)) { return FC(1, 0, newmag); }
        return FC(1, 1, Math.log10(a.mag)/b.mag);
      }
      
      if (a.layer === 1 && b.layer === 0)
      {
        return FC(1, 2, Math.log10(a.mag)-Math.log10(b.mag));
      }
      
      if (a.layer === 0 && b.layer === 1)
      {
        return FC(1, 2, Math.log10(Math.log10(a.mag))-b.mag);
      }
      
      if (a.layer === 1 && b.layer === 1)
      {
        return FC(1, 2, Math.log10(a.mag)-b.mag);
      }

      if (a.layer === 2 && b.layer <= 2)
      {
        var result = Decimal_BE.div(FC_NN(a.sign, 1, a.mag), FC_NN(b.sign, b.layer, b.mag));
        result.layer += 1;
        result.normalize();
        return result;
      }
      
      if (b.layer >= 2 && (b.layer - a.layer) >= 0)
      {
        //As far as I can tell, if b.layer >= 2 and a is a layer or more behind, then you just return 0 because all precision vanishes.
        return FC_NN(0, 0, 0);
      }
      else
      {
        //div of increasingly higher layer.
        var result = Decimal_BE.div(FC_NN(a.sign, a.layer-1, a.mag), FC_NN(b.sign, b.layer, b.mag));
        result.layer += 1;
        result.normalize();
        return result;
      }
      
      throw Error("Bad arguments to root: " + this + ", " + value);
    }

    Decimal_BE.prototype.factorial = function () {
      if (this.layer === 0)
      {
        return this.add(1).gamma();
      }
      else if (this.layer === 1)
      {
        return Decimal_BE.exp(Decimal_BE.mul(this, Decimal_BE.ln(this).sub(1)));
      }
      else
      {
        return Decimal_BE.exp(this);
      }
    };
    
    Decimal_BE.prototype.gamma = function () {
      if (this.layer === 0)
      {
        if (this.lt(FC_NN(1, 0, 24)))
        {
          return D(f_gamma(this.sign*this.mag));
        }
        
        var t = this.mag - 1;
        var l = 0.9189385332046727; //0.5*Math.log(2*Math.PI)
        l = (l+((t+0.5)*Math.log(t)));
        l = l-t;
        var n2 = t*t;
        var np = t;
        var lm = 12*np;
        var adj = 1/lm;
        var l2 = l+adj;
        if (l2 === l)
        {
          return Decimal_BE.exp(l);
        }
        
        l = l2;
        np = np*n2;
        lm = 360*np;
        adj = 1/lm;
        l2 = l-adj;
        if (l2 === l)
        {
          return Decimal_BE.exp(l);
        }
        
        l = l2;
        np = np*n2;
        lm = 1260*np;
        var lt = 1/lm;
        l = l+lt;
        np = np*n2;
        lm = 1680*np;
        lt = 1/lm;
        l = l-lt;
        return Decimal_BE.exp(l);
      }
      else if (this.layer === 1)
      {
        return Decimal_BE.exp(Decimal_BE.mul(this, Decimal_BE.ln(this).sub(1)));
      }
      else
      {
        return Decimal_BE.exp(this);
      }
    };

    Decimal_BE.prototype.exp = function () {
      if (this.layer === 0 && this.mag <= 709.7) { return FC(1, 0, Math.exp(this.mag)); }
      else if (this.layer === 0) { return FC(1, 1, Math.log10(Math.E)*this.mag); }
      else if (this.layer === 1) { return FC(1, 2, Math.log10(0.4342944819032518)+this.mag); }
      else { return FC(this.sign, this.layer+1, this.mag); }
    };

    Decimal_BE.prototype.sqr = function () {
      return this.pow(2);
    };

    Decimal_BE.prototype.sqrt = function () {
      if (this.layer == 0) { return D(Math.sqrt(this.sign*this.mag)); }
      else if (this.layer == 1) { return FC(1, 2, Math.log10(this.mag)-0.3010299956639812); }
      else
      {
        var result = Decimal_BE.div(FC_NN(this.sign, this.layer-1, this.mag), FC_NN(1, 0, 2));
        result.layer += 1;
        result.normalize();
        return result;
      }
    };

    Decimal_BE.prototype.cube = function () {
      return this.pow(3);
    };

    Decimal_BE.prototype.cbrt = function () {
      return this.pow(1/3);
    };
    
    Decimal_BE.prototype.tetrate = function(height = 2, payload = FC_NN(1, 0, 1)) {
      payload = D(payload);
      var oldheight = height;
      height = Math.trunc(height);
      var fracheight = oldheight-height;
      if (fracheight != 0)
      {
        ++height;
        payload = Decimal_BE.pow(fracheight, payload);
      }
      
      //special case: if height is 0, return 1
      if (height == 0) { return FC_NN(1, 0, 1); }
      //special case: if this is 10, return payload with layer increases by height
      if (this.sign == 1 && this.layer == 0 && this.mag == 10) { return FC(payload.sign, payload.layer + height, payload.mag); }
      
      for (var i = 0; i < height; ++i)
      {
        payload = this.pow(payload);
        //bail if we're NaN
        if (!isFinite(payload.layer) || !isFinite(payload.mag)) { return payload; }
        //shortcut 
        if (payload.layer - this.layer > 3) { return FC_NN(payload.sign, payload.layer + (height - i - 1), payload.mag); }
        //give up after 100 iterations if nothing is happening
        if (i > 100) { return payload; }
      }
      return payload;
    }
    
    Decimal_BE.prototype.pentate = function(height = 2, payload = FC_NN(1, 0, 1)) {
      payload = D(payload);
      height = Math.trunc(height);
      
      //special case: if height is 0, return 1
      if (height == 0) { return FC_NN(1, 0, 1); }
      
      for (var i = 0; i < height; ++i)
      {
        payload = this.tetrate(payload);
        //bail if we're NaN
        if (!isFinite(payload.layer) || !isFinite(payload.mag)) { return payload; }
        //give up after 10 iterations if nothing is happening
        if (i > 10) { return payload; }
      }
      return payload;
    }
    
    // trig functions!
    Decimal_BE.prototype.sin = function () {
      if (this.layer === 0) { return D(Math.sin(this.sign*this.mag)); }
      return FC_NN(0, 0, 0);
    };

    Decimal_BE.prototype.cos = function () {
      if (this.layer === 0) { return D(Math.cos(this.sign*this.mag)); }
      return FC_NN(0, 0, 0);
    };

    Decimal_BE.prototype.tan = function () {
      if (this.layer === 0) { return D(Math.tan(this.sign*this.mag)); }
      return FC_NN(0, 0, 0);
    };

    Decimal_BE.prototype.asin = function () {
      if (this.layer === 0) { return D(Math.asin(this.sign*this.mag)); }
      return FC_NN(Number.NaN, Number.NaN, Number.NaN);
    };

    Decimal_BE.prototype.acos = function () {
      if (this.layer === 0) { return D(Math.acos(this.sign*this.mag)); }
      return FC_NN(Number.NaN, Number.NaN, Number.NaN);
    };

    Decimal_BE.prototype.atan = function () {
      if (this.layer === 0) { return D(Math.atan(this.sign*this.mag)); }
      return D(Math.atan(this.sign*1.8e308));
    };

    Decimal_BE.prototype.sinh = function () {
      return this.exp().sub(this.negate().exp()).div(2);
    };

    Decimal_BE.prototype.cosh = function () {
      return this.exp().add(this.negate().exp()).div(2);
    };

    Decimal_BE.prototype.tanh = function () {
      return this.sinh().div(this.cosh());
    };

    Decimal_BE.prototype.asinh = function () {
      return Decimal_BE.ln(this.add(this.sqr().add(1).sqrt()));
    };

    Decimal_BE.prototype.acosh = function () {
      return Decimal_BE.ln(this.add(this.sqr().sub(1).sqrt()));
    };

    Decimal_BE.prototype.atanh = function () {
      if (this.abs().gte(1)) {
        return FC_NN(Number.NaN, Number.NaN, Number.NaN);
      }

      return Decimal_BE.ln(this.add(1).div(D(1).sub(this))).div(2);
    };
    
    /**
     * Joke function from Realm Grinder
     */
    Decimal_BE.prototype.ascensionPenalty = function (ascensions) {
      if (ascensions === 0) {
        return this;
      }

      return this.pow(Math.pow(10, -ascensions));
    };
    
    /**
     * Joke function from Cookie Clicker. It's 'egg'
     */
    Decimal_BE.prototype.egg = function () {
      return this.add(9);
    };
    
    Decimal_BE.prototype.lessThanOrEqualTo = function (other) {
      return this.cmp(other) < 1;
    };

    Decimal_BE.prototype.lessThan = function (other) {
      return this.cmp(other) < 0;
    };

    Decimal_BE.prototype.greaterThanOrEqualTo = function (other) {
      return this.cmp(other) > -1;
    };

    Decimal_BE.prototype.greaterThan = function (other) {
      return this.cmp(other) > 0;
    };

    return Decimal_BE;
  }();

  return Decimal_BE;

}));