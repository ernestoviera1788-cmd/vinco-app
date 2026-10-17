import { Audio } from 'expo-av';

/**
 * New-message ding. Best-effort: never throws, never blocks.
 * Plays even with the iOS silent switch on, so the user actually hears it.
 */

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    audioModeReady = true;
  }
}

export async function playMessageSound(): Promise<void> {
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../assets/sounds/message.wav'),
      { shouldPlay: true },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    /* silent: a missing sound must never break the chat */
  }
}
