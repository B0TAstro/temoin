import AVFoundation
import ExpoModulesCore

private let sampleRate = 16_000

public final class SoundLevelsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SoundLevels")

    AsyncFunction("read") { (path: String, windowMs: Double) async throws -> [Double] in
      let url =
        path.hasPrefix("file://")
        ? (URL(string: path) ?? URL(fileURLWithPath: String(path.dropFirst(7))))
        : URL(fileURLWithPath: path)
      return try await readSoundLevels(url: url, windowMs: windowMs)
    }
  }
}

private func readSoundLevels(url: URL, windowMs: Double) async throws -> [Double] {
  let asset = AVURLAsset(url: url)
  guard let track = try await asset.loadTracks(withMediaType: .audio).first else { return [] }

  let reader = try AVAssetReader(asset: asset)
  let output = AVAssetReaderTrackOutput(
    track: track,
    outputSettings: [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: sampleRate,
      AVNumberOfChannelsKey: 1,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsNonInterleaved: false,
      AVLinearPCMIsBigEndianKey: false,
    ])
  reader.add(output)
  guard reader.startReading() else { throw reader.error ?? CocoaError(.fileReadUnknown) }

  let window = max(1, Int(Double(sampleRate) * windowMs / 1000))
  var levels: [Double] = []
  var sum = 0.0
  var count = 0
  while let buffer = output.copyNextSampleBuffer() {
    guard let block = CMSampleBufferGetDataBuffer(buffer) else { continue }
    let length = CMBlockBufferGetDataLength(block)
    var samples = [Float](repeating: 0, count: length / MemoryLayout<Float>.size)
    samples.withUnsafeMutableBytes { bytes in
      _ = CMBlockBufferCopyDataBytes(
        block, atOffset: 0, dataLength: bytes.count, destination: bytes.baseAddress!)
    }
    for sample in samples {
      sum += Double(sample * sample)
      count += 1
      if count == window {
        levels.append((sum / Double(count)).squareRoot())
        sum = 0
        count = 0
      }
    }
  }
  if reader.status == .failed { throw reader.error ?? CocoaError(.fileReadUnknown) }
  return levels
}
