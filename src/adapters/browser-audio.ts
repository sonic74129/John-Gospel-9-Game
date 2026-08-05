import type { AudioChannel, AudioFactory } from "@sonic74129/audio-runtime";

class BrowserAudioChannel implements AudioChannel {
  readonly #audio: HTMLAudioElement;

  constructor(source: string) {
    this.#audio = new Audio(source);
    this.#audio.preload = "auto";
  }

  get loop(): boolean {
    return this.#audio.loop;
  }

  set loop(value: boolean) {
    this.#audio.loop = value;
  }

  get muted(): boolean {
    return this.#audio.muted;
  }

  set muted(value: boolean) {
    this.#audio.muted = value;
  }

  get volume(): number {
    return this.#audio.volume;
  }

  set volume(value: number) {
    this.#audio.volume = value;
  }

  play(): Promise<void> {
    return this.#audio.play();
  }

  pause(): void {
    this.#audio.pause();
  }

  stop(): void {
    this.#audio.pause();
    this.#audio.currentTime = 0;
  }

  dispose(): void {
    this.stop();
    this.#audio.removeAttribute("src");
    this.#audio.load();
  }

  onEnded(listener: () => void): () => void {
    this.#audio.addEventListener("ended", listener);
    return () => this.#audio.removeEventListener("ended", listener);
  }
}

export class BrowserAudioFactory implements AudioFactory {
  create(source: string): AudioChannel {
    return new BrowserAudioChannel(source);
  }
}
