const applyConcToCaster = async function (caster, duration) {

	let data = {
		"flags": {
			"core": {
				"statusId": "concentrating"
			}
		},
		"changes": [],
		"duration": duration,
		"icon": "modules/simple-5econs/icons/concentrating.svg",
		"label": "Concentrating"
	};
	await caster.createEmbeddedEntity("ActiveEffect", data);
}

const postMessageToChat = async ({ effectTitle, notes, rounds, currentRound, userId, actor }) => {

	const content = `<h2>${effectTitle}</h2>
	<p>${notes}</p>
	<p>${rounds} rounds</p>
	<p>Will be done in round ${currentRound + rounds}</p>`;

	ChatMessage.create({
		user: userId,
		speaker: ChatMessage.getSpeaker({ token: actor }),
		content
	});
}

const setTimerX = async function (actor, effectTitle, relativeTo, concToCaster, roundsAsString, notes) {
	let effect = await actor.effects.find(ef => ef.data.label === effectTitle);
	if (!effect) {
		ui.notifications.error("Something went wrong! Effect was not found on the token.");
		return;
	}
	const rounds = parseInt(roundsAsString);

	let currentRound = game.combat.current.round;
	let currentTurn = game.combat.current.turn;
	let duration = {
		rounds,
		turns: 1,
		startTurn: relativeTo,
		startRound: relativeTo <= currentTurn ? currentRound : currentRound - 1
	};
	console.log(duration);
	effect.update({ duration: duration });
	postMessageToChat({ effectTitle, notes, rounds, userId: game.user._id, actor });
	if (concToCaster) {
		applyConcToCaster(await game.combat.turns[relativeTo].actor, duration);
	};

}

const setTimerEndOfTurn = async function (actor, effectTitle, relativeTo, concToCaster, notes) {
	let effect = await actor.effects.find(ef => ef.data.label === effectTitle);
	if (!effect) {
		ui.notifications.error("Something went wrong! Effect was not found on the token.");
		return;
	}
	let currentRound = game.combat.current.round;
	let currentTurn = game.combat.current.turn;
	let duration = {
		turns: game.combat.turns.length + 1,
		rounds: 0,
		startTurn: relativeTo,
		startRound: relativeTo <= currentTurn ? currentRound : currentRound - 1
	};
	effect.update({ duration: duration });
	postMessageToChat({ effectTitle, notes, rounds: 1, userId: game.user._id, actor });

	if (concToCaster) {
		applyConcToCaster(await game.combat.turns[relativeTo].actor, duration);
	};
}


const popDialog = function (event, actor) {

	if (!game.combat) {
		ui.notifications.warn("Status effect timer module can only be used in combat. This is a subject to change.");
		return;
	}

	let fighterOptions = game.combat.turns
		.map((fighter, turn) => `<option value="${turn}"><img src=${fighter.img}>  ${fighter.name} </option>`)
		.join(``);

	$(function () {
		var defaultSelected = game.combat.turn;
		$("#relativeToSelector").val(defaultSelected);
	});

	let cont = `Relative to: <select name="relativeToSelector" id="relativeToSelector">${fighterOptions}</select>
	<br/><input type="checkbox" name="applyConc" id="applyConc"/> apply to ⇑them⇑ a concentration effect for the same duration.
	<br/><input type="number" name="duration" id="duration" placeholder="Duration in rounds"/>
	<br/><input type="text" name="notes" id="notes" placeholder="Notes, ie 1d6 bleed damage"/>
	<br/>`;

	new Dialog({
		title: "Select duration",
		content: cont,
		buttons: {
			a: {
				label: "End of next turn",
				callback: (html) => {
					setTimerEndOfTurn(
						actor,
						event.currentTarget.title,
						document.getElementById("relativeToSelector").value,
						document.getElementById("applyConc").checked,
						document.getElementById("notes").value);
				},
			},
			b: {
				label: "set rounds",
				callback: (html) => {
					setTimerX(
						actor,
						event.currentTarget.title,
						document.getElementById("relativeToSelector").value,
						document.getElementById("applyConc").checked,
						document.getElementById("duration").value,
						document.getElementById("notes").value)
				},
			}
		},
		default: "a",
	}).render(true)
}

Hooks.on("ready", function () {
	let originalToggle = TokenHUD.prototype._onToggleEffect;
	TokenHUD.prototype._onToggleEffect = (function (event, overlay) {
		originalToggle.bind(this);
		if (event.shiftKey) {
			popDialog(event, this.object.actor);
		}
		return originalToggle.bind(this)(event, overlay);
	});
});

const removeFinishedEffects = async function () {
	game.combat.turns.forEach(
		fighter => {
			[...fighter.actor.effects
				.filter(e => e.duration.remaining != null && e.duration.remaining <= 0)]
				.forEach(async (e) => { e.delete() })
		}
	);
}


let lastTurnProcessed = -1;
Hooks.on("getCombatTrackerEntryContext", () => {
	if (lastTurnProcessed != game.combat.turn) {
		lastTurnProcessed = game.combat.turn;
		removeFinishedEffects();
	}
}
);
