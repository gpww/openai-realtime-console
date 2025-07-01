/**
 * AudioWorklet processor code - kept as string for dynamic loading
 * This code runs in the AudioWorklet thread, separate from main thread
 */
const AUDIO_PROCESSOR_CODE = `
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 960; // 60ms @ 16kHz
    this.buffer = new Int16Array(this.frameSize);
    this.bufferIndex = 0;
    this.isRecording = false;
    
    // Listen for commands from main thread
    this.port.onmessage = (event) => {
      const { command } = event.data;
      
      switch (command) {
        case 'start':
          this.isRecording = true;
          this.port.postMessage({ type: 'status', message: 'Recording started' });
          break;
          
        case 'stop':
          this.isRecording = false;
          // Send any remaining buffered data
          if (this.bufferIndex > 0) {
            this.port.postMessage({
              type: 'audioData',
              buffer: this.buffer.slice(0, this.bufferIndex)
            });
            this.bufferIndex = 0;
          }
          this.port.postMessage({ type: 'status', message: 'Recording stopped' });
          break;
      }
    };
  }
  
  process(inputs, outputs, parameters) {
    if (!this.isRecording) return true;
    
    const input = inputs[0]?.[0]; // First channel of first input
    if (!input) return true;
    
    // Convert float32 samples to int16 and buffer them
    for (let i = 0; i < input.length; i++) {
      // Fill buffer frame by frame
      if (this.bufferIndex >= this.frameSize) {
        // Buffer full, send to main thread and reset
        this.port.postMessage({
          type: 'audioData',
          buffer: this.buffer.slice(0) // Copy the buffer
        });
        this.bufferIndex = 0;
      }
      
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, input[i]));
      this.buffer[this.bufferIndex++] = Math.floor(sample * (sample < 0 ? 0x8000 : 0x7FFF));
    }
    
    return true; // Keep processor alive
  }
}

// Register the processor with AudioWorklet
registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
`;

/**
 * Native Audio Recorder using Web Audio API with better compatibility
 */
export class NativeAudioRecorder {
    constructor(options = {}) {
        this.sampleRate = options.recordingSampleRate || options.sampleRate || 16000; // 确保支持两种参数名
        this.channels = options.channels || 1;
        this.frameSize = options.frameSize || 960; // 60ms @ 16kHz

        this.audioContext = null;
        this.mediaStream = null;
        this.audioSource = null;
        this.audioProcessor = null;
        this.analyser = null;
        this.isRecording = false;
        this.onDataCallback = null;
    }

    async begin() {
        try {
            // Request microphone with echo cancellation
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.sampleRate,
                    channelCount: this.channels
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate,
                latencyHint: 'interactive'
            });

            // Create audio source and analyser
            this.audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.audioSource.connect(this.analyser);

            // Create audio processor
            await this.createAudioProcessor();

            console.log('NativeAudioRecorder initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize NativeAudioRecorder:', error);
            throw error;
        }
    }

    async createAudioProcessor() {
        try {
            if (this.audioContext.audioWorklet) {
                // Use modern AudioWorklet (preferred)
                await this.createAudioWorkletProcessor();
            } else {
                // Fallback to legacy ScriptProcessorNode
                this.createScriptProcessor();
            }
        } catch (error) {
            console.warn('AudioWorklet failed, falling back to ScriptProcessor:', error);
            this.createScriptProcessor();
        }
    }

    async createAudioWorkletProcessor() {
        // Convert processor code string to a loadable module
        const blob = new Blob([AUDIO_PROCESSOR_CODE], { type: 'application/javascript' });
        const processorUrl = URL.createObjectURL(blob);

        try {
            // Load the processor module into AudioWorklet
            await this.audioContext.audioWorklet.addModule(processorUrl);

            // Create the processor node
            this.audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor');

            // Handle messages from the processor
            this.audioProcessor.port.onmessage = (event) => {
                const { type, buffer, message } = event.data;

                if (type === 'audioData' && this.onDataCallback) {
                    this.onDataCallback({ mono: buffer });
                } else if (type === 'status') {
                    console.log('AudioWorklet:', message);
                }
            };

            // Connect the audio chain
            this.audioSource.connect(this.audioProcessor);

            console.log('Using AudioWorklet for recording');
        } finally {
            // Clean up the blob URL
            URL.revokeObjectURL(processorUrl);
        }
    }

    createScriptProcessor() {
        // Legacy fallback for older browsers
        this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.audioProcessor.onaudioprocess = (event) => {
            if (!this.isRecording) return;

            const input = event.inputBuffer.getChannelData(0);
            const buffer = new Int16Array(input.length);

            // Convert float32 to int16
            for (let i = 0; i < input.length; i++) {
                const sample = Math.max(-1, Math.min(1, input[i]));
                buffer[i] = Math.floor(sample * (sample < 0 ? 0x8000 : 0x7FFF));
            }

            if (this.onDataCallback) {
                this.onDataCallback({ mono: buffer });
            }
        };

        this.audioSource.connect(this.audioProcessor);

        // Connect to a silent output to prevent garbage collection
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        this.audioProcessor.connect(silentGain);
        silentGain.connect(this.audioContext.destination);

        console.log('Using ScriptProcessorNode for recording (fallback)');
    }

    async record(callback) {
        if (this.isRecording) return;

        this.onDataCallback = callback;
        this.isRecording = true;

        // Send start command to AudioWorklet processor
        if (this.audioProcessor && this.audioProcessor.port) {
            this.audioProcessor.port.postMessage({ command: 'start' });
        }

        console.log('Recording started');
    }

    async pause() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Send stop command to AudioWorklet processor
        if (this.audioProcessor && this.audioProcessor.port) {
            this.audioProcessor.port.postMessage({ command: 'stop' });
        }

        console.log('Recording paused');
    }

    async end() {
        this.isRecording = false;

        if (this.audioProcessor) {
            if (this.audioProcessor.port) {
                this.audioProcessor.port.postMessage({ command: 'stop' });
            }
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }

        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        console.log('Recording ended and cleaned up');
    }

    get recording() {
        return this.isRecording;
    }

    getFrequencies(type = 'voice') {
        if (!this.analyser) {
            return { values: new Float32Array([0]) };
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Convert to Float32Array and normalize
        const values = new Float32Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
            values[i] = dataArray[i] / 255.0;
        }

        return { values };
    }
}

/**
 * Native Audio Player using Web Audio API with streaming support
 */
export class NativeAudioPlayer {
    constructor(options = {}) {
        this.sampleRate = options.playbackSampleRate || options.sampleRate || 24000; // 确保支持两种参数名
        this.channels = options.channels || 1;

        this.audioContext = null;
        this.analyser = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.currentSource = null;
        this.onPlayCallback = null;
        this.onEndedCallback = null;
    }

    async connect() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.connect(this.audioContext.destination);

            console.log('NativeAudioPlayer connected successfully');
            return true;
        } catch (error) {
            console.error('Failed to connect NativeAudioPlayer:', error);
            throw error;
        }
    }

    add16BitPCM(audioData, trackId) {
        const audioBuffer = {
            data: audioData,
            trackId: trackId,
            timestamp: Date.now()
        };

        this.audioQueue.push(audioBuffer);

        if (!this.isPlaying) {
            this.playNext();
        }
    }

    async playNext() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            if (this.onEndedCallback) {
                this.onEndedCallback();
            }
            return;
        }

        this.isPlaying = true;

        if (this.onPlayCallback) {
            this.onPlayCallback();
        }

        const audioBuffer = this.audioQueue.shift();

        try {
            // Convert Int16Array to Float32Array
            const float32Data = new Float32Array(audioBuffer.data.length);
            for (let i = 0; i < audioBuffer.data.length; i++) {
                float32Data[i] = audioBuffer.data[i] / (audioBuffer.data[i] < 0 ? 0x8000 : 0x7FFF);
            }

            // Create audio buffer
            const buffer = this.audioContext.createBuffer(this.channels, float32Data.length, this.sampleRate);
            buffer.copyToChannel(float32Data, 0);

            // Create source
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = buffer;

            // Create gain node for smooth transitions
            const gainNode = this.audioContext.createGain();
            const fadeDuration = 0.01; // 10ms fade

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + fadeDuration);

            const duration = buffer.duration;
            if (duration > fadeDuration * 2) {
                gainNode.gain.setValueAtTime(1, this.audioContext.currentTime + duration - fadeDuration);
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
            }

            // Connect and play
            this.currentSource.connect(gainNode);
            gainNode.connect(this.analyser);

            this.currentSource.onended = () => {
                this.currentSource = null;
                // 立即播放下一个音频片段，不延迟
                // 使用 requestAnimationFrame 确保在下一个渲染帧执行，但没有固定延迟
                if (this.audioQueue.length > 0) {
                    requestAnimationFrame(() => this.playNext());
                } else {
                    // 如果队列为空，等待短暂时间看是否有新数据到达
                    setTimeout(() => {
                        if (this.audioQueue.length > 0) {
                            this.playNext();
                        } else {
                            this.isPlaying = false;
                            if (this.onEndedCallback) {
                                this.onEndedCallback();
                            }
                        }
                    }, 5); // 减少到5ms的最小延迟
                }
            };

            this.currentSource.start();

        } catch (error) {
            console.error('Failed to play audio:', error);
            // Continue with next in queue with minimal delay
            requestAnimationFrame(() => this.playNext());
        }
    }

    async interrupt() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (error) {
                console.warn('Error stopping current audio source:', error);
            }
            this.currentSource = null;
        }

        // Clear the queue
        this.audioQueue = [];
        this.isPlaying = false;

        return { trackId: null, offset: 0 };
    }

    getFrequencies(type = 'voice') {
        if (!this.analyser) {
            return { values: new Float32Array([0]) };
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Convert to Float32Array and normalize
        const values = new Float32Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
            values[i] = dataArray[i] / 255.0;
        }

        return { values };
    }

    set onplay(callback) {
        this.onPlayCallback = callback;
    }

    set onended(callback) {
        this.onEndedCallback = callback;
    }
}
