// Speech service — removed expo-speech-recognition (caused native crashes).
// Voice input now works through Gboard's built-in mic via TextInput.
export function getExpoSpeechRecognitionModule() {
  return null;
}
export const useSpeechRecognitionEvent = (_event, _cb) => {};
