class SoundEffects {
	constructor() {
		this.basePath = "../sounds";
		this.files = {
			start: `${this.basePath}/start.mp3`,
			coin: `${this.basePath}/coin.mp3`,
			hit: `${this.basePath}/hit.mp3`,
			gameover: `${this.basePath}/gameover.mp3`,
			pickup: `${this.basePath}/pickup.mp3`,
			jump: `${this.basePath}/jump.mp3`,
			levelup: `${this.basePath}/levelup.mp3`,
		};
		this.cache = new Map();
		this.startTrack = null;
	}

	unlock() {
		for (const key of Object.keys(this.files)) {
			this._ensureAudio(key);
		}
	}

	playStart() {
		this.stopStart();
		const audio = this._ensureAudio("start");
		if (!audio) {
			return;
		}

		audio.currentTime = 0;
		this.startTrack = audio;
		audio.play().catch(() => {});
	}

	stopStart() {
		if (!this.startTrack) {
			return;
		}

		this.startTrack.pause();
		this.startTrack.currentTime = 0;
		this.startTrack = null;
	}

	playCoin() {
		this._play("coin");
	}

	playHit() {
		this._play("hit");
	}

	playGameOver() {
		this._play("gameover");
	}

	playPickup() {
		this._play("pickup");
	}

	playJump() {
		this._play("jump");
	}

	playLevelUp() {
		this._play("levelup");
	}

	_ensureAudio(name) {
		const source = this.files[name];
		if (!source) {
			return null;
		}

		if (!this.cache.has(source)) {
			const audio = new Audio(source);
			audio.preload = "auto";
			this.cache.set(source, audio);
		}

		return this.cache.get(source) || null;
	}

	_play(name) {
		const template = this._ensureAudio(name);
		if (!template) {
			return;
		}

		const audio = template.cloneNode(true);
		audio.currentTime = 0;
		audio.play().catch(() => {});
	}
}
