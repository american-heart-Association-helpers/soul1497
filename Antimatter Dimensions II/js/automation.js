var currencyNames = ["infinityPoints"]

function Extension(s = 1, c, u = "infinityPoints", l = 0, m = 1) {
	var extension = {
		id: au.extensions.length,
		level: new Decimal(l),
		cost: new Decimal(c).multiply(Decimal.pow(2, l)),
		currency: u,
		charge: 0,
		speed: new Decimal(s).multiply(Decimal.pow(2, l)),
		baseSpeed: new Decimal(s),
		mode: m,
		
		getMode: function() {
			var f = au.forcedStates[Math.floor(this.id / 15)];
			return f ? f-1 : this.mode
		}
	}
	
	return extension;
}

function canUpgradeAutomator() {
	var max = haveInfinitied() + haveEternitied();
	return au.class < max;
}

function upgradeAutomator() {
	if(!canUpgradeAutomator()) return;
	au.class++;
}

function upgradeExtension(n) {
	if(game[au.extensions[n].currency].lt(au.extensions[n].cost)) return;
	if(au.extensions[n].level.gte(2**au.class*10)) return;
	game[au.extensions[n].currency] = game[au.extensions[n].currency].subtract(au.extensions[n].cost);
	au.extensions[n].cost = au.extensions[n].cost.multiply(2);
	au.extensions[n].level = au.extensions[n].level.add(1);
	au.extensions[n].speed = au.extensions[n].speed.multiply(2);
}

function fireExtension(i, a, b, c, d, e, f) {
	var ext = au.extensions[i]
	if(ext.charge < 1) return;
	if(!ext.getMode()) return;
	
	if(autobuyerFunctions[i](a, b, c, d, e, f)) ext.charge -= 1;
}

function db(i, b, d = "") {
	if(b) return window["max" + d + "Dimension"](i)
	else return window["buy" + d + "Dimension"](i)
}

var autobuyerFunctions = [
	function(b) {return db(1, b)},
	function(b) {return db(2, b)},
	function(b) {return db(3, b)},
	function(b) {return db(4, b)},
	function(b) {return db(5, b)},
	function(b) {return db(6, b)},
	function(b) {return db(7, b)},
	function(b) {return db(8, b)},
	function(b) {return db(9, b)},
	function(b) {
		if(b) return maxTickspeed(b);
		else return buyTickspeed();
	},
	function() {
		if(shift()) return true;
		return boost();
	},
	function() {
		return galaxy();
	},
	function() {
		return sacrifice();
	},
	function() {
		return bigCrunch();
	},
	function() {
		return buyRepeatInf(0);
	},
	function(b) {return db(1, b, "Infinity")},
	function(b) {return db(2, b, "Infinity")},
	function(b) {return db(3, b, "Infinity")},
	function(b) {return db(4, b, "Infinity")},
	function(b) {return db(5, b, "Infinity")},
	function(b) {return db(6, b, "Infinity")},
	function(b) {return db(7, b, "Infinity")},
	function(b) {return db(8, b, "Infinity")},
	function(b) {return db(9, b, "Infinity")},
	function() {
		return maxInfinityShift();
	},
	function() {
		return eternity();
	}
]

function getExtByName(name) {
	
}

function extUnlocked(c) {
	if(c < 12) return challengeCompleted(c+1, 0);
	if(c == 12) return challengeCompleted(2, 1);
	if(c == 13) return canBreakInfinity() || game.break || haveEternitied();
	if(c == 14) return eternityMilestone("ipMult");
	if(c > 14 && c < 24) return eternityMilestone("iAuto" + (c-14));
	if(c == 24) return eternityMilestone("iShift");
	if(c == 25) return eternityMilestone("etAuto");
}

function ccmd(a, b, c) {
	if(a !== b) return;
	switch(a) {
		case "fire":
			return extUnlocked(c)
	}
	return true;
}

function runAu(line, log, explicit=true) {
	try {
		var args = line.split(" ")
		var cmd = args[0];
		var args2 = [...args]
		args2.shift(1);
		var arg = args2.join(" ")
		args2.shift(1);
		var arg2 = args2.join(" ")
		
		if(cmd == "cls") {
			ge("auLog").innerHTML = ""
		}
		if(cmd == "echo") { // write something in the console
			if(!args[1]) return;
			logAu(arg)
		}
		if(cmd == "extension") { // modify extensions
			if(!isNaN(parseInt(args[1]))) e = args[1];
			else if(getExtByName(args[1])) e = getExtByName(args[1]);
			else {
				if(log) logAu("Invalid extension.")
				return;
			}
			
			if(log) logAu("This command is incomplete and currently useless.")
		}
		if(cmd == "fire") { // activate extensions
			if(!isNaN(parseInt(args[1]))) e = args[1];
			else if(getExtByName(args[1])) e = getExtByName(args[1]);
			else {
				if(log) logAu("Invalid extension.")
				return;
			}
			
			fireExtension(e, args[2] == "true")
			if(log) logAu("Activated extension " + e + ".")
		}
		if(cmd == "get") {
			arg = arg.replace(/ /g, "")
			var r = au.memory[arg];
			if(new Decimal("e" + r).mag) r = new Decimal(r);
			else if(parseFloat(r)) r = parseFloat(r);
			if(log) logAu(r)
			return r;
		}
		if(cmd == "help") {
			logAu("AUTOMATOR HELP")
			if(!args[1]) {
				logAu("Welcome to the help menu.")
				logAu("Type [help h] for an explanation of the Automator.")
				logAu("Type [help t] for a tutorial on how to use it effectively.")
				logAu("Type [help l] for a list of commands.")
			}
			if(args[1] == "h") {
				logAu("General Info")
				logAu("The Automator is a metaprogram that helps with the automation of tasks. Its heart is the Automator Core, which sends signals to its Extensions to interact with various aspects of reality.")
				logAu("Type [help c] for more information about the Core.")
				logAu("Type [help e] for more information about Extensions.")
			}
			if(args[1] == "t") {
				logAu("Tutorial (WIP)")
				logAu("The basic function of the Automator is to run a series of commands, which can be entered to the left. You can also type commands in the interface below, which can be useful for testing or checking values.")
				logAu("The fire command is arguably the most important. It is used to trigger an extension specified by its ID, which can be found by hovering over the name of the extension. For example, running the command [fire 0] would activate the first dimension autobuyer.")
				logAu("There are also a few shortcut commands, such as [maxall], which activates all of the dimension autobuyers for a specific layer. For more info about specific commands, type [help l].")
			}
			if(args[1] == "l") {
				logAu("Command List")
				logAu("boost            Activates extension 10.")
				logAu("challenge        Several commands that interact with challenges.")
				logAu("cls              Clears the Automator panel.")
				logAu("crunch           Activates extension 13.")
				logAu("echo <t>         Writes t in the Automator panel.")
				if(haveEternitied())
				logAu("eternity         Activates extension 24.")
				logAu("fire <n>         Activates extension n.")
				logAu("galaxy           Activates extension 11.")
				logAu("help [t]         Displays help page t.")
				logAu("if <c>           Runs the next line only if c is true.")
				logAu("infinity         Activates extension 13.")
				logAu("maxall           Activates extensions 0-9 in order.")
				logAu("maxall [n]       Activates extensions 0-8 plus 15n in order.")
				logAu("pause <n>        Pauses script for n milliseconds.")
				logAu("pause <n> t      Pauses script for n ticks.")
				logAu("run <f>          Runs the Automator script saved as f.")
				logAu("sacrifice        Activates extension 12.")
			}
			if(args[1] == "c") {
				logAu("The Core")
				logAu("The Core is the main component of the Automator, capable of running many commands and simple programs written by the user. Upon reaching certain requirements, the Core can be upgraded to improve its performance and gain access to more functions and Extensions.")
			}
			if(args[1] == "e") {
				logAu("Extensions")
				logAu("Extensions are components of the Automator that it uses to interact with reality. Each Extension will slowly gain charge over time, up to a maximum amount determined by the Core's class. Upon being activated by the Core, they will use their charge to perform a designated function. They can be upgraded to increase their charging speed.")
			}
			if(args[1] == "") {
				
			}
		}
		if(cmd == "if") {
			if(!arg) return;
			var operators = "==,<,>,<=,>=,!==".split(",")
			var split, operator;
			operators.forEach(function(op) {if(operator) return; if(arg.includes(op)) {split = arg.split(op); operator = op}})
			if(!split) return;
			split[0] = split[0].replace(/ /g, "")
			split[1] = split[1].replace(/ /g, "")
			var t1 = (split[0][0]==split[0][split[0].length-1]&&split[0][0]=="%") ? 
					runAu("get " + split[0].substring(1, split[0].length - 1)) : 
					runAu("parse " + split[0]), 
				t2 = (split[1][0]==split[1][split[1].length-1]&&split[1][0]=="%") ? 
					runAu("get " + split[1].substring(1, split[1].length - 1)) : 
					runAu("parse " + split[1])
			
			if(t1 instanceof Decimal) {
				newOp = {"==":"eq","<":"lt",">":"gt","<=":"lte",">=":"gte"}[operator];
				out = t1[newOp](t2)
			}
			else out = eval(t1 + operator + t2);
			if(log) logAu(arg + " is " + out)
			return out
		}
		if(cmd == "parse") {
			var r = arg;
			if(new Decimal("e" + r).mag) r = new Decimal(r);
			else if(parseFloat(r)) r = parseFloat(r);
			else r = '"' + r + '"'
			if(log) logAu(r)
			return r;
		}
		if(cmd == "pause" || cmd == "wait") { // stops until a condition is met or time elapses
			if(args[1] == "until") {
				au.waitUntil = arg2;
			}
			else {
				t = parseInt(args[1])
				if(isNaN(t)) t = 0
				if(args[2] == "t" || args[2] == "tick" || args[2] == "ticks") { // ticks
					au.currentScript.tickDelay += t
					if(log) logAu("Paused for " + t + "ticks.")
				}
				else { // milliseconds
					au.currentScript.delay += t;
					if(log) logAu("Paused for " + t + "milliseconds.")
				}
			}
		}
		if(cmd == "run") { // write something in the console
			runAuScript(args[1] || "CURRENT")
		}
		if(cmd == "set") {
			au.memory[args[1]] = arg2
			if(log) logAu("Set " + args[1] + " to " + arg2)
		}
	
		// Game-related commands
		
		if(cmd == "challenge") { // enter/exit/unlock challenges
			if(args[1] == "exit") exitChallenge();
		}
		if(cmd == "maxall") {
			var s = parseInt(args[1]) || 0;
			for(var i = 0; i < 10-!!s; i++) runAu("fire " + (i+s*15) + " true")
			if(log) logAu("Maxed all " + layerNames[i] + "dimensions.")
		}
		if(cmd == "boost") runAu("fire 10", log)
		if(cmd == "galaxy") runAu("fire 11", log)
		if(cmd == "infinity" || cmd == "crunch") runAu("fire 13", log)
		if(cmd == "sacrifice") runAu("fire 12", log)
		if(cmd == "eternity") runAu("fire 25", log)
	}
	catch(e) {
		console.error(e)
		logAu("<span style = 'color: #f00'>" + e.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</span>", true)
	}
}

function logAu(t, h) {
	if(h) ge("auLog").innerHTML += t;
	else ge("auLog").innerText += t;
	ge("auLog").innerHTML += "<br>";
}

function runAuScript(name) {
	var script = au.save[name];
	if(script.running) return;
	script.running = true;
}

function selectFileOption() {
	var option = ge("fileOptions").value;
	au.file[option]();
	ge("fileOptions").value = "File"
}

function selectRunOption() {
	var option = ge("runOptions").value;
	au.run[option]();
	ge("runOptions").value = "Run"
}

function openFileMenu(name) {
	ge("fileMenu").style.transform = "scale(1, 1)"
	ge("fileMenu").style.opacity = 1;
	ge("fileMenu").style.pointerEvents = "";
	ge("fileMenuHeader").innerText = ge("fileButton").innerText = name;
	updateFileButton()
	
	ge("fileMenuFiles").innerHTML = "";
	
	var files = [];
		
	for(var id in au.save) {
		files.push(au.save[id])
	}
	
	files.sort((a, b) => a.name.localeCompare(b.name))
	var h = `
		<tr>
			<td style = "width: 70%">Name</td>
			<td style = "width: 25%">Date Modified</td>
			<td style = "width: 20%">Size</td>
		</tr>`
	
	for(var i = 0; i < files.length; i++) {
		file = files[i];
		h += `<tr class = "fileMenuFile" onclick = "selectFile(${i})" ondblclick = "closeFileMenu(ge('fileName').value)"><td>${file.name}</td><td>${new Date(file.lastEdit).getTime()}</td><td>${file.script.length}</td></tr>`;
	}
	
	ge("fileMenuFiles").innerHTML += h;
}

function updateFileButton() {
	var e = au.save.hasOwnProperty(ge("fileName").value) || ge("fileMenuHeader").innerText !== "Open"
	ge("fileButton").disabled = !e;
	ge("fileButton").className = e ? "buy" : "lock"
}

function selectFile(n) {
	gc("fileMenuFileActive", function(e) {e.className = "fileMenuFile"})
	var tr = ge("fileMenuFiles").children[0].children[n+1]
	tr.className = "fileMenuFileActive";
	ge("fileName").value = tr.children[0].innerText;
	updateFileButton()
}

function onFileMenuClosed(f) {
	_onFileMenuClosed = f;
}

function closeFileMenu(name, doOnClose = true) {
	ge("fileMenu").style.transform = "scale(0.75, 0.75)"
	ge("fileMenu").style.opacity = 0;
	ge("fileMenu").style.pointerEvents = "none";
	ge("fileName").value = "";
	updateFileButton()
	
	if(doOnClose) _onFileMenuClosed(name)
}