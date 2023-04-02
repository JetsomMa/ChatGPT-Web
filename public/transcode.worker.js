/*
 * @Autor: lycheng
 * @Date: 2020-01-07 08:51:50
 */

(function () {
  self.onmessage = function (e) {
    transAudioData.transcode(e.data)
  }

  let transAudioData = {
    transcode(audioData) {
      let output = transAudioData.to16kHz(audioData)
      output = transAudioData.to16BitPCM(output)
      output = Array.from(new Uint8Array(output.buffer))
      self.postMessage(output)
    },
    to16kHz(audioData) {
      const data = new Float32Array(audioData)
      const fitCount = Math.round(data.length * (16000 / 44100))
      const newData = new Float32Array(fitCount)
      const springFactor = (data.length - 1) / (fitCount - 1)
      newData[0] = data[0]
      for (let i = 1; i < fitCount - 1; i++) {
        const tmp = i * springFactor
        const before = Math.floor(tmp).toFixed()
        const after = Math.ceil(tmp).toFixed()
        const atPoint = tmp - before
        newData[i] = data[before] + (data[after] - data[before]) * atPoint
      }
      newData[fitCount - 1] = data[data.length - 1]
      return newData
    },
    to16BitPCM(input) {
      const dataLength = input.length * (16 / 8)
      const dataBuffer = new ArrayBuffer(dataLength)
      const dataView = new DataView(dataBuffer)
      let offset = 0
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]))
        dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      }
      return dataView
    },
  }
})()
