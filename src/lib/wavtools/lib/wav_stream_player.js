import { StreamProcessorSrc } from './worklets/stream_processor.js';
import { AudioAnalysis } from './analysis/audio_analysis.js';

/**
 * Plays audio streams received in raw PCM16 chunks from the browser
 * @class
 */
export class WavStreamPlayer {
  /**
   * Creates a new WavStreamPlayer instance
   * @param {{sampleRate?: number}} options
   * @returns {WavStreamPlayer}
   */
  constructor({ sampleRate = 44100 } = {}) {
    this.scriptSrc = StreamProcessorSrc;
    this.sampleRate = sampleRate;
    this.context = null;
    this.stream = null;
    this.analyser = null;
    this.trackSampleOffsets = {};
    this.interruptedTrackIds = {};
  }

  /**
   * Connects the audio context and enables output to speakers
   * @returns {Promise<true>}
   */
  async connect() {
    // this.context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
    this.context = new AudioContext({ sampleRate: this.sampleRate });
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    try {
      await this.context.audioWorklet.addModule(this.scriptSrc);
    } catch (e) {
      console.error(e);
      throw new Error(`Could not add audioWorklet module: ${this.scriptSrc}`);
    }
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.1;
    this.analyser = analyser;
    return true;
  }

  /**
   * Gets the current frequency domain data from the playing track
   * @param {"frequency"|"music"|"voice"} [analysisType]
   * @param {number} [minDecibels] default -100
   * @param {number} [maxDecibels] default -30
   * @returns {import('./analysis/audio_analysis.js').AudioAnalysisOutputType}
   */
  getFrequencies(
    analysisType = 'frequency',
    minDecibels = -100,
    maxDecibels = -30
  ) {
    if (!this.analyser) {
      throw new Error('Not connected, please call .connect() first');
    }
    return AudioAnalysis.getFrequencies(
      this.analyser,
      this.sampleRate,
      null,
      analysisType,
      minDecibels,
      maxDecibels
    );
  }


  /**
   * 开始播放事件
   * @type {Function}
   */
  onplay = null;

  /**
   * 结束播放事件
   * @type {Function}
   */
  onended = null;


  /**
   * Starts audio streaming
   * @private
   * @returns {Promise<true>}
   */
  _start() {
    if (this.onplay) {
      this.onplay();
    }
    const streamNode = new AudioWorkletNode(this.context, 'stream_processor');
    streamNode.connect(this.context.destination);
    streamNode.port.onmessage = (e) => {
      const { event } = e.data;
      if (event === 'stop') {
        streamNode.disconnect();
        this.stream = null;
        if (this.onended) {
          this.onended();
        }
      } else if (event === 'offset') {
        const { requestId, trackId, offset } = e.data;
        const currentTime = offset / this.sampleRate;
        this.trackSampleOffsets[requestId] = { trackId, offset, currentTime };
      }
    };
    this.analyser.disconnect();
    streamNode.connect(this.analyser);
    this.stream = streamNode;
    return true;
  }

  /**
   * Adds 16BitPCM data to the currently playing audio stream
   * You can add chunks beyond the current play point and they will be queued for play
   * @param {ArrayBuffer|Int16Array} arrayBuffer
   * @param {string} [trackId]
   * @returns {Int16Array}
   */
  add16BitPCM(arrayBuffer, trackId = 'default') {
    if (typeof trackId !== 'string') {
      throw new Error(`trackId must be a string`);
    } else if (this.interruptedTrackIds[trackId]) {
      return;
    }
    if (!this.stream) {
      this._start();
    }
    let buffer;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer;
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = new Int16Array(arrayBuffer);
    } else if (arrayBuffer instanceof AudioBuffer) {
      const channelData = arrayBuffer.getChannelData(0);
      buffer = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        buffer[i] = channelData[i] * 0x7FFF; // Convert float to PCM16
      }
    } else {
      throw new Error(`argument must be Int16Array or ArrayBuffer`);
    }
    this.stream.port.postMessage({ event: 'write', buffer, trackId });
    return buffer;
  }

  /**
   * Adds MP3 data to the currently playing audio stream
   * @param {ArrayBuffer|Int16Array} arrayBuffer
   * @param {string} [trackId]
   * @returns {Int16Array}
   */
  addMp3(arrayBuffer, trackId = 'default') {
    let buffer;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer.buffer; // 获取底层的 ArrayBuffer
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = arrayBuffer;
    } else {
      throw new Error('mp3Data must be an Int16Array or ArrayBuffer');
    }
    let audioBuffer;
    this.context.decodeAudioData(buffer)
      .then((decodedData) => {
        audioBuffer = decodedData;
      })
      .catch((error) => {
        console.error('Error decoding audio data:', error);
      });
    if (!audioBuffer) {
      throw new Error('Failed to decode mp3Data');
    }
    return this.add16BitPCM(audioBuffer, trackId);
  }

  /**
   * Gets the offset (sample count) of the currently playing stream
   * @param {boolean} [interrupt]
   * @returns {{trackId: string|null, offset: number, currentTime: number}}
   */
  async getTrackSampleOffset(interrupt = false) {
    if (!this.stream) {
      return null;
    }
    const requestId = crypto.randomUUID();
    this.stream.port.postMessage({
      event: interrupt ? 'interrupt' : 'offset',
      requestId,
    });
    let trackSampleOffset;
    while (!trackSampleOffset) {
      trackSampleOffset = this.trackSampleOffsets[requestId];
      await new Promise((r) => setTimeout(() => r(), 1));
    }
    const { trackId } = trackSampleOffset;
    if (interrupt && trackId) {
      this.interruptedTrackIds[trackId] = true;
    }
    return trackSampleOffset;
  }

  /**
   * Strips the current stream and returns the sample offset of the audio
   * @param {boolean} [interrupt]
   * @returns {{trackId: string|null, offset: number, currentTime: number}}
   */
  async interrupt() {
    return this.getTrackSampleOffset(true);
  }
}

globalThis.WavStreamPlayer = WavStreamPlayer;
