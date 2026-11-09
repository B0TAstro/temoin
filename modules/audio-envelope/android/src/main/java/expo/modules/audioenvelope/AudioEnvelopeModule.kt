package expo.modules.audioenvelope

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.sqrt

private const val TIMEOUT_US = 10_000L

class AudioEnvelopeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioEnvelope")

    AsyncFunction("read") { path: String, windowMs: Double ->
      readEnvelope(path.removePrefix("file://"), windowMs)
    }
  }
}

private fun readEnvelope(path: String, windowMs: Double): List<Double> {
  val extractor = MediaExtractor()
  try {
    extractor.setDataSource(path)
    val track = (0 until extractor.trackCount).firstOrNull {
      extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    } ?: return emptyList()
    extractor.selectTrack(track)
    val format = extractor.getTrackFormat(track)
    val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
    codec.configure(format, null, null, 0)
    codec.start()
    try {
      return decode(extractor, codec, windowMs)
    } finally {
      codec.stop()
      codec.release()
    }
  } finally {
    extractor.release()
  }
}

/** Feeds the AAC track to the decoder and folds the PCM it gives back into one RMS per window. */
private fun decode(extractor: MediaExtractor, codec: MediaCodec, windowMs: Double): List<Double> {
  val envelope = mutableListOf<Double>()
  val info = MediaCodec.BufferInfo()
  var inputDone = false
  var channels = 1
  var isFloat = false
  var window = 0
  var sum = 0.0
  var count = 0

  fun readOutputFormat() {
    val out = codec.outputFormat
    channels = max(1, out.getInteger(MediaFormat.KEY_CHANNEL_COUNT))
    isFloat = out.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
      out.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
    window = max(1, (out.getInteger(MediaFormat.KEY_SAMPLE_RATE) * windowMs / 1000).toInt())
  }

  fun add(sample: Double) {
    sum += sample * sample
    count++
    if (count == window) {
      envelope.add(sqrt(sum / count))
      sum = 0.0
      count = 0
    }
  }

  while (true) {
    if (!inputDone) {
      val inIndex = codec.dequeueInputBuffer(TIMEOUT_US)
      if (inIndex >= 0) {
        val size = extractor.readSampleData(codec.getInputBuffer(inIndex)!!, 0)
        if (size < 0) {
          codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
          inputDone = true
        } else {
          codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
          extractor.advance()
        }
      }
    }

    val outIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)
    if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
      readOutputFormat()
    } else if (outIndex >= 0) {
      if (window == 0) readOutputFormat()
      val buffer = codec.getOutputBuffer(outIndex)!!.order(ByteOrder.nativeOrder())
      buffer.position(info.offset)
      buffer.limit(info.offset + info.size)
      // Channels are interleaved: average them into one mono sample.
      if (isFloat) {
        val samples = buffer.asFloatBuffer()
        while (samples.remaining() >= channels) {
          var frame = 0.0
          repeat(channels) { frame += samples.get() }
          add(frame / channels)
        }
      } else {
        val samples = buffer.asShortBuffer()
        while (samples.remaining() >= channels) {
          var frame = 0.0
          repeat(channels) { frame += samples.get() / 32768.0 }
          add(frame / channels)
        }
      }
      codec.releaseOutputBuffer(outIndex, false)
      if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
    }
  }
  return envelope
}
