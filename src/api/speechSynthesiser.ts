export class SpeechSynthesiser {
  static read(text: string) {
    if (speechSynthesis.speaking) {
      console.error('speechSynthesis.speaking')
      speechSynthesis.cancel()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = 1
    utterance.rate = 1
    if (window.mySpeechSynthesisvoice)
      utterance.voice = window.mySpeechSynthesisvoice

    speechSynthesis.speak(utterance)
  }
}
